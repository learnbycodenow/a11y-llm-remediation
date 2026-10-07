# Phase Prompts

Paste one prompt at a time. After each phase: run the tests yourself, read the
diff, commit, then move on. Do not paste the next prompt until the done-criteria
are met.

---

## Phase 0: Plan (no code)

```
Read .github/copilot-instructions.md and docs/PROJECT_BRIEF.md fully. Do not write code yet.

Please:
1. Confirm your understanding of the pipeline and the two modes in your own words.
2. Propose the final folder structure and module boundaries.
3. Propose the TypeScript types for the violation schema and the patch format.
4. List the main technical risks, especially mapping a rendered DOM element back
   to an Angular template file and line.
5. Recommend a public Angular app as the first target and explain the choice.
6. Break the work into the phases in PROMPTS.md and flag anything you would
   change.
7. Read the "Positioning" and "Related work and baselines" sections of the brief.
   Create a first draft of docs/RELATED_WORK.md with the candidates listed there,
   marking every entry "unverified" until its repository or paper has been read.
   Do not describe any tool from memory.
8. Ask any questions you need answered before starting.

Wait for my approval before starting Phase 1.
```

**Done when:** you have read the plan, answered its questions, and approved it.

---

## Phase 1: Project scaffold and baseline scanner

```
Implement Phase 1.

1. Scaffold the TypeScript project: package.json, strict tsconfig, vitest,
   .gitignore (node_modules, out, .env), .env.example, and
   a11y.config.example.yaml matching docs/PROJECT_BRIEF.md.
2. Config loader: parse the YAML with zod, with clear error messages.
3. CLI with commander. Add the command `a11y scan --config <file>`.
4. Scanner: start (or connect to) the target app, wait for readiness, visit each
   configured route with Playwright, run axe-core, and write out/violations.json
   using the schema in the brief (category and source fields can be null for now).
5. Optional auth steps from the config, with credentials read from environment
   variables.
6. Tests with fixtures for the config loader and result normalizer. Do not
   require a live app for unit tests.
7. README section: install, configure, and run the scan.

Stop when done. Report the baseline command to run, and any limitations.
```

**Done when:** `a11y scan` produces `violations.json` for the target app, tests pass, and you have saved the baseline counts.

---

## Phase 2: Classification and source mapping

```
Implement Phase 2.

1. Classifier: tag each violation as rule_fixable, needs_judgment, or layout.
   Base the first version on a documented mapping from axe rule IDs to
   categories, stored in a data file, not scattered through code. Unknown
   rules default to needs_judgment.
2. Source mapper: for each violation, find the most likely Angular template file
   and line. Use the selector, HTML snippet, and text content to search the
   target's templates, using a parser that preserves positions. Set
   mappingConfidence to high, medium, low, or none, and add notes explaining
   low-confidence results. Never guess silently.
3. Add the commands `a11y classify` and `a11y map` that read and update
   violations.json.
4. Tests with fixture templates covering exact matches, ambiguous matches
   (the same HTML in several templates), and no match.
5. Add a summary printout: counts by category and by mapping confidence.

Stop when done. Show me the summary for the current baseline.
```

**Done when:** every violation has a category and a confidence level, and ambiguous cases are flagged, not guessed.

---

## Phase 3: Rule-based fixer (no AI)

```
Implement Phase 3.

1. Define a FixRule interface: which axe rule IDs it handles, a function that
   takes a violation plus parsed template context and returns either a patch or
   an explicit "cannot fix safely" result with a reason.
2. Implement the starting catalog from docs/PROJECT_BRIEF.md, one file per rule,
   each with its own tests (positive cases, negative cases, and cases where it
   must decline).
3. Add a registry that routes violations to rules and records the outcome in
   violations.json.
4. Skip any violation with mappingConfidence low or none unless I pass an
   explicit flag.
5. Patches are produced as structured edits (file, start, end, replacement) plus
   a unified diff derived from them. Not applied yet.
6. Add the command `a11y fix --mode rules-only` that writes out/patches/.
7. Prove with a test that this mode makes no network calls and needs no API key.

Stop when done. List which rules were implemented, which were skipped, and why.
```

**Done when:** the rules produce valid diffs for the cases they cover, decline the rest, and the offline test passes.

---

## Phase 4: Apply, validate, and re-scan

```
Implement Phase 4.

1. Patch applier: create a git worktree of the target repo on a new branch
   (under out/work/<mode>, with the target's node_modules symlinked in; add a
   config option to run the install command instead if the symlink fails). Apply
   each patch separately there, and record applied or rejected with a reason.
2. After applying, run the target's build (command from config) in the worktree.
   If a patch breaks the build, revert it and mark it rejected.
3. Re-scan the worktree using the same configuration and write
   out/<mode>/violations.after.json.
4. Comparison step: for every original violation, mark fixed or unchanged; list
   newly introduced violations separately.
5. Add `a11y apply` and `a11y rescan` commands, plus `a11y run` that executes the
   whole rules-only pipeline end to end.
6. Tests for the applier (using a temporary git repo fixture) and the comparison.
7. Never modify the target's main branch or its original working tree; all
   changes live in the worktree branch.

Stop when done. Show me a before/after summary from a real run.
```

**Done when:** `a11y run` works end to end in `rules-only` mode and the comparison counts are correct.

---

## Phase 5: Optional LLM fixer

```
Implement Phase 5.

1. Define a vendor-neutral LlmProvider interface. Users must be able to use any
   LLM or AI service API they choose, including hosted APIs and local models.
   Do not make any single vendor the required or only option.
   - Config sets provider, model ID, baseUrl (optional), the name of the
     environment variable holding the API key, and optional per-million-token
     input and output prices. Never hardcode a vendor, model ID, or price.
   - Ship a generic adapter for OpenAI-compatible chat endpoints (covers many
     hosted services and local servers) and keep each vendor-specific adapter in
     its own file so more can be added. Prefer plain HTTP over vendor SDKs so no
     SDK is a required dependency; ask before adding any SDK.
   - Users bring their own key. Keys come from environment variables only.
2. Create versioned prompt files under prompts/, one per violation type that
   needs judgment (for example missing alt text, unlabeled controls, link
   purpose). Each prompt must instruct the model to return only a structured
   edit (JSON: the replacement text for the provided snippet), with no prose.
3. Send only the violation, the rule description, and the minimal template
   snippet. Validate the response: valid JSON against a schema, replacement
   limited to the target snippet, no extra files, and the resulting unified diff
   (generated by our code, never by the model) applies cleanly. Reject
   everything else with a reason.
4. Log every call: prompt version, provider, model ID, input and output tokens,
   latency, retries, estimated cost (only if prices are configured, otherwise
   "unknown"), and the raw response.
5. Enforce maxViolations and budgetUsd from config; stop and report when
   either is reached. If no prices are configured, enforce an optional token
   cap instead and say so in the output.
6. Add --dry-run and a record/replay mode so tests never call the API.
7. Wire it in as `a11y fix --mode rules+llm`: rules first, then the LLM on
   leftovers only. Feed results into the same apply and re-scan steps.
8. Tests using recorded responses, including malformed and hostile responses
   (extra files, wide edits, prose instead of JSON).

Stop when done. Show me one dry-run and explain what a real run would cost,
using the configured prices or, if none, token counts.
```

**Done when:** `rules+llm` works end to end, malformed responses are rejected, and the cost controls are enforced.

---

## Phase 6: Comparison report

```
Implement Phase 6.

1. Add `a11y report` that reads the outputs of both modes (run each against the
   same baseline) and writes out/report.md and out/report.json.
2. Include everything listed under "Report contents" in docs/PROJECT_BRIEF.md:
   before/after counts by rule and category, fixed/unchanged/new, patches applied
   versus rejected with reasons, LLM tokens and cost, cost per fix, the
   incremental gain of rules+llm over rules-only, at least three example
   failures, and a plain statement of what the scanner cannot detect.
   LLM statistics must be vendor-neutral and apply to any model: provider and
   model ID, requests, input and output tokens, latency, retries, accepted versus
   rejected responses, fixes per 1,000 tokens, and cost only when prices were
   configured.
3. Add a manual review sheet: a CSV listing each LLM-fixed violation with the
   original code, the patched code, and empty columns for "correct? (y/n)" and
   "reviewer notes", so fixes can be hand-checked.
4. Add an optional "External baseline" section to the report. It should accept
   results from one existing open-source tool run on the same commit, routes, and
   scan configuration, with the tool's version, settings, model, and cost recorded.
   Present these as results under stated conditions, never as a ranking. If the
   conditions differ, say so in the report.
5. Add a manual-review summary: how many LLM-fixed violations were reviewed, how
   many were judged correct, and notes on common errors, read from the completed
   review CSV.
6. Use neutral wording. Do not claim compliance. State every number's source.
7. Tests for the report generator using fixture data.

Stop when done. Show me the generated report.
```

**Done when:** one command produces a report that compares both modes and a review sheet for manual checking.

---

## Phase 7: Documentation and release polish

```
Implement Phase 7.

1. README: problem statement, how it works (include a mermaid diagram of the
   pipeline), quick start for rules-only, setup for rules+llm (API key and cost
   notes), configuration reference, example report excerpt, limitations, and
   credits.
2. Add the MIT LICENSE, a CONTRIBUTING.md, and a SECURITY.md noting how API keys
   are handled.
3. Add a GitHub Actions workflow that runs lint, type-check, and unit tests only
   (no API calls, no live app).
4. Write docs/DECISIONS.md summarizing the key design choices and trade-offs.
5. Finalize docs/RELATED_WORK.md. For every entry, read the repository or paper,
   record the license and last-checked date, and state how this project differs.
   Remove anything you could not verify. Link the file from the README under a
   "Related work" heading.
6. Review the repo for secrets, employer-specific content, and any claim of
   compliance. Report what you find.

Stop when done. List anything I should verify manually before making the repo public.
```

**Done when:** a stranger could clone the repo, run `rules-only` in minutes, and understand the limits.

---

## Handy side prompts

**Start of each new session**
```
Read .github/copilot-instructions.md and docs/PROJECT_BRIEF.md. Summarize the current state of the repo,
which phase we are in, and what is left. Do not change anything yet.
```

**If the assistant drifts or adds unrequested features**
```
Stop. Re-read .github/copilot-instructions.md. List what you changed that was not part of this phase.
Revert anything out of scope and continue with only the current phase.
```

**Before a commit**
```
Run the tests and the linter. Summarize the changes in plain language, list any
risks, and suggest a conventional commit message. Do not commit.
```

**To review code you did not write**
```
Explain this module as if I must present it in a design review: what it does, the
main design choices, how it fails, and what I would change with more time.
```
