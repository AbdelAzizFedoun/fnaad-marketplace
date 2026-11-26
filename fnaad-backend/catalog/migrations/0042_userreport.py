from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):
    dependencies = [("catalog", "0041_conversation_direct_artist")]
    operations = [migrations.CreateModel(name="UserReport", fields=[
        ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
        ("reason", models.TextField()), ("status", models.CharField(choices=[("open", "Open"), ("resolved", "Resolved"), ("dismissed", "Dismissed")], default="open", max_length=20)),
        ("created_at", models.DateTimeField(auto_now_add=True)), ("resolved_at", models.DateTimeField(blank=True, null=True)),
        ("product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="user_reports", to="catalog.product")),
        ("reported_user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="received_user_reports", to="accounts.user")),
        ("reporter", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="submitted_user_reports", to="accounts.user")),
    ])]
