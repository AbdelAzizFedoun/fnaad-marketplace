from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("catalog", "0040_voicecall_timing"), ("accounts", "0022_remove_artiststudiophoto_studio_media_exactly_one_file_and_more")]
    operations = [migrations.AddField(model_name="conversation", name="direct_artist", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="direct_conversations", to="accounts.artistprofile"))]
