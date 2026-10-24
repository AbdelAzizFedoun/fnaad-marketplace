"""
Data migration: back-fill is_public_visible for products that were already
approved before the is_public_visible field was introduced in migration 0026.

When migration 0026 added the column it used default=False, so every product
that was approved prior to that migration is stuck with is_public_visible=False
and will never appear in the public gallery.  This migration sets
is_public_visible=True for every product whose status is currently 'approved'.
"""

from django.db import migrations


def backfill_public_visibility(apps, schema_editor):
    Product = apps.get_model("catalog", "Product")
    updated = Product.objects.filter(
        status="approved",
        is_public_visible=False,
    ).update(is_public_visible=True)
    if updated:
        print(f"\n  ✓ Set is_public_visible=True on {updated} already-approved product(s).")


def reverse_backfill(apps, schema_editor):
    # Non-destructive reverse: leave is_public_visible as-is.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalog", "0026_product_is_public_visible_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_public_visibility, reverse_code=reverse_backfill),
    ]
