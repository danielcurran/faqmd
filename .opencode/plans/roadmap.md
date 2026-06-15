# faqmd improvement roadmap

Five iterative phases that gradually transform the converter from a heuristics-based
formatter into a structured, production-quality pipeline. Each phase is independently
valuable — you can stop at any point.

## Phase dependencies

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
  │           │           │           │           │
  ▼           ▼           ▼           ▼           ▼
Fix bugs    No broken   Structured   LLM polishes  One-command
in current  output      extractors   edge cases    production
formatter   guarantee   + renderers  heuristics    pipeline
                        (IR)         miss
```

## Phase summary

| # | Name | Plan base | Goal | Est. effort |
|---|---|---|---|---|
| 1 | Foundation | A | Fix the worst formatter bugs — equipment tables, shop tables, whitespace | 2–3 days |
| 2 | Safety net | B + C | Add semantic extractors + confidence-based fallback to lists | 3–4 days |
| 3 | Structured IR | D | Refactor extractors/renderers into JSON schema → markdown pipeline | 4–5 days |
| 4 | LLM polish | E | Targeted LLM pass for blocks heuristics cannot fix | 3–4 days |
| 5 | Production pipeline | F | Orchestrate everything with validation and intermediate artifacts | 2–3 days |

## How to use this roadmap

1. Start a phase by reading the corresponding `phase-<N>.md` file.
2. Implement the changes described. Each phase file lists specific functions,
   test fixtures, and acceptance criteria.
3. Run `npm test` and verify the PSIV walkthrough regenerates cleanly.
4. Commit the phase. Move to the next phase or stop.

## Cross-references

- Each phase file lives under `.opencode/plans/phase-<N>-<name>.md`.
- Converter source is in `lib/` and `scripts/`.
- Agent skills are in `skills/` and mirrored in `.opencode/skills/`.
