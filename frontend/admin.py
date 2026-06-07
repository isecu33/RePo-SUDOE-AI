# File location: RePo-SUDOE-AI/frontend/admin.py
from django.contrib import admin
from .models import ChatSession, ChatMessage, UploadedFile, DockingSimulation, DockingPose

@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'created_at', 'updated_at', 'is_active']
    list_filter = ['is_active', 'created_at', 'updated_at']
    search_fields = ['title', 'user__username']
    readonly_fields = ['id', 'created_at', 'updated_at']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('user')

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['session', 'sender', 'content_preview', 'timestamp']
    list_filter = ['sender', 'timestamp']
    search_fields = ['content', 'session__title']
    readonly_fields = ['timestamp']
    
    def content_preview(self, obj):
        return obj.content[:100] + '...' if len(obj.content) > 100 else obj.content
    content_preview.short_description = 'Content Preview'

@admin.register(UploadedFile)
class UploadedFileAdmin(admin.ModelAdmin):
    list_display = ['original_filename', 'file_type', 'user', 'file_size_mb', 'uploaded_at', 'is_processed']
    list_filter = ['file_type', 'is_processed', 'processing_status', 'uploaded_at']
    search_fields = ['original_filename', 'user__username']
    readonly_fields = ['uploaded_at', 'file_size']
    
    def file_size_mb(self, obj):
        return f"{obj.file_size / (1024*1024):.2f} MB"
    file_size_mb.short_description = 'File Size'

@admin.register(DockingSimulation)
class DockingSimulationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'binding_affinity', 'started_at', 'completed_at', 'duration_display']
    list_filter = ['status', 'remove_non_gene_atoms', 'started_at']
    search_fields = ['user__username', 'receptor_file__original_filename']
    readonly_fields = ['id', 'started_at', 'completed_at']
    
    def duration_display(self, obj):
        return obj.duration if obj.duration else 'N/A'
    duration_display.short_description = 'Duration'

@admin.register(DockingPose)
class DockingPoseAdmin(admin.ModelAdmin):
    list_display = ['simulation', 'pose_number', 'binding_score', 'rmsd']
    list_filter = ['simulation__status']
    search_fields = ['simulation__id']
    readonly_fields = ['simulation']