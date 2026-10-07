import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildTemplateIndex, type TemplateIndex } from '../src/mapping/index.js';
import { mapViolation } from '../src/mapping/match.js';
import { parseRendered, selectorChain } from '../src/mapping/rendered.js';
import { parseTemplateElements, textPattern } from '../src/mapping/template.js';
import type { Violation } from '../src/types/violation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, 'fixtures', 'mapping-app');

function violation(html: string, hostChain: string[] | undefined, selector = 'x'): Violation {
  return {
    id: 'id',
    ruleId: 'rule',
    impact: null,
    wcagTags: [],
    route: '/',
    selector,
    html,
    category: null,
    sourceFile: null,
    sourceLine: null,
    mappingConfidence: null,
    status: 'open',
    notes: [],
    ...(hostChain !== undefined && { hostChain }),
  };
}

describe('template index', () => {
  let index: TemplateIndex;
  beforeAll(() => {
    index = buildTemplateIndex(root);
  });

  it('indexes component hosts by element selector and the document shell', () => {
    expect([...index.byTag.keys()].sort()).toEqual(['app-a', 'app-b', 'app-card', 'app-header', 'app-list', 'app-root']);
    expect(index.documents.map((d) => d.file)).toEqual(['src/index.html']);
  });

  it('reports templates it cannot index instead of skipping silently', () => {
    const messages = index.warnings.map((w) => `${w.file}: ${w.message}`);
    expect(messages.some((m) => m.includes('escaped.component.ts') && m.includes('escape sequences'))).toBe(true);
    expect(messages.some((m) => m.includes('MissingComponent'))).toBe(true);
  });

  it('records 1-based file lines for templateUrl templates', () => {
    const list = index.byTag.get('app-list')![0]!;
    expect(list.file).toBe('src/app/list.component.html');
    expect(list.elements.find((e) => e.tag === 'button' && e.attrs.some((a) => a.value === 'save'))?.line).toBe(6);
  });

  it('records file lines for inline templates and for elements inside @for blocks', () => {
    const header = index.byTag.get('app-header')![0]!;
    expect(header.file).toBe('src/app/header.component.ts');
    expect(header.elements.find((e) => e.tag === 'img')?.line).toBe(9);
    const list = index.byTag.get('app-list')![0]!;
    expect(list.elements.find((e) => e.tag === 'li')?.line).toBe(3);
  });
});

describe('mapViolation', () => {
  let index: TemplateIndex;
  beforeAll(() => {
    index = buildTemplateIndex(root);
  });

  it('maps an exact match in the nearest component with high confidence', () => {
    const r = mapViolation(violation('<button class="save" type="button">Save</button>', ['app-list', 'app-root']), index);
    expect(r).toMatchObject({ sourceFile: 'src/app/list.component.html', sourceLine: 6, mappingConfidence: 'high' });
    expect(r.sourceCandidates).toBeUndefined();
  });

  it('maps an inline template to a line in the TypeScript file', () => {
    const r = mapViolation(violation('<img class="logo" src="logo.png">', ['app-header', 'app-root']), index);
    expect(r).toMatchObject({ sourceFile: 'src/app/header.component.ts', sourceLine: 9, mappingConfidence: 'high' });
  });

  it('treats bound attributes and interpolated text as wildcards', () => {
    const r = mapViolation(violation('<a class="user" href="/u/ann">Ann</a>', ['app-header']), index);
    expect(r).toMatchObject({ sourceFile: 'src/app/header.component.ts', sourceLine: 8, mappingConfidence: 'high' });
  });

  it('maps elements inside control-flow blocks', () => {
    const r = mapViolation(violation('<li class="item">One</li>', ['app-list']), index);
    expect(r).toMatchObject({ sourceLine: 3, mappingConfidence: 'high' });
  });

  it('maps the root document element to index.html with high confidence', () => {
    const r = mapViolation(violation('<html>', [], 'html'), index);
    expect(r).toMatchObject({ sourceFile: 'src/index.html', sourceLine: 2, mappingConfidence: 'high' });
  });

  it('flags identical markup in several templates as low confidence and lists every candidate', () => {
    const r = mapViolation(violation('<button class="dup">Go</button>', undefined, '.dup'), index);
    expect(r.mappingConfidence).toBe('low');
    expect(r.sourceCandidates).toEqual([
      { file: 'src/app/a.component.html', line: 2 },
      { file: 'src/app/b.component.html', line: 2 },
    ]);
    expect(r.notes.join('\n')).toContain('ambiguous');
  });

  it('prefers the nearest ancestor component when the same markup is also in a farther one', () => {
    const r = mapViolation(violation('<button class="dup">Go</button>', ['app-a', 'app-b']), index);
    expect(r.sourceFile).toBe('src/app/a.component.html');
    expect(r.mappingConfidence).toBe('medium');
    expect(r.sourceCandidates).toHaveLength(2);
  });

  it('caps confidence when the nearest ancestor is not part of the target sources', () => {
    const r = mapViolation(violation('<button class="save" type="button">Save</button>', ['mat-form-field', 'app-list']), index);
    expect(r.sourceFile).toBe('src/app/list.component.html');
    expect(r.mappingConfidence).toBe('medium');
    expect(r.notes.join('\n')).toContain('mat-form-field');
  });

  it('finds projected content in the outer template and notes the farther owner', () => {
    const r = mapViolation(violation('<button class="close">Close</button>', ['app-card', 'app-list']), index);
    expect(r).toMatchObject({ sourceFile: 'src/app/list.component.html', sourceLine: 8, mappingConfidence: 'medium' });
  });

  it('reports none with a reason when nothing matches', () => {
    const r = mapViolation(violation('<marquee class="x">hi</marquee>', ['app-list']), index);
    expect(r).toMatchObject({ sourceFile: null, sourceLine: null, mappingConfidence: 'none' });
    expect(r.notes.join('\n')).toContain('no <marquee>');
  });

  it('reports none when no ancestor component has a template', () => {
    const r = mapViolation(violation('<button class="save">Save</button>', ['mat-form-field']), index);
    expect(r.mappingConfidence).toBe('none');
    expect(r.notes.join('\n')).toContain('mat-form-field');
  });

  it('does not match when static text differs', () => {
    const r = mapViolation(violation('<button class="save" type="button">Delete</button>', ['app-list']), index);
    expect(r.mappingConfidence).toBe('none');
  });

  it('ignores text for truncated snippets and gives medium confidence for tag-only matches', () => {
    const r = mapViolation(violation('<button class="save" type="button" _ngcontent-ng-c1="">', ['app-list']), index);
    expect(r).toMatchObject({ sourceLine: 6, mappingConfidence: 'high' });
    const tagOnly = mapViolation(violation('<main _ngcontent-ng-c1="">', ['app-root']), index);
    expect(tagOnly).toMatchObject({ sourceFile: 'src/app/app.component.html', mappingConfidence: 'medium' });
    expect(tagOnly.notes.join('\n')).toContain('tag only');
  });

  it('is deterministic', () => {
    const v = violation('<button class="dup">Go</button>', undefined, '.dup');
    expect(mapViolation(v, index)).toEqual(mapViolation(v, index));
  });
});

describe('helpers', () => {
  it('derives ancestor custom elements from a selector, nearest first, excluding the node itself', () => {
    expect(selectorChain('app-root > app-list app-item .btn')).toEqual(['app-item', 'app-list', 'app-root']);
    expect(selectorChain('app-card')).toEqual([]);
    expect(selectorChain('.nav-item:nth-child(1) > .nav-link[href="/a b"]')).toEqual([]);
  });

  it('parses the failing node and judges text reliability', () => {
    const full = parseRendered('<a class="x" href="/"> Home </a>')!;
    expect(full).toMatchObject({ tag: 'a', text: 'Home' });
    expect(full.attrs.get('href')).toBe('/');
    expect(parseRendered('<p class="x">')!.text).toBeNull();
    expect(parseRendered('<img src="a.png">')!.text).toBe('');
    expect(parseRendered('no element here')).toBeNull();
  });

  it('builds text patterns with interpolation wildcards', () => {
    const p = textPattern(' Hello {{ name }}!\n');
    expect(p.staticLength).toBe(6);
    expect(p.pattern.test('Hello Ann!')).toBe(true);
    expect(p.pattern.test('Bye Ann!')).toBe(false);
  });

  it('marks text unpredictable when children are components or blocks', () => {
    const els = parseTemplateElements('<div><app-x></app-x></div><p>@if (a) {x}</p><b>hi</b>', 't.html');
    expect(els.find((e) => e.tag === 'div')!.text).toBeNull();
    expect(els.find((e) => e.tag === 'p')!.text).toBeNull();
    expect(els.find((e) => e.tag === 'b')!.text).not.toBeNull();
  });
});
