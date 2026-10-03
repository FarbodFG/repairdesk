from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("notifications", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="error_code",
            field=models.CharField(
                blank=True,
                max_length=128,
                verbose_name="error code",
            ),
        ),
        migrations.AddField(
            model_name="notification",
            name="is_retryable",
            field=models.BooleanField(
                default=False,
                verbose_name="is retryable",
            ),
        ),
    ]
