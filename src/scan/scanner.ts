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

  const violations = normalizeAxeViolations(route, results.violations);
  await attachHostChains(page, violations);
  return { violations, axeVersion: results.testEngine.version ?? null };
}

/** Records each failing node's custom-element ancestors so the map stage can find the owning component. */
async function attachHostChains(page: Page, violations: Violation[]): Promise<void> {
  // Shadow DOM and iframe selectors cannot be resolved with a single querySelector.
  const selectors = violations.map((v) => (v.selector.includes(' >> ') ? null : v.selector));
  const chains = await page.evaluate((sels) => {
    return sels.map((sel) => {
      if (sel === null) return null;
      let el: Element | null;
      try {
        el = document.querySelector(sel);
      } catch {
        return null; // selector the browser cannot parse; leave the chain unknown
      }
      if (!el) return null;
      const chain: string[] = [];
      for (let p = el.parentElement; p; p = p.parentElement) {
        const tag = p.tagName.toLowerCase();
        if (tag.includes('-')) chain.push(tag);
      }
      return chain;
    });
  }, selectors);

  violations.forEach((v, i) => {
    const chain = chains[i];
    if (chain) v.hostChain = chain;
  });
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
