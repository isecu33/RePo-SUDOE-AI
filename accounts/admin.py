from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import CustomUser, AccessRequest, EmailVerification, PasswordReset


class CustomUserAdmin(UserAdmin):
    model = CustomUser
    list_display = ['email', 'first_name', 'last_name', 'is_verified', 'is_approved', 'is_staff', 'date_joined']
    list_filter = ['is_verified', 'is_approved', 'is_staff', 'is_superuser', 'date_joined']
    search_fields = ['email', 'first_name', 'last_name']
    ordering = ['-date_joined']
    
    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name')}),
        ('Permissions', {
            'fields': ('is_active', 'is_verified', 'is_approved', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined', 'last_login_ip')}),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password1', 'password2', 'first_name', 'last_name'),
        }),
    )
    
    readonly_fields = ['date_joined', 'last_login', 'last_login_ip']
    
    # ✅ Correcto: actions es una lista
    actions = ['approve_users', 'disapprove_users', 'verify_emails']
    
    def approve_users(self, request, queryset):
        """Aprobar usuarios seleccionados"""
        count = queryset.update(is_approved=True, is_active=True)
        self.message_user(request, f'{count} usuarios aprobados exitosamente.')
    approve_users.short_description = "Aprobar usuarios seleccionados"
    
    def disapprove_users(self, request, queryset):
        """Desaprobar usuarios seleccionados"""
        count = queryset.update(is_approved=False)
        self.message_user(request, f'{count} usuarios desaprobados.')
    disapprove_users.short_description = "Desaprobar usuarios seleccionados"
    
    def verify_emails(self, request, queryset):
        """Verificar emails de usuarios seleccionados"""
        count = queryset.update(is_verified=True)
        self.message_user(request, f'{count} emails verificados.')
    verify_emails.short_description = "Verificar emails seleccionados"


class AccessRequestAdmin(admin.ModelAdmin):
    list_display = ['user_email', 'user_institution', 'purpose', 'status', 'created_at', 'reviewed_by']
    list_filter = ['status', 'created_at', 'purpose']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'user__institution']
    ordering = ['-created_at']
    readonly_fields = ['created_at', 'updated_at']
    
    fieldsets = (
        ('Request Information', {
            'fields': ('user', 'organization', 'position', 'purpose', 'research_area', 'additional_info')
        }),
        ('Review Information', {
            'fields': ('status', 'reviewed_by', 'admin_notes', 'created_at', 'updated_at')
        }),
    )
    
    # ✅ Correcto: actions es una lista
    actions = ['approve_requests', 'reject_requests']
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'User Email'
    user_email.admin_order_field = 'user__email'
    
    def user_institution(self, obj):
        return obj.user.institution or 'Not specified'
    user_institution.short_description = 'Institution'
    user_institution.admin_order_field = 'user__institution'
    
    def approve_requests(self, request, queryset):
        """Aprobar solicitudes de acceso seleccionadas"""
        count = 0
        for access_request in queryset.filter(status='pending'):
            access_request.approve(request.user)
            count += 1
        self.message_user(request, f'{count} solicitudes aprobadas exitosamente.')
    approve_requests.short_description = "Aprobar solicitudes seleccionadas"
    
    def reject_requests(self, request, queryset):
        """Rechazar solicitudes de acceso seleccionadas"""
        count = 0
        for access_request in queryset.filter(status='pending'):
            access_request.reject(request.user, "Rechazado desde el panel de administración")
            count += 1
        self.message_user(request, f'{count} solicitudes rechazadas.')
    reject_requests.short_description = "Rechazar solicitudes seleccionadas"


class EmailVerificationAdmin(admin.ModelAdmin):
    list_display = ['user_email', 'created_at', 'verified_at', 'is_expired_status']
    list_filter = ['verified_at', 'created_at']
    search_fields = ['user__email']
    readonly_fields = ['token', 'created_at', 'verified_at']
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'User Email'
    
    def is_expired_status(self, obj):
        if obj.is_expired():
            return format_html('<span style="color: red;">Expired</span>')
        return format_html('<span style="color: green;">Valid</span>')
    is_expired_status.short_description = 'Status'


class PasswordResetAdmin(admin.ModelAdmin):
    list_display = ['user_email', 'created_at', 'used_at', 'ip_address', 'is_expired_status']
    list_filter = ['used_at', 'created_at']
    search_fields = ['user__email', 'ip_address']
    readonly_fields = ['token', 'created_at', 'used_at']
    
    def user_email(self, obj):
        return obj.user.email
    user_email.short_description = 'User Email'
    
    def is_expired_status(self, obj):
        if obj.is_expired():
            return format_html('<span style="color: red;">Expired</span>')
        elif obj.is_used():
            return format_html('<span style="color: blue;">Used</span>')
        return format_html('<span style="color: green;">Valid</span>')
    is_expired_status.short_description = 'Status'


# Registrar los modelos
admin.site.register(CustomUser, CustomUserAdmin)
admin.site.register(AccessRequest, AccessRequestAdmin)
admin.site.register(EmailVerification, EmailVerificationAdmin)
admin.site.register(PasswordReset, PasswordResetAdmin)

# Personalizar el header del admin
admin.site.site_header = "RePo-SUDOE-AI Administration"
admin.site.site_title = "RePo-SUDOE-AI Admin"
admin.site.index_title = "Welcome to RePo-SUDOE-AI Administration"