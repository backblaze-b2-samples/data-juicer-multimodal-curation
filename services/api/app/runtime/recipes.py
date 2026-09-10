import logging

# Blocking handlers are sync `def` so Starlette runs them in its threadpool
# (see runtime/files.py). The run handler is long-lived - it drives a
# Data-Juicer subprocess - so keeping it off the event loop matters most here.
from fastapi import APIRouter, HTTPException

from app.service import recipes as svc
from app.service.curation import NoSourceDataError, RunInProgressError, run_curation
from app.service.operators import RecipeValidationError, get_catalog
from app.service.recipes import RecipeConflictError, RecipeNotFoundError
from app.types import OperatorCatalogEntry, Recipe, RecipeSpec, RunRecord

logger = logging.getLogger(__name__)

router = APIRouter()

# SECURITY: like the Files routes, these are intentionally unauthenticated and
# bucket-wide (single-tenant demo). A multi-tenant clone must add auth and scope
# recipe/run objects to the caller - see docs/SECURITY.md.


@router.get("/operator-catalog", response_model=list[OperatorCatalogEntry])
def operator_catalog_endpoint():
    """The finite Data-Juicer operator catalog the recipe form selects from."""
    return get_catalog()


@router.get("/recipes", response_model=list[Recipe])
def list_recipes_endpoint():
    try:
        return svc.list_recipes()
    except RuntimeError:
        raise HTTPException(502, "Failed to read recipes from storage") from None


@router.post("/recipes", response_model=Recipe)
def create_recipe_endpoint(spec: RecipeSpec):
    try:
        recipe = svc.create_recipe(spec)
    except RecipeValidationError as e:
        raise HTTPException(400, e.detail) from None
    except RecipeConflictError as e:
        raise HTTPException(409, e.detail) from None
    except RuntimeError:
        raise HTTPException(502, "Failed to write recipe to storage") from None
    logger.info("Recipe created: id=%s", recipe.id)
    return recipe


@router.get("/recipes/{recipe_id}", response_model=Recipe)
def get_recipe_endpoint(recipe_id: str):
    try:
        return svc.get_recipe(recipe_id)
    except RecipeNotFoundError as e:
        raise HTTPException(404, e.detail) from None
    except RuntimeError:
        raise HTTPException(502, "Failed to read recipe from storage") from None


@router.put("/recipes/{recipe_id}", response_model=Recipe)
def update_recipe_endpoint(recipe_id: str, spec: RecipeSpec):
    try:
        return svc.update_recipe(recipe_id, spec)
    except RecipeValidationError as e:
        raise HTTPException(400, e.detail) from None
    except RecipeNotFoundError as e:
        raise HTTPException(404, e.detail) from None
    except RuntimeError:
        raise HTTPException(502, "Failed to write recipe to storage") from None


@router.delete("/recipes/{recipe_id}")
def delete_recipe_endpoint(recipe_id: str):
    try:
        svc.delete_recipe(recipe_id)
    except RecipeNotFoundError as e:
        raise HTTPException(404, e.detail) from None
    except RuntimeError:
        raise HTTPException(500, "Failed to delete recipe") from None
    logger.info("Recipe deleted: id=%s", recipe_id)
    return {"deleted": True, "id": recipe_id}


@router.post("/recipes/{recipe_id}/run", response_model=RunRecord)
def run_recipe_endpoint(recipe_id: str):
    """Run one curation pass for a recipe (synchronous, one at a time)."""
    try:
        record = run_curation(recipe_id)
    except RecipeNotFoundError as e:
        raise HTTPException(404, e.detail) from None
    except RunInProgressError as e:
        raise HTTPException(409, e.detail) from None
    except NoSourceDataError as e:
        raise HTTPException(400, e.detail) from None
    except RuntimeError:
        raise HTTPException(502, "Curation run failed talking to storage") from None
    logger.info("Curation run finished: id=%s status=%s", record.id, record.status)
    return record
