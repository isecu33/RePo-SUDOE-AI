# Vista de configuración de IA en el perfil de usuario

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django para docking molecular asistido por IA. La tarea `01_modelo_userprofile_apikey.md` crea el modelo `accounts.UserProfile` (1-a-1 con `CustomUser`, accesible como `user.ai_profile`) con los campos `ai_provider`, `encrypted_api_key`, `ai_model` y `ollama_base_url`.

Esta tarea (parte de la Fase 1 del `ROADMAP.md`, "API keys multi-proveedor") añade la **interfaz de usuario** para que cada investigador configure su proveedor de IA preferido y su propia API key desde la web, sin tocar el panel de administración de Django.

El proyecto ya tiene una vista de perfil de solo lectura en `accounts/views.py` (función `profile`, línea ~190), registrada en `accounts/urls.py` como `path('profile/', views.profile, name='profile')`, que renderiza `accounts/templates/accounts/profile.html` (extiende `accounts/base.html`, usa Bootstrap + Font Awesome). Existe también un formulario `ProfileUpdateForm` en `accounts/forms.py` (línea ~251) para datos personales (nombre, institución, etc.) que sigue el patrón `forms.ModelForm` con `widgets` que añaden `class: 'form-control'`.

Esta tarea crea una **página nueva separada** ("Configuración de IA" / `/accounts/settings/`) en lugar de mezclarla con `profile.html`, para mantener ambas responsabilidades independientes.

## Objetivo

Al terminar, un usuario autenticado debe poder visitar `/accounts/settings/`, ver su configuración actual de proveedor de IA (sin exponer la API key guardada en texto plano), elegir un proveedor (`OpenAI`, `Anthropic`, `Google Gemini`, `Ollama`), introducir/actualizar su API key (o la URL de Ollama) y un modelo opcional, guardar los cambios mediante POST, y ver un mensaje de confirmación.

## Pre-requisitos

- `01_modelo_userprofile_apikey.md` debe estar completado (modelo `UserProfile` con `user.ai_profile` disponible).

No depende de `02_abstraccion_ai_provider.md` (esta vista solo lee/escribe el modelo, no instancia ningún `AIProvider`), por lo que puede desarrollarse en paralelo con la tarea 02.

## Archivos a crear/modificar

- `accounts/forms.py`: añadir `ProfileAISettingsForm`.
- `accounts/views.py`: añadir la vista `profile_settings`.
- `accounts/urls.py`: añadir la ruta `settings/`.
- `accounts/templates/accounts/settings.html` (nuevo): plantilla del formulario.
- `accounts/templates/accounts/profile.html`: añadir un enlace a la nueva página de configuración.

## Especificación detallada

### 1. `accounts/forms.py`

Añadir, después de `ProfileUpdateForm` (línea ~268) y antes de `AdminReviewForm`:

```python
from .models import AI_PROVIDER_CHOICES  # añadir al import existente "from .models import CustomUser, AccessRequest"


class ProfileAISettingsForm(forms.ModelForm):
    """Formulario para configurar el proveedor de IA y la API key del usuario."""

    api_key = forms.CharField(
        label="API Key",
        required=False,
        widget=forms.PasswordInput(
            attrs={'class': 'form-control', 'autocomplete': 'off', 'placeholder': '••••••••'},
            render_value=False,
        ),
        help_text="Déjalo en blanco para no cambiar la clave guardada. "
                   "No es necesario para Ollama."
    )
    clear_api_key = forms.BooleanField(
        label="Eliminar API key guardada",
        required=False,
        widget=forms.CheckboxInput(attrs={'class': 'form-check-input'})
    )

    class Meta:
        model = UserProfile
        fields = ['ai_provider', 'ai_model', 'ollama_base_url']
        widgets = {
            'ai_provider': forms.Select(attrs={'class': 'form-select', 'id': 'id_ai_provider'}),
            'ai_model': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Ej: gpt-4o-mini, claude-3-haiku-20240307, gemini-1.5-flash, llama3.1:8b'
            }),
            'ollama_base_url': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'http://localhost:11434'
            }),
        }

    def clean(self):
        cleaned_data = super().clean()
        if cleaned_data.get('clear_api_key') and cleaned_data.get('api_key'):
            raise ValidationError("No marques 'Eliminar API key' y a la vez introduzcas una nueva clave.")
        return cleaned_data
```

Añadir `UserProfile` al import existente de `.models` (junto a `CustomUser, AccessRequest`).

### 2. `accounts/views.py`

Añadir, justo después de la función `profile` (línea ~198):

```python
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
```

Añadir `UserProfile` y `ProfileAISettingsForm` a los imports existentes al inicio del archivo (`from .models import CustomUser, AccessRequest, EmailVerification, PasswordReset, UserProfile` y `from .forms import (..., ProfileAISettingsForm)`).

### 3. `accounts/urls.py`

Añadir, junto a la ruta `profile/` existente:

```python
    path('settings/', views.profile_settings, name='profile_settings'),
```

### 4. `accounts/templates/accounts/settings.html` (nuevo)

Seguir el mismo patrón que `profile.html` (extiende `accounts/base.html`, Bootstrap):

```django
{% extends 'accounts/base.html' %}

{% block title %}Configuración de IA - RePo-SUDOE-AI{% endblock %}

{% block header_subtitle %}Configuración de IA{% endblock %}

{% block content %}
<div class="row">
    <div class="col-md-8">
        {% if messages %}
            {% for message in messages %}
                <div class="alert alert-{{ message.tags }}" role="alert">{{ message }}</div>
            {% endfor %}
        {% endif %}

        <p class="text-muted">
            Elige el proveedor de IA que quieres usar para el chat y los análisis de
            RePo-SUDOE-AI. Si no configuras nada, se usará el proveedor por defecto
            de la plataforma (OpenAI).
        </p>

        <form method="post" novalidate>
            {% csrf_token %}

            <div class="mb-3">
                <label for="{{ form.ai_provider.id_for_label }}" class="form-label">Proveedor de IA</label>
                {{ form.ai_provider }}
            </div>

            <div class="mb-3">
                <label for="{{ form.ai_model.id_for_label }}" class="form-label">Modelo (opcional)</label>
                {{ form.ai_model }}
                <div class="form-text">{{ form.ai_model.help_text }}</div>
            </div>

            <div class="mb-3">
                <label for="{{ form.ollama_base_url.id_for_label }}" class="form-label">URL de Ollama (solo si el proveedor es Ollama)</label>
                {{ form.ollama_base_url }}
            </div>

            <div class="mb-3">
                <label for="{{ form.api_key.id_for_label }}" class="form-label">API Key</label>
                {{ form.api_key }}
                <div class="form-text">
                    {% if has_api_key %}
                        Ya tienes una API key guardada para este proveedor.
                        Déjalo en blanco para conservarla.
                    {% else %}
                        No tienes ninguna API key guardada.
                    {% endif %}
                    {{ form.api_key.help_text }}
                </div>
            </div>

            {% if has_api_key %}
            <div class="mb-3 form-check">
                {{ form.clear_api_key }}
                <label class="form-check-label" for="{{ form.clear_api_key.id_for_label }}">
                    {{ form.clear_api_key.label }}
                </label>
            </div>
            {% endif %}

            {% if form.non_field_errors %}
                <div class="alert alert-danger">{{ form.non_field_errors }}</div>
            {% endif %}

            <button type="submit" class="btn btn-primary">
                <i class="fas fa-save me-2"></i>Guardar configuración
            </button>
            <a href="{% url 'accounts:profile' %}" class="btn btn-outline-secondary ms-2">Volver al perfil</a>
        </form>
    </div>
</div>
{% endblock %}
```

### 5. `accounts/templates/accounts/profile.html`

Dentro del bloque `auth-links` (alrededor de la línea 77-86), añadir un enlace a la nueva página, por ejemplo justo antes del enlace de "Logout":

```django
    <a href="{% url 'accounts:profile_settings' %}" class="btn btn-outline-primary ms-2">
        <i class="fas fa-robot me-2"></i>Configuración de IA
    </a>
```

## Dependencias nuevas

Ninguna (solo usa Django forms/views ya disponibles).

## Criterios de aceptación / cómo verificar

1. `python manage.py check` no produce errores.
2. Con el servidor en marcha (`python manage.py runserver`) y un usuario autenticado y aprobado:
   - Visitar `/accounts/profile/` muestra el nuevo enlace "Configuración de IA".
   - Visitar `/accounts/settings/` muestra el formulario con el proveedor por defecto (`openai`) preseleccionado y el campo API Key vacío.
3. Enviar el formulario seleccionando `Anthropic (Claude)`, escribiendo una API key de prueba (p.ej. `sk-ant-test-1234`) y pulsando "Guardar configuración":
   - Redirige a la misma página con un mensaje de éxito.
   - El desplegable "Proveedor de IA" muestra ahora `Anthropic (Claude)` seleccionado.
   - El texto bajo "API Key" indica "Ya tienes una API key guardada para este proveedor."
4. En `python manage.py shell`, comprobar que `user.ai_profile.ai_provider == 'anthropic'` y `user.ai_profile.encrypted_api_key == 'sk-ant-test-1234'`.
5. Volver a enviar el formulario marcando "Eliminar API key guardada" sin escribir ninguna clave nueva: tras guardar, `user.ai_profile.encrypted_api_key == ''` y el formulario vuelve a mostrar "No tienes ninguna API key guardada."
6. Enviar el formulario con `clear_api_key` marcado Y un valor en `api_key` a la vez: debe mostrar el error de validación "No marques 'Eliminar API key'...".
7. Un usuario NO autenticado que visite `/accounts/settings/` es redirigido a la página de login (`login_required`).

## Fuera de alcance

- No instanciar ni llamar a ningún `AIProvider` (eso es la tarea `02_abstraccion_ai_provider.md`/`04_integracion_ai_provider_query_handler.md`); esta vista solo persiste la configuración.
- No añadir un botón de "probar conexión" / verificación de la API key contra el proveedor real.
- No modificar `ProfileUpdateForm` ni la vista `profile` existente más allá de añadir el enlace descrito.
- No tocar `accounts/templates/accounts/base.html`.
