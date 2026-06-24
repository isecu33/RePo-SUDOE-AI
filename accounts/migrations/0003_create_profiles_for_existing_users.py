# Data migration: create UserProfile for all existing users

from django.db import migrations


def create_profiles_for_existing_users(apps, schema_editor):
    """Create a UserProfile for each CustomUser that doesn't have one yet."""
    CustomUser = apps.get_model('accounts', 'CustomUser')
    UserProfile = apps.get_model('accounts', 'UserProfile')
    for user in CustomUser.objects.all():
        UserProfile.objects.get_or_create(user=user)


def delete_profiles_for_existing_users(apps, schema_editor):
    """Reverse: remove UserProfile records created by the forward migration."""
    UserProfile = apps.get_model('accounts', 'UserProfile')
    UserProfile.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_userprofile'),
    ]

    operations = [
        migrations.RunPython(
            create_profiles_for_existing_users,
            reverse_code=delete_profiles_for_existing_users,
        ),
    ]
