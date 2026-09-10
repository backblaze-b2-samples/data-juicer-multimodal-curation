"""Isolated subprocess entry that runs one Data-Juicer recipe.

Invoked as ``python -m app.service.curation_worker <dj_config.yaml>`` by
``service/dj_engine.run_subprocess`` so Data-Juicer's torch/multiprocessing
state (and any native crash) stays out of the FastAPI worker. Imports the gated
Data-Juicer engine; prints one JSON status line to stdout and exits non-zero on
failure. This module is never imported by the API - only spawned.
"""

from __future__ import annotations

import json
import sys


def _emit(payload: dict) -> None:
    sys.stdout.write(json.dumps(payload) + "\n")
    sys.stdout.flush()


def main() -> int:
    if len(sys.argv) < 2:
        _emit({"ok": False, "error": "missing Data-Juicer config path"})
        return 2
    config_path = sys.argv[1]

    # Data-Juicer's init_configs reads argv; set it explicitly for compatibility
    # across versions (some accept args=..., some don't).
    sys.argv = ["dj-process", "--config", config_path]
    try:
        from data_juicer.config import init_configs

        cfg = init_configs()
    except Exception as exc:
        _emit({"ok": False, "error": f"Data-Juicer config init failed: {exc}"})
        return 3

    try:
        try:
            from data_juicer.core import DefaultExecutor as Executor
        except Exception:
            from data_juicer.core import Executor
        Executor(cfg).run()
    except Exception as exc:
        _emit({"ok": False, "error": f"Data-Juicer run failed: {exc}"})
        return 4

    _emit({"ok": True})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
