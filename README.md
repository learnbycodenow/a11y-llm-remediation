# a11y-remediation

Open-source CLI that scans a locally running Angular app for accessibility
violations (axe-core via Playwright), applies fixes, and re-scans to measure the
effect. Results describe **scanner-detected violations only**. They say nothing
about whether an app is compliant or accessible.

Status: Phase 2 (scan, classify, map). See [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md)
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

## Classify and map

Both commands read and update `out/violations.json` and print a summary of counts
by category and by mapping confidence.

```bash
npm run a11y -- classify --config a11y.config.yaml
npm run a11y -- map --config a11y.config.yaml
```

- `classify` tags each violation `rule_fixable`, `needs_judgment`, or `layout`
  using [data/rule-categories.json](data/rule-categories.json). Unknown rules
  default to `needs_judgment`. Edit that file to change a rule's category.
- `map` finds the most likely Angular template file and line (paths are relative
  to `target.path`) and sets `mappingConfidence` to `high`, `medium`, `low`, or
  `none`. The `notes` field says why, and ambiguous cases list every candidate in
  `sourceCandidates` instead of picking silently. Re-run `scan` first if your
  `violations.json` predates Phase 2, so each node carries its component chain.

How the mapper decides is described in [docs/DECISIONS.md](docs/DECISIONS.md).

## Test

```bash
npm run typecheck
npm test
```

Unit tests use fixtures and need neither a browser nor a running app.

## Limitations

- Scanning, classification, and mapping only; no fixes are made yet.
- A mapped location is a best guess from static matching, with a stated
  confidence. It is not proof that the template produced the node.
- Violation ids hash the rule, route, and CSS selector. Selectors can change
  when the DOM changes, which matters for later before/after comparison.
- Axe finds only a subset of accessibility problems. Passing a scan does not
  mean an app is accessible.
- Results can vary with timing or data. Compare repeated scans before drawing
  conclusions.
