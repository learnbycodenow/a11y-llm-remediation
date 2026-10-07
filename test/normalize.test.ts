import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { normalizeAxeViolations, selectorFromTarget, violationId, type AxeViolationLike } from '../src/scan/normalize.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const axe = JSON.parse(
  readFileSync(path.join(here, 'fixtures', 'axe-violations.json'), 'utf8'),
) as AxeViolationLike[];

describe('normalizeAxeViolations', () => {
  const out = normalizeAxeViolations('/login', axe);

  it('produces one entry per failing node with null classification fields', () => {
    expect(out).toHaveLength(6);
    const first = out[0]!;
    expect(first).toMatchObject({
      ruleId: 'button-name',
      impact: 'critical',
      route: '/login',
      selector: 'app-header .icon',
      html: '<button class="icon"></button>',
      category: null,
      sourceFile: null,
      sourceLine: null,
      mappingConfidence: null,
      status: 'open',
      notes: [],
    });
    expect(first.wcagTags).toContain('wcag412');
  });

  it('falls back to the rule impact when the node has none', () => {
    expect(out.find((v) => v.ruleId === 'image-alt')?.impact).toBe('critical');
  });

  it('maps unknown impact values to null', () => {
    expect(out.find((v) => v.ruleId === 'custom-rule')?.impact).toBeNull();
  });

  it('flattens shadow DOM and iframe targets', () => {
    expect(selectorFromTarget([['my-widget', 'p']])).toBe('my-widget >> p');
    expect(selectorFromTarget(['iframe#f', 'p'])).toBe('iframe#f >>> p');
  });

  it('merges nodes with an identical rule, route, and selector and notes it', () => {
    const merged = out.filter((v) => v.ruleId === 'custom-rule');
    expect(merged).toHaveLength(1);
    expect(merged[0]!.notes).toHaveLength(1);
  });

  it('produces stable ids that depend on rule, route, and selector', () => {
    expect(out[0]!.id).toBe(violationId('button-name', '/login', 'app-header .icon'));
    expect(violationId('button-name', '/a', 's')).not.toBe(violationId('button-name', '/b', 's'));
    expect(new Set(out.map((v) => v.id)).size).toBe(out.length);
  });
});
