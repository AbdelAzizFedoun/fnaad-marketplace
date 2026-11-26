from django.db import migrations, models
from django.core.validators import MinValueValidator


class Migration(migrations.Migration):
    dependencies = [("catalog", "0037_conversation_pinned_message_message_deleted_by")]

    operations = [
        migrations.AlterField(
            model_name="product",
            name="price_xaf",
            field=models.PositiveIntegerField(blank=True, null=True, validators=[MinValueValidator(500)]),
        ),
    ]
