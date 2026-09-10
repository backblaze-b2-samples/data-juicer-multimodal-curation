"""Curation Recipe CRUD, persisted as YAML objects in B2 ``configs/``.

No database: each recipe is one ``configs/<id>.yaml`` object. The stored YAML is
both the round-trippable authored form (``operators``) and the Data-Juicer
operator chain (``process``) the runner executes.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime

import yaml

from app.repo import delete_file, get_text, list_objects, object_exists, put_text
from app.service.operators import RecipeValidationError, render_process, validate_operators
from app.types import OperatorConfig, Recipe, RecipeSpec

CONFIG_PREFIX = "configs/"


class RecipeNotFoundError(Exception):
    def __init__(self, recipe_id: str):
        self.detail = f"Recipe not found: {recipe_id}"
        super().__init__(self.detail)


class RecipeConflictError(Exception):
    def __init__(self, recipe_id: str):
        self.detail = f"A recipe named '{recipe_id}' already exists"
        super().__init__(self.detail)


def _slug(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "recipe"


def _config_key(recipe_id: str) -> str:
    return f"{CONFIG_PREFIX}{recipe_id}.yaml"


def _render_doc(
    recipe_id: str,
    spec: RecipeSpec,
    created_at: datetime,
    updated_at: datetime,
) -> str:
    doc = {
        "id": recipe_id,
        "name": spec.name,
        "modality": spec.modality,
        "source_prefix": spec.source_prefix,
        "description": spec.description,
        "created_at": created_at.isoformat(),
        "updated_at": updated_at.isoformat(),
        "operators": [{"name": op.name, "params": op.params} for op in spec.operators],
        "process": render_process(spec.operators),
    }
    header = "# Data-Juicer Multimodal Curation recipe\n"
    return header + yaml.safe_dump(doc, sort_keys=False, allow_unicode=True)


def _parse(text: str, key: str) -> Recipe:
    doc = yaml.safe_load(text) or {}
    operators = [
        OperatorConfig(name=o["name"], params=o.get("params", {}))
        for o in doc.get("operators", [])
    ]
    now = datetime.now(UTC)
    created = doc.get("created_at")
    updated = doc.get("updated_at")
    return Recipe(
        id=doc.get("id") or key.removeprefix(CONFIG_PREFIX).removesuffix(".yaml"),
        name=doc.get("name", ""),
        modality=doc.get("modality", "text"),
        source_prefix=doc.get("source_prefix", "raw/"),
        operators=operators,
        description=doc.get("description", ""),
        created_at=datetime.fromisoformat(created) if created else now,
        updated_at=datetime.fromisoformat(updated) if updated else now,
        yaml=text,
        config_key=key,
    )


def list_recipes() -> list[Recipe]:
    recipes: list[Recipe] = []
    for obj in list_objects(CONFIG_PREFIX):
        key = obj["key"]
        if not key.endswith(".yaml"):
            continue
        text = get_text(key)
        if text is None:
            continue
        try:
            recipes.append(_parse(text, key))
        except (yaml.YAMLError, KeyError, ValueError):
            # A malformed config object shouldn't break the whole listing.
            continue
    recipes.sort(key=lambda r: r.updated_at, reverse=True)
    return recipes


def get_recipe(recipe_id: str) -> Recipe:
    key = _config_key(recipe_id)
    text = get_text(key)
    if text is None:
        raise RecipeNotFoundError(recipe_id)
    return _parse(text, key)


def create_recipe(spec: RecipeSpec) -> Recipe:
    validate_operators(spec.operators, spec.modality)
    recipe_id = _slug(spec.name)
    key = _config_key(recipe_id)
    if object_exists(key):
        raise RecipeConflictError(recipe_id)
    now = datetime.now(UTC)
    put_text(key, _render_doc(recipe_id, spec, now, now))
    return get_recipe(recipe_id)


def update_recipe(recipe_id: str, spec: RecipeSpec) -> Recipe:
    validate_operators(spec.operators, spec.modality)
    existing = get_recipe(recipe_id)  # raises RecipeNotFoundError
    key = _config_key(recipe_id)
    now = datetime.now(UTC)
    put_text(key, _render_doc(recipe_id, spec, existing.created_at, now))
    return get_recipe(recipe_id)


def delete_recipe(recipe_id: str) -> None:
    key = _config_key(recipe_id)
    if not object_exists(key):
        raise RecipeNotFoundError(recipe_id)
    delete_file(key)


__all__ = [
    "RecipeConflictError",
    "RecipeNotFoundError",
    "RecipeValidationError",
    "create_recipe",
    "delete_recipe",
    "get_recipe",
    "list_recipes",
    "update_recipe",
]
