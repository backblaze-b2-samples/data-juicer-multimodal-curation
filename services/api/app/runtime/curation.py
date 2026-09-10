import logging

from fastapi import APIRouter, HTTPException

from app.service.seed import seed_demo_corpus
from app.service.summary import get_curation_summary
from app.types import CurationSummary, SeedResult

logger = logging.getLogger(__name__)

router = APIRouter()

_SEED_MODALITIES = ("text", "image-text")


@router.get("/curation/summary", response_model=CurationSummary)
def curation_summary_endpoint():
    """Curation dashboard aggregates (storage split, samples, ratios)."""
    try:
        return get_curation_summary()
    except RuntimeError:
        raise HTTPException(502, "Failed to compute curation summary") from None


@router.post("/datasets/seed", response_model=SeedResult)
def seed_dataset_endpoint(modality: str = "image-text"):
    """Generate a tiny synthetic demo corpus under ``raw/`` (keyless, no download)."""
    if modality not in _SEED_MODALITIES:
        raise HTTPException(400, f"modality must be one of {_SEED_MODALITIES}")
    try:
        result = seed_demo_corpus(modality)
    except RuntimeError:
        raise HTTPException(502, "Failed to seed demo corpus to storage") from None
    logger.info("Seeded demo corpus: modality=%s created=%d", modality, result.created)
    return result
