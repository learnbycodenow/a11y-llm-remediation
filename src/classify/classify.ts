import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import type { Category, Violation } from '../types/violation.js';
import { replaceStageNotes } from '../util/notes.js';

const categorySchema = z.enum(['rule_fixable', 'needs_judgment', 'layout']);

const mapSchema = z.strictObject({
  version: z.literal(1),
  default: categorySchema,
  rules: z.record(
    z.string(),
    z.strictObject({ category: categorySchema, rationale: z.string().min(1) }),
  ),
});

export type CategoryMap = z.infer<typeof mapSchema>;

// Resolves to <repo>/data from both src/classify and dist/classify.
export const DEFAULT_CATEGORY_MAP_PATH = fileURLToPath(
  new URL('../../data/rule-categories.json', import.meta.url),
);

export function loadCategoryMap(file: string = DEFAULT_CATEGORY_MAP_PATH): CategoryMap {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read category map ${file}: ${(err as Error).message}`);
  }
  const parsed = mapSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`category map ${file} is invalid:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export function classifyViolations(violations: readonly Violation[], map: CategoryMap): Violation[] {
  return violations.map((v) => {
    const entry = map.rules[v.ruleId];
    const category: Category = entry?.category ?? map.default;
    const note = entry
      ? `${category}: ${entry.rationale}`
      : `rule "${v.ruleId}" is not in the category map; defaulted to ${map.default}`;
    return { ...v, category, notes: replaceStageNotes(v.notes, 'classify', [note]) };
  });
}
