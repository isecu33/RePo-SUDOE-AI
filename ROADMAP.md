# ROADMAP — RePo-SUDOE-AI v2

> Plan de desarrollo modular para la modernización del sistema de docking molecular con IA.  
> Cada fase es independiente y se puede implementar de forma incremental.

---

## Índice

1. [Fase 1 — API Key por usuario + Multi-proveedor IA](#fase-1)
2. [Fase 2 — Jobs asíncronos con Celery + Redis](#fase-2)
3. [Fase 3 — Docker-por-job para AutoDock Vina](#fase-3)
4. [Fase 4 — WebSockets para progreso en tiempo real](#fase-4)
5. [Fase 5 — Soporte Ollama (IA local, 0 coste API)](#fase-5)
6. [Fase 6 — Preparación OpenSource (GitHub isecu33)](#fase-6)

---

## Fase 1 — API Key por usuario + Multi-proveedor IA {#fase-1}

### Objetivo
Permitir que cada usuario registrado configure su propia API key y elija su proveedor de IA (OpenAI, Anthropic, Google o Ollama), eliminando la dependencia de una única clave global en `.env`.

### Dificultad: **Media**

### Archivos a crear o modificar

| Archivo | Acción |
|---|---|
| `accounts/models.py` | Crear modelo `UserProfile` |
| `accounts/forms.py` | Formulario de configuración de API key |
| `accounts/views.py` | Vista `profile_settings` |
| `accounts/urls.py` | Ruta `/accounts/settings/` |
| `accounts/templates/accounts/settings.html` | Template de configuración |
| `core/services/ai_provider.py` | **NUEVO** — Abstracción multi-proveedor |
| `config/settings.py` | Añadir `django-cryptography` a INSTALLED_APPS |
| `requirements.txt` | Añadir nuevas dependencias |

### Dependencias nuevas

```bash
pip install django-cryptography   # cifrado de campos en BD
pip install anthropic              # cliente Anthropic Claude
pip install google-generativeai    # cliente Google Gemini
pip install openai                 # ya existe, asegurar versión >=1.0
```

### Código de ejemplo

#### `accounts/models.py` — Modelo UserProfile

```python
from django.db import models
from django.contrib.auth.models import User
from django_cryptography.fields import encrypt

class UserProfile(models.Model):
    AI_PROVIDER_CHOICES = [
        ('openai', 'OpenAI (GPT-4)'),
        ('anthropic', 'Anthropic (Claude)'),
        ('google', 'Google (Gemini)'),
        ('ollama', 'Ollama (Local, sin coste)'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    ai_provider = models.CharField(
        max_length=20,
        choices=AI_PROVIDER_CHOICES,
        default='openai'
    )
    # El campo se cifra automáticamente en BD con AES-256
    encrypted_api_key = encrypt(models.CharField(max_length=512, blank=True, null=True))
    # Para Ollama: URL del servidor local (por defecto http://localhost:11434)
    ollama_base_url = models.URLField(default='http://localhost:11434', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile({self.user.username}, provider={self.ai_provider})"

    def get_api_key(self):
        """Devuelve la API key descifrada o None si es Ollama."""
        if self.ai_provider == 'ollama':
            return None
        return self.encrypted_api_key

# Signal para crear UserProfile automáticamente al crear un User
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        UserProfile.objects.create(user=instance)

@receiver(post_save, sender=User)
def save_user_profile(sender, instance, **kwargs):
    instance.profile.save()
```

#### `core/services/ai_provider.py` — Abstracción multi-proveedor

```python
from abc import ABC, abstractmethod
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Clase base abstracta para proveedores de IA."""

    @abstractmethod
    def generate_response(self, prompt: str, system_prompt: str = "") -> str:
        """Genera una respuesta a partir de un prompt."""
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """Comprueba si el proveedor está disponible."""
        pass


class OpenAIProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def generate_response(self, prompt: str, system_prompt: str = "") -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        response = self.client.chat.completions.create(
            model=self.model, messages=messages
        )
        return response.choices[0].message.content

    def is_available(self) -> bool:
        try:
            self.client.models.list()
            return True
        except Exception:
            return False


class AnthropicProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "claude-3-haiku-20240307"):
        import anthropic
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model

    def generate_response(self, prompt: str, system_prompt: str = "") -> str:
        kwargs = {"model": self.model, "max_tokens": 2048,
                  "messages": [{"role": "user", "content": prompt}]}
        if system_prompt:
            kwargs["system"] = system_prompt
        message = self.client.messages.create(**kwargs)
        return message.content[0].text

    def is_available(self) -> bool:
        try:
            self.client.models.list()
            return True
        except Exception:
            return False


class GoogleProvider(AIProvider):
    def __init__(self, api_key: str, model: str = "gemini-1.5-flash"):
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)

    def generate_response(self, prompt: str, system_prompt: str = "") -> str:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        response = self.model.generate_content(full_prompt)
        return response.text

    def is_available(self) -> bool:
        try:
            import google.generativeai as genai
            list(genai.list_models())
            return True
        except Exception:
            return False


class OllamaProvider(AIProvider):
    """Proveedor local — sin API key, sin coste."""
    def __init__(self, base_url: str = "http://localhost:11434", model: str = "llama3"):
        self.base_url = base_url
        self.model = model

    def generate_response(self, prompt: str, system_prompt: str = "") -> str:
        import requests
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False
        }
        response = requests.post(f"{self.base_url}/api/generate", json=payload, timeout=120)
        response.raise_for_status()
        return response.json()["response"]

    def is_available(self) -> bool:
        import requests
        try:
            r = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return r.status_code == 200
        except Exception:
            return False


def get_ai_provider_for_user(user) -> Optional[AIProvider]:
    """
    Factory: dado un User de Django, devuelve el proveedor de IA configurado.
    Lanza ValueError si falta la API key o el proveedor no está disponible.
    """
    profile = user.profile
    provider_map = {
        'openai': lambda: OpenAIProvider(api_key=profile.encrypted_api_key),
        'anthropic': lambda: AnthropicProvider(api_key=profile.encrypted_api_key),
        'google': lambda: GoogleProvider(api_key=profile.encrypted_api_key),
        'ollama': lambda: OllamaProvider(base_url=profile.ollama_base_url),
    }
    factory = provider_map.get(profile.ai_provider)
    if not factory:
        raise ValueError(f"Proveedor desconocido: {profile.ai_provider}")
    if profile.ai_provider != 'ollama' and not profile.encrypted_api_key:
        raise ValueError("El usuario no ha configurado su API key.")
    return factory()
```

### Pasos de implementación

1. Instalar dependencias: `pip install django-cryptography anthropic google-generativeai`
2. Crear `accounts/models.py` con `UserProfile` (código arriba)
3. Ejecutar `python manage.py makemigrations accounts && python manage.py migrate`
4. Crear `core/services/ai_provider.py` con la abstracción
5. Crear formulario y vista `profile_settings` en `accounts/`
6. Añadir URL en `accounts/urls.py`
7. Crear template `accounts/settings.html` con campos de formulario
8. Actualizar los servicios existentes de IA para usar `get_ai_provider_for_user(request.user)`
9. Añadir `FIELD_ENCRYPTION_KEY` en `settings.py` (generada con `python -c "from django_cryptography.utils.crypto import get_random_string; print(get_random_string(50))"`)

---

## Fase 2 — Jobs asíncronos con Celery + Redis {#fase-2}

### Objetivo
Convertir el endpoint de docking de síncrono (bloquea la request HTTP durante minutos) a asíncrono, con seguimiento de estado desde el frontend.

### Dificultad: **Media**

### Archivos a crear o modificar

| Archivo | Acción |
|---|---|
| `config/celery.py` | **NUEVO** — Configuración de Celery |
| `config/__init__.py` | Modificar para cargar Celery al arrancar |
| `config/settings.py` | Añadir `CELERY_*` settings |
| `core/models.py` | Añadir modelo `DockingJob` |
| `core/tasks.py` | **NUEVO** — Task Celery para docking |
| `core/api/jobs.py` | **NUEVO** — Endpoints de polling |
| `frontend/src/services/jobPolling.ts` | **NUEVO** — Lógica de polling en TS |
| `docker-compose.yml` | Añadir servicios `redis` y `celery_worker` |
| `requirements.txt` | Añadir `celery[redis]` |

### Dependencias nuevas

```bash
pip install celery[redis]   # worker asíncrono
pip install redis            # cliente Python para Redis
pip install django-celery-results  # guardar resultados en BD Django (opcional)
```

### Código de ejemplo

#### `config/celery.py`

```python
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('repo_sudoe')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

#### `config/__init__.py`

```python
from .celery import app as celery_app
__all__ = ('celery_app',)
```

#### `config/settings.py` — Añadir sección Celery

```python
# Celery Configuration
CELERY_BROKER_URL = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_RESULT_BACKEND = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutos máximo por job
```

#### `core/models.py` — Modelo DockingJob

```python
import uuid
from django.db import models
from django.contrib.auth.models import User

class DockingJob(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pendiente'),
        ('running', 'En ejecución'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
        ('cancelled', 'Cancelado'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='docking_jobs')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    progress = models.IntegerField(default=0)  # 0-100
    celery_task_id = models.CharField(max_length=255, blank=True, null=True)
    
    # Parámetros del job (guardados para reintento)
    receptor_filename = models.CharField(max_length=255)
    ligand_filename = models.CharField(max_length=255)
    vina_config = models.JSONField(default=dict)
    
    # Resultados
    result_data = models.JSONField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
```

#### `core/tasks.py` — Task Celery

```python
from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def run_docking_job(self, job_id: str):
    """
    Task Celery que ejecuta un job de docking molecular.
    Actualiza DockingJob.progress durante la ejecución.
    """
    from core.models import DockingJob
    from core.services.vina_service import DockerVinaService

    job = DockingJob.objects.get(id=job_id)
    
    try:
        job.status = 'running'
        job.started_at = timezone.now()
        job.celery_task_id = self.request.id
        job.progress = 5
        job.save(update_fields=['status', 'started_at', 'celery_task_id', 'progress'])

        vina_service = DockerVinaService()
        
        # Actualizar progreso antes del docking
        job.progress = 20
        job.save(update_fields=['progress'])

        result = vina_service.run_docking(
            receptor_filename=job.receptor_filename,
            ligand_filename=job.ligand_filename,
            vina_config=job.vina_config,
        )

        job.status = 'completed'
        job.progress = 100
        job.result_data = result
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'progress', 'result_data', 'finished_at'])

    except Exception as exc:
        logger.error(f"Job {job_id} falló: {exc}", exc_info=True)
        job.status = 'failed'
        job.error_message = str(exc)
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'error_message', 'finished_at'])
        raise
```

#### Endpoint de polling (`core/api/jobs.py`)

```python
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from django.contrib.auth.decorators import login_required
from core.models import DockingJob

@login_required
@require_GET
def job_status(request, job_id):
    """GET /api/jobs/{job_id}/status/ — retorna estado y progreso del job."""
    try:
        job = DockingJob.objects.get(id=job_id, user=request.user)
    except DockingJob.DoesNotExist:
        return JsonResponse({'error': 'Job no encontrado'}, status=404)

    data = {
        'job_id': str(job.id),
        'status': job.status,
        'progress': job.progress,
        'created_at': job.created_at.isoformat(),
    }
    if job.status == 'completed':
        data['result'] = job.result_data
    elif job.status == 'failed':
        data['error'] = job.error_message
    
    return JsonResponse(data)
```

#### `frontend/src/services/jobPolling.ts` — Polling TypeScript

```typescript
interface JobStatus {
  job_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
}

type ProgressCallback = (status: JobStatus) => void;

export async function pollJobStatus(
  jobId: string,
  onProgress: ProgressCallback,
  intervalMs = 2000,
  maxWaitMs = 30 * 60 * 1000  // 30 minutos
): Promise<JobStatus> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - startTime > maxWaitMs) {
        reject(new Error('Timeout: el job tardó demasiado'));
        return;
      }

      try {
        const response = await fetch(`/api/jobs/${jobId}/status/`, {
          headers: { 'X-CSRFToken': getCsrfToken() }
        });
        const status: JobStatus = await response.json();
        onProgress(status);

        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed' || status.status === 'cancelled') {
          reject(new Error(status.error || 'El job falló'));
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        reject(err);
      }
    };

    poll();
  });
}

function getCsrfToken(): string {
  const cookie = document.cookie
    .split(';')
    .find(c => c.trim().startsWith('csrftoken='));
  return cookie ? cookie.split('=')[1] : '';
}
```

#### `docker-compose.yml` — Añadir Redis y Celery Worker

```yaml
  redis:
    image: redis:7-alpine
    container_name: repo-sudoe-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - repo-sudoe-network
    restart: unless-stopped

  celery_worker:
    build: .
    container_name: repo-sudoe-celery
    command: celery -A config worker --loglevel=info --concurrency=2
    volumes:
      - .:/app
    env_file:
      - .env
    depends_on:
      - db
      - redis
    networks:
      - repo-sudoe-network
    restart: unless-stopped
```

### Pasos de implementación

1. Instalar `celery[redis]` y `redis` en `requirements.txt`
2. Crear `config/celery.py` y modificar `config/__init__.py`
3. Añadir settings de Celery en `config/settings.py`
4. Crear modelo `DockingJob` en `core/models.py` + migraciones
5. Crear `core/tasks.py` con el task `run_docking_job`
6. Crear endpoint `/api/jobs/{job_id}/status/` en `core/api/`
7. Modificar el endpoint de docking principal para crear un `DockingJob` y lanzar el task (retornar `job_id` inmediatamente)
8. Implementar `jobPolling.ts` en el frontend
9. Añadir servicios Redis y celery_worker al `docker-compose.yml`
10. Probar: `celery -A config worker --loglevel=info`

---

## Fase 3 — Docker-por-job para AutoDock Vina {#fase-3}

### Objetivo
Ejecutar cada job de docking en un contenedor Docker efímero e independiente, eliminando los problemas de concurrencia y archivos compartidos del sistema actual.

### Dificultad: **Alta**

### Archivos a crear o modificar

| Archivo | Acción |
|---|---|
| `core/services/docker_runner.py` | **NUEVO** — Lanzador de contenedores por job |
| `core/tasks.py` | Modificar para usar `DockerJobRunner` |
| `config/settings.py` | Añadir `VINA_*` settings |
| `docker-compose.yml` | Montar socket Docker al contenedor web/celery |
| `requirements.txt` | Añadir `docker` (SDK Python) |

### Dependencias nuevas

```bash
pip install docker   # SDK oficial de Python para Docker
```

### Código de ejemplo

#### `core/services/docker_runner.py` — Runner de contenedores

```python
import docker
import threading
import logging
import shutil
from pathlib import Path
from uuid import UUID
from django.conf import settings

logger = logging.getLogger(__name__)

# Semáforo global para limitar jobs paralelos
_job_semaphore = threading.Semaphore(
    getattr(settings, 'VINA_MAX_PARALLEL_JOBS', 2)
)


class DockerJobRunner:
    """
    Lanza un contenedor Docker efímero por cada job de docking.
    Garantiza aislamiento completo entre jobs concurrentes.
    """
    VINA_IMAGE = getattr(settings, 'VINA_DOCKER_IMAGE', 'cafernandezlo/dock-tools:v1.0')
    BASE_DIR = Path(getattr(settings, 'VINA_JOBS_DIR', '/tmp/vina_jobs'))
    CPU_QUOTA = int(getattr(settings, 'VINA_CPU_QUOTA', 100000))  # 1 CPU
    MEM_LIMIT = getattr(settings, 'VINA_MEM_LIMIT', '512m')
    TIMEOUT_SECONDS = int(getattr(settings, 'VINA_TIMEOUT_SECONDS', 1200))  # 20 min

    def __init__(self):
        self.client = docker.from_env()

    def run(self, job_id: UUID, receptor_filename: str, ligand_filename: str,
            vina_config: dict, source_input_dir: Path) -> dict:
        """
        Ejecuta el docking para un job dado.
        Bloquea si ya hay VINA_MAX_PARALLEL_JOBS corriendo.
        """
        job_dir = self.BASE_DIR / str(job_id)
        job_input = job_dir / 'input'
        job_output = job_dir / 'output'

        job_input.mkdir(parents=True, exist_ok=True)
        job_output.mkdir(parents=True, exist_ok=True)

        # Copiar archivos de entrada
        shutil.copy2(source_input_dir / receptor_filename, job_input / receptor_filename)
        shutil.copy2(source_input_dir / ligand_filename, job_input / ligand_filename)

        with _job_semaphore:
            return self._run_container(job_id, receptor_filename, ligand_filename,
                                       vina_config, job_input, job_output)

    def _run_container(self, job_id, receptor, ligand, config, input_dir, output_dir) -> dict:
        container = None
        try:
            # Construir comando Vina
            cmd = self._build_vina_command(receptor, ligand, config)
            logger.info(f"[Job {job_id}] Lanzando contenedor: {cmd}")

            container = self.client.containers.run(
                image=self.VINA_IMAGE,
                command=cmd,
                volumes={
                    str(input_dir): {'bind': '/input', 'mode': 'ro'},
                    str(output_dir): {'bind': '/output', 'mode': 'rw'},
                },
                cpu_quota=self.CPU_QUOTA,
                mem_limit=self.MEM_LIMIT,
                network_disabled=True,       # sin acceso a red
                remove=False,                # no auto-eliminar (necesitamos logs)
                detach=True,
            )

            # Esperar con timeout
            result = container.wait(timeout=self.TIMEOUT_SECONDS)
            exit_code = result.get('StatusCode', -1)
            logs = container.logs(stdout=True, stderr=True).decode('utf-8', errors='replace')

            if exit_code != 0:
                raise RuntimeError(f"Vina terminó con código {exit_code}.\nLogs:\n{logs[:2000]}")

            return self._parse_output(output_dir, logs)

        finally:
            if container:
                try:
                    container.remove(force=True)
                except Exception:
                    pass
            self._cleanup_job_dir(job_id)

    def _build_vina_command(self, receptor, ligand, config: dict) -> list:
        cmd = ['vina', receptor, ligand]
        for key, value in config.items():
            if key not in ('use_box_enveloping',) and value is not None:
                cmd.extend([f'--{key}', str(value)])
        return cmd

    def _parse_output(self, output_dir: Path, logs: str) -> dict:
        """Parsea el resultado del docking desde los archivos de salida."""
        result = {'logs': logs, 'output_files': []}
        for f in output_dir.iterdir():
            result['output_files'].append(f.name)
            if f.suffix == '.pdbqt':
                result['result_pdbqt'] = f.name
        # Extraer binding affinity del log
        for line in logs.splitlines():
            if 'VINA RESULT' in line or 'Affinity' in line:
                result['binding_affinity_line'] = line.strip()
                break
        return result

    def _cleanup_job_dir(self, job_id: UUID):
        job_dir = self.BASE_DIR / str(job_id)
        if job_dir.exists():
            shutil.rmtree(job_dir, ignore_errors=True)
```

#### `docker-compose.yml` — Montar socket Docker

```yaml
  celery_worker:
    build: .
    command: celery -A config worker --loglevel=info --concurrency=2
    volumes:
      - .:/app
      - /var/run/docker.sock:/var/run/docker.sock  # ← acceso al Docker del host
      - /tmp/vina_jobs:/tmp/vina_jobs               # ← directorio de jobs compartido
    environment:
      - VINA_DOCKER_IMAGE=cafernandezlo/dock-tools:v1.0
      - VINA_MAX_PARALLEL_JOBS=2
      - VINA_MEM_LIMIT=512m
      - VINA_TIMEOUT_SECONDS=1200
```

#### `config/settings.py` — Settings de Vina

```python
# AutoDock Vina — Docker runner
VINA_DOCKER_IMAGE = env('VINA_DOCKER_IMAGE', default='cafernandezlo/dock-tools:v1.0')
VINA_MAX_PARALLEL_JOBS = env.int('VINA_MAX_PARALLEL_JOBS', default=2)
VINA_CPU_QUOTA = env.int('VINA_CPU_QUOTA', default=100000)   # 100000 = 1 CPU
VINA_MEM_LIMIT = env('VINA_MEM_LIMIT', default='512m')
VINA_TIMEOUT_SECONDS = env.int('VINA_TIMEOUT_SECONDS', default=1200)
VINA_JOBS_DIR = env('VINA_JOBS_DIR', default='/tmp/vina_jobs')
```

### Pasos de implementación

1. Instalar SDK Docker: `pip install docker`
2. Crear `core/services/docker_runner.py` con `DockerJobRunner`
3. Actualizar `core/tasks.py` para usar `DockerJobRunner` en lugar del servicio actual
4. Actualizar `config/settings.py` con settings de Vina
5. Montar `/var/run/docker.sock` en el servicio `celery_worker` del compose
6. Montar `/tmp/vina_jobs` como volumen compartido entre host y worker
7. Asegurar que el usuario del contenedor Celery tiene permisos sobre el socket Docker
8. Probar un job de docking completo con logs

---

## Fase 4 — WebSockets para progreso en tiempo real {#fase-4}

### Objetivo
Reemplazar el polling HTTP por WebSockets bidireccionales, permitiendo que el servidor notifique al cliente instantáneamente cuando el estado de un job cambie.

### Dificultad: **Alta**

### Archivos a crear o modificar

| Archivo | Acción |
|---|---|
| `config/asgi.py` | Modificar para enrutar WS con Channels |
| `config/settings.py` | Añadir Channels a INSTALLED_APPS |
| `core/consumers.py` | **NUEVO** — Consumer WebSocket de jobs |
| `core/routing.py` | **NUEVO** — Rutas WebSocket |
| `core/tasks.py` | Modificar para enviar señales al WS |
| `frontend/src/services/jobSocket.ts` | **NUEVO** — Cliente WS TypeScript |
| `docker-compose.yml` | Añadir Daphne (ASGI server) |
| `requirements.txt` | Añadir `channels[daphne]` y `channels-redis` |

### Dependencias nuevas

```bash
pip install channels[daphne]   # Django Channels + Daphne ASGI server
pip install channels-redis      # Channel Layer sobre Redis
```

### Código de ejemplo

#### `config/asgi.py`

```python
import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
import core.routing

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(
        URLRouter(core.routing.websocket_urlpatterns)
    ),
})
```

#### `core/routing.py`

```python
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/jobs/(?P<job_id>[0-9a-f-]+)/$', consumers.JobProgressConsumer.as_asgi()),
]
```

#### `core/consumers.py`

```python
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class JobProgressConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.job_id = self.scope['url_route']['kwargs']['job_id']
        self.user = self.scope['user']

        if not self.user.is_authenticated:
            await self.close()
            return

        # Verificar que el job pertenece al usuario
        job = await self._get_job(self.job_id)
        if not job or job.user_id != self.user.id:
            await self.close()
            return

        self.group_name = f'job_{self.job_id}'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def job_update(self, event):
        """Recibe mensajes del group y los envía al cliente WS."""
        await self.send(text_data=json.dumps(event['data']))

    @database_sync_to_async
    def _get_job(self, job_id):
        from core.models import DockingJob
        try:
            return DockingJob.objects.get(id=job_id)
        except DockingJob.DoesNotExist:
            return None
```

#### Enviar actualización desde Celery task

```python
# En core/tasks.py — añadir después de actualizar el job
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def _notify_job_progress(job_id: str, status: str, progress: int, **extra):
    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f'job_{job_id}',
        {
            'type': 'job_update',
            'data': {'job_id': job_id, 'status': status, 'progress': progress, **extra}
        }
    )
```

#### `frontend/src/services/jobSocket.ts`

```typescript
export class JobProgressSocket {
  private socket: WebSocket | null = null;

  connect(jobId: string, onUpdate: (data: Record<string, unknown>) => void): void {
    const wsUrl = `ws://${window.location.host}/ws/jobs/${jobId}/`;
    this.socket = new WebSocket(wsUrl);

    this.socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as Record<string, unknown>;
      onUpdate(data);
    };

    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }
}
```

#### `config/settings.py` — Channel Layer

```python
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {
            'hosts': [env('REDIS_URL', default='redis://localhost:6379/1')],
        },
    },
}
```

### Pasos de implementación

1. Instalar `channels[daphne]` y `channels-redis`
2. Modificar `config/asgi.py` con `ProtocolTypeRouter`
3. Añadir `'channels'` a `INSTALLED_APPS` y configurar `CHANNEL_LAYERS`
4. Crear `core/consumers.py` y `core/routing.py`
5. Modificar `core/tasks.py` para llamar a `_notify_job_progress` en cada cambio de estado
6. Crear `frontend/src/services/jobSocket.ts`
7. Actualizar el frontend para usar `JobProgressSocket` en lugar de polling
8. Cambiar el comando de arranque a Daphne: `daphne -b 0.0.0.0 -p 8000 config.asgi:application`

---

## Fase 5 — Soporte Ollama (IA local, 0 coste API) {#fase-5}

### Objetivo
Añadir Ollama como proveedor de IA completamente local, sin necesidad de API keys externas ni coste por uso. Ideal para entornos con restricciones de privacidad o sin acceso a internet.

### Dificultad: **Baja**

### Archivos a crear o modificar

| Archivo | Acción |
|---|---|
| `core/services/ai_provider.py` | Ya incluye `OllamaProvider` (Fase 1) |
| `docker-compose.yml` | Añadir servicio `ollama` |
| `accounts/models.py` | Ya incluye `ollama_base_url` (Fase 1) |
| `.env.example` | Añadir `OLLAMA_BASE_URL` |

### Docker Compose — Servicio Ollama

```yaml
  ollama:
    image: ollama/ollama:latest
    container_name: repo-sudoe-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama   # modelos persistentes entre reinicios
    networks:
      - repo-sudoe-network
    restart: unless-stopped
    # Para usar GPU (requiere nvidia-docker):
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: all
    #           capabilities: [gpu]
```

### Modelos recomendados

| Modelo | Tamaño | Calidad | Velocidad | Uso recomendado |
|--------|--------|---------|-----------|-----------------|
| `llama3.2:3b` | ~2 GB | ★★★☆☆ | Muy rápido | Desarrollo/pruebas |
| `llama3.1:8b` | ~5 GB | ★★★★☆ | Rápido | Uso general |
| `qwen2.5:7b` | ~5 GB | ★★★★☆ | Rápido | Muy bueno en ciencia |
| `mistral:7b` | ~4 GB | ★★★★☆ | Rápido | Código + análisis |
| `llama3.1:70b` | ~40 GB | ★★★★★ | Lento | Producción (GPU) |

### Primeros pasos con Ollama

```bash
# Descargar modelo (una vez)
docker exec repo-sudoe-ollama ollama pull llama3.1:8b

# Probar desde terminal
curl http://localhost:11434/api/generate \
  -d '{"model": "llama3.1:8b", "prompt": "Explain docking score of -8.5 kcal/mol", "stream": false}'
```

### Trade-offs

| Criterio | OpenAI/Anthropic | Ollama local |
|----------|-----------------|--------------|
| Coste | ~$0.01–0.10 por query | 0 (solo electricidad) |
| Privacidad | Datos a servidor externo | 100% local |
| Calidad (GPT-4) | ★★★★★ | ★★★★☆ (7B) |
| Setup | Solo API key | Necesita ~5 GB RAM libre |
| Sin internet | No | Sí |

### Pasos de implementación

1. Añadir servicio `ollama` al `docker-compose.yml`
2. Confirmar que `OllamaProvider` en `ai_provider.py` apunta a `http://ollama:11434` dentro de Docker
3. Descargar modelo inicial: `docker exec repo-sudoe-ollama ollama pull llama3.1:8b`
4. En el UserProfile, el usuario elige `ollama` como proveedor y no necesita API key
5. Documentar en README qué modelos están disponibles y cómo añadir nuevos

---

## Fase 6 — Preparación OpenSource (GitHub isecu33) {#fase-6}

### Objetivo
Preparar el repositorio para publicación pública en GitHub, con configuración de CI, licencia, y documentación lista para colaboradores externos.

### Dificultad: **Baja**

### Estructura del repositorio

```
RePo-SUDOE-AI/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml          # CI: lint + tests + build frontend
│   │   └── docker.yml      # Build y push imagen a GHCR (opcional)
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── pull_request_template.md
├── accounts/
├── config/
├── core/
├── frontend/
├── .env.example             # ← NUNCA .env real
├── .gitignore
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── docker-compose.yml
```

### `.gitignore` definitivo

```gitignore
# Python
__pycache__/
*.py[cod]
*.pyo
*.pyd
.Python
*.egg-info/
dist/
build/
*.egg
.eggs/

# Django
*.log
*.pot
db.sqlite3
/staticfiles/
/media/
/static/

# Entorno virtual
venv/
.venv/
env/
.env          # ← NUNCA subir el .env real

# Node / Frontend
frontend/node_modules/
frontend/dist/
frontend/.cache/
*.map

# Docker
*.override.yml

# IDEs
.vscode/
.idea/
*.swp
*.swo
.DS_Store
Thumbs.db

# Testing
.coverage
htmlcov/
.pytest_cache/
.tox/

# Archivos de docking (datos de usuario, no van al repo)
/input/
/output/
*.pdbqt
*.pdb
/tmp/
```

### Licencia recomendada

Para un TFG académico con uso científico, se recomienda **Apache License 2.0** por las siguientes razones:

- **Más permisiva que GPL**: permite uso comercial sin obligar a liberar el código derivado.
- **Más protegida que MIT**: incluye cláusula de patentes (protege a los contribuidores).
- **Estándar en ciencia abierta**: usada por Google, Apache Foundation, muchos proyectos bioinformáticos.
- **Compatible con MIT y LGPL**: facilita el uso de dependencias con distintas licencias.

> Si el TFG incluye código derivado de un proyecto GPL (por ejemplo, algún componente de AutoDock), entonces se requeriría **GPL v3**. Verificar las licencias de las dependencias antes de decidir.

### GitHub Actions CI — `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  backend:
    name: Backend (Python)
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'
      - name: Install dependencies
        run: pip install -r requirements.txt flake8 black
      - name: Lint (flake8)
        run: flake8 . --max-line-length=120 --exclude=migrations,venv
      - name: Format check (black)
        run: black --check . --exclude='/(migrations|venv)/'
      - name: Run tests
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost/test_db
          SECRET_KEY: ci-secret-key-not-for-production
          DEBUG: "True"
        run: python manage.py test

  frontend:
    name: Frontend (TypeScript)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - name: Install dependencies
        working-directory: frontend
        run: npm ci
      - name: Type check
        working-directory: frontend
        run: npm run type-check
      - name: Lint (ESLint)
        working-directory: frontend
        run: npm run lint
      - name: Build
        working-directory: frontend
        run: npm run build
```

### Badges para el README

```markdown
![CI](https://github.com/isecu33/RePo-SUDOE-AI/actions/workflows/ci.yml/badge.svg)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-4.2-092E20?logo=django&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
```

### Pasos de implementación

1. Crear `.gitignore` completo (código arriba)
2. Añadir `LICENSE` con texto de Apache 2.0 (copiar de https://www.apache.org/licenses/LICENSE-2.0.txt)
3. Crear `.github/workflows/ci.yml`
4. Crear `.github/ISSUE_TEMPLATE/bug_report.md` y `feature_request.md`
5. Crear `CONTRIBUTING.md` (ver Tarea 3)
6. Revisar el historial de commits para asegurarse de que no hay `.env` ni claves comprometidas (usar `git filter-repo` si es necesario)
7. Hacer el repo público en GitHub
8. Habilitar GitHub Actions y verificar que el CI pasa

---

*Documento generado para RePo-SUDOE-AI v2 — TFG 2025/2026*
