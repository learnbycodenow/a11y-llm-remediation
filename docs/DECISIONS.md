# Design decisions

Short records of non-obvious choices. Newest last.

## Vendor-neutral LLM layer
Users bring any provider, model, and key. Config names the env var holding the key;
vendor, model ID, and prices are never hardcoded. Cost is reported only when prices
are configured. (Phase 5.)

## Patches are structured edits; diffs are derived
A patch is a list of range edits against the original file, and our code generates
the unified diff. LLMs return JSON replacements, not diffs, because models often get
diff line numbers and context wrong. (Phases 3 and 5.)

## Fixes are applied in a git worktree
Changes go to a worktree on a new branch, never the target's checked-out tree, with
`node_modules` symlinked to avoid a second install. (Phase 4.)

## TypeScript 5.9 is a runtime dependency
The mapper reads `@Component` metadata with the TypeScript compiler API. TypeScript
7.x ships no programmatic API, so the project pins `~5.9`.

## Category is the first stage to try, not a final verdict
`data/rule-categories.json` maps axe rule IDs to `rule_fixable`, `needs_judgment`, or
`layout`, with a rationale per rule. Unknown rules default to `needs_judgment`.
`rule_fixable` means "a deterministic rule may be able to fix this"; the rule can
still decline. Whether the LLM also receives declined `rule_fixable` violations is
decided in Phase 5.

## Host chain captured at scan time
Axe selectors are the shortest unique selector, not the full DOM path, so they rarely
name the owning component. The scanner therefore records each failing node's
custom-element ancestors (`hostChain`). The mapper uses it to pick the candidate
templates, and falls back to the selector when the field is absent.

## Source mapping is static and conservative
The mapper matches the rendered snippet (tag, static attributes, text) to template
elements parsed with `@angular/compiler`, searching only the templates of ancestor
components. Bound attributes and interpolated text act as wildcards. A static
attribute or text in the template that is missing from the rendered node rules a
candidate out.

Confidence: `high` = one candidate, in the nearest component, with attribute or text
evidence; `medium` = weak evidence, several candidates with one clearly best, a
farther (possibly content-projected) owner, or a library component directly above;
`low` = tied candidates (all listed in `sourceCandidates`); `none` = nothing matches.

Known limits: candidates are not told apart by child content (for example identical
fieldsets that differ only in their inputs); `nth-child` positions are ignored; nodes
inside shadow DOM or iframes get no host chain; attribute-selector components are
found only by a search of every template.
