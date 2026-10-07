import path from 'node:path';
import type { Config } from '../config/schema.js';
import type { ViolationsFile } from '../types/violation.js';
import { headCommit, writeJson } from '../util/fs.js';
import { startApp } from './app.js';
import { scanRoutes } from './scanner.js';
import { summarize, type ScanSummary } from './summary.js';

export interface ScanOutput {
  file: ViolationsFile;
  summary: ScanSummary;
  violationsPath: string;
  summaryPath: string;
  connectedToRunningApp: boolean;
}

export async function runScan(
  config: Config,
  env: Record<string, string | undefined> = process.env,
): Promise<ScanOutput> {
  const app = await startApp(config);
  let scan;
  try {
    scan = await scanRoutes(config, env);
  } finally {
    await app.stop();
  }

  const file: ViolationsFile = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    target: { path: config.target.path, commit: headCommit(config.target.path) },
    baseUrl: config.target.baseUrl,
    configHash: config.configHash,
    axeVersion: scan.axeVersion,
    routes: config.routes,
    violations: scan.violations,
  };
  const summary = summarize(file.violations);

  const violationsPath = path.join(config.output.dir, 'violations.json');
  const summaryPath = path.join(config.output.dir, 'baseline-summary.json');
  writeJson(violationsPath, file);
  writeJson(summaryPath, summary);

  return { file, summary, violationsPath, summaryPath, connectedToRunningApp: app.connected };
}
