# Tech debt

## 2026-09-10 — verify

- `/runs` — GET /runs is ~1–2s at 1 run but ~16–56s at 40–50 runs → `list_runs` (`services/api/app/service/curation.py`) reads each run's stats with an N+1 sequential B2 `get_text`; latency scales linearly with run count. Batch/parallelize the per-run stats reads, or add a paginated/summary runs endpoint. Not first-time-user-facing (1 run ≈ 1–2s); a latent scalability issue. (shot `.local/verify/A/10-runs-history.png`)
- `/recipes/[id]` "Runs for this recipe" panel — fetches the entire global `/runs` list and filters client-side by `recipe_id`, inheriting the N+1 latency above → slow to populate against a large accumulated bucket. Add a recipe-scoped runs endpoint. Mitigated in practice: a success toast confirms the run and the full breakdown renders immediately on `/runs` and the Dashboard. (shot `.local/verify/C/06b-default-recipe-detail-after-run.png`)
- `apps/web/src/components/ui/progress.tsx` — re-verify `value` is forwarded to Radix `<ProgressPrimitive.Root>` so `aria-valuenow`/`aria-valuemax` are set for screen readers while the run progress bar advances (a fix was applied during this verify; a lens still flagged it, so confirm it landed). (shot `.local/verify/B/12-run-mid-wait-t20.png`)
