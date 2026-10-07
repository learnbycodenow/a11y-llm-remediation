import { spawn, type ChildProcess } from 'node:child_process';
import type { Config } from '../config/schema.js';

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{ status: number }>;

export interface AppHandle {
  /** true when the app was already running and we did not start it. */
  connected: boolean;
  stop(): Promise<void>;
}

export function readyUrl(config: Pick<Config, 'target'>): string {
  return new URL(config.target.readyPath, config.target.baseUrl).toString();
}

export async function isReady(url: string, fetchFn: FetchLike = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(url, { signal: AbortSignal.timeout(2_000) });
    return res.status < 400;
  } catch {
    // Connection refused or timeout simply means "not ready yet".
    return false;
  }
}

export async function waitForReady(
  url: string,
  timeoutMs: number,
  opts: { intervalMs?: number; fetchFn?: FetchLike; aborted?: () => string | null } = {},
): Promise<void> {
  const { intervalMs = 1_000, fetchFn = fetch, aborted } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const reason = aborted?.() ?? null;
    if (reason) throw new Error(reason);
    if (await isReady(url, fetchFn)) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`app at ${url} was not ready within ${timeoutMs} ms`);
}

function killGroup(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, signal); // negative pid: the whole process group
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ESRCH') throw err;
  }
}

export async function startApp(config: Config): Promise<AppHandle> {
  const url = readyUrl(config);

  if (await isReady(url)) {
    return { connected: true, stop: async () => {} };
  }

  const { startCommand, path: cwd } = config.target;
  if (!startCommand) {
    throw new Error(`app at ${url} is not running and no target.startCommand is configured`);
  }

  const child = spawn(startCommand, { cwd, shell: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let tail = '';
  const keep = (chunk: Buffer): void => {
    tail = (tail + chunk.toString()).slice(-2_000);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);

  let exitInfo: string | null = null;
  child.on('exit', (code, signal) => {
    exitInfo = `start command "${startCommand}" exited early (code ${code}, signal ${signal})\n${tail}`;
  });
  child.on('error', (err) => {
    exitInfo = `could not run start command "${startCommand}": ${err.message}`;
  });

  const stop = async (): Promise<void> => {
    if (exitInfo !== null) return;
    killGroup(child, 'SIGTERM');
    await new Promise((r) => setTimeout(r, 1_500));
    if (exitInfo === null) killGroup(child, 'SIGKILL');
  };

  try {
    await waitForReady(url, config.target.readyTimeoutMs, { aborted: () => exitInfo });
  } catch (err) {
    await stop();
    throw new Error(`${(err as Error).message}\nlast output of "${startCommand}":\n${tail}`);
  }
  return { connected: false, stop };
}
