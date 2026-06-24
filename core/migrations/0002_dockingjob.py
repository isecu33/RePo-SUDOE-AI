# Generated migration for DockingJob model
# This migration adds the DockingJob model for asynchronous docking jobs via Celery

import django.db.models.deletion
import django.utils.timezone
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("frontend", "0001_initial"),
        ("core", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="DockingJob",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("completed", "Completed"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                (
                    "progress",
                    models.PositiveSmallIntegerField(
                        default=0, help_text="Progreso estimado, 0-100"
                    ),
                ),
                (
                    "celery_task_id",
                    models.CharField(blank=True, db_index=True, max_length=255),
                ),
                ("drug", models.CharField(max_length=255)),
                ("gene", models.CharField(max_length=255)),
                (
                    "structure",
                    models.CharField(
                        help_text="Código PDB de la estructura seleccionada",
                        max_length=20,
                    ),
                ),
                (
                    "receptor_path",
                    models.CharField(
                        help_text="Ruta absoluta al archivo PDB del receptor",
                        max_length=1024,
                    ),
                ),
                (
                    "drug_path",
                    models.CharField(
                        help_text="Ruta absoluta al archivo SDF del fármaco",
                        max_length=1024,
                    ),
                ),
                (
                    "vina_config",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Configuración personalizada de AutoDock Vina",
                    ),
                ),
                (
                    "experiment_analysis",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Análisis predictivo generado antes de lanzar el job",
                    ),
                ),
                (
                    "result_data",
                    models.JSONField(
                        blank=True,
                        default=dict,
                        help_text="Resultado completo (formato igual al de run_autodock_vina / response de docking_complete)",
                    ),
                ),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                (
                    "chat_session",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="docking_jobs",
                        to="frontend.chatsession",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="docking_jobs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Docking Job",
                "verbose_name_plural": "Docking Jobs",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["status"], name="core_dockin_status_idx"),
                    models.Index(
                        fields=["user", "status"], name="core_dockin_user_status_idx"
                    ),
                ],
            },
        ),
    ]
