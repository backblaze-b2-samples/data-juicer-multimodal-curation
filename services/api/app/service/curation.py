"""Curation run orchestration.

Reads a recipe, streams the source shards from B2 ``raw/``, invokes Data-Juicer
locally in an isolated subprocess, then writes the refined dataset to
``refined/<run_id>/`` and the run record + per-operator stats to
``stats/<run_id>.json``. B2 is the sole store; all B2 traffic goes through the
repo layer's custom-UA boto3 client. One run at a time (native-ML containment).
"""

from __future__ import annotations

import json
import os
import shutil
import tempfile
import threading
import time
from datetime import UTC, datetime

from app.repo import download_to_file, get_text, list_objects, upload_file_from_path
from app.service import recipes
from app.service.dj_engine import (
    build_config,
    detect_device,
    engine_available,
    parse_operator_counts,
    run_subprocess,
    write_config,
)
from app.types import OperatorStat, Recipe, RunRecord

REFINED_PREFIX = "refined/"
STATS_PREFIX = "stats/"

# One curation pass at a time: Data-Juicer pulls torch/native code, and running
# two heavy ML passes concurrently invites native contention/segfaults.
_run_lock = threading.Lock()

_ENGINE_MISSING_MSG = (
    "Data-Juicer engine not installed. Install services/api/requirements-ml.txt "
    "into the API venv (services/api/.venv/bin/pip install -r "
    "services/api/requirements-ml.txt) to run real curation passes. See ARCHITECTURE.md."
)


class RunInProgressError(Exception):
    detail = "A curation run is already in progress. Runs execute one at a time."


class NoSourceDataError(Exception):
    def __init__(self, prefix: str):
        self.detail = (
            f"No dataset shards found under '{prefix}'. Upload a corpus JSONL there, "
            "or seed a tiny synthetic demo corpus first."
        )
        super().__init__(self.detail)


def run_curation(recipe_id: str) -> RunRecord:
    """Execute one curation pass for a recipe (synchronous, one at a time)."""
    recipe = recipes.get_recipe(recipe_id)  # raises RecipeNotFoundError
    if not _run_lock.acquire(blocking=False):
        raise RunInProgressError()
    try:
        return _execute(recipe)
    finally:
        _run_lock.release()


def _run_id() -> str:
    return datetime.now(UTC).strftime("run-%Y%m%d-%H%M%S-%f")


def _execute(recipe: Recipe) -> RunRecord:
    run_id = _run_id()
    started = datetime.now(UTC)
    device = detect_device()

    if not engine_available():
        record = _base_record(run_id, recipe, started, device)
        return _finish_failed(record, started, _ENGINE_MISSING_MSG)

    workdir = tempfile.mkdtemp(prefix="djmc-")
    t0 = time.monotonic()
    try:
        input_path, samples_in = _prepare_input(recipe, workdir)
        if samples_in == 0:
            raise NoSourceDataError(recipe.source_prefix)

        export_path = os.path.join(workdir, "refined.jsonl")
        config_path = os.path.join(workdir, "dj_config.yaml")
        write_config(build_config(recipe, input_path, export_path), config_path)

        returncode, output = run_subprocess(config_path)
        record = _base_record(run_id, recipe, started, device)
        record.samples_in = samples_in

        if returncode != 0 or not os.path.exists(export_path):
            msg = _extract_error(output) or f"Data-Juicer exited with code {returncode}"
            return _finish_failed(record, started, msg, samples_in)

        samples_out = _count_lines(export_path)
        op_stats = _operator_stats(recipe, output, samples_in)
        refined_prefix = f"{REFINED_PREFIX}{run_id}/"
        upload_file_from_path(
            export_path, f"{refined_prefix}refined.jsonl", "application/x-ndjson"
        )
        return _finish_succeeded(
            record, started, samples_in, samples_out, op_stats, refined_prefix, t0
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def _prepare_input(recipe: Recipe, workdir: str) -> tuple[str, int]:
    """Download the source corpus (+ referenced media) and localize image paths."""
    objs = list_objects(recipe.source_prefix)
    jsonl_keys = [o["key"] for o in objs if o["key"].endswith((".jsonl", ".json"))]
    if not jsonl_keys:
        return "", 0
    corpus_key = next(
        (k for k in jsonl_keys if k.endswith("corpus.jsonl")), jsonl_keys[0]
    )
    text = get_text(corpus_key) or ""
    lines = [ln for ln in text.splitlines() if ln.strip()]
    media_dir = os.path.join(workdir, "media")
    os.makedirs(media_dir, exist_ok=True)

    records = []
    for ln in lines:
        try:
            rec = json.loads(ln)
        except json.JSONDecodeError:
            continue
        if recipe.modality == "image-text" and rec.get("images"):
            local = []
            for img_key in rec["images"]:
                dest = os.path.join(media_dir, os.path.basename(img_key))
                download_to_file(img_key, dest)
                local.append(dest)
            rec["images"] = local
        records.append(rec)

    input_path = os.path.join(workdir, "input.jsonl")
    with open(input_path, "w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(json.dumps(rec) + "\n")
    return input_path, len(records)


def _count_lines(path: str) -> int:
    with open(path, encoding="utf-8") as fh:
        return sum(1 for ln in fh if ln.strip())


def _extract_error(output: str) -> str | None:
    for ln in reversed(output.splitlines()):
        ln = ln.strip()
        if ln.startswith("{") and '"error"' in ln:
            try:
                return json.loads(ln).get("error")
            except json.JSONDecodeError:
                continue
    return None


def _operator_stats(
    recipe: Recipe, output: str, samples_in: int
) -> list[OperatorStat]:
    recipe_names = [op.name for op in recipe.operators]
    parsed = [(n, c) for (n, c) in parse_operator_counts(output) if n in recipe_names]
    if len(parsed) != len(recipe_names):
        return []
    stats: list[OperatorStat] = []
    prev = samples_in
    for name, left in parsed:
        stats.append(
            OperatorStat(
                name=name,
                samples_in=prev,
                samples_out=left,
                filtered=max(prev - left, 0),
                kept_ratio=round(left / prev, 4) if prev else 0.0,
            )
        )
        prev = left
    return stats


def _dedup_ratio(op_stats: list[OperatorStat]) -> float:
    for st in op_stats:
        if st.name.endswith("deduplicator") and st.samples_in:
            return round(st.filtered / st.samples_in, 4)
    return 0.0


def _base_record(run_id, recipe, started, device) -> RunRecord:
    return RunRecord(
        id=run_id,
        recipe_id=recipe.id,
        recipe_name=recipe.name,
        modality=recipe.modality,
        status="running",
        device=device,
        stats_key=f"{STATS_PREFIX}{run_id}.json",
        started_at=started,
    )


def _persist(record: RunRecord) -> RunRecord:
    put_key = record.stats_key or f"{STATS_PREFIX}{record.id}.json"
    from app.repo import put_text  # local import keeps the module import list tidy

    put_text(put_key, record.model_dump_json(indent=2), "application/json")
    return record


def _finish_failed(record, started, message, samples_in=0) -> RunRecord:
    record.status = "failed"
    record.error = message
    record.samples_in = samples_in
    record.finished_at = datetime.now(UTC)
    record.duration_seconds = (record.finished_at - started).total_seconds()
    return _persist(record)


def _finish_succeeded(
    record, started, samples_in, samples_out, op_stats, refined_prefix, t0
) -> RunRecord:
    record.status = "succeeded"
    record.samples_in = samples_in
    record.samples_out = samples_out
    record.filtered = max(samples_in - samples_out, 0)
    record.kept_ratio = round(samples_out / samples_in, 4) if samples_in else 0.0
    record.dedup_ratio = _dedup_ratio(op_stats)
    record.operators = op_stats
    record.refined_prefix = refined_prefix
    record.finished_at = datetime.now(UTC)
    record.duration_seconds = round(time.monotonic() - t0, 3)
    return _persist(record)


def list_runs() -> list[RunRecord]:
    runs: list[RunRecord] = []
    for obj in list_objects(STATS_PREFIX):
        if not obj["key"].endswith(".json"):
            continue
        text = get_text(obj["key"])
        if text is None:
            continue
        try:
            runs.append(RunRecord.model_validate_json(text))
        except ValueError:
            continue
    runs.sort(key=lambda r: r.started_at, reverse=True)
    return runs


def get_run(run_id: str) -> RunRecord | None:
    text = get_text(f"{STATS_PREFIX}{run_id}.json")
    if text is None:
        return None
    return RunRecord.model_validate_json(text)
