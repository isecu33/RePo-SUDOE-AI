from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import login, authenticate, logout
from django.contrib.auth.decorators import login_required
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib import messages
from django.core.mail import send_mail
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.urls import reverse
from django.utils import timezone
import json
import uuid

from .models import CustomUser, AccessRequest, EmailVerification, PasswordReset, UserProfile
from .forms import (
    CustomUserCreationForm, 
    AccessRequestForm, 
    CustomAuthenticationForm,
    PasswordResetRequestForm,
    PasswordResetForm,
    ProfileAISettingsForm
)
from .utils import get_client_ip

def register(request):
    """User registration with access request"""
    if request.method == 'POST':
        user_form = CustomUserCreationForm(request.POST)
        access_form = AccessRequestForm(request.POST)

        if user_form.is_valid() and access_form.is_valid():
            # Create user (inactive until approved)
            user = user_form.save(commit=False)
            user.is_active = False  # Will be activated after approval
            user.save()

            # Create access request
            access_request = access_form.save(commit=False)
            access_request.user = user
            access_request.save()

            # Notify admin (iker.seoane@udc.es) about new registration
            notify_admin_new_registration(access_request)

            messages.success(
                request,
                'Registration successful! Your request has been sent to the administrator for review.'
            )
            return redirect('accounts:login')
    else:
        user_form = CustomUserCreationForm()
        access_form = AccessRequestForm()

    return render(request, 'accounts/register.html', {
        'user_form': user_form,
        'access_form': access_form
    })

def login_view(request):
    """Custom login view"""
    if request.method == 'POST':
        form = CustomAuthenticationForm(request, data=request.POST)
        if form.is_valid():
            email = form.cleaned_data.get('username')  # Using email as username
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=email, password=password)
            
            if user is not None:
                if not user.is_verified:
                    messages.error(request, 'Please verify your email address before logging in.')
                    return render(request, 'accounts/login.html', {'form': form})
                
                if not user.is_approved:
                    messages.error(request, 'Your account is pending approval. Please wait for administrator review.')
                    return render(request, 'accounts/login.html', {'form': form})
                
                # Track login
                user.last_login_ip = get_client_ip(request)
                user.save()
                
                login(request, user)
                messages.success(request, f'Welcome back, {user.get_full_name()}!')
                
                # Redirect to next or frontend
                next_url = request.GET.get('next', 'frontend:index')
                return redirect(next_url)
    else:
        form = CustomAuthenticationForm()
    
    return render(request, 'accounts/login.html', {'form': form})

@login_required
def logout_view(request):
    """Logout view"""
    logout(request)
    messages.success(request, 'You have been successfully logged out.')
    return redirect('accounts:login')

def verify_email(request, token):
    """Verify email address"""
    try:
        verification = EmailVerification.objects.get(token=token)
        
        if verification.is_expired():
            messages.error(request, 'Email verification link has expired. Please request a new one.')
            return redirect('accounts:resend_verification')
        
        if verification.verified_at:
            messages.info(request, 'Email address is already verified.')
            return redirect('accounts:login')
        
        # Verify email
        verification.verify()
        messages.success(request, 'Email address verified successfully! You can now log in once your account is approved.')
        return redirect('accounts:login')
        
    except EmailVerification.DoesNotExist:
        messages.error(request, 'Invalid verification link.')
        return redirect('accounts:login')

def resend_verification(request):
    """Resend email verification"""
    if request.method == 'POST':
        email = request.POST.get('email')
        try:
            user = CustomUser.objects.get(email=email, is_verified=False)
            send_email_verification(user, request)
            messages.success(request, 'Verification email sent! Please check your inbox.')
        except CustomUser.DoesNotExist:
            messages.error(request, 'User not found or already verified.')
    
    return render(request, 'accounts/resend_verification.html')

def password_reset_request(request):
    """Request password reset"""
    if request.method == 'POST':
        form = PasswordResetRequestForm(request.POST)
        if form.is_valid():
            email = form.cleaned_data['email']
            try:
                user = CustomUser.objects.get(email=email, is_active=True)
                send_password_reset_email(user, request)
                messages.success(request, 'Password reset instructions sent to your email.')
                return redirect('accounts:login')
            except CustomUser.DoesNotExist:
                messages.error(request, 'No active account found with this email address.')
    else:
        form = PasswordResetRequestForm()
    
    return render(request, 'accounts/password_reset_request.html', {'form': form})

def password_reset_confirm(request, token):
    """Confirm password reset"""
    try:
        reset = PasswordReset.objects.get(token=token)
        
        if reset.is_expired() or reset.is_used():
            messages.error(request, 'Password reset link has expired or been used.')
            return redirect('accounts:password_reset_request')
        
        if request.method == 'POST':
            form = PasswordResetForm(request.POST)
            if form.is_valid():
                # Set new password
                user = reset.user
                user.set_password(form.cleaned_data['password1'])
                user.save()
                
                # Mark token as used
                reset.mark_used()
                
                messages.success(request, 'Password reset successfully! You can now log in.')
                return redirect('accounts:login')
        else:
            form = PasswordResetForm()
        
        return render(request, 'accounts/password_reset_confirm.html', {
            'form': form,
            'token': token
        })
        
    except PasswordReset.DoesNotExist:
        messages.error(request, 'Invalid password reset link.')
        return redirect('accounts:password_reset_request')

@login_required
def profile(request):
    """User profile view"""
    user = request.user
    access_request = getattr(user, 'access_request', None)
    
    return render(request, 'accounts/profile.html', {
        'user': user,
        'access_request': access_request
    })


@login_required
def profile_settings(request):
    """Página de configuración del proveedor de IA del usuario."""
    profile_obj, _created = UserProfile.objects.get_or_create(user=request.user)

    if request.method == 'POST':
        form = ProfileAISettingsForm(request.POST, instance=profile_obj)
        if form.is_valid():
            updated_profile = form.save(commit=False)

            if form.cleaned_data.get('clear_api_key'):
                updated_profile.encrypted_api_key = ''
            elif form.cleaned_data.get('api_key'):
                updated_profile.encrypted_api_key = form.cleaned_data['api_key']
            # si api_key está vacío y clear_api_key es False, no se toca encrypted_api_key

            updated_profile.save()
            messages.success(request, "Configuración de IA actualizada correctamente.")
            return redirect('accounts:profile_settings')
    else:
        form = ProfileAISettingsForm(instance=profile_obj)

    return render(request, 'accounts/settings.html', {
        'form': form,
        'profile': profile_obj,
        'has_api_key': profile_obj.has_custom_api_key(),
    })

@staff_member_required
def admin_dashboard(request):
    """Admin dashboard for managing access requests"""
    pending_requests = AccessRequest.objects.filter(status='pending').order_by('-created_at')
    recent_requests = AccessRequest.objects.exclude(status='pending').order_by('-updated_at')[:10]
    
    stats = {
        'pending_count': AccessRequest.objects.filter(status='pending').count(),
        'approved_count': AccessRequest.objects.filter(status='approved').count(),
        'rejected_count': AccessRequest.objects.filter(status='rejected').count(),
        'total_users': CustomUser.objects.filter(is_active=True).count(),
        'approved_users': CustomUser.objects.filter(is_approved=True).count(),
    }
    
    return render(request, 'accounts/admin_dashboard.html', {
        'pending_requests': pending_requests,
        'recent_requests': recent_requests,
        'stats': stats
    })

@staff_member_required
def review_access_request(request, request_id):
    """Review individual access request"""
    access_request = get_object_or_404(AccessRequest, id=request_id)
    
    if request.method == 'POST':
        action = request.POST.get('action')
        admin_notes = request.POST.get('admin_notes', '')
        
        if action == 'approve':
            access_request.approve(request.user)
            send_approval_email(access_request.user)
            messages.success(request, f'Access request approved for {access_request.user.get_full_name()}')
            
        elif action == 'reject':
            access_request.reject(request.user, admin_notes)
            send_rejection_email(access_request.user, admin_notes)
            messages.success(request, f'Access request rejected for {access_request.user.get_full_name()}')
            
        elif action == 'request_more_info':
            access_request.status = 'more_info'
            access_request.admin_notes = admin_notes
            access_request.reviewed_by = request.user
            access_request.reviewed_at = timezone.now()
            access_request.save()
            send_more_info_email(access_request.user, admin_notes)
            messages.success(request, 'More information requested from user')
        
        return redirect('accounts:admin_dashboard')
    
    return render(request, 'accounts/review_request.html', {
        'access_request': access_request
    })

@require_http_methods(["POST"])
@csrf_exempt
def check_email_availability(request):
    """AJAX endpoint to check email availability"""
    data = json.loads(request.body)
    email = data.get('email')
    
    if email:
        exists = CustomUser.objects.filter(email=email).exists()
        return JsonResponse({'available': not exists})
    
    return JsonResponse({'available': False})


def dev_reload(request):
    """Development helper: return latest modification timestamp for templates/project files.
    Only enabled when settings.DEBUG is True.
    Front-end JS can poll this endpoint and reload the page when a newer timestamp appears.
    """
    if not getattr(settings, 'DEBUG', False):
        return JsonResponse({'error': 'disabled'}, status=404)

    import os
    latest = 0
    # Check template dirs from settings
    try:
        for tpl in settings.TEMPLATES:
            for d in tpl.get('DIRS', []):
                if not d:
                    continue
                for root, _, files in os.walk(d):
                    for f in files:
                        if f.endswith(('.html', '.css', '.js', '.py')):
                            try:
                                m = os.path.getmtime(os.path.join(root, f))
                                if m > latest:
                                    latest = m
                            except Exception:
                                pass
    except Exception:
        pass

    # Also check project base dir if available (avoid venvs)
    base = getattr(settings, 'BASE_DIR', None)
    if base:
        for root, _, files in os.walk(base):
            # skip virtualenv folders
            if 'venv' in root or 'env' in root or 'venv-wsl' in root:
                continue
            for f in files:
                if f.endswith(('.html', '.css', '.js', '.py')):
                    try:
                        m = os.path.getmtime(os.path.join(root, f))
                        if m > latest:
                            latest = m
                    except Exception:
                        pass

    return JsonResponse({'ts': latest})

# Email utility functions
def send_email_verification(user, request):
    """Send email verification"""
    verification, created = EmailVerification.objects.get_or_create(user=user)
    if not created:
        # Update token if existing
        verification.token = uuid.uuid4()
        verification.created_at = timezone.now()
        verification.save()
    
    verification_url = request.build_absolute_uri(
        reverse('accounts:verify_email', kwargs={'token': verification.token})
    )
    
    subject = 'Verify your email - RePo-SUDOE-AI'
    html_message = render_to_string('accounts/emails/email_verification.html', {
        'user': user,
        'verification_url': verification_url,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

def send_password_reset_email(user, request):
    """Send password reset email"""
    reset = PasswordReset.objects.create(
        user=user,
        ip_address=get_client_ip(request)
    )
    
    reset_url = request.build_absolute_uri(
        reverse('accounts:password_reset_confirm', kwargs={'token': reset.token})
    )
    
    subject = 'Password Reset - RePo-SUDOE-AI'
    html_message = render_to_string('accounts/emails/password_reset.html', {
        'user': user,
        'reset_url': reset_url,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

def notify_admin_new_registration(access_request):
    """Notify admin (iker.seoane@udc.es) about new registration"""
    admin_email = 'iker.seoane@udc.es'

    subject = f'Nueva Solicitud de Registro - {access_request.user.get_full_name()}'
    html_message = render_to_string('accounts/emails/simple_admin_notification.html', {
        'access_request': access_request,
    })
    plain_message = strip_tags(html_message)

    try:
        send_mail(
            subject,
            plain_message,
            settings.DEFAULT_FROM_EMAIL,
            [admin_email],
            html_message=html_message,
            fail_silently=False,
        )
    except Exception as e:
        print(f"Error sending email: {e}")

def notify_admins_new_request(access_request, request):
    """Notify admins about new access request"""
    admin_users = CustomUser.objects.filter(is_staff=True, is_active=True)

    review_url = request.build_absolute_uri(
        reverse('accounts:review_request', kwargs={'request_id': access_request.id})
    )

    subject = f'New Access Request - {access_request.user.get_full_name()}'
    html_message = render_to_string('accounts/emails/admin_notification.html', {
        'access_request': access_request,
        'review_url': review_url,
    })
    plain_message = strip_tags(html_message)

    admin_emails = [admin.email for admin in admin_users if admin.email]

    if admin_emails:
        send_mail(
            subject,
            plain_message,
            settings.DEFAULT_FROM_EMAIL,
            admin_emails,
            html_message=html_message,
            fail_silently=True,
        )

def send_approval_email(user):
    """Send approval email to user"""
    subject = 'Account Approved - RePo-SUDOE-AI'
    html_message = render_to_string('accounts/emails/account_approved.html', {
        'user': user,
        'login_url': settings.SITE_URL + reverse('accounts:login'),
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

def send_rejection_email(user, reason):
    """Send rejection email to user"""
    subject = 'Account Application Update - RePo-SUDOE-AI'
    html_message = render_to_string('accounts/emails/account_rejected.html', {
        'user': user,
        'reason': reason,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

def send_more_info_email(user, message):
    """Send more info request email to user"""
    subject = 'Additional Information Required - RePo-SUDOE-AI'
    html_message = render_to_string('accounts/emails/more_info_request.html', {
        'user': user,
        'message': message,
    })
    plain_message = strip_tags(html_message)
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )
def about(request):
    """About page view"""
    return render(request, 'accounts/about.html')
