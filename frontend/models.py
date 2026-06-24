# File location: RePo-SUDOE-AI/frontend/models.py
import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class ChatSession(models.Model):
    """Modelo para sesiones de chat en RePo-SUDOE-AI"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_sessions"
    )
    title = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-updated_at"]
        verbose_name = "RePo-SUDOE-AI Chat Session"
        verbose_name_plural = "RePo-SUDOE-AI Chat Sessions"

    def __str__(self):
        return f"RePo-SUDOE-AI: {self.title or 'Chat'} - {self.user.username}"

    def get_preview(self):
        first_message = self.messages.filter(sender="user").first()
        if first_message:
            return (
                first_message.content[:100] + "..."
                if len(first_message.content) > 100
                else first_message.content
            )
        return "New RePo-SUDOE-AI chat"


class ChatMessage(models.Model):
    """Modelo para mensajes de chat en RePo-SUDOE-AI"""

    SENDER_CHOICES = [
        ("user", "User"),
        ("assistant", "RePo-SUDOE-AI Assistant"),
        ("system", "System"),
    ]

    session = models.ForeignKey(
        ChatSession, on_delete=models.CASCADE, related_name="messages"
    )
    sender = models.CharField(max_length=10, choices=SENDER_CHOICES)
    content = models.TextField()
    timestamp = models.DateTimeField(default=timezone.now)
    metadata = models.JSONField(
        default=dict, blank=True
    )  # Para guardar datos adicionales de RePo-SUDOE-AI

    class Meta:
        ordering = ["timestamp"]
        verbose_name = "RePo-SUDOE-AI Chat Message"
        verbose_name_plural = "RePo-SUDOE-AI Chat Messages"

    def __str__(self):
        return f"RePo-SUDOE-AI {self.sender}: {self.content[:50]}..."


class UploadedFile(models.Model):
    """Modelo para archivos subidos a RePo-SUDOE-AI"""

    FILE_TYPE_CHOICES = [
        ("receptor", "Receptor"),
        ("drug", "Drug"),
        ("pose", "Correct Pose"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="uploaded_files",
    )
    file_type = models.CharField(max_length=10, choices=FILE_TYPE_CHOICES)
    original_filename = models.CharField(max_length=255)
    file_path = models.FileField(upload_to="uploads/%Y/%m/%d/")
    file_size = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(default=timezone.now)
    is_processed = models.BooleanField(default=False)
    processing_status = models.CharField(max_length=50, default="uploaded")

    class Meta:
        ordering = ["-uploaded_at"]
        verbose_name = "RePo-SUDOE-AI Uploaded File"
        verbose_name_plural = "RePo-SUDOE-AI Uploaded Files"

    def __str__(self):
        return f"RePo-SUDOE-AI {self.file_type}: {self.original_filename}"


class DockingSimulation(models.Model):
    """Modelo para simulaciones de docking en RePo-SUDOE-AI"""

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("running", "Running"),
        ("completed", "Completed"),
        ("failed", "Failed"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="docking_simulations",
    )
    chat_session = models.ForeignKey(
        ChatSession, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Archivos de entrada para RePo-SUDOE-AI
    receptor_file = models.ForeignKey(
        UploadedFile, on_delete=models.CASCADE, related_name="receptor_simulations"
    )
    drug_file = models.ForeignKey(
        UploadedFile, on_delete=models.CASCADE, related_name="drug_simulations"
    )
    pose_file = models.ForeignKey(
        UploadedFile,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pose_simulations",
    )

    # Parámetros de RePo-SUDOE-AI
    remove_non_gene_atoms = models.BooleanField(default=False)
    additional_parameters = models.JSONField(default=dict, blank=True)

    # Estado y resultados
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True)

    # Resultados de RePo-SUDOE-AI
    binding_affinity = models.FloatField(null=True, blank=True)
    results_data = models.JSONField(default=dict, blank=True)
    output_files = models.JSONField(
        default=list, blank=True
    )  # Rutas de archivos de salida

    class Meta:
        ordering = ["-started_at"]
        verbose_name = "RePo-SUDOE-AI Docking Simulation"
        verbose_name_plural = "RePo-SUDOE-AI Docking Simulations"

    def __str__(self):
        return f"RePo-SUDOE-AI Docking {self.id} - {self.status}"

    @property
    def duration(self):
        if self.started_at and self.completed_at:
            return self.completed_at - self.started_at
        return None


class DockingPose(models.Model):
    """Modelo para poses de docking en RePo-SUDOE-AI"""

    simulation = models.ForeignKey(
        DockingSimulation, on_delete=models.CASCADE, related_name="poses"
    )
    pose_number = models.PositiveIntegerField()
    binding_score = models.FloatField()
    rmsd = models.FloatField(null=True, blank=True)
    coordinates = models.JSONField(default=dict)  # Coordenadas 3D del pose
    pdb_content = models.TextField(blank=True)  # Contenido PDB del pose

    class Meta:
        ordering = ["binding_score"]  # Ordenar por mejor score
        unique_together = ["simulation", "pose_number"]
        verbose_name = "RePo-SUDOE-AI Docking Pose"
        verbose_name_plural = "RePo-SUDOE-AI Docking Poses"

    def __str__(self):
        return f"RePo-SUDOE-AI Pose {self.pose_number} - Score: {self.binding_score}"
