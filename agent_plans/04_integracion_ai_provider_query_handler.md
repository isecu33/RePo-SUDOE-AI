# Integrar AIProvider en QueryHandler (uso real del proveedor del usuario)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. La clase `QueryHandler` (`core/services/query_handler.py`) es el cerebro del chat: clasifica la intención del usuario, responde preguntas informativas y extrae los parámetros (`drug`, `gene`) de las peticiones de docking. Actualmente crea un cliente OpenAI fijo en `__init__`:

```python
self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
```

y lo usa en exactamente 3 sitios, todos con el mismo patrón "system_prompt + user_prompt → texto":

- `classify_intent(self, user_query)` — `model="gpt-4o"`, `temperature=0`, devuelve `response.choices[0].message.content.strip().lower()`.
- `handle_information_query(self, user_query)` — `model="gpt-4o"`, `temperature=0.7`, devuelve `{"type": "information", "response": response.choices[0].message.content}`.
- `extract_docking_params(self, user_query)` — `model="gpt-4o-mini"`, `temperature=0.3`, extrae un JSON del texto de respuesta con una expresión regular (`re.search(r'\{[\s\S]*\}', content)`) — **NO** usa el modo JSON nativo de OpenAI, así que cualquier proveedor que devuelva texto plano funciona igual.

Las tareas `01_modelo_userprofile_apikey.md` (modelo `accounts.UserProfile`, accesible como `user.ai_profile`) y `02_abstraccion_ai_provider.md` (módulo `core/services/ai_provider.py` con `AIProvider`, `OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`, `OllamaProvider`, `get_ai_provider_for_user(user)` y `AIProviderConfigError`) ya están completadas. Esta tarea conecta ambas piezas: hace que `QueryHandler` use el proveedor de IA configurado por el usuario (en lugar de siempre OpenAI con la key global) en esos 3 puntos, sin cambiar ningún otro comportamiento del chat.

`QueryHandler` se instancia desde `frontend/views.py` (función `chat_message`, el endpoint principal del chat, y otras funciones) y desde `core/views.py` (`molecular_query_api`). Consulta `ROADMAP.md`, sección "Fase 1", para el contexto general del roadmap.

## Objetivo

Al terminar, `QueryHandler` debe aceptar un parámetro opcional `user` en su constructor, usar `get_ai_provider_for_user(user)` para resolver el proveedor de IA, y reemplazar las 3 llamadas directas a `self.client.chat.completions.create(...)` por `self.ai_provider.generate_response(system_prompt, user_query, temperature=...)`, de forma que un usuario que haya configurado Anthropic/Google/Ollama en `/accounts/settings/` vea esas respuestas generadas por su proveedor elegido, manteniendo el comportamiento actual (OpenAI global) para usuarios sin configuración personalizada.

## Pre-requisitos

- `01_modelo_userprofile_apikey.md` (modelo `UserProfile`, `user.ai_profile`).
- `02_abstraccion_ai_provider.md` (módulo `core/services/ai_provider.py`).

## Archivos a crear/modificar

- `core/services/query_handler.py`: constructor `__init__`, métodos `classify_intent`, `handle_information_query`, `extract_docking_params`.
- `frontend/views.py`: las 5 instanciaciones de `QueryHandler(...)` (líneas aproximadas 115, 374, 558, 1074, 1343 — verifica los números reales antes de editar, pueden haber cambiado).
- `core/views.py`: la instanciación de `QueryHandler()` en `molecular_query_api` (línea aproximada 32).

## Especificación detallada

### 1. `core/services/query_handler.py` — `__init__`

Sustituir:

```python
    def __init__(self, language='es'):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.language = language  # 'es' or 'en'
```

por:

```python
    def __init__(self, language='es', user=None):
        from .ai_provider import get_ai_provider_for_user, AIProviderConfigError, OpenAIProvider

        try:
            self.ai_provider = get_ai_provider_for_user(user)
        except AIProviderConfigError as e:
            print(f"[WARN] Proveedor de IA del usuario no disponible ({e}); usando OpenAI por defecto")
            self.ai_provider = OpenAIProvider(
                api_key=os.getenv("OPENAI_API_KEY"),
                model=getattr(settings, 'OPENAI_MODEL', None),
            )

        self.language = language  # 'es' or 'en'
```

No elimines el import `from openai import OpenAI` de la cabecera del archivo si se usa en otro sitio (verifícalo con una búsqueda; si tras este cambio ya no se usa en ningún otro lugar del archivo, puedes eliminarlo, pero no es obligatorio).

### 2. `classify_intent` (línea ~141)

Sustituir el bloque:

```python
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            temperature=0
        )

        return response.choices[0].message.content.strip().lower()
```

por:

```python
        content = self.ai_provider.generate_response(system_prompt, user_query, temperature=0)
        return content.strip().lower()
```

### 3. `handle_information_query` (línea ~175)

Sustituir el bloque:

```python
            response = self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_query}
                ],
                temperature=0.7
            )

            return {
                "type": "information",
                "response": response.choices[0].message.content
            }
```

por:

```python
            content = self.ai_provider.generate_response(system_prompt, user_query, temperature=0.7)

            return {
                "type": "information",
                "response": content
            }
```

### 4. `extract_docking_params` (línea ~442 / llamada ~479)

Sustituir el bloque:

```python
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            temperature=0.3
        )

        content = response.choices[0].message.content.strip()
```

por:

```python
        content = self.ai_provider.generate_response(system_prompt, user_query, temperature=0.3).strip()
```

El resto del método (`re.search`, `json.loads`, manejo de errores) permanece sin cambios.

### 5. `frontend/views.py` — pasar el usuario actual

En cada uno de los 5 sitios donde se instancia `QueryHandler(...)`, comprueba que la función contenedora es una vista con `request` disponible (todas lo son: `chat_message`, y las demás funciones decoradas con `@full_access_required`) y añade `user=request.user`:

```python
# chat_message (línea ~115)
query_handler = QueryHandler(language=language_code, user=request.user)
```

```python
# Otros 4 sitios (líneas ~374, ~558, ~1074, ~1343) — actualmente `QueryHandler()`
query_handler = QueryHandler(user=request.user)
```

> Si alguno de estos 4 sitios NO está dentro de una función con `request` accesible (revisa el contexto antes de editar), déjalo como `QueryHandler()` sin el parámetro `user` — `user=None` hace que `get_ai_provider_for_user` devuelva el proveedor OpenAI global, que es el comportamiento actual, así que omitir `user` en algún sitio no rompe nada.

### 6. `core/views.py` — `molecular_query_api` (línea ~32)

```python
query_handler = QueryHandler(user=request.user)
```

(Esta vista ya está decorada con `@full_access_required`, por lo que `request.user` está disponible y autenticado.)

## Dependencias nuevas

Ninguna (reutiliza `core/services/ai_provider.py` de la tarea 02).

## Criterios de aceptación / cómo verificar

1. `python manage.py check` no produce errores.
2. Con un usuario cuyo `ai_profile.ai_provider == 'openai'` y sin API key propia (configuración por defecto), el chat (`/api/chat/`) funciona exactamente igual que antes: clasificación de intención, respuestas informativas y extracción de `drug`/`gene` siguen funcionando (probar con una consulta como "¿Qué es el gen BRCA1?" y con "Quiero hacer docking de Aspirina con BRCA1").
3. En `python manage.py shell`, instanciar `QueryHandler` con un usuario sin `ai_profile` (o con `ai_profile.ai_provider='openai'`) y comprobar que `query_handler.ai_provider` es una instancia de `OpenAIProvider`:
   ```python
   from accounts.models import CustomUser
   from core.services.query_handler import QueryHandler
   from core.services.ai_provider import OpenAIProvider

   u = CustomUser.objects.first()
   qh = QueryHandler(language='es', user=u)
   assert isinstance(qh.ai_provider, OpenAIProvider)
   ```
4. Configurar `u.ai_profile.ai_provider = 'ollama'` (con `ollama_base_url` apuntando a un servidor Ollama accesible, o dejar el valor por defecto si se va a verificar solo el fallback) y `u.ai_profile.save()`. Volver a instanciar `QueryHandler(language='es', user=u)`:
   - Si Ollama NO está disponible, `get_ai_provider_for_user` no lanza error en el constructor (`OllamaProvider.__init__` no valida conectividad), por lo que `qh.ai_provider` debe ser `OllamaProvider`. La excepción solo aparecería al llamar a `generate_response` (y sería capturada donde corresponda por el flujo normal de `process_query`/`chat_message`, que ya tiene manejo de excepciones genérico).
5. Probar manualmente `qh.classify_intent("Quiero hacer un experimento de docking entre Aspirina y BRCA1")` con un usuario configurado con OpenAI y comprobar que devuelve `"docking"`.
6. Revisar que ningún otro método de `QueryHandler` (aparte de los 3 listados) referencia `self.client` (búsqueda de texto `self.client` en el archivo debe devolver 0 resultados tras el cambio).

## Fuera de alcance

- No modificar `generate_experiment_analysis` ni ningún otro método que NO use `self.client` (no usan IA, son consultas a las bases de datos Excel).
- No añadir un selector de proveedor en la UI del chat (eso ya se gestiona desde `/accounts/settings/`, tarea `03_vista_perfil_configuracion.md`).
- No implementar streaming de respuestas de IA en el chat.
- No modificar `run_autodock_vina`, `handle_docking_flow` ni ningún aspecto del flujo de docking en sí (Fase 2/3 del roadmap).
- No tocar `core/services/vina_service.py`.
