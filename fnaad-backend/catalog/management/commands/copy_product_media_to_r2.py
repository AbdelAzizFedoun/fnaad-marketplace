from urllib.parse import urlsplit

import boto3
import requests
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from catalog.models import ProductImage
from catalog.serializers import ProductImageSerializer


class Command(BaseCommand):
    help = "Copy existing Cloudinary product images and thumbnails to Cloudflare R2."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Count source files without uploading them.",
        )

    def handle(self, *args, dry_run=False, **options):
        if settings.PRODUCT_MEDIA_STORAGE_BACKEND != "cloudinary" or not settings.CLOUDINARY_URL:
            raise CommandError(
                "Run this command while product media is still stored in Cloudinary."
            )
        if not settings.R2_CREDENTIALS_CONFIGURED:
            raise CommandError(
                "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and "
                "R2_BUCKET_NAME before copying media."
            )

        client = boto3.client(
            "s3",
            endpoint_url=settings.R2_ENDPOINT_URL,
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
        )
        serializer = ProductImageSerializer()
        copied = 0

        for product_image in ProductImage.objects.iterator():
            for field_name in ("image", "thumbnail"):
                media_file = getattr(product_image, field_name)
                if not media_file:
                    continue

                source_url = serializer._media_url(media_file)
                source_host = urlsplit(source_url or "").hostname
                if not source_host or not (
                    source_host == "cloudinary.com"
                    or source_host.endswith(".cloudinary.com")
                ):
                    raise CommandError(
                        f"Product image {product_image.pk} has no public Cloudinary URL."
                    )

                key = media_file.name.lstrip("/")
                if not key:
                    raise CommandError(
                        f"Product image {product_image.pk} has an empty storage key."
                    )

                copied += 1
                if dry_run:
                    continue

                try:
                    response = requests.get(source_url, timeout=(10, 60))
                    response.raise_for_status()
                    content_type = response.headers.get("Content-Type", "").split(";")[0]
                    if not content_type.startswith("image/"):
                        raise CommandError(
                            f"Product image {product_image.pk} returned a non-image response."
                        )
                    client.put_object(
                        Bucket=settings.R2_BUCKET_NAME,
                        Key=key,
                        Body=response.content,
                        ContentType=content_type,
                        CacheControl="public, max-age=31536000, immutable",
                    )
                except (requests.RequestException, BotoCoreError, ClientError) as error:
                    raise CommandError(
                        f"Could not copy product image {product_image.pk} ({field_name}): {error}"
                    ) from error

        if dry_run:
            self.stdout.write(f"Would copy {copied} product media file(s) to R2.")
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Copied {copied} product media file(s) to R2.")
            )
