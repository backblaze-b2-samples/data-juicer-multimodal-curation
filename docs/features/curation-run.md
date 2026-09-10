<!-- last_verified: 2026-09-10 -->
# Feature: Curation Run

## Purpose
Run a recipe end-to-end: stream raw shards from B2, clean them locally with
Data-Juicer, and write the refined dataset plus per-operator stats back to B2.

## Used By
- UI: "Run curation" on `/recipes/[id]` and the Run action on `/recipes`; results on `/runs`
- API: `POST /recipes/{recipe_id}/run`, `GET /runs`, `GET /runs/{run_id}`, `POST /datasets/seed`

## Core Functions
- `services/api/app/service/curation.py` — run orchestration, input prep, run persistence, one-at-a-time lock
- `services/api/app/service/dj_engine.py` — device detect, Data-Juicer config build, contained subprocess, log parsing
- `services/api/app/service/curation_worker.py` — the isolated subprocess that imports and runs Data-Juicer
- `services/api/app/service/seed.py` — synthetic demo corpus generator
- `services/api/app/repo/b2_dataset.py` — download source shards / upload refined + stats

## Canonical Files
- Engine boundary: `services/api/app/service/dj_engine.py`
- Subprocess entry: `services/api/app/service/curation_worker.py`

## Inputs
- A stored recipe (`configs/<id>.yaml`) and its `source_prefix` under `raw/`
- A corpus JSONL under the source prefix (each line a sample; image-text samples carry `images` object keys)

## Outputs
- `refined/<run_id>/refined.jsonl` — the cleaned dataset
- `stats/<run_id>.json` — the `RunRecord` (status, samples in/out, kept/dedup ratios, per-operator stats, device, timings)
- Side effect: B2 writes; listing cache invalidated

## Flow
- Acquire the single-run lock (429/409 if busy) → detect device (CUDA → MPS → CPU, default CPU)
- If the Data-Juicer engine isn't installed: persist a `failed` run with an actionable "install requirements-ml.txt" message and return (never a 500)
- Download the source JSONL (+ referenced images) to a temp dir; rewrite image paths to local
- Build a Data-Juicer config (paths + the recipe's operator chain, `np: 1`) and run `python -m app.service.curation_worker` in a subprocess with a timeout
- On success: count kept samples, parse per-operator counts from the engine log, upload `refined/` + `stats/`
- On non-zero exit / native crash: persist a `failed` run with the captured error (contained, never crashes the API)

## Edge Cases
- Engine not installed → `failed` run with install instructions (exercised by CI on the base venv)
- No source shards under the prefix → 400 with a "seed or upload a corpus" message
- A run already in progress → 409 (one pass at a time; native-ML containment)
- Native segfault / timeout in the subprocess → contained, surfaced as a `failed` run

## UX States
- Loading: "Running…" pending state on the Run button
- Empty: "No runs yet" on `/runs`
- Error: failed runs render their error message inline

## Verification
- Test files: `services/api/tests/test_curation.py`, `services/api/tests/test_curation_containment.py`
- Required cases: engine-unavailable failed run (no 500), single-run lock returns 409, Data-Juicer imported only in the subprocess worker
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green on the base venv; real runs require `requirements-ml.txt`

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
- [Curation Recipes](recipes.md)
