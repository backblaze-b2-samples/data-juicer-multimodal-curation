"""B2 object I/O for recipes, runs, and dataset shards.

All curation-related B2 traffic goes through this repo module's boto3 client
(the same cached, custom-UA client as ``b2_client``) so the S3-compatible API
and the custom user agent are never bypassed - Data-Juicer itself never gets an
S3 client. boto3/botocore usage stays confined to the ``repo`` layer.
"""

from __future__ import annotations

import io
import os

from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings
from app.repo.b2_client import get_s3_client
from app.repo.list_cache import invalidate as _invalidate_list_cache


def put_text(key: str, text: str, content_type: str = "application/x-yaml") -> None:
    """Write a UTF-8 text object (recipe YAML, stats JSON). Raises RuntimeError."""
    client = get_s3_client()
    try:
        client.put_object(
            Bucket=settings.b2_bucket_name,
            Key=key,
            Body=io.BytesIO(text.encode("utf-8")),
            ContentType=content_type,
        )
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 put failed for '{key}': {e}") from e
    _invalidate_list_cache()


def get_text(key: str) -> str | None:
    """Read a UTF-8 text object. Returns None if it does not exist."""
    client = get_s3_client()
    try:
        response = client.get_object(Bucket=settings.b2_bucket_name, Key=key)
        return response["Body"].read().decode("utf-8")
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return None
        raise RuntimeError(f"B2 get failed for '{key}': {e}") from e
    except BotoCoreError as e:
        raise RuntimeError(f"B2 get failed for '{key}': {e}") from e


def object_exists(key: str) -> bool:
    client = get_s3_client()
    try:
        client.head_object(Bucket=settings.b2_bucket_name, Key=key)
        return True
    except ClientError as e:
        code = e.response.get("Error", {}).get("Code", "")
        if code in ("404", "NoSuchKey"):
            return False
        raise RuntimeError(f"B2 head failed for '{key}': {e}") from e


def list_objects(prefix: str) -> list[dict]:
    """Fresh (uncached) pagination of every object under ``prefix``.

    Recipes and run stats must appear immediately after a write, so this reads
    B2 directly rather than through the 5-minute stale-while-revalidate listing
    cache used by the bucket-wide file explorer. Returns
    ``[{"key", "size", "last_modified"}]``. Raises RuntimeError on S3 failure.
    """
    client = get_s3_client()
    out: list[dict] = []
    kwargs: dict = {"Bucket": settings.b2_bucket_name, "Prefix": prefix, "MaxKeys": 1000}
    try:
        while True:
            response = client.list_objects_v2(**kwargs)
            for obj in response.get("Contents", []):
                out.append(
                    {
                        "key": obj["Key"],
                        "size": obj["Size"],
                        "last_modified": obj["LastModified"],
                    }
                )
            if not response.get("IsTruncated"):
                break
            kwargs["ContinuationToken"] = response["NextContinuationToken"]
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 list failed for prefix '{prefix}': {e}") from e
    return out


def download_to_file(key: str, dest_path: str) -> None:
    """Stream an object's body to a local file (curation input). Raises RuntimeError."""
    client = get_s3_client()
    os.makedirs(os.path.dirname(dest_path) or ".", exist_ok=True)
    try:
        client.download_file(settings.b2_bucket_name, key, dest_path)
    except (ClientError, BotoCoreError) as e:
        raise RuntimeError(f"B2 download failed for '{key}': {e}") from e


def upload_file_from_path(path: str, key: str, content_type: str) -> None:
    """Upload a local file to B2 (refined shard). Raises RuntimeError."""
    client = get_s3_client()
    try:
        with open(path, "rb") as fh:
            client.put_object(
                Bucket=settings.b2_bucket_name,
                Key=key,
                Body=fh,
                ContentType=content_type,
            )
    except (ClientError, BotoCoreError, OSError) as e:
        raise RuntimeError(f"B2 upload failed for '{key}': {e}") from e
    _invalidate_list_cache()
