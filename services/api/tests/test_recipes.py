"""Recipe CRUD + run behavior, hermetic against an in-memory B2 store."""

from datetime import UTC, datetime

import pytest

from app.service import recipes as svc

_CREATE = {
    "name": "Image-text baseline",
    "modality": "image-text",
    "source_prefix": "raw/",
    "operators": [
        {"name": "text_length_filter", "params": {"min_len": 10, "max_len": 100000}},
        {"name": "image_shape_filter", "params": {"min_width": 128, "min_height": 128}},
    ],
}


@pytest.fixture
def store(monkeypatch):
    """Patch the recipe service's repo functions with an in-memory object store."""
    data: dict[str, str] = {}

    def put_text(key, text, content_type="application/x-yaml"):
        data[key] = text

    def get_text(key):
        return data.get(key)

    def list_objects(prefix):
        return [
            {"key": k, "size": len(v.encode()), "last_modified": datetime.now(UTC)}
            for k, v in data.items()
            if k.startswith(prefix)
        ]

    def object_exists(key):
        return key in data

    def delete_file(key):
        data.pop(key, None)

    monkeypatch.setattr(svc, "put_text", put_text)
    monkeypatch.setattr(svc, "get_text", get_text)
    monkeypatch.setattr(svc, "list_objects", list_objects)
    monkeypatch.setattr(svc, "object_exists", object_exists)
    monkeypatch.setattr(svc, "delete_file", delete_file)
    return data


@pytest.mark.asyncio
async def test_operator_catalog_is_non_empty(client):
    resp = await client.get("/operator-catalog")
    assert resp.status_code == 200
    names = {o["name"] for o in resp.json()}
    assert "text_length_filter" in names
    assert "image_deduplicator" in names


@pytest.mark.asyncio
async def test_recipe_crud_lifecycle(client, store):
    # create
    resp = await client.post("/recipes", json=_CREATE)
    assert resp.status_code == 200, resp.text
    recipe = resp.json()
    assert recipe["id"] == "image-text-baseline"
    assert "process" in recipe["yaml"]
    assert store  # something was written to B2

    # read (list + detail)
    assert any(r["id"] == "image-text-baseline" for r in (await client.get("/recipes")).json())
    detail = await client.get("/recipes/image-text-baseline")
    assert detail.status_code == 200
    assert detail.json()["modality"] == "image-text"

    # edit
    edited = {**_CREATE, "description": "cleaned up"}
    put = await client.put("/recipes/image-text-baseline", json=edited)
    assert put.status_code == 200
    assert put.json()["description"] == "cleaned up"

    # delete
    dele = await client.delete("/recipes/image-text-baseline")
    assert dele.status_code == 200 and dele.json()["deleted"] is True
    assert (await client.get("/recipes/image-text-baseline")).status_code == 404


@pytest.mark.asyncio
async def test_create_duplicate_conflicts(client, store):
    assert (await client.post("/recipes", json=_CREATE)).status_code == 200
    assert (await client.post("/recipes", json=_CREATE)).status_code == 409


@pytest.mark.asyncio
async def test_create_rejects_modality_mismatched_operator(client, store):
    bad = {**_CREATE, "modality": "text", "operators": [
        {"name": "image_shape_filter", "params": {"min_width": 128}}
    ]}
    resp = await client.post("/recipes", json=bad)
    assert resp.status_code == 400
    assert "does not apply" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_get_missing_recipe_404(client, store):
    assert (await client.get("/recipes/nope")).status_code == 404
