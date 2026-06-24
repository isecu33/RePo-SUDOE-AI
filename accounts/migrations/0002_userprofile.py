# Generated migration for UserProfile model

import django.db.models.deletion
import django.utils.timezone
import django_cryptography.fields
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ai_provider', models.CharField(
                    choices=[
                        ('openai', 'OpenAI'),
                        ('anthropic', 'Anthropic (Claude)'),
                        ('google', 'Google Gemini'),
                        ('ollama', 'Ollama (local)'),
                    ],
                    default='openai',
                    max_length=20,
                    verbose_name='Proveedor de IA',
                )),
                ('encrypted_api_key', django_cryptography.fields.encrypt(
                    models.CharField(blank=True, default='', max_length=500, verbose_name='API Key')
                )),
                ('ai_model', models.CharField(
                    blank=True,
                    default='',
                    help_text='Déjalo vacío para usar el modelo por defecto del proveedor',
                    max_length=100,
                    verbose_name='Modelo',
                )),
                ('ollama_base_url', models.CharField(
                    blank=True,
                    default='',
                    max_length=255,
                    verbose_name='URL de Ollama',
                )),
                ('created_at', models.DateTimeField(default=django.utils.timezone.now)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='ai_profile',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Perfil de IA del usuario',
                'verbose_name_plural': 'Perfiles de IA de usuarios',
            },
        ),
    ]
