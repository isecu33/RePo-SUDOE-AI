import uuid
from django.utils import timezone


def get_client_ip(request):
    """
    Get the client IP address from request
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def generate_token():
    """
    Generate a unique token for email verification or password reset
    """
    return str(uuid.uuid4())


def is_token_expired(created_at, hours=24):
    """
    Check if a token is expired based on creation time
    Default expiry is 24 hours
    """
    expiry_time = created_at + timezone.timedelta(hours=hours)
    return timezone.now() > expiry_time