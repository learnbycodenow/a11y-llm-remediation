# Project Brief: a11y-remediation

## Purpose

A command-line tool that measures how much of an Angular app's
scanner-detectable accessibility violations can be fixed automatically, with
and without an LLM, and reports the results honestly.

## Goals

1. Scan a locally running Angular app and produce a baseline violation report.
2. Fix what can be fixed with deterministic rules.
3. Optionally send the leftovers to an LLM for suggested fixes.
4. Re-scan and report fixed, unchanged, and newly introduced violations.
5. Compare `rules-only` against `rules+llm`, including LLM cost.
6. Optionally compare against one existing open-source tool as an external
   baseline, under clearly stated conditions (see "Related work and baselines").

## Positioning

This project is an open, reproducible way to measure how far deterministic
fixes, and deterministic fixes plus an LLM, can reduce scanner-detected
accessibility violations in Angular apps. It builds on published research and
open-source tooling (see "Related work and baselines") and focuses on the
evidence: what each approach fixes, what it misses, what it breaks, and what it
costs.

Distinguishing features:

- Two modes run on the same baseline: fully offline rules-only, and rules plus
  an LLM that sees only what the rules could not fix.
- Template-level source mapping with an explicit confidence level, so uncertain
  fixes are flagged instead of guessed.
- Every patch is validated against the build and a re-scan, and newly
  introduced violations are counted.
- Manual review of the LLM's output, reported alongside the scanner numbers.
- A tool anyone can clone, configure for their own Angular app, and run with or
  without an API key.

## Related work and baselines

Maintain `docs/RELATED_WORK.md`. For each entry record: name, link, what it
does, license, last-checked date, and how this project differs. Verify every
entry by reading its repository or paper before listing it. Do not describe a
tool from memory or from a summary.

Starting candidates to review (verify each before use):

- **axle** (GitHub: asafamos/axle): PR-oriented scanning with axe-core and
  LLM-generated fix suggestions, with a confidence rating and manual-review
  flag per fix.
- **OpenSpec** (FOSS hackathon project): axe-core detection with LLM-generated
  HTML fixes shown as diffs.
- **AccessGuru** (arXiv 2507.19549): taxonomy of syntactic, semantic, and
  layout violations; combines scanning with LLM correction.
- **Automated Accessibility Remediation for Web and Angular SPAs**
  (arXiv 2602.17887): closest academic match to this project's target stack.
- **A11yRepair** and **A11y-Bench**: repair and benchmark work using real
  projects; check whether their data or code are public.
- Guidance from `angular-eslint` template accessibility rules, as a source of
  deterministic checks and fixes.

### External baseline (optional)

If an existing tool is open source, its license permits the use, and it can be
run locally against the same target app and routes:

- Run it on the same commit, routes, and scan configuration.
- Record its version, settings, model (if any), and cost.
- Report its results in a separate section of the report. Present them as
  "results under these conditions", not as a ranking or head-to-head claim,
  unless the conditions are truly identical.
- If it cannot be run fairly, say so in the report and skip it.

## Non-goals

- Certifying compliance with Section 508 or WCAG.
- Replacing manual testing or assistive-technology testing.
- Scanning sites the user does not run locally.
- Fixing issues that need design decisions (for example, colour-palettes) without human review.

## Pipeline

1. **Scan**: Playwright opens each configured route; axe-core checks it.
2. **Normalize**: write `violations.json` using the schema below.
3. **Classify**: tag each violation as `rule_fixable`, `needs_judgment`, or
   `layout`.
4. **Map to source**: link each violation to the most likely template file and
   line, with an explicit confidence level.
5. **Rule fixer**: run registered fix rules on `rule_fixable` violations.
6. **LLM fixer (optional)**: handle remaining `needs_judgment` violations.
7. **Apply**: apply patches as diffs on a new branch; reject any that do not
   apply cleanly or break the build.
8. **Re-scan**: run the same scan configuration again.
9. **Report**: write `report.md` and `report.json`.

## Violation schema (violations.json)

Each entry:

| Field | Type | Notes |
|---|---|---|
| id | string | Stable hash of rule, route, and selector |
| ruleId | string | axe rule ID |
| impact | string or null | minor, moderate, serious, critical |
| wcagTags | string[] | From axe result |
| route | string | Route scanned |
| selector | string | CSS selector of the failing node |
| html | string | Failing node HTML |
| category | enum | rule_fixable, needs_judgment, layout |
| sourceFile | string or null | Best-guess template path |
| sourceLine | number or null | Best-guess line |
| mappingConfidence | enum | high, medium, low, none |
| status | enum | open, fixed_by_rule, fixed_by_llm, unfixed, rejected |
| notes | string[] | Reasons for rejection or low confidence |

## Starting catalog of rule-based fixes

Implement each only where the fix is safe and unambiguous:

- Add `type="button"` to buttons that lack a type inside non-form contexts.
- Add `lang` to the root document template if missing.
- Add `alt=""` to images already marked decorative by role or a known pattern.
- Link `<label>` to its input via matching `for` and `id` when both exist.
- Add `aria-label` from visible text already present in the element.
- Correct a skipped heading level only when the change cannot alter layout
  semantics.
- Add a missing landmark role where the structure is unambiguous.

Anything not on this list is `needs_judgment` until proven otherwise.

## Configuration (a11y.config.yaml)

```yaml
target:
  path: ../angular-realworld-example-app   # local clone of the target app
  startCommand: npm start
  baseUrl: http://localhost:4200
  readyPath: /
routes:
  - /
  - /login
  - /register
auth:                                      # optional
  loginRoute: /login
  steps:
    - fill: { selector: "input[type=email]", valueEnv: A11Y_TEST_EMAIL }
    - fill: { selector: "input[type=password]", valueEnv: A11Y_TEST_PASSWORD }
    - click: { selector: "button[type=submit]" }
mode: rules-only                           # rules-only | rules+llm
llm:
  provider: openai-compatible             # any supported provider; user's choice
  model: ""                                # set from env or config, never hardcoded
  baseUrl: ""                              # optional, for local or alternative endpoints
  apiKeyEnv: LLM_API_KEY                   # name of the env var holding the user's key
  pricing:                                 # optional; omit if unknown or local
    inputPerMTokUsd: 0
    outputPerMTokUsd: 0
  maxViolations: 25
  budgetUsd: 2.00
output:
  dir: ./out
```

## Report contents

- Violation counts before and after, by rule and by category.
- Fixed, unchanged, and newly introduced violations.
- Patches applied versus rejected, with reasons.
- For `rules+llm`: tokens, estimated cost, cost per fix, and the incremental
  gain over `rules-only`.
- Manual review results: number of LLM-fixed violations reviewed, number judged
  correct, and notes on common errors.
- If run, an "External baseline" section with the conditions listed above.
- At least three example failures with explanations.
- A short, plain statement of what the scanner cannot detect.

## Suggested repo layout

```
a11y-remediation/
  README.md
  LICENSE
  a11y.config.example.yaml
  .env.example
  docs/
    PROJECT_BRIEF.md
    DECISIONS.md
    RELATED_WORK.md
  prompts/                 # versioned LLM prompts, one per violation type
  src/
    cli.ts
    config/
    scan/
    classify/
    mapping/
    rules/                 # registry plus one file per fix rule
    llm/                   # provider interface, provider adapters, replay
    patch/
    rescan/
    report/
  test/
    fixtures/
```

## Licensing and attribution

- MIT license.
- Credit axe-core, Playwright, and any papers whose taxonomy or ideas are used.
- README must state that results describe scanner-detected violations only.
