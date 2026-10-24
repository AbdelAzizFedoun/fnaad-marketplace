import hashlib
from typing import Optional, Tuple

try:
    import imagehash
except ImportError:
    imagehash = None

from django.db.models import Q
from .models import Product, ProductImage


def hamming_distance_hash(phash1: str, phash2: str) -> Optional[int]:
    try:
        if not phash1 or not phash2 or imagehash is None:
            return None
        h1 = imagehash.hex_to_hash(phash1)
        h2 = imagehash.hex_to_hash(phash2)
        return h1 - h2
    except Exception:
        return None


def find_potential_copy(image_obj: ProductImage, exclude_artist=None, threshold: int = 8) -> Tuple[Optional[Product], float, str]:
    sha256 = image_obj.image_file_sha256
    phash = image_obj.image_phash

    if not sha256 and not phash:
        return None, 0.0, "no_hash"

    queryset = Product.objects.filter(status=Product.STATUS_APPROVED).prefetch_related("images")
    if exclude_artist:
        queryset = queryset.exclude(artist=exclude_artist)

    best_product = None
    best_conf = 0.0

    for product in queryset:
        for other_img in product.images.all():
            if other_img.image_file_sha256 and sha256 and other_img.image_file_sha256 == sha256:
                return product, 1.0, "exact_sha256"

            dist = hamming_distance_hash(phash, other_img.image_phash)
            if dist is not None and dist <= threshold:
                conf = max(0.5, 1.0 - (dist / (threshold + 1)))
                if conf > best_conf:
                    best_conf = conf
                    best_product = product
                if best_conf >= 0.95:
                    return best_product, best_conf, "phash_high"

    return best_product, best_conf, "no_match"
