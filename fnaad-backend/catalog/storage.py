from django.core.files.storage import storages


def product_media_storage():
    return storages["product_media"]
