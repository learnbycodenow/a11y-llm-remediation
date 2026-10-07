import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ViolationsFile } from '../types/violation.js';

export function writeJson(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

export function readViolationsFile(file: string): ViolationsFile {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read ${file}: ${(err as Error).message}. Run "a11y scan" first.`);
  }
  const f = data as Partial<ViolationsFile> | null;
  if (!f || f.schemaVersion !== 1 || !Array.isArray(f.violations)) {
    throw new Error(`${file} is not a schemaVersion 1 violations file`);
  }
  return f as ViolationsFile;
}

/** Returns null if `dir` is not a git repository; later stages require one. */
export function headCommit(dir: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}
