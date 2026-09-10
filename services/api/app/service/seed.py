"""Synthesize a tiny, synthetic, keyless demo corpus into B2 ``raw/``.

Programmatic only - no binary assets are committed to the repo. Produces a
handful of PIL-generated images and text JSONL so a curation run finishes in
seconds. The samples are deliberately mixed (duplicates, too-short text, tiny
images) so the default operators actually filter something.
"""

from __future__ import annotations

import io
import json
import random

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

# (size, seed) - the first two share a seed so they render byte-identical and
# exercise the perceptual-hash image_deduplicator; the two 64px entries fall
# below image_shape_filter's 128px floor; the rest are distinct and large enough
# (dimensions + per-pixel grain) to clear the shape/aspect/size filters, so a
# realistic MIX survives the default recipe instead of everything filtering.
# Seed content is a gradient plus grain, NOT a solid fill: a solid-fill PNG
# compresses to well under image_size_filter's 5KB floor and gets dropped, which
# used to filter every seeded image (a self-defeating demo).
_IMAGE_SPECS = [
    ((256, 256), 1),
    ((256, 256), 1),
    ((256, 200), 2),
    ((320, 240), 3),
    ((64, 64), 4),
    ((64, 48), 5),
    ((300, 300), 6),
    ((224, 224), 7),
]


def _png_bytes(size: tuple[int, int], seed: int) -> bytes:
    """Render a deterministic gradient-plus-grain PNG.

    Grain gives the PNG real entropy so it clears ``image_size_filter``'s 5KB
    floor (a solid fill compresses to a few hundred bytes and is dropped). The
    same ``seed`` yields byte-identical output, which is what lets a duplicate
    pair exercise the perceptual-hash deduplicator.
    """
    w, h = size
    rnd = random.Random(seed)
    base_r, base_g, base_b = (rnd.randrange(256) for _ in range(3))
    pixels = []
    for y in range(h):
        for x in range(w):
            r = (base_r + x * 160 // w + rnd.randrange(48)) % 256
            g = (base_g + y * 160 // h + rnd.randrange(48)) % 256
            b = (base_b + (x + y) * 120 // (w + h) + rnd.randrange(48)) % 256
            pixels.append((r, g, b))
    img = Image.new("RGB", size)
    img.putdata(pixels)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
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
    for i, (size, seed) in enumerate(_IMAGE_SPECS):
        img_key = f"{IMAGE_TEXT_PREFIX}images/img_{i:02d}.png"
        upload_file(_png_bytes(size, seed), img_key, "image/png")
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
