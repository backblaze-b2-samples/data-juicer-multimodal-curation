import logging

from fastapi import APIRouter, HTTPException

from app.service.curation import get_run, list_runs
from app.types import RunRecord

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/runs", response_model=list[RunRecord])
def list_runs_endpoint():
    """History of curation passes, read back from ``stats/`` in B2."""
    try:
        return list_runs()
    except RuntimeError:
        raise HTTPException(502, "Failed to read runs from storage") from None


@router.get("/runs/{run_id}", response_model=RunRecord)
def get_run_endpoint(run_id: str):
    try:
        run = get_run(run_id)
    except RuntimeError:
        raise HTTPException(502, "Failed to read run from storage") from None
    if run is None:
        raise HTTPException(404, "Run not found")
    return run
