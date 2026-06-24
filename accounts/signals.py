from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

from .models import UserProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_ai_profile(sender, instance, created, **kwargs):
    """Crea automáticamente un UserProfile (config. de IA) para cada nuevo usuario."""
    if created:
        UserProfile.objects.get_or_create(user=instance)
