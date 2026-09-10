"""Data-Juicer engine adapter: device detection, config build, contained run.

Data-Juicer (the gated ML engine) is never imported into the FastAPI worker.
It runs in an isolated subprocess (``app.service.curation_worker``) so a native
crash/segfault or macOS ML banner cannot take down the API - it surfaces as a
non-zero return code that the caller turns into a typed, JSON error.
"""

from __future__ import annotations

import importlib.util
import re
import subprocess
import sys
from pathlib import Path

import yaml

from app.service.operators import render_process
from app.types import Recipe

API_ROOT = Path(__file__).resolve().parents[2]  # services/api
# Bound a demo run - a tiny corpus completes in seconds; this stops a runaway
# native process from hanging the request forever.
RUN_TIMEOUT_SECONDS = 900


def engine_available() -> bool:
    """True when the gated Data-Juicer engine is importable (requirements-ml.txt)."""
    return importlib.util.find_spec("data_juicer") is not None


def detect_device() -> str:
    """First available of CUDA -> Apple MPS -> CPU, defaulting to CPU.

    Torch lives in the gated engine deps, so this imports it lazily and falls
    back to CPU when torch is absent. Data-Juicer's ML-backed operators run on
    torch where MPS coverage is weak, so those effectively fall back CUDA -> CPU
    (Data-Juicer uses CUDA when present, else CPU); the value here is recorded
    on the run for provenance.
    """
    try:
        import torch

        if torch.cuda.is_available():
            return "cuda"
        if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
            return "mps"
    except Exception:
        pass
    return "cpu"


def build_config(recipe: Recipe, input_path: str, export_path: str) -> dict:
    """Assemble the Data-Juicer recipe config for one run (paths + operator chain)."""
    config: dict = {
        "project_name": recipe.id,
        "dataset_path": input_path,
        "export_path": export_path,
        "np": 1,  # single process for the demo (keeps native state contained)
        "text_keys": "text",
        "open_tracer": False,
        # Surface a genuine per-operator engine error instead of swallowing it:
        # DJ defaults skip_op_error=True, which drops every sample on a crashing
        # op and reports "Left 0 samples", so a real failure reads as a
        # "succeeded / 0 kept" run. Failing loudly lets the caller mark the run
        # FAILED with an actionable message.
        "skip_op_error": False,
        "process": render_process(recipe.operators),
    }
    if recipe.modality == "image-text":
        config["image_key"] = "images"
    return config


def write_config(config: dict, path: str) -> None:
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(config, fh, sort_keys=False, allow_unicode=True)


def run_subprocess(config_path: str) -> tuple[int, str]:
    """Run the Data-Juicer worker in a subprocess. Returns (returncode, output).

    A negative return code means the child was killed by a signal (e.g. a native
    segfault); the caller reports that as a contained engine failure rather than
    letting it propagate into the API worker.
    """
    proc = subprocess.run(
        [sys.executable, "-m", "app.service.curation_worker", config_path],
        cwd=str(API_ROOT),
        capture_output=True,
        text=True,
        timeout=RUN_TIMEOUT_SECONDS,
        check=False,
    )
    return proc.returncode, (proc.stdout or "") + "\n" + (proc.stderr or "")


# Data-Juicer 1.4.6 logs one line per operator when it finishes, e.g.:
#   OP [text_length_filter] Done in 0.557s. Left 7 samples.
# Match the operator name in brackets and the trailing "Left <n> samples" count.
# Brackets are kept optional and the gap is `[^\n]*?` (not `[^0-9]`) so an
# intervening duration like "0.557s" no longer aborts the match.
_OP_LOG_RE = re.compile(
    r"OP\s*\[?([a-z0-9_]+)\]?[^\n]*?Left\s+(\d+)\s+samples", re.IGNORECASE
)


def parse_operator_counts(output: str) -> list[tuple[str, int]]:
    """Best-effort per-operator 'samples left' counts from Data-Juicer's log.

    Data-Juicer logs each operator's remaining sample count; we parse those so
    the per-operator stats come from the engine's own output, not a guess.
    Returns [] when the log format isn't recognized (overall counts still hold).
    """
    counts: list[tuple[str, int]] = []
    for match in _OP_LOG_RE.finditer(output):
        counts.append((match.group(1).lower(), int(match.group(2))))
    return counts
