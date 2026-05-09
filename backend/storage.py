"""
Cloudflare R2 file storage helper.
Uses boto3's S3-compatible interface against R2's endpoint.
"""
from __future__ import annotations
import os
import boto3
from botocore.config import Config

_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
_ACCESS_KEY  = os.getenv("R2_ACCESS_KEY_ID", "")
_SECRET_KEY  = os.getenv("R2_SECRET_ACCESS_KEY", "")
_BUCKET      = os.getenv("R2_BUCKET_NAME", "spendemic-uploads")
_PUBLIC_URL  = os.getenv("R2_PUBLIC_URL", "").rstrip("/")


def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=_ACCESS_KEY,
        aws_secret_access_key=_SECRET_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_file(file_bytes: bytes, key: str, content_type: str) -> str:
    """Upload bytes to R2 and return the public URL."""
    _client().put_object(
        Bucket=_BUCKET,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    return f"{_PUBLIC_URL}/{key}"


def delete_file(key: str) -> None:
    """Delete an object from R2. Silently ignores missing keys."""
    try:
        _client().delete_object(Bucket=_BUCKET, Key=key)
    except Exception:
        pass
