"""Persist a refined dataset's media to B2 and rewrite its media paths.

Data-Juicer writes ``refined.jsonl`` with ``images`` pointing at the run's temp
``workdir/media/`` files, which the run deletes as soon as it finishes. Uploading
that JSONL verbatim would leave every ``images`` entry dangling. This uploads the
referenced media under the run's ``refined/<id>/media/`` prefix and rewrites the
records' media paths to those B2 keys, so the uploaded refined dataset is a
self-contained, fetchable multimodal artifact.
"""

from __future__ import annotations

import json
import mimetypes
import os

from app.repo import upload_file_from_path
from app.types import Recipe


def persist_refined(
    recipe: Recipe, export_path: str, workdir: str, refined_prefix: str
) -> str:
    """Upload kept-sample media, rewrite ``images`` to B2 keys, return a JSONL path.

    Returns the original ``export_path`` unchanged for modalities with no
    localized media (only ``image-text`` localizes files today).
    """
    if recipe.modality != "image-text":
        return export_path
    media_prefix = f"{refined_prefix}media/"
    rewritten_path = os.path.join(workdir, "refined.b2.jsonl")
    with (
        open(export_path, encoding="utf-8") as src,
        open(rewritten_path, "w", encoding="utf-8") as dst,
    ):
        for ln in src:
            if not ln.strip():
                continue
            rec = json.loads(ln)
            images = rec.get("images") or []
            new_images = []
            for local in images:
                if isinstance(local, str) and os.path.exists(local):
                    key = f"{media_prefix}{os.path.basename(local)}"
                    ctype = mimetypes.guess_type(local)[0] or "application/octet-stream"
                    upload_file_from_path(local, key, ctype)
                    new_images.append(key)
                else:
                    new_images.append(local)
            if images:
                rec["images"] = new_images
            dst.write(json.dumps(rec) + "\n")
    return rewritten_path
