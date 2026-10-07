import type { MappingConfidence, SourceLocation, Violation } from '../types/violation.js';
import type { TemplateDoc, TemplateIndex } from './index.js';
import { parseRendered, selectorChain, type RenderedNode } from './rendered.js';
import { normalizeText, type TemplateElement } from './template.js';

export interface MappingResult {
  sourceFile: string | null;
  sourceLine: number | null;
  mappingConfidence: MappingConfidence;
  sourceCandidates: SourceLocation[] | undefined;
  notes: string[];
}

interface Match {
  el: TemplateElement;
  doc: TemplateDoc;
  score: number;
  distance: number;
}

const ROOT_TAGS = new Set(['html', 'head', 'body']);
const FRAMEWORK_ATTR = /^(_ngcontent-|_nghost-|ng-reflect-|ng-version$|ngh$|ng-server-context$)/;
const RANK: Record<MappingConfidence, number> = { none: 0, low: 1, medium: 2, high: 3 };

function atMost(a: MappingConfidence, cap: MappingConfidence): MappingConfidence {
  return RANK[a] <= RANK[cap] ? a : cap;
}

/** Returns a score (higher is more specific), or null if the template element cannot have rendered this node. */
export function scoreMatch(r: RenderedNode, t: TemplateElement): number | null {
  let score = 0;

  for (const a of t.attrs) {
    if (a.kind !== 'static' || a.name === 'style') continue;
    const rendered = r.attrs.get(a.name);
    if (rendered === undefined) return null;
    if (a.name === 'class') {
      const have = new Set(rendered.split(/\s+/));
      if (!a.value.split(/\s+/).filter(Boolean).every((c) => have.has(c))) return null;
    } else if (normalizeText(rendered) !== normalizeText(a.value)) {
      return null;
    }
    score += 2;
  }

  for (const name of r.attrs.keys()) {
    if (name === 'class' || name === 'style' || FRAMEWORK_ATTR.test(name)) continue;
    if (t.attrs.some((a) => a.name === name && a.kind === 'bound')) score += 1;
  }

  if (t.text && r.text !== null) {
    if (!t.text.pattern.test(r.text)) return null;
    if (t.text.staticLength > 0) score += 3;
  }
  return score;
}

const loc = (m: Match): SourceLocation => ({ file: m.el.file, line: m.el.line });
const fmt = (m: Match): string => `${m.el.file}:${m.el.line}`;

function none(...notes: string[]): MappingResult {
  return { sourceFile: null, sourceLine: null, mappingConfidence: 'none', sourceCandidates: undefined, notes };
}

interface Scope {
  docs: Map<TemplateDoc, number>;
  cap: MappingConfidence;
  notes: string[];
  failure?: string;
}

function chooseScope(v: Violation, r: RenderedNode, index: TemplateIndex): Scope {
  const docs = new Map<TemplateDoc, number>();
  const notes: string[] = [];
  let cap: MappingConfidence = 'high';

  if (ROOT_TAGS.has(r.tag)) {
    for (const d of index.documents) docs.set(d, 0);
    return { docs, cap, notes, ...(docs.size === 0 && { failure: 'no index.html found in the target' }) };
  }

  const chain = v.hostChain ?? selectorChain(v.selector);
  if (v.hostChain === undefined && chain.length === 0) {
    for (const d of index.all) docs.set(d, 0);
    notes.push('no component information for this node (old violations.json or generic selector); searched every template');
    return { docs, cap: 'medium', notes };
  }

  if (chain.length === 0) {
    for (const d of index.documents) docs.set(d, 0);
    return { docs, cap, notes, ...(docs.size === 0 && { failure: 'node is outside any component and no index.html was found' }) };
  }

  let rank = 0;
  for (const tag of chain) {
    const found = index.byTag.get(tag);
    if (!found) continue;
    for (const d of found) if (!docs.has(d)) docs.set(d, rank);
    rank++;
  }
  if (!index.knownTags.has(chain[0]!)) {
    cap = 'medium';
    notes.push(`nearest component <${chain[0]}> is not in the target's sources; the node may be rendered by it`);
  }
  if (docs.size === 0) {
    return { docs, cap, notes, failure: `none of the ancestor components (${chain.join(', ')}) has an indexed template` };
  }
  return { docs, cap, notes };
}

export function mapViolation(v: Violation, index: TemplateIndex): MappingResult {
  const r = parseRendered(v.html);
  if (!r) return none('could not parse an element from the violation HTML');

  const scope = chooseScope(v, r, index);
  if (scope.failure) return none(...scope.notes, scope.failure);

  const matches: Match[] = [];
  for (const [doc, distance] of scope.docs) {
    for (const el of doc.elements) {
      if (el.tag !== r.tag) continue;
      const score = scoreMatch(r, el);
      if (score !== null) matches.push({ el, doc, score, distance });
    }
  }

  const owners = [...scope.docs.keys()].map((d) => d.owner).join(', ');
  if (matches.length === 0) {
    return none(...scope.notes, `no <${r.tag}> in the templates of ${owners} matches its attributes and text`);
  }

  matches.sort((a, b) => a.distance - b.distance || b.score - a.score);
  const best = matches[0]!;
  const tied = matches.filter((m) => m.distance === best.distance && m.score === best.score);
  const notes = [...scope.notes];
  let confidence: MappingConfidence;
  let candidates: Match[] | undefined;

  if (tied.length > 1) {
    confidence = 'low';
    candidates = tied;
    notes.push(`ambiguous: ${tied.length} equally likely locations: ${tied.map(fmt).join(', ')}`);
  } else if (matches.length === 1) {
    confidence = best.score >= 2 || ROOT_TAGS.has(r.tag) ? 'high' : 'medium';
    if (best.score < 2 && !ROOT_TAGS.has(r.tag)) notes.push(`<${r.tag}> matched by tag only; no attribute or text evidence`);
    if (best.distance > 0) {
      confidence = atMost(confidence, 'medium');
      notes.push(`found in ${best.doc.owner}, not the nearest ancestor component; it may be projected content`);
    }
  } else {
    confidence = 'medium';
    candidates = matches;
    notes.push(`best of ${matches.length} candidates; others: ${matches.slice(1).map(fmt).join(', ')}`);
  }

  confidence = atMost(confidence, scope.cap);
  return {
    sourceFile: best.el.file,
    sourceLine: best.el.line,
    mappingConfidence: confidence,
    sourceCandidates: candidates?.map(loc),
    notes: [`matched <${r.tag}> at ${fmt(best)} (score ${best.score})`, ...notes],
  };
}
