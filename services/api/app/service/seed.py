"""Synthesize a tiny, synthetic, keyless demo corpus into B2 ``raw/``.

Programmatic only - no binary assets are committed to the repo. Produces a
handful of PIL-generated images and text JSONL so a curation run finishes in
seconds. The samples are deliberately mixed (duplicates, too-short text, tiny
images) so the default operators actually filter something.
"""

from __future__ import annotations

import io
import json

from PIL import Image

from app.repo import put_text, upload_file
from app.types import SeedResult

TEXT_PREFIX = "raw/demo-text/"
IMAGE_TEXT_PREFIX = "raw/demo-image-text/"

# Mixed text samples: a few clean, a duplicate pair, one too-short, one highly
# repetitive - so text_length / repetition / dedup filters each remove something.
_TEXTS = [
    "A curated dataset keeps only high-quality, deduplicated training samples.",
    "Backblaze B2 stores raw corpora, recipes, refined shards, and run stats.",
    "Data-Juicer composes operators into a reproducible cleaning pipeline.",
    "Multimodal curation aligns image-text pairs before foundation-model training.",
    "Refined datasets reduce noise and improve downstream model accuracy.",
    "A curated dataset keeps only high-quality, deduplicated training samples.",
    "Backblaze B2 stores raw corpora, recipes, refined shards, and run stats.",
    "hi",
    "repeat repeat repeat repeat repeat repeat repeat repeat repeat repeat",
    "Operators include length, repetition, alphanumeric, and dedup filters.",
    "Image filters check shape, aspect ratio, file size, and near-duplicates.",
    "Stream shards from raw/, clean locally, write refined/ and stats/ back.",
    "The whole corpus lives in one bucket; curation runs from a local box.",
    "Write amplification makes object storage the natural home for datasets.",
    "Each run records kept, filtered, and dedup ratios per operator.",
    "Recipes are YAML operator chains versioned as objects in configs/.",
]

# (size, fill) - two 64px images are too small for image_shape_filter(min 128);
# the two identical 256px blues exercise the perceptual-hash deduplicator.
_IMAGE_SPECS = [
    ((256, 256), (40, 90, 180)),
    ((256, 256), (40, 90, 180)),
    ((256, 200), (200, 80, 60)),
    ((320, 240), (60, 160, 90)),
    ((64, 64), (120, 120, 120)),
    ((64, 48), (200, 200, 40)),
    ((300, 300), (150, 60, 170)),
    ((224, 224), (30, 30, 30)),
]


def _png_bytes(size: tuple[int, int], fill: tuple[int, int, int]) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, fill).save(buf, format="PNG")
    return buf.getvalue()


def _seed_text() -> SeedResult:
    lines = [
        json.dumps({"text": t, "meta": {"idx": i}}) for i, t in enumerate(_TEXTS)
    ]
    put_text(
        f"{TEXT_PREFIX}corpus.jsonl",
        "\n".join(lines) + "\n",
        content_type="application/x-ndjson",
    )
    return SeedResult(created=len(lines), prefix=TEXT_PREFIX, modality="text")


def _seed_image_text() -> SeedResult:
    records = []
    for i, (size, fill) in enumerate(_IMAGE_SPECS):
        img_key = f"{IMAGE_TEXT_PREFIX}images/img_{i:02d}.png"
        upload_file(_png_bytes(size, fill), img_key, "image/png")
        records.append(
            {
                "text": _TEXTS[i % len(_TEXTS)],
                "images": [img_key],
                "meta": {"idx": i},
            }
        )
    lines = [json.dumps(r) for r in records]
    put_text(
        f"{IMAGE_TEXT_PREFIX}corpus.jsonl",
        "\n".join(lines) + "\n",
        content_type="application/x-ndjson",
    )
    return SeedResult(
        created=len(records), prefix=IMAGE_TEXT_PREFIX, modality="image-text"
    )


def seed_demo_corpus(modality: str = "image-text") -> SeedResult:
    """Generate a tiny synthetic corpus under ``raw/`` for the given modality."""
    if modality == "text":
        return _seed_text()
    return _seed_image_text()
