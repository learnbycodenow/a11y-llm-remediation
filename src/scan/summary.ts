import type { Violation } from '../types/violation.js';

export interface ScanSummary {
  total: number;
  byRule: Record<string, number>;
  byImpact: Record<string, number>;
  byRoute: Record<string, number>;
}

function count(values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  return out;
}

export function summarize(violations: readonly Violation[]): ScanSummary {
  return {
    total: violations.length,
    byRule: count(violations.map((v) => v.ruleId)),
    byImpact: count(violations.map((v) => v.impact ?? 'unknown')),
    byRoute: count(violations.map((v) => v.route)),
  };
}

function section(title: string, counts: Record<string, number>): string[] {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return [title, ...rows.map(([k, n]) => `  ${String(n).padStart(4)}  ${k}`)];
}

export function formatSummary(s: ScanSummary): string {
  return [
    `Scanner-detected violation nodes: ${s.total}`,
    ...section('By impact:', s.byImpact),
    ...section('By route:', s.byRoute),
    ...section('By rule:', s.byRule),
  ].join('\n');
}
