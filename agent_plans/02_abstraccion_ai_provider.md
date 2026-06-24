# Abstracción multi-proveedor de IA (AIProvider)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django para experimentos de docking molecular asistidos por IA. El chat (`core/services/query_handler.py`, clase `QueryHandler`) usa actualmente el SDK de `openai` directamente (`self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))`) en tres puntos: clasificación de intención (`classify_intent`), respuestas informativas (`handle_information_query`) y extracción de parámetros de docking (`extract_docking_params`). Los tres siguen el mismo patrón: `system_prompt` + `user_prompt` (texto del usuario) → texto de respuesta (en el caso de `extract_docking_params`, el texto contiene un JSON que se extrae con una expresión regular, NO se usa el modo JSON nativo de OpenAI).

Según `ROADMAP.md` (Fase 1: "API keys multi-proveedor"), el objetivo es permitir que cada usuario use su propio proveedor de IA (OpenAI, Anthropic Claude, Google Gemini u Ollama local) y su propia API key. La tarea `01_modelo_userprofile_apikey.md` ya crea el modelo `accounts.UserProfile` (relación 1-a-1 con `CustomUser`) con los campos `ai_provider`, `encrypted_api_key`, `ai_model` y `ollama_base_url`.

Esta tarea crea la **capa de abstracción** (`AIProvider`) que encapsula las llamadas a cada SDK/API detrás de una interfaz común, y la fábrica `get_ai_provider_for_user(user)` que decide qué proveedor instanciar según el `UserProfile` del usuario (o el proveedor global por defecto si el usuario no ha configurado nada). Esta tarea NO modifica `query_handler.py` (eso es la tarea `04_integracion_ai_provider_query_handler.md`); solo crea el módulo nuevo y lo deja listo para usar.

`config/settings.py` usa `os.getenv()` (vía `python-dotenv`), no `django-environ`. El archivo `.env.example` ya define `OPENAI_API_KEY`/`OPENAI_MODEL`, `ANTHROPIC_API_KEY`/`ANTHROPIC_MODEL`, `GOOGLE_API_KEY`/`GOOGLE_MODEL`, `OLLAMA_BASE_URL`/`OLLAMA_MODEL` con valores de ejemplo razonables (`gpt-4o-mini`, `claude-3-haiku-20240307`, `gemini-1.5-flash`, `llama3.1:8b`).

## Objetivo

Al terminar, debe existir `core/services/ai_provider.py` con una clase abstracta `AIProvider` (método `generate_response(system_prompt, user_prompt, temperature=0.7) -> str`), cuatro implementaciones concretas (`OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`, `OllamaProvider`) y la función `get_ai_provider_for_user(user)` que devuelve la instancia correcta según la configuración del usuario, todo verificable desde `python manage.py shell` sin tocar `query_handler.py`.

## Pre-requisitos

- `01_modelo_userprofile_apikey.md` debe estar completado (necesita el modelo `accounts.UserProfile` con los campos `ai_provider`, `encrypted_api_key`, `ai_model`, `ollama_base_url` y el related_name `user.ai_profile`).

## Archivos a crear/modificar

- `core/services/ai_provider.py` (nuevo): clase `AIProvider`, subclases por proveedor, excepción `AIProviderConfigError`, función `get_ai_provider_for_user()`.
- `config/settings.py`: añadir lectura de `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GOOGLE_API_KEY`, `GOOGLE_MODEL`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` vía `os.getenv()`.
- `requirements.txt`: añadir `anthropic` y `google-generativeai`.

## Especificación detallada

### 1. `config/settings.py`

Justo debajo de la línea existente `OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')` (línea ~204), añadir:

```python
# OpenAI Configuration for molecular intelligence
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
OPENAI_MODEL = os.getenv('OPENAI_MODEL', 'gpt-4o-mini')

# Multi-provider AI configuration (Fase 1 - ROADMAP)
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY')
ANTHROPIC_MODEL = os.getenv('ANTHROPIC_MODEL', 'claude-3-haiku-20240307')

GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
GOOGLE_MODEL = os.getenv('GOOGLE_MODEL', 'gemini-1.5-flash')

OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.1:8b')
```

> Nota: el diccionario `CORE_SETTINGS['OPENAI_MODEL'] = 'gpt-4o'` (línea ~208) es un ajuste preexistente no relacionado y NO debe modificarse ni eliminarse en esta tarea. La nueva variable `settings.OPENAI_MODEL` (a nivel raíz) es la que usará `OpenAIProvider` como modelo por defecto cuando el usuario no especifique uno propio.

### 2. `core/services/ai_provider.py` (nuevo)

```python
"""
Abstracción multi-proveedor de IA.

Provee una interfaz común (AIProvider.generate_response) implementada por
OpenAI, Anthropic (Claude), Google (Gemini) y Ollama (local), y una fábrica
get_ai_provider_for_user() que selecciona el proveedor según la configuración
guardada en accounts.UserProfile (ver 01_modelo_userprofile_apikey.md).
"""

import os
import logging
from abc import ABC, abstractmethod

from django.conf import settings

logger = logging.getLogger(__name__)


class AIProviderConfigError(Exception):
    """Se lanza cuando la configuración de un proveedor de IA es inválida
    (p.ej. falta API key) o el SDK necesario no está instalado."""
    pass


class AIProvider(ABC):
    """Interfaz común para todos los proveedores de IA."""

    @abstractmethod
    def generate_response(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        """
        Genera una respuesta de texto a partir de un prompt de sistema y
        un prompt de usuario. Debe devolver SIEMPRE un str (nunca None).
        Lanza AIProviderConfigError si la configuración es inválida, o
        propaga la excepción del SDK subyacente en caso de error de red/API.
        """
        raise NotImplementedError


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = None):
        if not api_key:
            raise AIProviderConfigError("Falta API key de OpenAI")
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model or settings.OPENAI_MODEL

    def generate_response(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=temperature,
        )
        return response.choices[0].message.content or ""


class AnthropicProvider(AIProvider):
    def __init__(self, api_key: str, model: str = None):
        if not api_key:
            raise AIProviderConfigError("Falta API key de Anthropic")
        try:
            import anthropic
        except ImportError as exc:
            raise AIProviderConfigError(
                "El paquete 'anthropic' no está instalado. Añádelo a requirements.txt"
            ) from exc
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model or settings.ANTHROPIC_MODEL

    def generate_response(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2048,
            temperature=temperature,
            system=system_prompt,
            messages=[{"role": "user", "content": user_prompt}],
        )
        # response.content es una lista de bloques; concatenar los de tipo "text"
        return "".join(block.text for block in response.content if getattr(block, "type", None) == "text")


class GoogleProvider(AIProvider):
    def __init__(self, api_key: str, model: str = None):
        if not api_key:
            raise AIProviderConfigError("Falta API key de Google Gemini")
        try:
            import google.generativeai as genai
        except ImportError as exc:
            raise AIProviderConfigError(
                "El paquete 'google-generativeai' no está instalado. Añádelo a requirements.txt"
            ) from exc
        genai.configure(api_key=api_key)
        self._genai = genai
        self.model_name = model or settings.GOOGLE_MODEL

    def generate_response(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        model = self._genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt,
        )
        response = model.generate_content(
            user_prompt,
            generation_config={"temperature": temperature},
        )
        return response.text or ""


class OllamaProvider(AIProvider):
    """Proveedor local sin API key, vía servidor Ollama (REST API /api/chat)."""

    def __init__(self, base_url: str = None, model: str = None):
        import requests
        self._requests = requests
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip('/')
        self.model = model or settings.OLLAMA_MODEL

    def generate_response(self, system_prompt: str, user_prompt: str, temperature: float = 0.7) -> str:
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "stream": False,
            "options": {"temperature": temperature},
        }
        try:
            resp = self._requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
        except self._requests.exceptions.RequestException as exc:
            raise AIProviderConfigError(
                f"No se pudo conectar con Ollama en {self.base_url}: {exc}"
            ) from exc
        data = resp.json()
        return data.get("message", {}).get("content", "")


def _default_openai_provider() -> AIProvider:
    """Proveedor OpenAI usando la API key global (comportamiento actual del proyecto)."""
    return OpenAIProvider(api_key=settings.OPENAI_API_KEY, model=settings.OPENAI_MODEL)


def get_ai_provider_for_user(user) -> AIProvider:
    """
    Devuelve la instancia de AIProvider adecuada para `user`.

    - Si `user` es None, no está autenticado, o no tiene `ai_profile`,
      o tiene `ai_profile.ai_provider == 'openai'` sin API key propia:
      devuelve OpenAIProvider con la API key global (settings.OPENAI_API_KEY).
    - En cualquier otro caso, usa la configuración de `user.ai_profile`:
        - 'openai': OpenAIProvider con la API key del usuario (o la global
          si el usuario no ha introducido una propia).
        - 'anthropic': AnthropicProvider con la API key del usuario (o
          settings.ANTHROPIC_API_KEY si no ha configurado una propia).
        - 'google': GoogleProvider, igual patrón con settings.GOOGLE_API_KEY.
        - 'ollama': OllamaProvider, sin API key; usa
          ai_profile.ollama_base_url o settings.OLLAMA_BASE_URL.

    Lanza AIProviderConfigError si no hay ninguna API key disponible
    (ni la del usuario ni la global) para el proveedor elegido.
    """
    profile = getattr(user, 'ai_profile', None) if user is not None else None

    if profile is None:
        return _default_openai_provider()

    provider_name = profile.ai_provider
    model = profile.ai_model or None
    user_key = profile.encrypted_api_key or None

    if provider_name == 'openai':
        api_key = user_key or settings.OPENAI_API_KEY
        return OpenAIProvider(api_key=api_key, model=model)

    if provider_name == 'anthropic':
        api_key = user_key or settings.ANTHROPIC_API_KEY
        return AnthropicProvider(api_key=api_key, model=model)

    if provider_name == 'google':
        api_key = user_key or settings.GOOGLE_API_KEY
        return GoogleProvider(api_key=api_key, model=model)

    if provider_name == 'ollama':
        base_url = profile.ollama_base_url or settings.OLLAMA_BASE_URL
        return OllamaProvider(base_url=base_url, model=model)

    logger.warning("Proveedor de IA desconocido '%s' para usuario %s, usando OpenAI por defecto", provider_name, user)
    return _default_openai_provider()
```

### 3. `requirements.txt`

Añadir:

```
anthropic>=0.34.0
google-generativeai>=0.7.0
```

## Dependencias nuevas

- `anthropic>=0.34.0` (pip)
- `google-generativeai>=0.7.0` (pip)
- (Ollama no requiere dependencia Python adicional: se usa `requests`, ya presente en `requirements.txt`)

## Criterios de aceptación / cómo verificar

1. `pip install -r requirements.txt` instala `anthropic` y `google-generativeai` sin errores.
2. `python manage.py shell`:
   ```python
   from django.conf import settings
   from core.services.ai_provider import get_ai_provider_for_user, OpenAIProvider, AIProviderConfigError

   # Sin usuario -> proveedor OpenAI global
   provider = get_ai_provider_for_user(None)
   assert isinstance(provider, OpenAIProvider)
   ```
3. Si `OPENAI_API_KEY` está configurada en `.env`, probar una llamada real (opcional, consume cuota):
   ```python
   texto = provider.generate_response("Responde solo con la palabra OK.", "Hola")
   print(texto)
   ```
4. Simular un usuario con proveedor Anthropic configurado (requiere haber completado la tarea 01):
   ```python
   from accounts.models import CustomUser
   u = CustomUser.objects.first()
   u.ai_profile.ai_provider = 'anthropic'
   u.ai_profile.encrypted_api_key = ''  # sin key propia
   u.ai_profile.save()

   from core.services.ai_provider import get_ai_provider_for_user, AnthropicProvider, AIProviderConfigError
   try:
       p = get_ai_provider_for_user(u)
       assert isinstance(p, AnthropicProvider)
   except AIProviderConfigError:
       pass  # esperado si ANTHROPIC_API_KEY no está configurada en el entorno
   ```
5. Probar `OllamaProvider` (no requiere API key; si Ollama no está corriendo localmente, `generate_response` debe lanzar `AIProviderConfigError` con un mensaje claro, no una excepción genérica de `requests`):
   ```python
   from core.services.ai_provider import OllamaProvider, AIProviderConfigError
   p = OllamaProvider(base_url="http://localhost:11434", model="llama3.1:8b")
   try:
       p.generate_response("Eres un asistente.", "Di hola")
   except AIProviderConfigError as e:
       print("Ollama no disponible (esperado en CI):", e)
   ```
6. `python manage.py check` no produce errores tras los cambios en `settings.py`.

## Fuera de alcance

- No modificar `core/services/query_handler.py` ni ninguno de sus métodos (`classify_intent`, `handle_information_query`, `extract_docking_params`, etc.) — eso es la tarea `04_integracion_ai_provider_query_handler.md`.
- No crear vistas, formularios ni plantillas (tarea `03_vista_perfil_configuracion.md`).
- No implementar streaming de respuestas ni "function calling"/tools de los distintos SDKs: solo generación de texto simple (`generate_response`).
- No añadir caché de instancias de `AIProvider` ni gestión de conexiones persistentes; cada llamada a `get_ai_provider_for_user()` puede crear una instancia nueva.
