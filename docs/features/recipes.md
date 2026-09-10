<!-- last_verified: 2026-09-10 -->
# Feature: Curation Recipes

## Purpose
Author, store, and run reusable Data-Juicer operator chains (recipes) that clean
a multimodal corpus — the app's primary entity.

## Used By
- UI: `/recipes` (list), `/recipes/new` (create), `/recipes/[id]` (detail + run), `/recipes/[id]/edit` (edit)
- API: `GET /operator-catalog`, `GET/POST /recipes`, `GET/PUT/DELETE /recipes/{recipe_id}`, `POST /recipes/{recipe_id}/run`

## Core Functions
- `apps/web/src/components/recipes/recipe-form.tsx` — create/edit form (modality + source selectors, operator checklist, numeric thresholds)
- `apps/web/src/components/recipes/recipe-list.tsx` — list with run/delete
- `services/api/app/runtime/recipes.py` — route handlers
- `services/api/app/service/recipes.py` — CRUD over B2 `configs/*.yaml`
- `services/api/app/service/operators.py` — the finite operator catalog + Data-Juicer rendering
- `services/api/app/repo/b2_dataset.py` — B2 object I/O (put/get/list YAML)

## Canonical Files
- Form-UX exemplar: `apps/web/src/components/settings/settings-form.tsx`
- Service logic: `services/api/app/service/recipes.py`

## Inputs
- `RecipeSpec`: name (str), modality (image-text | video | audio | text), source_prefix (str), operators (list of {name, params}), description (str)

## Outputs
- A `configs/<slug>.yaml` object in B2 holding recipe metadata, the authored operators, and the rendered Data-Juicer `process` chain
- `Recipe` responses (including the rendered YAML) to the UI

## Flow
- Create: form → `POST /recipes` → validate operators against the catalog + modality → render YAML → `put_object` to `configs/<slug>.yaml`
- Read: `GET /recipes` lists + parses every `configs/*.yaml`; `GET /recipes/{id}` returns one
- Edit: `/recipes/[id]/edit` opens pre-filled from the stored YAML → `PUT` overwrites, preserving `created_at`
- Delete: confirm dialog → `DELETE /recipes/{id}` → `delete_object`
- Run: "Run curation" → `POST /recipes/{id}/run` (see [Curation Run](curation-run.md))

## Edge Cases
- Duplicate name (same slug) on create → 409
- Operator not applicable to the chosen modality, or unknown operator → 400
- Missing recipe on get/edit/delete/run → 404
- Malformed `configs/*.yaml` object → skipped in the listing, never breaks it

## UX States
- Empty: "No recipes yet" with a New recipe CTA
- Loading: skeleton rows / form
- Error: inline `ErrorState` with retry

## Verification
- Test files: `services/api/tests/test_recipes.py`
- Required cases: catalog non-empty, full CRUD lifecycle, duplicate conflict, modality-mismatched operator rejected, missing recipe 404
- Focused verify command: `pnpm test:api`
- Default pre-PR verify command: `pnpm verify`
- Full local verify command: `pnpm verify:full` when E2E/live prerequisites apply
- Pass criteria: focused tests and `pnpm verify` green

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
- [Curation Run](curation-run.md)
