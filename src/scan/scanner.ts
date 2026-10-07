import { AxeBuilder } from '@axe-core/playwright';
import { chromium, type Page } from 'playwright';
import type { Config } from '../config/schema.js';
import type { Violation } from '../types/violation.js';
import { resolveAuthSteps } from './auth.js';
import { normalizeAxeViolations } from './normalize.js';

export interface ScanResult {
  violations: Violation[];
  axeVersion: string | null;
}

async function login(page: Page, config: Config, env: Record<string, string | undefined>): Promise<void> {
  const { auth } = config;
  if (!auth) return;

  // Resolve credentials before opening the page so a missing variable fails fast.
  const steps = resolveAuthSteps(auth.steps, env);
  await page.goto(new URL(auth.loginRoute, config.target.baseUrl).toString(), { waitUntil: 'networkidle' });
  for (const step of steps) {
    if (step.kind === 'fill') await page.fill(step.selector, step.value);
    else await page.click(step.selector);
  }
  await page.waitForLoadState('networkidle');
}

async function scanRoute(page: Page, config: Config, route: string): Promise<ScanResult> {
  const url = new URL(route, config.target.baseUrl).toString();
  const response = await page.goto(url, { waitUntil: 'networkidle' });
  if (!response || response.status() >= 400) {
    throw new Error(`route ${route} returned HTTP ${response?.status() ?? 'no response'}`);
  }

  let builder = new AxeBuilder({ page });
  if (config.scan.tags.length > 0) builder = builder.withTags(config.scan.tags);
  const results = await builder.analyze();

  return {
    violations: normalizeAxeViolations(route, results.violations),
    axeVersion: results.testEngine.version ?? null,
  };
}

export async function scanRoutes(
  config: Config,
  env: Record<string, string | undefined>,
): Promise<ScanResult> {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, config, env);

    const violations: Violation[] = [];
    let axeVersion: string | null = null;
    for (const route of config.routes) {
      const result = await scanRoute(page, config, route);
      violations.push(...result.violations);
      axeVersion = result.axeVersion ?? axeVersion;
    }
    return { violations, axeVersion };
  } finally {
    await browser.close();
  }
}
