import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, parseConfig } from '../src/config/load.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => path.join(here, 'fixtures', 'config', name);

describe('config loader', () => {
  it('applies defaults and resolves paths relative to the config file', () => {
    const cfg = loadConfig(fixture('minimal.yaml'));
    expect(cfg.mode).toBe('rules-only');
    expect(cfg.target.readyPath).toBe('/');
    expect(cfg.target.readyTimeoutMs).toBe(120_000);
    expect(cfg.scan.tags).toEqual([]);
    expect(cfg.target.path).toBe(path.join(here, 'fixtures', 'config', 'app'));
    expect(cfg.output.dir).toBe(path.join(here, 'fixtures', 'config', 'out'));
    expect(cfg.configHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('loads the shipped example config', () => {
    const cfg = loadConfig(path.join(here, '..', 'a11y.config.example.yaml'));
    expect(cfg.routes).toEqual(['/', '/login', '/register']);
    expect(cfg.auth?.steps).toHaveLength(3);
    expect(cfg.llm?.provider).toBe('openai-compatible');
  });

  it('reports every problem with its path', () => {
    const run = () => loadConfig(fixture('invalid.yaml'));
    expect(run).toThrow(ConfigError);
    try {
      run();
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toContain('target.baseUrl');
      expect(msg).toContain('target');
      expect(msg).toContain('routes.0');
      expect(msg).toContain('llm: required when mode is "rules+llm"');
    }
  });

  it('rejects unknown top-level keys', () => {
    const text = 'target: {path: a, baseUrl: "http://x.test"}\nroutes: [/]\ntypo: 1\n';
    expect(() => parseConfig(text, '/tmp')).toThrow(/typo/);
  });

  it('requires a model for rules+llm', () => {
    const text = [
      'target: {path: a, baseUrl: "http://x.test"}',
      'routes: [/]',
      'mode: rules+llm',
      'llm: {provider: openai-compatible, model: ""}',
    ].join('\n');
    expect(() => parseConfig(text, '/tmp')).toThrow(/llm\.model/);
  });

  it('does not require llm settings for rules-only', () => {
    const text = 'target: {path: a, baseUrl: "http://x.test"}\nroutes: [/]\n';
    expect(parseConfig(text, '/tmp').llm).toBeUndefined();
  });

  it('gives a clear error for invalid YAML', () => {
    expect(() => parseConfig('a: [unclosed', '/tmp')).toThrow(/invalid YAML/);
  });

  it('gives a clear error for a missing file', () => {
    expect(() => loadConfig(fixture('does-not-exist.yaml'))).toThrow(/cannot read config file/);
  });
});
