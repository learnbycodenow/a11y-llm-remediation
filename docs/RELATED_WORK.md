# Related work and baselines

Status: first draft. Every entry is **unverified**. Nothing below describes a tool
from its repository or paper; "Pointer from brief" only restates what
`docs/PROJECT_BRIEF.md` says to review. Fields stay "not yet read" until the
source has been read, and entries that cannot be verified will be removed.

Per-entry fields: name, link, what it does, license, last-checked date, how this
project differs.

## Candidates

### axle

- Status: unverified
- Link: https://github.com/asafamos/axle (from brief; not yet opened)
- Pointer from brief: PR-oriented scanning with axe-core and LLM-generated fix
  suggestions, with a confidence rating and manual-review flag per fix.
- What it does: not yet read
- License: not yet read
- Last checked: never
- How this project differs: not yet assessed
- External baseline candidate: undecided (needs license check and a local run)

### OpenSpec

- Status: unverified
- Link: not yet located (the brief names it only as a FOSS hackathon project)
- Pointer from brief: axe-core detection with LLM-generated HTML fixes shown
  as diffs.
- What it does: not yet read
- License: not yet read
- Last checked: never
- How this project differs: not yet assessed
- External baseline candidate: undecided

### AccessGuru

- Status: unverified
- Link: arXiv 2507.19549 (from brief; not yet opened)
- Pointer from brief: taxonomy of syntactic, semantic, and layout violations;
  combines scanning with LLM correction.
- What it does: not yet read
- Code or data availability: not yet checked
- License: not yet read
- Last checked: never
- How this project differs: not yet assessed

### Automated Accessibility Remediation for Web and Angular SPAs

- Status: unverified
- Link: arXiv 2602.17887 (from brief; not yet opened)
- Pointer from brief: closest academic match to this project's target stack.
- What it does: not yet read
- Code or data availability: not yet checked
- License: not yet read
- Last checked: never
- How this project differs: not yet assessed

### A11yRepair

- Status: unverified
- Link: not yet located
- Pointer from brief: repair work using real projects; check whether data or
  code are public.
- What it does: not yet read
- Code or data availability: not yet checked
- License: not yet read
- Last checked: never
- How this project differs: not yet assessed

### A11y-Bench

- Status: unverified
- Link: not yet located
- Pointer from brief: benchmark work using real projects; check whether data or
  code are public.
- What it does: not yet read
- Code or data availability: not yet checked
- License: not yet read
- Last checked: never
- How this project differs: not yet assessed

### angular-eslint template accessibility rules

- Status: unverified
- Link: not yet located
- Pointer from brief: possible source of deterministic checks and fixes.
- What it does: not yet read
- Which rules exist and whether any have autofixes: not yet checked
- License: not yet read
- Last checked: never
- How this project differs: not yet assessed

## Foundations to credit (not yet verified for this file)

- axe-core and `@axe-core/playwright`: confirm license and version before
  crediting in the README.
- Playwright: confirm license and version before crediting in the README.

## Open items

- Read each source above and fill in every field, or remove the entry.
- Decide whether one entry can be run fairly as the optional external baseline
  (open source, license permits use, runs locally on the same commit, routes,
  and scan configuration).
- Link this file from the README under a "Related work" heading (Phase 7).
