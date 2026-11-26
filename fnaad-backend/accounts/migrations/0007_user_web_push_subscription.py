from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0022_remove_artiststudiophoto_studio_media_exactly_one_file_and_more")]
    operations = [migrations.AddField(
        model_name="user", name="web_push_subscription",
        field=models.JSONField(blank=True, default=dict),
    )]
