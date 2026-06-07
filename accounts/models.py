# File location: RePo-SUDOE-AI/accounts/models.py
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import uuid

class CustomUser(AbstractUser):
    """Extended user model with additional fields for RePo-SUDOE-AI"""
    
    # Personal Information
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    email = models.EmailField(unique=True)
    
    # Institution/Organization Info
    institution = models.CharField(max_length=255, blank=True, verbose_name="Institution/Organization")
    department = models.CharField(max_length=255, blank=True)
    position = models.CharField(max_length=255, blank=True, verbose_name="Position/Title")
    
    # Research Information
    research_area = models.TextField(blank=True, verbose_name="Research Area/Interest")
    orcid_id = models.CharField(max_length=50, blank=True, verbose_name="ORCID ID")
    
    # Account Status
    is_verified = models.BooleanField(default=False, verbose_name="Email Verified")
    is_approved = models.BooleanField(default=False, verbose_name="Account Approved")
    approval_date = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        'self', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='approved_users'
    )
    
    # Usage tracking
    last_login_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Make email the login field
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'first_name', 'last_name']
    
    class Meta:
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return f"{self.get_full_name()} ({self.email})"
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username
    
    def can_access_frontend(self):
        """Check if user can access the frontend application"""
        return self.is_active and self.is_verified and self.is_approved
    
    def approve_account(self, approved_by_user):
        """Approve the user account"""
        self.is_approved = True
        self.approval_date = timezone.now()
        self.approved_by = approved_by_user
        self.save()

class AccessRequest(models.Model):
    """Model to handle access requests from users"""
    
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('more_info', 'More Information Required'),
    ]
    
    RESEARCH_PURPOSES = [
        ('academic', 'Academic Research'),
        ('pharmaceutical', 'Pharmaceutical Research'),
        ('biotech', 'Biotechnology'),
        ('education', 'Educational Purposes'),
        ('commercial', 'Commercial Research'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE, related_name='access_request')
    
    # Request Information
    purpose = models.CharField(max_length=20, choices=RESEARCH_PURPOSES, verbose_name="Research Purpose")
    project_description = models.TextField(verbose_name="Project Description")
    expected_usage = models.TextField(blank=True, verbose_name="Expected Usage Pattern")
    
    # Validation Documents
    supervisor_email = models.EmailField(blank=True, verbose_name="Supervisor/PI Email")
    institutional_verification = models.TextField(blank=True, verbose_name="Institutional Verification")
    
    # Status and Review
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    admin_notes = models.TextField(blank=True, verbose_name="Admin Notes")
    reviewed_by = models.ForeignKey(
        CustomUser, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='reviewed_requests'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Access Request'
        verbose_name_plural = 'Access Requests'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Access Request - {self.user.get_full_name()} ({self.status})"
    
    def approve(self, admin_user):
        """Approve the access request"""
        self.status = 'approved'
        self.reviewed_by = admin_user
        self.reviewed_at = timezone.now()
        self.save()
        
        # Also approve the user account
        self.user.approve_account(admin_user)
    
    def reject(self, admin_user, reason=""):
        """Reject the access request"""
        self.status = 'rejected'
        self.reviewed_by = admin_user
        self.reviewed_at = timezone.now()
        if reason:
            self.admin_notes = reason
        self.save()

class UserSession(models.Model):
    """Track user sessions for security and analytics"""
    
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='sessions')
    session_key = models.CharField(max_length=40, unique=True)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    last_activity = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = 'User Session'
        verbose_name_plural = 'User Sessions'
        ordering = ['-last_activity']
    
    def __str__(self):
        return f"{self.user.username} - {self.ip_address}"

class EmailVerification(models.Model):
    """Handle email verification tokens"""
    
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    verified_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        verbose_name = 'Email Verification'
        verbose_name_plural = 'Email Verifications'
    
    def __str__(self):
        return f"Email verification for {self.user.email}"
    
    def is_expired(self):
        """Check if verification token is expired (24 hours)"""
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(hours=24)
    
    def verify(self):
        """Mark email as verified"""
        self.verified_at = timezone.now()
        self.user.is_verified = True
        self.user.save()
        self.save()

class PasswordReset(models.Model):
    """Handle password reset tokens"""
    
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    created_at = models.DateTimeField(default=timezone.now)
    used_at = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField()
    
    class Meta:
        verbose_name = 'Password Reset'
        verbose_name_plural = 'Password Resets'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Password reset for {self.user.email}"
    
    def is_expired(self):
        """Check if reset token is expired (1 hour)"""
        from datetime import timedelta
        return timezone.now() > self.created_at + timedelta(hours=1)
    
    def is_used(self):
        """Check if token has been used"""
        return self.used_at is not None
    
    def mark_used(self):
        """Mark token as used"""
        self.used_at = timezone.now()
        self.save()