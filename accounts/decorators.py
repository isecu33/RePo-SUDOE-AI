from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseForbidden


def email_verified_required(view_func):
    """
    Decorator that requires the user to have a verified email address.
    """
    @wraps(view_func)
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_verified:
            messages.error(request, 'Please verify your email address to access this page.')
            return redirect('accounts:resend_verification')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def account_approved_required(view_func):
    """
    Decorator that requires the user to have an approved account.
    """
    @wraps(view_func)
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_approved:
            messages.error(request, 'Your account is pending approval. Please wait for administrator review.')
            return redirect('accounts:profile')
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def full_access_required(view_func):
    """
    Decorator that requires the user to be logged in, verified, and approved.
    """
    @wraps(view_func)
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        user = request.user
        
        if not user.is_verified:
            messages.error(request, 'Please verify your email address to access this page.')
            return redirect('accounts:resend_verification')
            
        if not user.is_approved:
            messages.error(request, 'Your account is pending approval. Please wait for administrator review.')
            return redirect('accounts:profile')
            
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def admin_or_staff_required(view_func):
    """
    Decorator that requires the user to be admin or staff.
    """
    @wraps(view_func)
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        if not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("You don't have permission to access this page.")
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def superuser_required(view_func):
    """
    Decorator that requires the user to be a superuser.
    """
    @wraps(view_func)
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied("You must be a superuser to access this page.")
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def anonymous_required(view_func):
    """
    Decorator that requires the user to be anonymous (not logged in).
    Redirects to a specified page if user is authenticated.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if request.user.is_authenticated:
            messages.info(request, 'You are already logged in.')
            return redirect('frontend:index')  # or wherever you want to redirect
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def ajax_required(view_func):
    """
    Decorator that requires the request to be made via AJAX.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        if not request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return HttpResponseForbidden("This view is only accessible via AJAX.")
        return view_func(request, *args, **kwargs)
    return _wrapped_view


def user_passes_test_with_message(test_func, message=None, login_url=None):
    """
    Custom version of user_passes_test that shows a message when test fails.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            if test_func(request.user):
                return view_func(request, *args, **kwargs)
            
            if message:
                messages.error(request, message)
            
            if login_url:
                return redirect(login_url)
            
            raise PermissionDenied("You don't have permission to access this page.")
        return _wrapped_view
    return decorator


def check_user_status(view_func):
    """
    Decorator that checks comprehensive user status and redirects accordingly.
    """
    @wraps(view_func)
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        user = request.user
        
        # Check if user is active
        if not user.is_active:
            messages.error(request, 'Your account has been deactivated.')
            return redirect('accounts:login')
        
        # Check email verification
        if not user.is_verified:
            messages.warning(request, 'Please verify your email address.')
            return redirect('accounts:resend_verification')
        
        # Check account approval
        if not user.is_approved:
            messages.info(request, 'Your account is pending approval.')
            return redirect('accounts:profile')
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view


# Class-based view mixins
class EmailVerifiedRequiredMixin:
    """
    Mixin that requires email verification for class-based views.
    """
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        
        if not request.user.is_verified:
            messages.error(request, 'Please verify your email address to access this page.')
            return redirect('accounts:resend_verification')
        
        return super().dispatch(request, *args, **kwargs)


class AccountApprovedRequiredMixin:
    """
    Mixin that requires account approval for class-based views.
    """
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        
        if not request.user.is_approved:
            messages.error(request, 'Your account is pending approval.')
            return redirect('accounts:profile')
        
        return super().dispatch(request, *args, **kwargs)


class FullAccessRequiredMixin(EmailVerifiedRequiredMixin, AccountApprovedRequiredMixin):
    """
    Mixin that requires full access (logged in, verified, and approved).
    """
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        
        if not request.user.is_verified:
            messages.error(request, 'Please verify your email address to access this page.')
            return redirect('accounts:resend_verification')
        
        if not request.user.is_approved:
            messages.error(request, 'Your account is pending approval.')
            return redirect('accounts:profile')
        
        return super().dispatch(request, *args, **kwargs)


class AdminOrStaffRequiredMixin:
    """
    Mixin that requires admin or staff access for class-based views.
    """
    def dispatch(self, request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('accounts:login')
        
        if not (request.user.is_staff or request.user.is_superuser):
            raise PermissionDenied("You don't have permission to access this page.")
        
        return super().dispatch(request, *args, **kwargs)
