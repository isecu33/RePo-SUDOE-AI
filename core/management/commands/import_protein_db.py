import os

import pandas as pd
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from core.models import ProteinDatabase


class Command(BaseCommand):
    help = "Import protein database from Excel file"

    def add_arguments(self, parser):
        parser.add_argument(
            "excel_file",
            type=str,
            help="Path to the Excel file containing protein database",
        )
        parser.add_argument(
            "--clear",
            action="store_true",
            help="Clear existing data before importing",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be imported without actually importing",
        )

    def handle(self, *args, **options):
        excel_file = options["excel_file"]
        clear_existing = options["clear"]
        dry_run = options["dry_run"]

        # Check if file exists
        if not os.path.exists(excel_file):
            raise CommandError(f'Excel file "{excel_file}" does not exist.')

        self.stdout.write(f"Reading Excel file: {excel_file}")

        try:
            # Read Excel file
            df = pd.read_excel(excel_file, engine="openpyxl")
            self.stdout.write(f"Found {len(df)} rows in Excel file")

            # Display column information
            self.stdout.write("Available columns:")
            for col in df.columns:
                self.stdout.write(f"  - {col}")

            # Map expected columns (adjust these based on your Excel structure)
            column_mapping = {
                "hgnc_symbol": ["hgnc_symbol", "symbol", "gene_symbol"],
                "gene_name": ["gene_name", "name", "full_name"],
                "pdb_codes": ["pdb", "pdb_codes", "structures"],
                "description": ["description", "desc", "summary"],
                "chromosome": ["chromosome", "chr"],
                "gene_type": ["gene_type", "type"],
                "synonyms": ["synonyms", "aliases"],
                "uniprot_id": ["uniprot_id", "uniprot", "protein_id"],
            }

            # Find actual column names
            actual_columns = {}
            for field, possible_names in column_mapping.items():
                for name in possible_names:
                    if name in df.columns:
                        actual_columns[field] = name
                        break

            self.stdout.write(f"Mapped columns: {actual_columns}")

            # Validate required columns
            required_fields = ["hgnc_symbol", "gene_name"]
            missing_fields = [
                field for field in required_fields if field not in actual_columns
            ]

            if missing_fields:
                raise CommandError(f"Missing required columns: {missing_fields}")

            if dry_run:
                self.stdout.write(
                    self.style.WARNING("DRY RUN - No data will be imported")
                )
                self.show_preview(df, actual_columns)
                return

            # Clear existing data if requested
            if clear_existing:
                self.stdout.write("Clearing existing protein database...")
                ProteinDatabase.objects.all().delete()
                self.stdout.write(self.style.SUCCESS("Existing data cleared"))

            # Import data
            self.import_data(df, actual_columns)

        except Exception as e:
            raise CommandError(f"Error processing Excel file: {str(e)}")

    def show_preview(self, df, column_mapping):
        """Show preview of what would be imported"""
        self.stdout.write("\nPreview of first 5 rows:")
        self.stdout.write("-" * 80)

        for i, row in df.head(5).iterrows():
            self.stdout.write(f"Row {i + 1}:")
            for field, col_name in column_mapping.items():
                value = row.get(col_name, "") if col_name else ""
                self.stdout.write(f"  {field}: {value}")
            self.stdout.write("")

    def import_data(self, df, column_mapping):
        """Import data from DataFrame to database"""
        self.stdout.write(f"Importing {len(df)} protein entries...")

        imported_count = 0
        skipped_count = 0

        with transaction.atomic():
            for i, row in df.iterrows():
                try:
                    # Extract data
                    hgnc_symbol = str(
                        row.get(column_mapping["hgnc_symbol"], "")
                    ).strip()
                    gene_name = str(row.get(column_mapping["gene_name"], "")).strip()

                    # Skip rows without required data
                    if not hgnc_symbol or not gene_name:
                        skipped_count += 1
                        continue

                    # Extract optional fields
                    protein_data = {
                        "hgnc_symbol": hgnc_symbol,
                        "gene_name": gene_name,
                    }

                    # Add optional fields if columns exist
                    optional_fields = [
                        "pdb_codes",
                        "description",
                        "chromosome",
                        "gene_type",
                        "synonyms",
                        "uniprot_id",
                    ]

                    for field in optional_fields:
                        if field in column_mapping:
                            value = str(row.get(column_mapping[field], "")).strip()
                            if value and value.lower() not in ["nan", "none", ""]:
                                protein_data[field] = value

                    # Create or update protein entry
                    protein, created = ProteinDatabase.objects.update_or_create(
                        hgnc_symbol=hgnc_symbol, defaults=protein_data
                    )

                    if created:
                        imported_count += 1

                    # Progress indicator
                    if (i + 1) % 100 == 0:
                        self.stdout.write(f"Processed {i + 1} rows...")

                except Exception as e:
                    self.stdout.write(
                        self.style.WARNING(f"Error processing row {i + 1}: {str(e)}")
                    )
                    skipped_count += 1

        # Summary
        self.stdout.write(
            self.style.SUCCESS(
                f"Import completed! Imported: {imported_count}, Skipped: {skipped_count}"
            )
        )

        # Show total count
        total_count = ProteinDatabase.objects.count()
        self.stdout.write(f"Total proteins in database: {total_count}")
