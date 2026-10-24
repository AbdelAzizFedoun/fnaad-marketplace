from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("billing", "0004_alter_subscription_status"),
    ]

    operations = [
        migrations.RenameField(
            model_name="subscriptionpayment",
            old_name="campay_reference",
            new_name="provider_transaction_id",
        ),
    ]
