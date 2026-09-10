"""Pydantic models for Curation Recipes - the app's primary entity.

A recipe is a Data-Juicer operator chain persisted as a YAML object in B2 under
``configs/<id>.yaml``. There is no database: B2 is the sole store (consistent
with the starter's design).
"""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# The four corpora modalities the app curates. `text` and `image-text` run
# fully on CPU with the default operators; `video` / `audio` are selectable and
# carry their own applicable operators (see service/recipes catalog).
Modality = Literal["image-text", "video", "audio", "text"]


class OperatorConfig(BaseModel):
    """One Data-Juicer operator plus its numeric thresholds.

    `name` must be one of the finite operator catalog (service/recipes.py);
    `params` are per-operator numeric knobs (min/max thresholds). Values may be
    int or float so integer-only Data-Juicer params (e.g. `rep_len`, `min_len`)
    survive the config->engine boundary as ints rather than being widened to
    float, which the engine rejects.
    """

    name: str
    params: dict[str, float | int] = Field(default_factory=dict)


class RecipeSpec(BaseModel):
    """Create/edit input for a recipe (the form payload)."""

    name: str = Field(min_length=1, max_length=100)
    modality: Modality
    source_prefix: str = "raw/"
    operators: list[OperatorConfig] = Field(default_factory=list)
    description: str = ""


class Recipe(BaseModel):
    """A stored recipe, parsed back from its ``configs/<id>.yaml`` object."""

    id: str
    name: str
    modality: Modality
    source_prefix: str
    operators: list[OperatorConfig]
    description: str = ""
    created_at: datetime
    updated_at: datetime
    # The rendered Data-Juicer recipe YAML (operator chain), shown on the detail
    # page. Derived from `operators`, so it is a view, never a second source.
    yaml: str
    config_key: str


class OperatorCatalogEntry(BaseModel):
    """One selectable operator surfaced to the recipe form."""

    name: str
    label: str
    modalities: list[Modality]
    # True for model-backed operators (download a model / GPU-preferred); these
    # are off by default in the form.
    model_backed: bool = False
    default: bool = False
    description: str = ""
    # Numeric param hints shown as placeholders/FormDescription on the create
    # form: {param_name: {"default": x, "hint": "..."}}.
    params: dict[str, dict] = Field(default_factory=dict)
