from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("catalog", "0039_commissionrequest_reference_image")]
    operations = [
        migrations.AddField(model_name="voicecall", name="answered_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="voicecall", name="ended_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="voicecall", name="duration_seconds", field=models.PositiveIntegerField(blank=True, null=True)),
    ]
