import { Block, Element, HtmlParser, Text, type Node } from '@angular/compiler';

export interface TemplateAttr {
  /** Lower-cased name as it would appear on the rendered DOM node. */
  name: string;
  value: string;
  kind: 'static' | 'bound';
}

export interface TemplateElement {
  file: string;
  /** 1-based line of the opening tag in the file. */
  line: number;
  column: number;
  /** Lower-cased tag name. */
  tag: string;
  attrs: TemplateAttr[];
  /** Pattern for the element's full text, or null when the rendered text cannot be predicted. */
  text: { pattern: RegExp; staticLength: number } | null;
}

const INTERPOLATION = /\{\{[\s\S]*?\}\}/g;
const HAS_INTERPOLATION = /\{\{[\s\S]*?\}\}/;

export function normalizeText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function classifyAttr(rawName: string, value: string): TemplateAttr | null {
  const lower = rawName.toLowerCase();
  // Events, references, structural directives, animations, and i18n markers do not render as attributes.
  if (/^(\(|#|\*|@|i18n)/.test(lower)) return null;
  if (lower.startsWith('[(')) return { name: lower.slice(2, -2), value, kind: 'bound' };

  if (lower.startsWith('[')) {
    const inner = lower.slice(1, -1);
    if (inner.startsWith('attr.')) return { name: inner.slice(5), value, kind: 'bound' };
    if (inner.startsWith('class.') || inner === 'ngclass') return { name: 'class', value, kind: 'bound' };
    if (inner.startsWith('style.') || inner === 'ngstyle') return { name: 'style', value, kind: 'bound' };
    return { name: inner, value, kind: 'bound' };
  }
  if (HAS_INTERPOLATION.test(value)) return { name: lower, value, kind: 'bound' };
  return { name: lower, value, kind: 'static' };
}

/** Collects the element's text, or returns null if any descendant makes the rendered text unpredictable. */
function collectText(nodes: readonly Node[]): string | null {
  let out = '';
  for (const n of nodes) {
    if (n instanceof Text) {
      out += n.value;
    } else if (n instanceof Element) {
      const tag = n.name.toLowerCase();
      const dynamic = tag.includes('-') || tag.startsWith('ng-') || n.attrs.some((a) => /^(\*|\[(inner|text))/i.test(a.name));
      if (dynamic) return null;
      const inner = collectText(n.children);
      if (inner === null) return null;
      out += inner;
    } else if (n instanceof Block) {
      return null;
    }
  }
  return out;
}

export function textPattern(raw: string): { pattern: RegExp; staticLength: number } {
  const normalized = normalizeText(raw);
  const parts = normalized.split(INTERPOLATION).map((p) => p.trim());
  const staticLength = parts.join('').length;
  const source = parts.map(escapeRegex).join('.*');
  return { pattern: new RegExp(`^\\s*${source}\\s*$`, 's'), staticLength };
}

export function parseTemplateElements(text: string, file: string, lineOffset = 0): TemplateElement[] {
  const result = new HtmlParser().parse(text, file, { tokenizeExpansionForms: false, tokenizeBlocks: true });
  const out: TemplateElement[] = [];

  const visit = (nodes: readonly Node[]): void => {
    for (const n of nodes) {
      if (n instanceof Element) {
        const tag = n.name.toLowerCase();
        const attrs = n.attrs
          .map((a) => classifyAttr(a.name, a.value))
          .filter((a): a is TemplateAttr => a !== null);
        const inner = collectText(n.children);
        const start = n.startSourceSpan.start;
        out.push({
          file,
          line: start.line + 1 + lineOffset,
          column: start.col + 1,
          tag,
          attrs,
          text: inner === null ? null : textPattern(inner),
        });
        visit(n.children);
      } else if (n instanceof Block) {
        visit(n.children);
      }
    }
  };
  visit(result.rootNodes);
  return out;
}
