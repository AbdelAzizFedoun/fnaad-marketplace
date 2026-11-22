from django.core.files.storage import storages

try:
    from cloudinary_storage.storage import RawMediaCloudinaryStorage
except ImportError:
    RawMediaCloudinaryStorage = None


def product_media_storage():
    return storages["product_media"]


def audio_media_storage():
    """Use Cloudinary's video resource type for audio files when available."""
    if RawMediaCloudinaryStorage is not None:
        return RawMediaCloudinaryStorage()
    return storages["default"]
