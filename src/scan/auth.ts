import type { AuthStep } from '../config/schema.js';

export type ResolvedAuthStep =
  | { kind: 'fill'; selector: string; value: string }
  | { kind: 'click'; selector: string };

/** Reads credentials from the environment; throws if any referenced variable is unset. */
export function resolveAuthSteps(
  steps: readonly AuthStep[],
  env: Record<string, string | undefined>,
): ResolvedAuthStep[] {
  const missing: string[] = [];
  const resolved = steps.map((step): ResolvedAuthStep => {
    if ('fill' in step) {
      const value = env[step.fill.valueEnv];
      if (value === undefined || value === '') missing.push(step.fill.valueEnv);
      return { kind: 'fill', selector: step.fill.selector, value: value ?? '' };
    }
    return { kind: 'click', selector: step.click.selector };
  });

  if (missing.length > 0) {
    const names = [...new Set(missing)].join(', ');
    throw new Error(`auth requires environment variable(s) that are not set: ${names}`);
  }
  return resolved;
}
