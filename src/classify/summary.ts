import type { Violation } from '../types/violation.js';

const CATEGORIES = ['rule_fixable', 'needs_judgment', 'layout'] as const;
const CONFIDENCES = ['high', 'medium', 'low', 'none'] as const;

function tally<T extends string>(keys: readonly T[], values: readonly (T | null)[]): Record<T | 'unset', number> {
  const out = { unset: 0 } as Record<T | 'unset', number>;
  for (const k of keys) out[k] = 0;
  for (const v of values) out[v ?? 'unset'] += 1;
  return out;
}

export interface TriageSummary {
  total: number;
  byCategory: Record<(typeof CATEGORIES)[number] | 'unset', number>;
  byConfidence: Record<(typeof CONFIDENCES)[number] | 'unset', number>;
  /** Mapping confidence within each category. */
  byCategoryAndConfidence: Record<string, Record<(typeof CONFIDENCES)[number] | 'unset', number>>;
}

export function summarizeTriage(violations: readonly Violation[]): TriageSummary {
  const byCategoryAndConfidence: TriageSummary['byCategoryAndConfidence'] = {};
  for (const cat of [...CATEGORIES, 'unset'] as const) {
    const inCat = violations.filter((v) => (v.category ?? 'unset') === cat);
    byCategoryAndConfidence[cat] = tally(CONFIDENCES, inCat.map((v) => v.mappingConfidence));
  }
  return {
    total: violations.length,
    byCategory: tally(CATEGORIES, violations.map((v) => v.category)),
    byConfidence: tally(CONFIDENCES, violations.map((v) => v.mappingConfidence)),
    byCategoryAndConfidence,
  };
}

function lines(title: string, counts: Record<string, number>): string[] {
  return [title, ...Object.entries(counts).filter(([k, n]) => k !== 'unset' || n > 0).map(([k, n]) => `  ${String(n).padStart(4)}  ${k}`)];
}

export function formatTriageSummary(s: TriageSummary): string {
  const cross = Object.entries(s.byCategoryAndConfidence)
    .filter(([, c]) => Object.values(c).some((n) => n > 0))
    .map(([cat, c]) => {
      const cells = Object.entries(c)
        .filter(([k, n]) => k !== 'unset' || n > 0)
        .map(([k, n]) => `${k} ${n}`)
        .join('  ');
      return `  ${cat.padEnd(15)} ${cells}`;
    });
  return [
    `Violation nodes: ${s.total}`,
    ...lines('By category:', s.byCategory),
    ...lines('By mapping confidence:', s.byConfidence),
    'Category x mapping confidence:',
    ...cross,
  ].join('\n');
}
