import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { configSchema, type Config } from './schema.js';

export class ConfigError extends Error {
  override name = 'ConfigError';
}

export function parseConfig(text: string, configDir: string, source = 'config'): Config {
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    throw new ConfigError(`${source}: invalid YAML: ${(err as Error).message}`);
  }

  const result = configSchema.safeParse(raw);
  if (!result.success) {
    const lines = result.error.issues.map((i) => {
      const where = i.path.length > 0 ? i.path.join('.') : '(root)';
      return `  - ${where}: ${i.message}`;
    });
    throw new ConfigError(`${source} is invalid:\n${lines.join('\n')}`);
  }

  const parsed = result.data;
  const configHash = createHash('sha256').update(JSON.stringify(parsed)).digest('hex');
  return {
    ...parsed,
    target: { ...parsed.target, path: path.resolve(configDir, parsed.target.path) },
    output: { dir: path.resolve(configDir, parsed.output.dir) },
    configDir,
    configHash,
  };
}

export function loadConfig(file: string): Config {
  const abs = path.resolve(file);
  let text: string;
  try {
    text = readFileSync(abs, 'utf8');
  } catch (err) {
    throw new ConfigError(`cannot read config file ${abs}: ${(err as Error).message}`);
  }
  return parseConfig(text, path.dirname(abs), abs);
}
