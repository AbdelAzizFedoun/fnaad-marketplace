from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0006_alter_user_email")]
    operations = [migrations.AddField(
        model_name="user", name="web_push_subscription",
        field=models.JSONField(blank=True, default=dict),
    )]
