from django.core.files.storage import storages

try:
    from cloudinary_storage.storage import VideoMediaCloudinaryStorage
except ImportError:
    VideoMediaCloudinaryStorage = None


def studio_video_storage():
    """Store studio videos as Cloudinary video resources, not images."""
    if VideoMediaCloudinaryStorage is not None:
        return VideoMediaCloudinaryStorage()
    return storages["default"]
