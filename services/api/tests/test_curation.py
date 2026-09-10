"""Curation run behavior: graceful degradation and single-run containment.

These run on the base venv (no Data-Juicer / torch installed), which is the
credential-free CI path - so the engine-unavailable branch is exactly what CI
exercises. That is by design: the real engine path is gated behind
requirements-ml.txt and exercised by the heavier verify stage.
"""

from datetime import UTC, datetime

import pytest

from app.service import curation
from app.types import OperatorConfig, Recipe


def _recipe() -> Recipe:
    now = datetime.now(UTC)
    return Recipe(
        id="r1",
        name="R1",
        modality="text",
        source_prefix="raw/",
        operators=[OperatorConfig(name="text_length_filter", params={"min_len": 10})],
        created_at=now,
        updated_at=now,
        yaml="process: []",
        config_key="configs/r1.yaml",
    )


@pytest.mark.asyncio
async def test_run_without_engine_records_failed(client, monkeypatch):
    """A missing engine yields a persisted `failed` run with an actionable
    message - never a 500."""
    monkeypatch.setattr(curation, "engine_available", lambda: False)
    monkeypatch.setattr(curation.recipes, "get_recipe", lambda rid: _recipe())
    seen = {}
    monkeypatch.setattr(curation, "_persist", lambda rec: seen.setdefault("rec", rec) or rec)

    resp = await client.post("/recipes/r1/run")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "failed"
    assert "requirements-ml.txt" in body["error"]
    assert seen["rec"].status == "failed"


@pytest.mark.asyncio
async def test_second_run_conflicts_while_locked(client, monkeypatch):
    """Only one curation pass runs at a time (native-ML containment)."""
    monkeypatch.setattr(curation.recipes, "get_recipe", lambda rid: _recipe())
    assert curation._run_lock.acquire(blocking=False)
    try:
        resp = await client.post("/recipes/r1/run")
        assert resp.status_code == 409
    finally:
        curation._run_lock.release()
