# a11y-remediation

Open-source CLI that scans a locally running Angular app for accessibility
violations (axe-core via Playwright), applies fixes, and re-scans to measure the
effect. Results describe **scanner-detected violations only**. They say nothing
about whether an app is compliant or accessible.

Status: Phase 1 (scan only). See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md)
for the full plan and [PROMPTS.md](PROMPTS.md) for the phases.

## Install

Requires Node 20.12 or newer.

```bash
npm install
npx playwright install chromium
```

## Configure

```bash
cp a11y.config.example.yaml a11y.config.yaml
```

Edit `a11y.config.yaml`:

| Key | Meaning |
|---|---|
| `target.path` | Local clone of the Angular app. Relative paths are resolved from the config file. |
| `target.startCommand` | Optional. Run in `target.path` if the app is not already running. If the app already answers at `baseUrl`, the scanner connects to it and does not start or stop anything. |
| `target.baseUrl`, `readyPath`, `readyTimeoutMs` | Where to wait for readiness, and for how long. |
| `routes` | Routes to visit; each must start with `/`. |
| `auth` | Optional login steps (`fill` and `click`). Credentials come from environment variables named by `valueEnv`. |
| `scan.tags` | Optional axe tags (for example `wcag2a`, `wcag2aa`). Empty means axe defaults. |
| `output.dir` | Where results are written. |

Credentials and API keys are read from environment variables only. Copy
`.env.example` to `.env` (ignored by git) if you want the CLI to load them for
you; variables already set in your shell take precedence.

Only scan apps you run locally.

## Run the scan

```bash
npm run a11y -- scan --config a11y.config.yaml
```

This builds the CLI, starts the app if needed, visits each route, runs axe-core,
and writes:

- `out/violations.json`: one entry per failing DOM node (schema in the brief;
  `category`, `sourceFile`, `sourceLine`, and `mappingConfidence` are `null`
  until later phases).
- `out/baseline-summary.json`: counts by rule, impact, and route.

The same run printed to the console is your baseline.

## Test

```bash
npm run typecheck
npm test
```

Unit tests use fixtures and need neither a browser nor a running app.

## Limitations (Phase 1)

- Scanning only; no fixes are made yet.
- Violation ids hash the rule, route, and CSS selector. Selectors can change
  when the DOM changes, which matters for later before/after comparison.
- Axe finds only a subset of accessibility problems. Passing a scan does not
  mean an app is accessible.
- Results can vary with timing or data. Compare repeated scans before drawing
  conclusions.
