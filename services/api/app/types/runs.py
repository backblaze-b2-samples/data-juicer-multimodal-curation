"""Pydantic models for curation Runs.

A run is an *output* of the recipe `run` verb, not a second managed entity. Its
record (overall counts + per-operator stats) is persisted as a JSON object in
B2 under ``stats/<run_id>.json``; its refined dataset lands under
``refined/<run_id>/``.
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

RunStatus = Literal["pending", "running", "succeeded", "failed"]


class OperatorStat(BaseModel):
    """Per-operator effect within a run, parsed from the engine's own output."""

    name: str
    samples_in: int
    samples_out: int
    filtered: int
    kept_ratio: float


class RunRecord(BaseModel):
    """The full record of one curation pass."""

    id: str
    recipe_id: str
    recipe_name: str
    modality: str
    status: RunStatus
    samples_in: int = 0
    samples_out: int = 0
    filtered: int = 0
    kept_ratio: float = 0.0
    dedup_ratio: float = 0.0
    device: str = "cpu"
    refined_prefix: str | None = None
    stats_key: str | None = None
    operators: list[OperatorStat] = Field(default_factory=list)
    error: str | None = None
    started_at: datetime
    finished_at: datetime | None = None
    duration_seconds: float | None = None


class CurationSummary(BaseModel):
    """Aggregate curation metrics for the dashboard."""

    recipe_count: int
    run_count: int
    raw_bytes: int
    raw_human: str
    refined_bytes: int
    refined_human: str
    stats_bytes: int
    stats_human: str
    total_samples_in: int
    total_samples_out: int
    total_filtered: int
    pass_rate: float
    dedup_ratio: float


class SeedResult(BaseModel):
    """Result of seeding a tiny synthetic demo corpus into ``raw/``."""

    created: int
    prefix: str
    modality: str
