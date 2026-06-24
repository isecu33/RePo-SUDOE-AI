from django.urls import path

from . import views

app_name = "accounts"

urlpatterns = [
    # Authentication URLs
    path("register/", views.register, name="register"),
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    # Email verification URLs
    path("verify-email/<uuid:token>/", views.verify_email, name="verify_email"),
    path("resend-verification/", views.resend_verification, name="resend_verification"),
    # Password reset URLs
    path(
        "password-reset/", views.password_reset_request, name="password_reset_request"
    ),
    path(
        "password-reset-confirm/<uuid:token>/",
        views.password_reset_confirm,
        name="password_reset_confirm",
    ),
    # User profile
    path("profile/", views.profile, name="profile"),
    path("settings/", views.profile_settings, name="profile_settings"),
    # Admin dashboard (for staff)
    path("admin-dashboard/", views.admin_dashboard, name="admin_dashboard"),
    path(
        "review-request/<uuid:request_id>/",
        views.review_access_request,
        name="review_request",
    ),
    # About page
    path("about/", views.about, name="about"),
    # AJAX endpoints
    path(
        "api/check-email/",
        views.check_email_availability,
        name="check_email_availability",
    ),
    path("__dev_reload__", views.dev_reload, name="dev_reload"),
]
