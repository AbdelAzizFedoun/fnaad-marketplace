"""
One-time script: upload all existing local media files to Cloudinary.

Usage (from fnaad-backend/ folder):
    python scripts/migrate_to_cloudinary.py

Requires CLOUDINARY_URL to be set in .env
"""

import os
import sys
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv
load_dotenv(BASE_DIR / ".env")

CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "")
if not CLOUDINARY_URL:
    print("ERROR: CLOUDINARY_URL is not set in .env - aborting.")
    sys.exit(1)

# Parse cloudinary://key:secret@cloud_name without importing Django
import urllib.parse
_parsed = urllib.parse.urlparse(CLOUDINARY_URL)
import cloudinary
cloudinary.config(
    cloud_name=_parsed.hostname,
    api_key=_parsed.username,
    api_secret=_parsed.password,
)
import cloudinary.uploader

MEDIA_ROOT = BASE_DIR / "media"
PRODUCT_MEDIA_ROOTS = [
    MEDIA_ROOT / "products",
]

VIDEO_EXTS  = {".mp4", ".mov", ".avi", ".webm", ".m4a", ".3gp"}
IMAGE_EXTS  = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}

def resource_type(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in VIDEO_EXTS:  return "video"
    if ext in IMAGE_EXTS:  return "image"
    return "raw"

def main():
    print(f"Migrating media/ -> Cloudinary (cloud: {cloudinary.config().cloud_name})\n")

    if not MEDIA_ROOT.exists():
        print("WARNING: No local media/ folder found - nothing to migrate.")
        return

    # Product artwork only. Do not upload profile photos, messages, audio,
    # documents, or other private media as part of this migration.
    files = [f for root in PRODUCT_MEDIA_ROOTS if root.exists() for f in root.rglob("*") if f.is_file()]
    print(f"Found {len(files)} file(s).\n")

    success = failed = 0
    for f in files:
        rel  = f.relative_to(MEDIA_ROOT)
        pub  = f"fnaad/{str(rel).replace(chr(92), '/')}"
        rtype = resource_type(f)
        try:
            cloudinary.uploader.upload(str(f), public_id=pub,
                                       resource_type=rtype, overwrite=False)
            print(f"  OK  {rel}")
            success += 1
        except Exception as e:
            print(f"  FAILED  {rel}  ->  {e}")
            failed += 1

    print(f"\nDone — {success} uploaded, {failed} failed.")

if __name__ == "__main__":
    main()
