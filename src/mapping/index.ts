import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  extractComponents,
  listComponentSourceFiles,
  toPosix,
  type ComponentInfo,
  type ScanWarning,
} from './components.js';
import { parseTemplateElements, type TemplateElement } from './template.js';

export interface TemplateDoc {
  /** Component class, or "index.html" for the document shell. */
  owner: string;
  file: string;
  elements: TemplateElement[];
}

export interface TemplateIndex {
  /** Templates by component host tag (lower-case). */
  byTag: Map<string, TemplateDoc[]>;
  /** Component hosts that are indexed even if their template could not be read. */
  knownTags: Set<string>;
  /** The document shell(s), for html, head, and body. */
  documents: TemplateDoc[];
  all: TemplateDoc[];
  warnings: ScanWarning[];
}

function readTemplate(root: string, comp: ComponentInfo): { text: string; file: string; lineOffset: number } | null {
  if (!comp.template) return null;
  if (comp.template.kind === 'inline') {
    return { text: comp.template.text, file: comp.file, lineOffset: comp.template.startLine - 1 };
  }
  const abs = path.join(root, comp.template.file);
  if (!existsSync(abs)) return null;
  return { text: readFileSync(abs, 'utf8'), file: comp.template.file, lineOffset: 0 };
}

export function buildTemplateIndex(root: string): TemplateIndex {
  const byTag = new Map<string, TemplateDoc[]>();
  const knownTags = new Set<string>();
  const all: TemplateDoc[] = [];
  const warnings: ScanWarning[] = [];

  for (const file of listComponentSourceFiles(root)) {
    const found = extractComponents(readFileSync(file, 'utf8'), file, root);
    warnings.push(...found.warnings);

    for (const comp of found.components) {
      for (const tag of comp.tags) knownTags.add(tag);
      const tpl = readTemplate(root, comp);
      if (!tpl) {
        if (comp.tags.length > 0) {
          warnings.push({ file: comp.file, message: `template of ${comp.className} was not found or not indexed` });
        }
        continue;
      }
      const doc: TemplateDoc = {
        owner: comp.className,
        file: tpl.file,
        elements: parseTemplateElements(tpl.text, tpl.file, tpl.lineOffset),
      };
      all.push(doc);
      for (const tag of comp.tags) byTag.set(tag, [...(byTag.get(tag) ?? []), doc]);
    }
  }

  const documents: TemplateDoc[] = [];
  for (const rel of ['src/index.html', 'index.html']) {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) continue;
    const doc: TemplateDoc = {
      owner: 'index.html',
      file: toPosix(rel),
      elements: parseTemplateElements(readFileSync(abs, 'utf8'), toPosix(rel)),
    };
    documents.push(doc);
    all.push(doc);
  }

  return { byTag, knownTags, documents, all, warnings };
}
