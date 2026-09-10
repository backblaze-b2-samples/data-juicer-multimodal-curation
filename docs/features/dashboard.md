<!-- last_verified: 2026-09-10 -->
# Feature: Dashboard

## Purpose
Give an at-a-glance overview of curation activity: recipes and runs, raw vs
refined vs stats storage on B2, and pass/dedup ratios.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /curation/summary`, `GET /runs`

## Core Functions
- `apps/web/src/components/dashboard/curation-stats.tsx` — 4 stat cards (recipes, runs, pass rate, dedup ratio) + a storage-split card
- `apps/web/src/components/dashboard/recent-runs-table.tsx` — most recent runs
- `apps/web/src/lib/queries.ts` — `useCurationSummary()`, `useRuns()`
- `services/api/app/runtime/curation.py` — `GET /curation/summary` handler
- `services/api/app/service/summary.py` — aggregation logic
- `services/api/app/repo/b2_dataset.py` — prefix-scoped B2 listings

## Canonical Files
- Dashboard stats: `apps/web/src/components/dashboard/curation-stats.tsx`
- Summary service: `services/api/app/service/summary.py`

## Inputs
- None (loads automatically)

## Outputs
- `GET /curation/summary` → `CurationSummary` (recipe_count, run_count, raw/refined/stats bytes + human, total samples in/out/filtered, pass_rate, dedup_ratio)
- `GET /runs` → `RunRecord[]` for the recent-runs table

## Flow
- Page loads → `useCurationSummary()` and `useRuns()` fetch in parallel
- Stat cards: recipes, runs, pass rate, dedup ratio
- Storage-split card: raw vs refined vs stats human sizes (from prefix-scoped B2 listings)
- Recent runs table: recipe, modality, samples in → out, status badge; "View all" links to `/runs`

## Edge Cases
- API unavailable → `ErrorState` with retry
- No recipes/runs yet → zeros and an empty recent-runs table
- Storage numbers reflect a fresh (uncached) prefix listing for `configs`/`stats`; `raw`/`refined` go through the shared bucket listing cache

## UX States
- Loading: escalating "Loading curation metrics…" notice + skeletons
- Empty: zeros, "No runs yet"
- Loaded: populated cards, storage split, recent runs

## Verification
- Test files: `services/api/tests/test_recipes.py`, `services/api/tests/test_curation.py`
- Required cases: summary aggregates over runs, recent runs sorted newest-first, API error fallback
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
