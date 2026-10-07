import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type TemplateSource =
  | { kind: 'file'; file: string }
  | { kind: 'inline'; text: string; startLine: number };

export interface ComponentInfo {
  className: string;
  /** Element-name selectors only (e.g. "app-header"); attribute and class selectors are not indexed. */
  tags: string[];
  /** Repo-relative path of the TypeScript file declaring the component. */
  file: string;
  template: TemplateSource | null;
}

export interface ScanWarning {
  file: string;
  message: string;
}

const SKIP_DIRS = new Set(['node_modules', 'dist', '.angular', '.git', 'out', 'coverage', '.vscode']);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) yield* walk(full);
    else yield full;
  }
}

export function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

export function listComponentSourceFiles(root: string): string[] {
  return [...walk(root)].filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.d.ts') && !f.endsWith('.spec.ts'),
  );
}

function literalText(node: ts.Node | undefined): { text: string; exact: boolean } | null {
  if (!node || !(ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))) return null;
  // With escapes the literal's raw text differs from its value, so offsets inside it would be wrong.
  const raw = node.getText().slice(1, -1);
  return { text: node.text, exact: raw === node.text };
}

function decoratorProps(decorator: ts.Decorator): ts.ObjectLiteralExpression | null {
  const expr = decorator.expression;
  if (!ts.isCallExpression(expr)) return null;
  const callee = expr.expression;
  const name = ts.isIdentifier(callee)
    ? callee.text
    : ts.isPropertyAccessExpression(callee)
      ? callee.name.text
      : '';
  if (name !== 'Component') return null;
  const arg = expr.arguments[0];
  return arg && ts.isObjectLiteralExpression(arg) ? arg : null;
}

function prop(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name) {
      return p.initializer;
    }
  }
  return undefined;
}

export function extractComponents(
  sourceText: string,
  fileAbs: string,
  root: string,
): { components: ComponentInfo[]; warnings: ScanWarning[] } {
  const rel = toPosix(path.relative(root, fileAbs));
  const sf = ts.createSourceFile(fileAbs, sourceText, ts.ScriptTarget.Latest, true);
  const components: ComponentInfo[] = [];
  const warnings: ScanWarning[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isClassDeclaration(node)) {
      for (const dec of ts.getDecorators(node) ?? []) {
        const props = decoratorProps(dec);
        if (!props) continue;

        const selector = literalText(prop(props, 'selector'));
        const tags = (selector?.text ?? '')
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter((s) => /^[a-z][\w-]*$/.test(s));

        let template: TemplateSource | null = null;
        const url = literalText(prop(props, 'templateUrl'));
        const inlineNode = prop(props, 'template');
        const inline = literalText(inlineNode);
        if (url) {
          template = { kind: 'file', file: toPosix(path.relative(root, path.resolve(path.dirname(fileAbs), url.text))) };
        } else if (inline && inlineNode) {
          if (inline.exact) {
            const startLine = sf.getLineAndCharacterOfPosition(inlineNode.getStart()).line + 1;
            template = { kind: 'inline', text: inline.text, startLine };
          } else {
            warnings.push({ file: rel, message: `inline template of ${node.name?.text ?? 'component'} has escape sequences; not indexed` });
          }
        } else if (prop(props, 'template')) {
          warnings.push({ file: rel, message: `template of ${node.name?.text ?? 'component'} is not a plain string literal; not indexed` });
        }

        components.push({ className: node.name?.text ?? '(anonymous)', tags, file: rel, template });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  return { components, warnings };
}
