from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("catalog", "0038_alter_product_price_xaf")]

    operations = [
        migrations.AddField(
            model_name="commissionrequest",
            name="reference_image",
            field=models.ImageField(blank=True, null=True, upload_to="commissions/references/"),
        ),
    ]
