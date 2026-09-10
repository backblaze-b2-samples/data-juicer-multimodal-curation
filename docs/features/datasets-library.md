<!-- last_verified: 2026-09-10 -->
# Feature: Datasets Library

## Purpose
A modality-aware, prefix-scoped browse of the app's own datasets (`raw`,
`refined`, `stats`, `configs`) — distinct from, and additional to, the kept
full-bucket File Explorer.

## Used By
- UI: `/datasets`
- API: `GET /files` (scoped by `prefix`), `POST /datasets/seed`, `GET /files-by-key/download`

## Core Functions
- `apps/web/src/components/datasets/datasets-browser.tsx` — prefix selector, seed control, grouped object table with downloads
- `apps/web/src/lib/queries.ts` — `useFiles(prefix)`, `useSeedDataset()`, `useDownloadUrl()`
- `services/api/app/runtime/curation.py` — `POST /datasets/seed`
- `services/api/app/service/seed.py` — synthetic corpus generation

## Canonical Files
- Browser component: `apps/web/src/components/datasets/datasets-browser.tsx`

## Inputs
- Prefix selection: `raw/` | `refined/` | `stats/` | `configs/`
- Seed modality: `text` | `image-text`

## Outputs
- A grouped listing of objects under the selected prefix (grouped by inferred modality for `raw/`)
- Seed: a tiny synthetic corpus (PIL images + text JSONL) written under `raw/`; returns a `SeedResult`
- Per-row download via a presigned GET URL

## Flow
- Select a prefix → `GET /files?prefix=<prefix>` (served from the shared listing cache)
- For `raw/`, rows are grouped by modality inferred from the object key (image-text / video / audio / text)
- Seed demo corpus → `POST /datasets/seed?modality=…` → objects appear after cache invalidation
- Download → `GET /files-by-key/download` presigns and the browser fetches directly from B2

## Edge Cases
- Empty prefix → empty state prompting to seed or run a recipe
- API error → inline `ErrorState` with retry
- The full-bucket explorer remains available under `/files` (non-negotiable keep)

## UX States
- Empty: "Nothing under `<prefix>`"
- Loading: skeleton rows
- Loaded: grouped tables with sizes and download actions

## Verification
- Test files: `services/api/tests/test_recipes.py` (seed/list share the repo boundary), `apps/web/src/lib/queries.test.ts`
- Required cases: seed writes objects under `raw/`, scoped listing returns only the prefix
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [File Browser](file-browser.md)
- [docs/app-workflows.md](../app-workflows.md)
