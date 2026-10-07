#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { Command } from 'commander';
import { loadConfig } from './config/load.js';
import { runClassify, runMap, type StageOutput } from './classify/run.js';
import { runScan } from './scan/index.js';
import { formatSummary } from './scan/summary.js';

function loadDotEnv(): void {
  // Existing environment variables win over .env values.
  if (existsSync('.env')) process.loadEnvFile('.env');
}

const program = new Command();
program.name('a11y').description('Scan an Angular app for accessibility violations and measure fixes.');

program
  .command('scan')
  .description('Scan the configured routes and write violations.json')
  .requiredOption('-c, --config <file>', 'path to the YAML config file')
  .action(async (opts: { config: string }) => {
    loadDotEnv();
    const config = loadConfig(opts.config);
    const out = await runScan(config);
    console.log(out.connectedToRunningApp ? 'Connected to the already running app.' : 'Started and stopped the app.');
    console.log(formatSummary(out.summary));
    console.log(`\nWrote ${out.violationsPath}`);
    console.log(`Wrote ${out.summaryPath}`);
  });

function printStage(out: StageOutput): void {
  for (const w of out.warnings) console.warn(`warning: ${w.file}: ${w.message}`);
  console.log(out.summaryText);
  console.log(`\nUpdated ${out.path}`);
}

program
  .command('classify')
  .description('Tag each violation as rule_fixable, needs_judgment, or layout')
  .requiredOption('-c, --config <file>', 'path to the YAML config file')
  .action((opts: { config: string }) => {
    printStage(runClassify(loadConfig(opts.config)));
  });

program
  .command('map')
  .description('Map each violation to its most likely Angular template file and line')
  .requiredOption('-c, --config <file>', 'path to the YAML config file')
  .action((opts: { config: string }) => {
    printStage(runMap(loadConfig(opts.config)));
  });

program.parseAsync().catch((err: unknown) => {
  console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
