# Modelo UserProfile para API keys multi-proveedor

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django (5.1) que permite a investigadores ejecutar experimentos de docking molecular (AutoDock Vina) a través de un chat con IA. Actualmente toda la inteligencia conversacional usa una única clave de OpenAI global, definida en `OPENAI_API_KEY` (variable de entorno leída en `config/settings.py` con `os.getenv()`).

El `ROADMAP.md` (Fase 1: "API keys multi-proveedor") describe permitir que **cada usuario configure su propio proveedor de IA** (OpenAI, Anthropic, Google Gemini u Ollama local) y su propia API key, almacenada cifrada en base de datos.

Esta tarea es el **primer paso** de la Fase 1: crear el modelo de datos que almacena esa configuración por usuario. NO implementa todavía la lógica de los proveedores de IA (eso es la tarea `02_abstraccion_ai_provider.md`) ni la pantalla de configuración (tarea `03_vista_perfil_configuracion.md`).

El modelo de usuario del proyecto es `accounts.CustomUser` (definido en `accounts/models.py`, `AUTH_USER_MODEL = 'accounts.CustomUser'`, autenticación por email). Las claves API de los usuarios deben cifrarse en BD usando `django-cryptography`. El archivo `.env.example` (en la raíz del proyecto) **ya incluye** la variable `FIELD_ENCRYPTION_KEY` lista para usar.

Consulta `ROADMAP.md`, sección "Fase 1: Sistema de API Keys Multi-Proveedor", para más contexto general (ten en cuenta que el roadmap usa `django.contrib.auth.models.User` como ejemplo genérico; en este proyecto el modelo real es `accounts.CustomUser` / `settings.AUTH_USER_MODEL`, y `settings.py` usa `os.getenv()`, no `django-environ`).

## Objetivo

Al terminar, debe existir un modelo `UserProfile` en `accounts/models.py` (relación 1-a-1 con `CustomUser`) que almacene el proveedor de IA elegido, una API key cifrada y configuración asociada (modelo concreto, URL de Ollama), con su migración aplicada, un perfil creado automáticamente para cada usuario nuevo (y para los existentes vía migración de datos), y registrado en el admin de Django.

## Pre-requisitos

Ninguna. Esta es una tarea base — no depende de ningún otro archivo de `agent_plans/`.

## Archivos a crear/modificar

- `requirements.txt`: añadir la dependencia `django-cryptography`.
- `config/settings.py`: añadir la lectura de `FIELD_ENCRYPTION_KEY` desde el entorno.
- `accounts/models.py`: añadir las constantes `AI_PROVIDER_CHOICES` y la clase `UserProfile`.
- `accounts/signals.py` (nuevo archivo): señal `post_save` sobre `CustomUser` para crear automáticamente el `UserProfile`.
- `accounts/apps.py`: registrar la señal en el método `ready()`.
- `accounts/admin.py`: registrar `UserProfile` en el admin.
- `accounts/migrations/0002_userprofile.py` (autogenerada con `makemigrations`, no se escribe a mano): crea la tabla `UserProfile` y migra perfiles para usuarios existentes.

## Especificación detallada

### 1. `requirements.txt`

Añadir una línea (manteniendo el formato `paquete>=version` como el resto del archivo):

```
django-cryptography>=1.1
```

### 2. `config/settings.py`

En la sección donde se leen otras claves de cifrado/seguridad (cerca de `SECRET_KEY = os.getenv('SECRET_KEY', ...)`), añadir:

```python
# Clave de cifrado para las API keys de usuarios almacenadas en BD (Fase 1 - Multi-proveedor IA)
FIELD_ENCRYPTION_KEY = os.getenv('FIELD_ENCRYPTION_KEY')
```

No es necesario añadir `django_cryptography` a `INSTALLED_APPS`: la librería solo proporciona el campo de modelo `encrypt()`, no define modelos propios ni necesita app registrada.

### 3. `accounts/models.py`

Añadir (después de la definición de `CustomUser` y de cualquier otro modelo existente en el archivo, p.ej. tras `AccessRequest`/`EmailVerification`/`PasswordReset` si existen — revisa el final del archivo antes de añadir):

```python
from django_cryptography.fields import encrypt

AI_PROVIDER_CHOICES = [
    ('openai', 'OpenAI'),
    ('anthropic', 'Anthropic (Claude)'),
    ('google', 'Google Gemini'),
    ('ollama', 'Ollama (local)'),
]


class UserProfile(models.Model):
    """
    Configuración de IA por usuario: proveedor elegido, API key cifrada
    y parámetros asociados. Relación 1-a-1 con CustomUser.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='ai_profile'
    )

    ai_provider = models.CharField(
        max_length=20,
        choices=AI_PROVIDER_CHOICES,
        default='openai',
        verbose_name="Proveedor de IA"
    )

    # Cifrada en BD mediante django-cryptography (transparente: se lee/escribe
    # como texto plano en Python, pero se almacena cifrada con FIELD_ENCRYPTION_KEY)
    encrypted_api_key = encrypt(
        models.CharField(max_length=500, blank=True, default='', verbose_name="API Key")
    )

    # Modelo concreto a usar (ej. "gpt-4o-mini", "claude-3-haiku-20240307",
    # "gemini-1.5-flash", "llama3.1:8b"). Vacío = usar el valor por defecto
    # del proveedor (ver settings.CORE_SETTINGS / variables *_MODEL en .env).
    ai_model = models.CharField(
        max_length=100, blank=True, default='',
        verbose_name="Modelo",
        help_text="Déjalo vacío para usar el modelo por defecto del proveedor"
    )

    # Solo aplica si ai_provider == 'ollama'. Vacío = usar settings.OLLAMA_BASE_URL
    ollama_base_url = models.CharField(
        max_length=255, blank=True, default='',
        verbose_name="URL de Ollama"
    )

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Perfil de IA del usuario"
        verbose_name_plural = "Perfiles de IA de usuarios"

    def __str__(self):
        return f"AI profile for {self.user.email} ({self.get_ai_provider_display()})"

    def has_custom_api_key(self):
        return bool(self.encrypted_api_key)
```

`models`, `settings` y `timezone` ya están importados al inicio de `accounts/models.py` (verifícalo; si falta `from django.conf import settings`, añádelo).

### 4. `accounts/signals.py` (nuevo)

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.conf import settings

from .models import UserProfile


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_user_ai_profile(sender, instance, created, **kwargs):
    """Crea automáticamente un UserProfile (config. de IA) para cada nuevo usuario."""
    if created:
        UserProfile.objects.get_or_create(user=instance)
```

### 5. `accounts/apps.py`

Buscar la clase `AccountsConfig(AppConfig)` (o como se llame la config existente) y añadir el método `ready()`:

```python
class AccountsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'accounts'

    def ready(self):
        import accounts.signals  # noqa: F401
```

Si `ready()` ya existe con otro contenido, añade la línea `import accounts.signals` dentro de él sin eliminar lo que ya hubiera.

### 6. `accounts/admin.py`

Registrar el nuevo modelo. Asegúrate de NO mostrar `encrypted_api_key` en `list_display` (para no exponer si hay clave configurada de forma indiscreta) pero sí permitir editarla en el formulario de detalle:

```python
from .models import UserProfile  # añadir al import existente de .models


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'ai_provider', 'ai_model', 'updated_at')
    list_filter = ('ai_provider',)
    search_fields = ('user__email', 'user__username')
    readonly_fields = ('created_at', 'updated_at')
```

### 7. Migración

Ejecutar:

```
python manage.py makemigrations accounts
```

Esto generará `accounts/migrations/0002_userprofile.py` (o el siguiente número libre — comprueba el último fichero en `accounts/migrations/`) creando la tabla `accounts_userprofile`.

Como la señal `post_save` solo crea perfiles para usuarios **nuevos**, añade además una migración de datos para los usuarios ya existentes en la base de datos. Puedes:

- Editar la migración autogenerada para añadir una `RunPython` que recorra `CustomUser.objects.all()` y haga `UserProfile.objects.get_or_create(user=user)`, o
- Crear una segunda migración con `python manage.py makemigrations accounts --empty -n create_profiles_for_existing_users` y rellenarla con esa lógica `RunPython` (con su correspondiente `reverse_code` que borre los `UserProfile` creados, o `migrations.RunPython.noop`).

Usa la segunda opción (migración de datos separada) para mantener clara la separación entre cambio de esquema y migración de datos.

## Dependencias nuevas

- `django-cryptography>=1.1` (pip)

## Criterios de aceptación / cómo verificar

1. `pip install -r requirements.txt` instala `django-cryptography` sin errores.
2. `python manage.py makemigrations accounts` no produce errores y genera las migraciones descritas (esquema + datos).
3. `python manage.py migrate` aplica ambas migraciones sin errores.
4. En `python manage.py shell`:
   ```python
   from accounts.models import CustomUser, UserProfile
   u = CustomUser.objects.first()
   print(u.ai_profile)  # debe existir (creado por la migración de datos para usuarios existentes)
   u.ai_profile.ai_provider = 'anthropic'
   u.ai_profile.encrypted_api_key = 'sk-ant-test-12345'
   u.ai_profile.save()
   u2 = CustomUser.objects.get(pk=u.pk)
   assert u2.ai_profile.encrypted_api_key == 'sk-ant-test-12345'  # se desencripta de forma transparente
   ```
5. Verificar que el valor está cifrado en BD (no en texto plano), por ejemplo con una consulta SQL directa:
   ```python
   from django.db import connection
   with connection.cursor() as cursor:
       cursor.execute("SELECT encrypted_api_key FROM accounts_userprofile WHERE user_id = %s", [u.pk])
       raw_value = cursor.fetchone()[0]
       assert 'sk-ant-test-12345' not in raw_value
   ```
6. Crear un usuario nuevo (`CustomUser.objects.create_user(...)`) y comprobar que `nuevo_usuario.ai_profile` existe automáticamente (creado por la señal `post_save`).
7. `accounts/admin.py` muestra "Perfiles de IA de usuarios" en `/admin/` y permite editar un perfil sin mostrar la API key en texto plano en el listado.

## Fuera de alcance

- No implementar las clases `AIProvider`/`OpenAIProvider`/etc. ni `get_ai_provider_for_user()` (tarea `02_abstraccion_ai_provider.md`).
- No crear ninguna vista, formulario de usuario ni plantilla HTML para editar este perfil desde la interfaz (tarea `03_vista_perfil_configuracion.md`).
- No modificar `core/services/query_handler.py` ni ningún otro código que use IA (tarea `04_integracion_ai_provider_query_handler.md`).
- No tocar `OPENAI_API_KEY` ni el resto de variables `*_API_KEY`/`*_MODEL` globales en `config/settings.py` (siguen existiendo como fallback global; se usarán en la tarea 02).
