from django.core.management.base import BaseCommand
from catalog.models import Product, ProductImage
from accounts.models import ArtistProfile


class Command(BaseCommand):
    help = "Create safe demo artworks for local/public preview environments."

    def handle(self, *args, **options):
        artists = list(ArtistProfile.objects.select_related("user").all()[:5])
        source_images = list(ProductImage.objects.all()[:3])
        if not artists or not source_images:
            self.stderr.write("Create at least one artist and upload at least one image first.")
            return

        titles = [
            ("Terracotta Morning", "A warm study of morning light and memory.", "painting"),
            ("Market Voices", "Layers of colour inspired by everyday street life.", "abstract"),
            ("Rain on the Roof", "A quiet piece about home, weather, and belonging.", "contemporary"),
            ("The Weaver", "A portrait celebrating patience, craft, and tradition.", "portrait"),
            ("Blue Horizon", "A calm composition for spaces that need room to breathe.", "painting"),
            ("Hands at Work", "A drawing about the dignity of making things by hand.", "drawing"),
            ("Green Earth", "Organic shapes inspired by Cameroon’s forest landscapes.", "abstract"),
            ("Sunday Cloth", "Colour, pattern, and family gathered in one scene.", "artisan_crafts"),
            ("City After Rain", "A contemporary view of lights returning to the street.", "contemporary"),
            ("Quiet Strength", "A simple portrait with a strong, gentle presence.", "portrait"),
            ("Indigo Memory", "Deep blue tones carrying a story from one generation to the next.", "painting"),
            ("Home Ground", "A small celebration of place, texture, and everyday life.", "home_design"),
        ]
        created = 0
        for index, (title, description, category) in enumerate(titles):
            product, made = Product.objects.get_or_create(
                title=f"{title} (FNAAD Demo)",
                defaults={
                    "artist": artists[index % len(artists)],
                    "description": description,
                    "category": category,
                    "price_xaf": 25000 + index * 7500,
                    "status": Product.STATUS_APPROVED,
                    "is_public_visible": True,
                    "verification_level": Product.VERIFICATION_EVIDENCE,
                    "creation_method": "original",
                },
            )
            if made:
                source = source_images[index % len(source_images)]
                ProductImage.objects.create(
                    product=product,
                    image=source.image.name,
                    thumbnail=source.thumbnail.name if source.thumbnail else "",
                    is_primary=True,
                    order=0,
                    image_phash=source.image_phash,
                    image_dhash=source.image_dhash,
                    image_file_sha256=source.image_file_sha256,
                )
                created += 1
        self.stdout.write(self.style.SUCCESS(f"Created {created} demo artworks."))
