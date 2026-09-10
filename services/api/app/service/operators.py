"""The finite Data-Juicer operator catalog + recipe->Data-Juicer rendering.

The catalog is a constant (never free text): the recipe form multi-selects from
it, and the curation runner renders the chosen operators into a Data-Juicer
``process`` list. Default operators are lightweight, CPU-only, and need no model
download; model-backed operators are flagged and off by default.
"""

from __future__ import annotations

from app.types import Modality, OperatorCatalogEntry, OperatorConfig

# Text operators apply to text and image-text corpora; image operators to
# image-text; a couple of media operators to video/audio. Every non-model entry
# runs on CPU with no download. `params` values are {default, hint}.
OPERATOR_CATALOG: list[OperatorCatalogEntry] = [
    OperatorCatalogEntry(
        name="text_length_filter",
        label="Text length",
        modalities=["text", "image-text"],
        default=True,
        description="Keep samples whose text length is within [min_len, max_len].",
        params={
            "min_len": {"default": 10, "hint": "min characters (e.g. 10)"},
            "max_len": {"default": 100000, "hint": "max characters (e.g. 100000)"},
        },
    ),
    OperatorCatalogEntry(
        name="character_repetition_filter",
        label="Character repetition",
        modalities=["text", "image-text"],
        default=True,
        description="Drop samples with excessive character n-gram repetition.",
        params={
            "rep_len": {"default": 10, "hint": "n-gram length (e.g. 10)"},
            "max_ratio": {"default": 0.5, "hint": "max repetition ratio 0-1 (e.g. 0.5)"},
        },
    ),
    OperatorCatalogEntry(
        name="word_repetition_filter",
        label="Word repetition",
        modalities=["text", "image-text"],
        default=True,
        description="Drop samples with excessive word n-gram repetition.",
        params={
            "rep_len": {"default": 10, "hint": "n-gram length (e.g. 10)"},
            "max_ratio": {"default": 0.5, "hint": "max repetition ratio 0-1 (e.g. 0.5)"},
        },
    ),
    OperatorCatalogEntry(
        name="alphanumeric_filter",
        label="Alphanumeric ratio",
        modalities=["text", "image-text"],
        default=True,
        description="Keep samples with a sane alphanumeric-to-total character ratio.",
        params={
            "min_ratio": {"default": 0.25, "hint": "min ratio 0-1 (e.g. 0.25)"},
            "max_ratio": {"default": 0.9, "hint": "max ratio 0-1 (e.g. 0.9)"},
        },
    ),
    OperatorCatalogEntry(
        name="document_deduplicator",
        label="Document dedup (exact)",
        modalities=["text", "image-text"],
        default=True,
        description="Remove exact-duplicate documents by hashing their text.",
        params={},
    ),
    OperatorCatalogEntry(
        name="image_shape_filter",
        label="Image shape",
        modalities=["image-text"],
        default=True,
        description="Keep images at or above a minimum width/height.",
        params={
            "min_width": {"default": 128, "hint": "min px (e.g. 128)"},
            "min_height": {"default": 128, "hint": "min px (e.g. 128)"},
        },
    ),
    OperatorCatalogEntry(
        name="image_aspect_ratio_filter",
        label="Image aspect ratio",
        modalities=["image-text"],
        default=True,
        description="Keep images whose W/H aspect ratio is within [min, max].",
        params={
            "min_ratio": {"default": 0.333, "hint": "min W/H (e.g. 0.333)"},
            "max_ratio": {"default": 3.0, "hint": "max W/H (e.g. 3.0)"},
        },
    ),
    OperatorCatalogEntry(
        name="image_size_filter",
        label="Image file size",
        modalities=["image-text"],
        default=True,
        description="Keep image files at or above a minimum byte size.",
        params={"min_size_kb": {"default": 5, "hint": "min KB (e.g. 5)"}},
    ),
    OperatorCatalogEntry(
        name="image_deduplicator",
        label="Image dedup (phash)",
        modalities=["image-text"],
        default=True,
        description="Remove near-duplicate images by perceptual hash.",
        params={},
    ),
    OperatorCatalogEntry(
        name="video_duration_filter",
        label="Video duration",
        modalities=["video"],
        description="Keep videos within a duration window (seconds).",
        params={
            "min_duration": {"default": 1.0, "hint": "min seconds (e.g. 1.0)"},
            "max_duration": {"default": 60.0, "hint": "max seconds (e.g. 60)"},
        },
    ),
    OperatorCatalogEntry(
        name="audio_duration_filter",
        label="Audio duration",
        modalities=["audio"],
        description="Keep audio clips within a duration window (seconds).",
        params={
            "min_duration": {"default": 1.0, "hint": "min seconds (e.g. 1.0)"},
            "max_duration": {"default": 3600.0, "hint": "max seconds (e.g. 3600)"},
        },
    ),
    # --- model-backed (flagged, off by default) -----------------------------
    OperatorCatalogEntry(
        name="language_id_score_filter",
        label="Language ID score (model)",
        modalities=["text", "image-text"],
        model_backed=True,
        description="fastText language ID - downloads a model.",
        params={"min_score": {"default": 0.8, "hint": "min confidence 0-1 (e.g. 0.8)"}},
    ),
    OperatorCatalogEntry(
        name="image_nsfw_filter",
        label="Image NSFW (model)",
        modalities=["image-text"],
        model_backed=True,
        description="NSFW scorer - downloads a model, GPU-preferred.",
        params={"score_threshold": {"default": 0.5, "hint": "max NSFW score 0-1"}},
    ),
    OperatorCatalogEntry(
        name="image_aesthetics_filter",
        label="Image aesthetics (model)",
        modalities=["image-text"],
        model_backed=True,
        description="Aesthetic scorer - downloads a model, GPU-preferred.",
        params={"min_score": {"default": 0.4, "hint": "min aesthetics score 0-1"}},
    ),
]

_BY_NAME = {e.name: e for e in OPERATOR_CATALOG}


class RecipeValidationError(Exception):
    """Raised when a recipe references an unknown or modality-mismatched operator."""

    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def get_catalog() -> list[OperatorCatalogEntry]:
    return OPERATOR_CATALOG


def validate_operators(
    operators: list[OperatorConfig], modality: Modality
) -> list[OperatorConfig]:
    """Reject unknown operators or ones not applicable to the recipe's modality."""
    if not operators:
        raise RecipeValidationError("A recipe needs at least one operator.")
    for op in operators:
        entry = _BY_NAME.get(op.name)
        if entry is None:
            raise RecipeValidationError(f"Unknown operator: {op.name!r}")
        if modality not in entry.modalities:
            raise RecipeValidationError(
                f"Operator {op.name!r} does not apply to modality {modality!r}"
            )
    return operators


def _dj_args(op: OperatorConfig) -> dict:
    """Map a catalog operator + its numeric params to Data-Juicer op arguments."""
    p = dict(op.params)
    if op.name == "image_size_filter":
        kb = p.pop("min_size_kb", 5)
        return {"min_size": f"{int(kb)}KB"}
    # Every other catalog operator maps its numeric params straight through
    # (Data-Juicer uses the same argument names). Dedup operators have no args.
    return {k: v for k, v in p.items()}


def render_process(operators: list[OperatorConfig]) -> list[dict]:
    """Render the chosen operators into a Data-Juicer ``process`` list."""
    process: list[dict] = []
    for op in operators:
        args = _dj_args(op)
        process.append({op.name: args})
    return process
