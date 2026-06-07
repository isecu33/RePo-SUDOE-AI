from django.http import HttpResponseForbidden
from django.shortcuts import redirect
from django.urls import reverse
from django.contrib.auth import get_user_model

User = get_user_model()

class AccessControlMiddleware:
    """
    Middleware to control access to the application based on user approval status
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        # URLs that don't require approval
        self.exempt_paths = [
            '/admin/',
            '/accounts/login/',
            '/accounts/register/',
            '/accounts/logout/',
            '/accounts/verify-email/',
            '/accounts/resend-verification/',
            '/accounts/password-reset/',
            '/accounts/password-reset-confirm/',
            '/static/',
            '/media/',
        ]
    
    def __call__(self, request):
        # Check if user needs access control
        if self.should_check_access(request):
            if not self.user_can_access(request.user):
                return redirect('accounts:login')
        
        response = self.get_response(request)
        return response
    
    def should_check_access(self, request):
        """
        Determine if we should check access for this request
        """
        # Skip access control for exempt paths
        for exempt_path in self.exempt_paths:
            if request.path.startswith(exempt_path):
                return False
        
        # Only check access for authenticated users
        return request.user.is_authenticated
    
    def user_can_access(self, user):
        """
        Check if user has permission to access the application
        """
        if not user.is_authenticated:
            return False
        
        # Admins and staff can always access
        if user.is_staff or user.is_superuser:
            return True
        
        # Regular users need to be verified and approved
        return user.is_verified and user.is_approved