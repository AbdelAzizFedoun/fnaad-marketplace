from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("billing", "0006_registration_fee")]

    operations = [
        migrations.AddField(
            model_name="subscriptionpayment",
            name="provider",
            field=models.CharField(
                choices=[("fapshi", "Fapshi"), ("campay", "CamPay")],
                default="fapshi",
                max_length=20,
            ),
        ),
    ]
