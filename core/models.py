from django.db import models
from django.conf import settings
from django.utils import timezone
from frontend.models import ChatSession
import uuid


class ProteinDatabase(models.Model):
    """
    Model to store protein/gene information from Excel database.
    Replaces the Excel file lookup functionality from the original app.py.
    """
    
    hgnc_symbol = models.CharField(
        max_length=50, 
        db_index=True,
        verbose_name="HGNC Symbol",
        help_text="Official gene symbol from HGNC"
    )
    gene_name = models.CharField(
        max_length=255, 
        db_index=True,
        verbose_name="Gene Name",
        help_text="Full gene name"
    )
    pdb_codes = models.TextField(
        blank=True,
        verbose_name="PDB Codes",
        help_text="Semicolon-separated list of PDB structure codes"
    )
    
    # Additional fields that might be in the Excel database
    description = models.TextField(blank=True, verbose_name="Description")
    chromosome = models.CharField(max_length=10, blank=True, verbose_name="Chromosome")
    gene_type = models.CharField(max_length=50, blank=True, verbose_name="Gene Type")
    synonyms = models.TextField(blank=True, verbose_name="Gene Synonyms")
    uniprot_id = models.CharField(max_length=20, blank=True, verbose_name="UniProt ID")
    
    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Protein Database Entry"
        verbose_name_plural = "Protein Database Entries"
        indexes = [
            models.Index(fields=['hgnc_symbol']),
            models.Index(fields=['gene_name']),
        ]
    
    def __str__(self):
        return f"{self.hgnc_symbol} - {self.gene_name}"
    
    def get_pdb_list(self):
        """Returns list of PDB codes"""
        if not self.pdb_codes:
            return []
        return [pdb.strip() for pdb in self.pdb_codes.split(';') if pdb.strip()]
    
    def get_structures_info(self):
        """Returns structured information about available PDB structures"""
        pdb_list = self.get_pdb_list()
        return [
            {
                "tipo": "experimental",
                "id": pdb,
                "fuente": f"https://files.rcsb.org/download/{pdb}.pdb"
            }
            for pdb in pdb_list
        ]


class ConversationContext(models.Model):
    """
    Model to store conversation context and extracted parameters for multi-step workflows.
    Extends the existing ChatSession with molecular-specific context.
    """
    
    INTENT_CHOICES = [
        ('general', 'General Query'),
        ('docking', 'Docking Request'),
        ('structure_search', 'Structure Search'),
        ('parameter_extraction', 'Parameter Extraction'),
    ]
    
    chat_session = models.OneToOneField(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='molecular_context'
    )
    current_intent = models.CharField(
        max_length=20, 
        choices=INTENT_CHOICES,
        default='general'
    )
    extracted_parameters = models.JSONField(
        default=dict,
        help_text="Stores extracted drug, gene, and structure parameters"
    )
    workflow_state = models.CharField(
        max_length=50,
        default='initial',
        help_text="Current state in multi-step workflow"
    )
    awaiting_confirmation = models.BooleanField(
        default=False,
        help_text="Whether the system is waiting for user confirmation"
    )
    available_structures = models.JSONField(
        default=list,
        help_text="List of available protein structures for selection"
    )
    
    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Conversation Context"
        verbose_name_plural = "Conversation Contexts"
    
    def __str__(self):
        return f"Context for {self.chat_session} - {self.current_intent}"
    
    def reset_context(self):
        """Reset context for new conversation flow"""
        self.current_intent = 'general'
        self.extracted_parameters = {}
        self.workflow_state = 'initial'
        self.awaiting_confirmation = False
        self.available_structures = []
        self.save()
    
    def update_parameters(self, new_params):
        """Update extracted parameters"""
        self.extracted_parameters.update(new_params)
        self.save()


class MolecularQuery(models.Model):
    """
    Model to log all molecular queries and their results for analytics and debugging.
    """
    
    QUERY_TYPES = [
        ('general', 'General Information'),
        ('docking', 'Docking Request'),
        ('structure_lookup', 'Structure Lookup'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='molecular_queries'
    )
    chat_session = models.ForeignKey(
        ChatSession,
        on_delete=models.CASCADE,
        related_name='molecular_queries',
        null=True,
        blank=True
    )
    
    # Query information
    query_type = models.CharField(max_length=20, choices=QUERY_TYPES)
    original_query = models.TextField(verbose_name="Original User Query")
    extracted_parameters = models.JSONField(
        default=dict,
        help_text="Parameters extracted by OpenAI"
    )
    
    # Results
    response_data = models.JSONField(
        default=dict,
        help_text="Complete response data"
    )
    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    # Performance metrics
    processing_time_ms = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="Processing time in milliseconds"
    )
    openai_calls = models.PositiveSmallIntegerField(
        default=0,
        help_text="Number of OpenAI API calls made"
    )
    
    # Metadata
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        verbose_name = "Molecular Query"
        verbose_name_plural = "Molecular Queries"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.query_type} query by {self.user} at {self.created_at}"


class StructureCache(models.Model):
    """
    Model to cache downloaded PDB structures to avoid repeated downloads.
    """
    
    pdb_code = models.CharField(
        max_length=10,
        unique=True,
        db_index=True,
        verbose_name="PDB Code"
    )
    structure_data = models.TextField(
        verbose_name="PDB Structure Data",
        help_text="Raw PDB file content"
    )
    download_url = models.URLField(
        verbose_name="Download URL",
        help_text="Original download URL"
    )
    file_size = models.PositiveIntegerField(
        verbose_name="File Size (bytes)"
    )
    
    # Validation flags
    is_valid_structure = models.BooleanField(
        default=True,
        help_text="Whether RDKit could successfully parse this structure"
    )
    validation_error = models.TextField(
        blank=True,
        help_text="Error message if structure validation failed"
    )
    
    # Cache metadata
    downloaded_at = models.DateTimeField(default=timezone.now)
    last_accessed = models.DateTimeField(default=timezone.now)
    access_count = models.PositiveIntegerField(default=0)
    
    class Meta:
        verbose_name = "Structure Cache"
        verbose_name_plural = "Structure Cache"
        ordering = ['-last_accessed']
    
    def __str__(self):
        return f"Cached structure {self.pdb_code}"
    
    def mark_accessed(self):
        """Update access timestamp and count"""
        self.last_accessed = timezone.now()
        self.access_count += 1
        self.save(update_fields=['last_accessed', 'access_count'])
