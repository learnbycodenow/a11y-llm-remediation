import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyViolations, loadCategoryMap } from '../src/classify/classify.js';
import { runClassify, runMap } from '../src/classify/run.js';
import { formatTriageSummary, summarizeTriage } from '../src/classify/summary.js';
import { parseConfig } from '../src/config/load.js';
import type { Violation, ViolationsFile } from '../src/types/violation.js';

const here = path.dirname(fileURLToPath(import.meta.url));

function v(ruleId: string, extra: Partial<Violation> = {}): Violation {
  return {
    id: `${ruleId}-${Math.random()}`,
    ruleId,
    impact: null,
    wcagTags: [],
    route: '/',
    selector: 'x',
    html: '<button class="save" type="button">Save</button>',
    category: null,
    sourceFile: null,
    sourceLine: null,
    mappingConfidence: null,
    status: 'open',
    notes: [],
    ...extra,
  };
}

describe('classifier', () => {
  const map = loadCategoryMap();

  it('loads the shipped category map', () => {
    expect(map.default).toBe('needs_judgment');
    expect(map.rules['html-has-lang']?.category).toBe('rule_fixable');
    expect(map.rules['color-contrast']?.category).toBe('layout');
  });

  it('maps known rules using the data file', () => {
    const out = classifyViolations([v('html-has-lang'), v('color-contrast'), v('aria-roles')], map);
    expect(out.map((x) => x.category)).toEqual(['rule_fixable', 'layout', 'needs_judgment']);
  });

  it('defaults unknown rules to needs_judgment and says so', () => {
    const [out] = classifyViolations([v('brand-new-axe-rule')], map);
    expect(out!.category).toBe('needs_judgment');
    expect(out!.notes.join('\n')).toContain('not in the category map');
  });

  it('replaces its own notes when re-run and keeps other notes', () => {
    const once = classifyViolations([v('label', { notes: ['scan: kept'] })], map);
    const twice = classifyViolations(once, map);
    expect(twice[0]!.notes.filter((n) => n.startsWith('classify: '))).toHaveLength(1);
    expect(twice[0]!.notes).toContain('scan: kept');
  });

  it('does not change the input violations', () => {
    const input = [v('label')];
    classifyViolations(input, map);
    expect(input[0]!.category).toBeNull();
  });

  it('rejects a malformed category map', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'a11y-map-'));
    const file = path.join(dir, 'bad.json');
    writeFileSync(file, JSON.stringify({ version: 1, default: 'nope', rules: {} }));
    expect(() => loadCategoryMap(file)).toThrow(/invalid/);
  });
});

describe('triage summary', () => {
  it('counts by category, mapping confidence, and both together', () => {
    const s = summarizeTriage([
      v('a', { category: 'rule_fixable', mappingConfidence: 'high' }),
      v('b', { category: 'rule_fixable', mappingConfidence: 'low' }),
      v('c', { category: 'layout', mappingConfidence: 'none' }),
      v('d'),
    ]);
    expect(s.byCategory).toMatchObject({ rule_fixable: 2, layout: 1, needs_judgment: 0, unset: 1 });
    expect(s.byConfidence).toMatchObject({ high: 1, low: 1, none: 1, medium: 0, unset: 1 });
    expect(s.byCategoryAndConfidence['rule_fixable']).toMatchObject({ high: 1, low: 1 });
    const text = formatTriageSummary(s);
    expect(text).toContain('Violation nodes: 4');
    expect(text).toContain('rule_fixable');
  });
});

describe('classify and map stages', () => {
  it('read and update violations.json in place, with map results recorded', () => {
    const out = mkdtempSync(path.join(os.tmpdir(), 'a11y-out-'));
    const config = parseConfig(
      [
        `target: { path: ${path.join(here, 'fixtures', 'mapping-app')}, baseUrl: "http://localhost:4200" }`,
        'routes: [/]',
        `output: { dir: ${out} }`,
      ].join('\n'),
      here,
    );
    const file: ViolationsFile = {
      schemaVersion: 1,
      generatedAt: 'now',
      target: { path: 'x', commit: null },
      baseUrl: 'http://localhost:4200',
      configHash: 'h',
      axeVersion: null,
      routes: ['/'],
      violations: [
        v('button-name', { hostChain: ['app-list'] }),
        v('button-name', { html: '<button class="dup">Go</button>', selector: '.dup' }),
        v('button-name', { html: '<marquee>', hostChain: ['app-list'] }),
      ],
    };
    writeFileSync(path.join(out, 'violations.json'), JSON.stringify(file));

    runClassify(config);
    const mapped = runMap(config);

    const saved = JSON.parse(readFileSync(path.join(out, 'violations.json'), 'utf8')) as ViolationsFile;
    expect(saved.violations.map((x) => x.category)).toEqual(['rule_fixable', 'rule_fixable', 'rule_fixable']);
    expect(saved.violations.map((x) => x.mappingConfidence)).toEqual(['high', 'low', 'none']);
    expect(saved.violations[1]!.sourceCandidates).toHaveLength(2);
    expect(saved.violations[0]).not.toHaveProperty('sourceCandidates');
    expect(mapped.summaryText).toContain('By mapping confidence');
    expect(mapped.warnings.length).toBeGreaterThan(0);
  });

  it('fails clearly when violations.json is missing', () => {
    const config = parseConfig(
      `target: { path: ., baseUrl: "http://localhost:4200" }\nroutes: [/]\noutput: { dir: ${os.tmpdir()}/a11y-none-${Date.now()} }`,
      here,
    );
    expect(() => runClassify(config)).toThrow(/Run "a11y scan" first/);
  });
});
