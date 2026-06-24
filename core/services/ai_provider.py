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

    logger.warning(
        "Proveedor de IA desconocido '%s' para usuario %s, usando OpenAI por defecto",
        provider_name, user
    )
    return _default_openai_provider()
