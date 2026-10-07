# a11y-remediation

Open-source CLI that scans a locally running Angular app for accessibility
violations (axe-core via Playwright), applies fixes, and re-scans to measure
the effect. It works in two modes:

- `rules-only`: deterministic fixes, fully offline, no API key.
- `rules+llm`: rules run first; an LLM handles only the violations the rules
  could not fix.

Read `docs/PROJECT_BRIEF.md` for the full specification before changing code.

## Scope and safety

- Targets are public, open-source Angular apps that the user runs locally.
  Never scan third-party live sites.
- Never include code, data, screenshots, or details from any employer or
  client system anywhere in this repo.
- Never edit target app files in place. All changes are applied as diffs in a
  git worktree on a new branch of the target repo. Log every patch, including
  rejected ones.
- Never claim an app is "compliant" or "accessible". Report only
  scanner-detected violations and what was manually reviewed.
- Secrets come from environment variables only. Never commit keys. Keep
  `.env.example` current and `.env` in `.gitignore`.

## Stack

- TypeScript (strict), Node 20+, npm.
- Scanner: `playwright` + `@axe-core/playwright`.
- CLI: `commander`. Config: YAML validated with `zod`. Tests: `vitest`.
- Template edits must use a parser that preserves source positions (for
  example `@angular/compiler`). Never regex-edit templates blindly.
- Ask before adding any dependency not listed here, and say why it is needed.

## Architecture

Pipeline order: scan -> classify -> rule fixer -> (optional) LLM fixer for
leftovers only -> apply as diff -> re-scan -> report.

- One module per stage under `src/`, communicating through typed JSON files
  in the output directory, so any stage can be re-run on its own.
- The rule fixer is a registry of small, individually tested fix rules. Each
  rule declares which axe rule IDs it handles, and returns a patch or a
  "cannot fix safely" result. When unsure, it declines.
- The LLM fixer sits behind a vendor-neutral `LlmProvider` interface. Users
  bring their own provider, model, and API key. Vendor, model ID, and prices
  come from config, never hardcoded. Each provider adapter is isolated in its
  own file, with a generic OpenAI-compatible adapter first.
- `rules-only` mode must run with no network access and no API key. A test
  must prove that.

## LLM usage rules

- Send only the violation, the rule description, and the minimal template
  snippet. Do not send whole files or unrelated source.
- Require a structured edit (JSON replacement for the snippet) as the response,
  never a model-written diff. Our code derives the unified diff. Validate the
  format before accepting it. Reject anything touching code outside the
  target snippet.
- Prompts live in versioned files under `prompts/`, one per violation type.
- Log for every call: prompt version, model ID, token counts, cost estimate,
  and the raw response.
- Provide `--dry-run` and a record/replay mode so tests never call the API.
- Enforce a configurable budget cap and a maximum number of violations per run.

## Quality

- Small, typed functions. No `any` without a comment explaining why.
- Every module has tests. Use fixtures, not live apps, for unit tests.
- Fail loudly with clear errors. Never swallow exceptions.
- Record non-obvious design choices in `docs/DECISIONS.md`.
- Conventional commit messages, one logical change per commit.

## Working agreement

- Work one phase at a time, as defined in `PROMPTS.md`. Do not start the next
  phase without approval.
- At the end of each phase: run all tests, summarize what changed, list known
  limitations, and state the done-criteria status.
- If a requirement is ambiguous or a task would break a rule above, stop and
  ask instead of guessing.
