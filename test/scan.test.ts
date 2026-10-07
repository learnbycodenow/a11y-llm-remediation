import { describe, expect, it } from 'vitest';
import { resolveAuthSteps } from '../src/scan/auth.js';
import { isReady, waitForReady, type FetchLike } from '../src/scan/app.js';
import { formatSummary, summarize } from '../src/scan/summary.js';
import type { Violation } from '../src/types/violation.js';

describe('resolveAuthSteps', () => {
  const steps = [
    { fill: { selector: '#e', valueEnv: 'A11Y_TEST_EMAIL' } },
    { fill: { selector: '#p', valueEnv: 'A11Y_TEST_PASSWORD' } },
    { click: { selector: 'button' } },
  ];

  it('reads values from the given environment', () => {
    const out = resolveAuthSteps(steps, { A11Y_TEST_EMAIL: 'a@b.c', A11Y_TEST_PASSWORD: 'pw' });
    expect(out).toEqual([
      { kind: 'fill', selector: '#e', value: 'a@b.c' },
      { kind: 'fill', selector: '#p', value: 'pw' },
      { kind: 'click', selector: 'button' },
    ]);
  });

  it('names every missing variable and never includes values', () => {
    expect(() => resolveAuthSteps(steps, { A11Y_TEST_EMAIL: 'secret@x.y' })).toThrow(
      'A11Y_TEST_PASSWORD',
    );
    try {
      resolveAuthSteps(steps, { A11Y_TEST_EMAIL: 'secret@x.y' });
    } catch (err) {
      expect((err as Error).message).not.toContain('secret@x.y');
    }
  });
});

describe('app readiness', () => {
  it('treats status < 400 as ready and connection errors as not ready', async () => {
    expect(await isReady('http://x', async () => ({ status: 200 }))).toBe(true);
    expect(await isReady('http://x', async () => ({ status: 503 }))).toBe(false);
    expect(
      await isReady('http://x', async () => {
        throw new Error('ECONNREFUSED');
      }),
    ).toBe(false);
  });

  it('waits until the app answers', async () => {
    let calls = 0;
    const fetchFn: FetchLike = async () => ({ status: ++calls < 3 ? 503 : 200 });
    await waitForReady('http://x', 5_000, { intervalMs: 1, fetchFn });
    expect(calls).toBe(3);
  });

  it('times out with a clear error', async () => {
    const fetchFn: FetchLike = async () => ({ status: 503 });
    await expect(waitForReady('http://x', 20, { intervalMs: 5, fetchFn })).rejects.toThrow(/not ready/);
  });

  it('stops early when the start command has exited', async () => {
    const fetchFn: FetchLike = async () => ({ status: 503 });
    await expect(
      waitForReady('http://x', 5_000, { intervalMs: 1, fetchFn, aborted: () => 'start command exited' }),
    ).rejects.toThrow('start command exited');
  });
});

describe('summarize', () => {
  const v = (ruleId: string, route: string, impact: Violation['impact']): Violation => ({
    id: `${ruleId}${route}`,
    ruleId,
    impact,
    wcagTags: [],
    route,
    selector: 's',
    html: '',
    category: null,
    sourceFile: null,
    sourceLine: null,
    mappingConfidence: null,
    status: 'open',
    notes: [],
  });

  it('counts by rule, impact, and route', () => {
    const s = summarize([v('a', '/', 'minor'), v('a', '/x', 'minor'), v('b', '/', null)]);
    expect(s).toEqual({
      total: 3,
      byRule: { a: 2, b: 1 },
      byImpact: { minor: 2, unknown: 1 },
      byRoute: { '/': 2, '/x': 1 },
    });
    expect(formatSummary(s)).toContain('Scanner-detected violation nodes: 3');
  });
});
