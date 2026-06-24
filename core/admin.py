from django.contrib import admin
from django.utils.html import format_html
from .models import ProteinDatabase, ConversationContext, MolecularQuery, StructureCache, DockingJob


@admin.register(ProteinDatabase)
class ProteinDatabaseAdmin(admin.ModelAdmin):
    list_display = ['hgnc_symbol', 'gene_name', 'pdb_count', 'gene_type', 'created_at']
    list_filter = ['gene_type', 'created_at']
    search_fields = ['hgnc_symbol', 'gene_name', 'synonyms', 'uniprot_id']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Gene Information', {
            'fields': ('hgnc_symbol', 'gene_name', 'description', 'gene_type')
        }),
        ('Structure Information', {
            'fields': ('pdb_codes',)
        }),
        ('Additional Information', {
            'fields': ('chromosome', 'synonyms', 'uniprot_id')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def pdb_count(self, obj):
        return len(obj.get_pdb_list())
    pdb_count.short_description = 'PDB Count'


@admin.register(ConversationContext)
class ConversationContextAdmin(admin.ModelAdmin):
    list_display = ['chat_session', 'current_intent', 'workflow_state', 'awaiting_confirmation', 'created_at']
    list_filter = ['current_intent', 'workflow_state', 'awaiting_confirmation', 'created_at']
    search_fields = ['chat_session__user__email', 'chat_session__title']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Context Information', {
            'fields': ('chat_session', 'current_intent', 'workflow_state', 'awaiting_confirmation')
        }),
        ('Parameters', {
            'fields': ('extracted_parameters', 'available_structures')
        }),
        ('Metadata', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(MolecularQuery)
class MolecularQueryAdmin(admin.ModelAdmin):
    list_display = ['user', 'query_type', 'success', 'processing_time_ms', 'openai_calls', 'created_at']
    list_filter = ['query_type', 'success', 'created_at']
    search_fields = ['user__email', 'original_query', 'error_message']
    readonly_fields = ['id', 'created_at']
    
    fieldsets = (
        ('Query Information', {
            'fields': ('user', 'chat_session', 'query_type', 'original_query')
        }),
        ('Processing', {
            'fields': ('extracted_parameters', 'response_data', 'success', 'error_message')
        }),
        ('Performance', {
            'fields': ('processing_time_ms', 'openai_calls')
        }),
        ('Metadata', {
            'fields': ('id', 'created_at'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        return False


@admin.register(StructureCache)
class StructureCacheAdmin(admin.ModelAdmin):
    list_display = ['pdb_code', 'file_size_kb', 'is_valid_structure', 'access_count', 'last_accessed']
    list_filter = ['is_valid_structure', 'downloaded_at', 'last_accessed']
    search_fields = ['pdb_code', 'download_url']
    readonly_fields = ['downloaded_at', 'last_accessed', 'access_count']
    
    fieldsets = (
        ('Structure Information', {
            'fields': ('pdb_code', 'download_url', 'file_size')
        }),
        ('Validation', {
            'fields': ('is_valid_structure', 'validation_error')
        }),
        ('Cache Statistics', {
            'fields': ('downloaded_at', 'last_accessed', 'access_count')
        }),
        ('Data', {
            'fields': ('structure_data',),
            'classes': ('collapse',)
        }),
    )
    
    def file_size_kb(self, obj):
        return f"{obj.file_size / 1024:.1f} KB"
    file_size_kb.short_description = 'File Size'
    
    actions = ['clear_cache', 'validate_structures']
    
    def clear_cache(self, request, queryset):
        count = queryset.count()
        queryset.delete()
        self.message_user(request, f'{count} cached structures deleted.')
    clear_cache.short_description = "Clear selected cached structures"
    
    def validate_structures(self, request, queryset):
        from core.services.molecular_utils import MolecularUtils
        
        validated = 0
        for structure in queryset:
            try:
                valid = MolecularUtils.validate_molecule_file(
                    structure.structure_data, 
                    '.pdb'
                )
                structure.is_valid_structure = valid
                if not valid:
                    structure.validation_error = "RDKit validation failed"
                else:
                    structure.validation_error = ""
                structure.save()
                validated += 1
            except Exception as e:
                structure.is_valid_structure = False
                structure.validation_error = str(e)
                structure.save()
        
        self.message_user(request, f'{validated} structures validated.')
    validate_structures.short_description = "Validate selected structures with RDKit"


@admin.register(DockingJob)
class DockingJobAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'drug', 'gene', 'structure', 'status', 'progress', 'created_at')
    list_filter = ('status',)
    search_fields = ('id', 'user__email', 'drug', 'gene', 'celery_task_id')
    readonly_fields = ('id', 'created_at', 'started_at', 'finished_at')
