import hashlib
from io import BytesIO
from uuid import uuid4

from django.core.files.base import ContentFile
from PIL import Image, ImageOps

try:
    import imagehash
except ImportError:
    imagehash = None


THUMBNAIL_SIZE = (640, 640)


def generate_product_thumbnail(product_image):
    if not product_image.image:
        return

    with product_image.image.open("rb") as source:
        with Image.open(source) as original:
            thumbnail = ImageOps.exif_transpose(original)
            thumbnail.thumbnail(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            if thumbnail.mode not in ("RGB", "RGBA"):
                thumbnail = thumbnail.convert("RGBA" if "transparency" in thumbnail.info else "RGB")
            output = BytesIO()
            thumbnail.save(output, format="WEBP", quality=78, method=6)

    product_image.thumbnail.save(
        f"{uuid4().hex}.webp",
        ContentFile(output.getvalue()),
        save=False,
    )
    product_image.save(update_fields=["thumbnail"])


def compute_image_hashes(image_file):
    """Return perceptual hashes plus a reliable content hash for an upload."""
    data = b""
    try:
        img_hash = None
        dhash = None
        # FieldFile objects must be opened explicitly. Calling read() directly
        # can fail after Django has moved the upload to storage.
        if hasattr(image_file, "open"):
            with image_file.open("rb") as source:
                data = source.read()
        else:
            if hasattr(image_file, "seek"):
                image_file.seek(0)
            data = image_file.read()

        if imagehash is not None and data:
            with Image.open(BytesIO(data)) as img:
                img_hash = str(imagehash.phash(img))
                dhash = str(imagehash.dhash(img))
        sha256 = hashlib.sha256(data).hexdigest()

        return img_hash, dhash, sha256
    except Exception:
        # Never discard the exact-file hash because perceptual hashing failed.
        return None, None, hashlib.sha256(data).hexdigest() if data else None
