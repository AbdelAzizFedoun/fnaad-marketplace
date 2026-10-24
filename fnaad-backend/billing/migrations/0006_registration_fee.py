from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("billing", "0005_rename_campay_reference_provider_transaction_id")]
    operations = [
        migrations.AddField(model_name="subscription", name="registration_fee_paid", field=models.BooleanField(default=True)),
        migrations.AddField(model_name="subscriptionpayment", name="is_registration_fee", field=models.BooleanField(default=False)),
    ]
