import { createHash } from 'node:crypto';
import type { Impact, Violation } from '../types/violation.js';

// Minimal structural types so tests can use plain fixtures without axe-core or a browser.
export interface AxeNodeLike {
  html: string;
  target: readonly unknown[];
  impact?: string | null | undefined;
}

export interface AxeViolationLike {
  id: string;
  impact?: string | null | undefined;
  tags: readonly string[];
  nodes: readonly AxeNodeLike[];
}

const IMPACTS: readonly string[] = ['minor', 'moderate', 'serious', 'critical'];

function toImpact(value: string | null | undefined): Impact | null {
  return value != null && IMPACTS.includes(value) ? (value as Impact) : null;
}

/** Axe targets are strings, or string arrays for shadow DOM; iframes add one entry per frame. */
export function selectorFromTarget(target: readonly unknown[]): string {
  return target
    .map((part) => (Array.isArray(part) ? part.map(String).join(' >> ') : String(part)))
    .join(' >>> ');
}

export function violationId(ruleId: string, route: string, selector: string): string {
  return createHash('sha256').update(`${ruleId}|${route}|${selector}`).digest('hex').slice(0, 16);
}

export function normalizeAxeViolations(
  route: string,
  axeViolations: readonly AxeViolationLike[],
): Violation[] {
  const byId = new Map<string, Violation>();

  for (const v of axeViolations) {
    for (const node of v.nodes) {
      const selector = selectorFromTarget(node.target);
      const id = violationId(v.id, route, selector);

      const existing = byId.get(id);
      if (existing) {
        existing.notes.push('duplicate node with the same rule, route, and selector was merged');
        continue;
      }

      byId.set(id, {
        id,
        ruleId: v.id,
        impact: toImpact(node.impact ?? v.impact),
        wcagTags: [...v.tags],
        route,
        selector,
        html: node.html,
        category: null,
        sourceFile: null,
        sourceLine: null,
        mappingConfidence: null,
        status: 'open',
        notes: [],
      });
    }
  }

  return [...byId.values()];
}
