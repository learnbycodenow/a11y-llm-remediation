import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export function writeJson(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
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
