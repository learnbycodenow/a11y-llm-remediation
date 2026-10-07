import path from 'node:path';
import type { Config } from '../config/schema.js';
import { buildTemplateIndex } from '../mapping/index.js';
import { mapViolation } from '../mapping/match.js';
import type { ScanWarning } from '../mapping/components.js';
import type { Violation, ViolationsFile } from '../types/violation.js';
import { readViolationsFile, writeJson } from '../util/fs.js';
import { replaceStageNotes } from '../util/notes.js';
import { classifyViolations, loadCategoryMap } from './classify.js';
import { formatTriageSummary, summarizeTriage } from './summary.js';

export interface StageOutput {
  file: ViolationsFile;
  path: string;
  summaryText: string;
  warnings: ScanWarning[];
}

const violationsPath = (config: Config): string => path.join(config.output.dir, 'violations.json');

export function runClassify(config: Config): StageOutput {
  const p = violationsPath(config);
  const file = readViolationsFile(p);
  const updated: ViolationsFile = { ...file, violations: classifyViolations(file.violations, loadCategoryMap()) };
  writeJson(p, updated);
  return { file: updated, path: p, summaryText: formatTriageSummary(summarizeTriage(updated.violations)), warnings: [] };
}

export function runMap(config: Config): StageOutput {
  const p = violationsPath(config);
  const file = readViolationsFile(p);
  const index = buildTemplateIndex(config.target.path);

  const violations = file.violations.map((v): Violation => {
    const result = mapViolation(v, index);
    const { sourceCandidates: _previous, ...rest } = v;
    return {
      ...rest,
      sourceFile: result.sourceFile,
      sourceLine: result.sourceLine,
      mappingConfidence: result.mappingConfidence,
      ...(result.sourceCandidates && { sourceCandidates: result.sourceCandidates }),
      notes: replaceStageNotes(v.notes, 'map', result.notes),
    };
  });

  const updated: ViolationsFile = { ...file, violations };
  writeJson(p, updated);
  return { file: updated, path: p, summaryText: formatTriageSummary(summarizeTriage(violations)), warnings: index.warnings };
}
