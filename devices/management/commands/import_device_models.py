"""
Place this file at:
    devices/management/commands/import_device_models.py

Then run:
    python manage.py import_device_models
or:
    python manage.py import_device_models --file path/to/iran_mobile_models.csv

Edit only the import line below if your app/model names differ.
"""

import csv
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from devices.models import Brand, DeviceModel


def first_field(model, candidates, *, required=True):
    field_names = {field.name for field in model._meta.get_fields()}
    for candidate in candidates:
        if candidate in field_names:
            return candidate
    if required:
        raise CommandError(
            f"None of these fields exist on {model.__name__}: {', '.join(candidates)}"
        )
    return None


class Command(BaseCommand):
    help = "Import or update a curated mobile-device catalog from CSV."

    def add_arguments(self, parser):
        default_file = (
            Path(__file__).resolve().parents[2]
            / "data"
            / "iran_mobile_models.csv"
        )
        parser.add_argument(
            "--file",
            default=str(default_file),
            help="Path to the CSV catalog.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        csv_path = Path(options["file"]).resolve()
        if not csv_path.exists():
            raise CommandError(f"CSV file not found: {csv_path}")

        brand_name_field = first_field(Brand, ["name", "title"])
        brand_slug_field = first_field(Brand, ["slug"], required=False)

        device_name_field = first_field(
            DeviceModel, ["name", "model_name", "title"]
        )
        device_brand_field = first_field(
            DeviceModel, ["brand", "manufacturer"]
        )

        optional_fields = {
            "catalog_key": first_field(
                DeviceModel, ["catalog_key", "slug", "code"], required=False
            ),
            "series": first_field(
                DeviceModel, ["series"], required=False
            ),
            "device_type": first_field(
                DeviceModel, ["device_type", "type"], required=False
            ),
            "catalog_priority": first_field(
                DeviceModel, ["catalog_priority", "priority"], required=False
            ),
            "search_aliases": first_field(
                DeviceModel, ["search_aliases", "aliases"], required=False
            ),
            "is_active": first_field(
                DeviceModel, ["is_active", "active"], required=False
            ),
            "source_group": first_field(
                DeviceModel, ["source_group", "source"], required=False
            ),
        }

        created_count = 0
        updated_count = 0

        with csv_path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)

            for row_number, row in enumerate(reader, start=2):
                brand_name = (row.get("brand") or "").strip()
                model_name = (row.get("model_name") or "").strip()

                if not brand_name or not model_name:
                    self.stderr.write(
                        f"Skipping row {row_number}: missing brand/model_name"
                    )
                    continue

                brand_defaults = {}
                if brand_slug_field:
                    brand_defaults[brand_slug_field] = slugify(
                        brand_name, allow_unicode=True
                    )

                brand, _ = Brand.objects.get_or_create(
                    **{brand_name_field: brand_name},
                    defaults=brand_defaults,
                )

                lookup = {
                    device_brand_field: brand,
                    device_name_field: model_name,
                }

                defaults = {}
                for csv_column, model_field in optional_fields.items():
                    if not model_field:
                        continue

                    value = row.get(csv_column, "")
                    if csv_column == "is_active":
                        value = str(value).strip().lower() in {
                            "1", "true", "yes", "y"
                        }
                    else:
                        value = str(value).strip()

                    defaults[model_field] = value

                _, created = DeviceModel.objects.update_or_create(
                    **lookup,
                    defaults=defaults,
                )

                if created:
                    created_count += 1
                else:
                    updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Import completed: {created_count} created, "
                f"{updated_count} updated."
            )
        )
