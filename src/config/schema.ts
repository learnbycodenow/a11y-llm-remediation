import { z } from 'zod';

const nonEmpty = z.string().min(1);

const fillStep = z.strictObject({
  fill: z.strictObject({ selector: nonEmpty, valueEnv: nonEmpty }),
});
const clickStep = z.strictObject({
  click: z.strictObject({ selector: nonEmpty }),
});
const authStep = z.union([fillStep, clickStep]);

const route = z.string().startsWith('/', 'routes must start with "/"');

const llmSchema = z.strictObject({
  provider: nonEmpty,
  model: z.string().default(''),
  baseUrl: z.string().default(''),
  apiKeyEnv: nonEmpty.default('LLM_API_KEY'),
  pricing: z
    .strictObject({
      inputPerMTokUsd: z.number().nonnegative(),
      outputPerMTokUsd: z.number().nonnegative(),
    })
    .optional(),
  maxViolations: z.number().int().positive().default(25),
  budgetUsd: z.number().nonnegative().default(2),
  maxTotalTokens: z.number().int().positive().optional(),
});

export const configSchema = z
  .strictObject({
    target: z.strictObject({
      path: nonEmpty,
      startCommand: nonEmpty.optional(),
      baseUrl: z.url(),
      readyPath: route.default('/'),
      readyTimeoutMs: z.number().int().positive().default(120_000),
    }),
    routes: z.array(route).min(1, 'at least one route is required'),
    auth: z
      .strictObject({
        loginRoute: route,
        steps: z.array(authStep).min(1),
      })
      .optional(),
    scan: z
      .strictObject({ tags: z.array(nonEmpty).default([]) })
      .default({ tags: [] }),
    mode: z.enum(['rules-only', 'rules+llm']).default('rules-only'),
    llm: llmSchema.optional(),
    output: z.strictObject({ dir: nonEmpty.default('./out') }).default({ dir: './out' }),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.mode !== 'rules+llm') return;
    if (!cfg.llm) {
      ctx.addIssue({ code: 'custom', path: ['llm'], message: 'required when mode is "rules+llm"' });
    } else if (cfg.llm.model.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['llm', 'model'], message: 'required when mode is "rules+llm"' });
    }
  });

export type AuthStep = z.infer<typeof authStep>;
export type RawConfig = z.infer<typeof configSchema>;

/** Config with paths resolved to absolute paths. */
export interface Config extends Omit<RawConfig, 'target' | 'output'> {
  target: RawConfig['target'] & { path: string };
  output: { dir: string };
  configDir: string;
  /** Hash of the parsed config before path resolution, so it is portable across machines. */
  configHash: string;
}
