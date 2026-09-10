"""Curation dashboard aggregates - raw vs refined storage, samples, ratios.

Flows through repo (B2 listings) + the runs service, exposed to the frontend
via the TanStack Query hooks in lib/queries.ts.
"""

from __future__ import annotations

from app.repo import list_objects
from app.service.curation import STATS_PREFIX, list_runs
from app.service.recipes import CONFIG_PREFIX
from app.types import CurationSummary
from app.types.formatting import humanize_bytes

RAW_PREFIX = "raw/"
REFINED_PREFIX = "refined/"


def _bytes_under(prefix: str) -> int:
    return sum(o["size"] for o in list_objects(prefix))


def get_curation_summary() -> CurationSummary:
    raw_bytes = _bytes_under(RAW_PREFIX)
    refined_bytes = _bytes_under(REFINED_PREFIX)
    stats_bytes = _bytes_under(STATS_PREFIX)
    recipe_count = sum(
        1 for o in list_objects(CONFIG_PREFIX) if o["key"].endswith(".yaml")
    )

    runs = list_runs()
    succeeded = [r for r in runs if r.status == "succeeded"]
    total_in = sum(r.samples_in for r in succeeded)
    total_out = sum(r.samples_out for r in succeeded)
    total_filtered = max(total_in - total_out, 0)
    pass_rate = round(total_out / total_in, 4) if total_in else 0.0
    dedup_vals = [r.dedup_ratio for r in succeeded if r.samples_in]
    dedup_ratio = round(sum(dedup_vals) / len(dedup_vals), 4) if dedup_vals else 0.0

    return CurationSummary(
        recipe_count=recipe_count,
        run_count=len(runs),
        raw_bytes=raw_bytes,
        raw_human=humanize_bytes(raw_bytes),
        refined_bytes=refined_bytes,
        refined_human=humanize_bytes(refined_bytes),
        stats_bytes=stats_bytes,
        stats_human=humanize_bytes(stats_bytes),
        total_samples_in=total_in,
        total_samples_out=total_out,
        total_filtered=total_filtered,
        pass_rate=pass_rate,
        dedup_ratio=dedup_ratio,
    )
