# DockerJobRunner: ejecución controlada de Vina vía Docker SDK

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. Actualmente, `core/services/vina_service.py` (`DockerVinaService`) ejecuta AutoDock Vina lanzando el CLI `docker` con `subprocess.run(...)` (método `_execute_with_fallback`, línea ~1001), con un timeout fijo de 1800s y montando los directorios compartidos `self.input_dir`/`self.output_dir` (comunes a toda la aplicación, no por-job). La imagen Docker está hardcodeada como `self.docker_image = "cafernandezlo/dock-tools:v1.0"` (línea ~111 de `__init__`), sin leer de configuración.

`ROADMAP.md`, Fase 3 ("Docker-por-job para Vina"), propone: (1) usar el SDK de Python `docker` en lugar de `subprocess` + CLI, (2) limitar el número de ejecuciones de Vina concurrentes (`VINA_MAX_PARALLEL_JOBS`), (3) aplicar límites de recursos (CPU/memoria) a cada contenedor, y (4) hacer la imagen configurable.

`.env.example` ya define las variables relevantes: `VINA_DOCKER_IMAGE=cafernandezlo/dock-tools:v1.0`, `VINA_MAX_PARALLEL_JOBS=2`, `VINA_CPU_QUOTA=100000`, `VINA_MEM_LIMIT=512m`, `VINA_TIMEOUT_SECONDS=1200` (además de `VINA_JOBS_DIR`, `VINA_INPUT_DIR`, `VINA_OUTPUT_DIR`, que se usarán en la tarea `11_integracion_docker_runner_tasks.md` para directorios por-job; NO son necesarias en esta tarea).

Esta tarea crea **solo el componente reutilizable** `DockerJobRunner` (`core/services/docker_runner.py`) y los ajustes de Django asociados, SIN modificar `vina_service.py` todavía — eso es la tarea `11_integracion_docker_runner_tasks.md`, que depende de esta. Es independiente de las tareas de Celery/DockingJob/WebSockets (no comparte archivos con ellas), por lo que puede desarrollarse en paralelo.

## Objetivo

Al terminar, debe existir `core/services/docker_runner.py` con una clase `DockerJobRunner` que, dado un directorio de entrada, un directorio de salida y una lista de argumentos (`["vina", receptor, ligand, "--box_enveloping", "--padding", "2.0", ...]`-style, es decir los mismos argumentos que hoy genera `DockerVinaService.build_vina_command` después del nombre de la imagen), ejecute un contenedor Docker efímero usando el SDK `docker`, limite la concurrencia global mediante un semáforo (`VINA_MAX_PARALLEL_JOBS`), aplique límites de CPU/memoria (`VINA_CPU_QUOTA`/`VINA_MEM_LIMIT`) y un timeout (`VINA_TIMEOUT_SECONDS`), y devuelva `{"success": bool, "exit_code": int, "stdout": str, "stderr": str}`.

## Pre-requisitos

Ninguna. Tarea independiente — no comparte archivos con las tareas 05-09 ni 12-16.

## Archivos a crear/modificar

- `core/services/docker_runner.py` (nuevo): clase `DockerJobRunner`, excepción `DockerJobRunnerError`.
- `config/settings.py`: añadir `VINA_DOCKER_IMAGE`, `VINA_MAX_PARALLEL_JOBS`, `VINA_CPU_QUOTA`, `VINA_MEM_LIMIT`, `VINA_TIMEOUT_SECONDS`.
- `requirements.txt`: añadir `docker`.

## Especificación detallada

### 1. `config/settings.py`

Añade una nueva sección (puede ir junto a la sección `Celery` añadida en la tarea 05, o en cualquier lugar claramente identificado de `settings.py`):

```python
# =============================================================================
# AutoDock Vina vía Docker (Fase 3 - ROADMAP: Docker-por-job)
# =============================================================================
VINA_DOCKER_IMAGE = os.getenv('VINA_DOCKER_IMAGE', 'cafernandezlo/dock-tools:v1.0')
VINA_MAX_PARALLEL_JOBS = int(os.getenv('VINA_MAX_PARALLEL_JOBS', '2'))
VINA_CPU_QUOTA = int(os.getenv('VINA_CPU_QUOTA', '100000'))
VINA_MEM_LIMIT = os.getenv('VINA_MEM_LIMIT', '512m')
VINA_TIMEOUT_SECONDS = int(os.getenv('VINA_TIMEOUT_SECONDS', '1200'))
```

(Todos estos nombres ya existen con valores de ejemplo en `.env.example` — no inventes nombres nuevos.)

### 2. `requirements.txt`

Añade:

```
docker>=7.0.0
```

### 3. `core/services/docker_runner.py` (nuevo)

```python
"""
DockerJobRunner: ejecución controlada de contenedores Docker de AutoDock Vina
usando el SDK de Python `docker` (en lugar de subprocess + CLI).

Fase 3 del ROADMAP ("Docker-por-job para Vina"). Este módulo es independiente
de DockerVinaService; la integración (sustituir _execute_with_fallback por
DockerJobRunner) se hace en la tarea 11_integracion_docker_runner_tasks.md.
"""

import logging
import threading
from pathlib import Path
from typing import Dict, List, Optional

import docker
from docker.errors import DockerException, ImageNotFound, ContainerError
from django.conf import settings

logger = logging.getLogger(__name__)


class DockerJobRunnerError(Exception):
    """Error al preparar o ejecutar un contenedor Docker de Vina."""
    pass


# Semáforo a nivel de proceso: limita cuántos contenedores Vina se ejecutan
# simultáneamente desde ESTE proceso (p.ej. un worker Celery). Combinado con
# CELERY_WORKER_CONCURRENCY, controla la carga total sobre el host Docker.
_vina_semaphore = threading.Semaphore(getattr(settings, 'VINA_MAX_PARALLEL_JOBS', 2))


class DockerJobRunner:
    """Ejecuta `vina <args...>` en un contenedor Docker efímero."""

    def __init__(self, image: Optional[str] = None):
        self.image = image or settings.VINA_DOCKER_IMAGE
        try:
            self.client = docker.from_env()
        except DockerException as exc:
            raise DockerJobRunnerError(
                f"No se pudo conectar con el daemon Docker: {exc}"
            ) from exc

    def run_vina(self, input_dir: str, output_dir: str, vina_args: List[str]) -> Dict:
        """
        Ejecuta `vina <vina_args...>` en un contenedor efímero.

        - Monta `input_dir` (host) en `/input` (contenedor, solo lectura) y
          `output_dir` (host) en `/output` (contenedor, lectura/escritura).
        - `vina_args` es la lista de argumentos que se pasan al binario
          `vina` DENTRO del contenedor (p.ej.
          `["vina", "1JM7.pdb", "Aspirin.sdf", "--box_enveloping", "--padding", "2.0", "--cpu", "2"]`),
          equivalente a la parte del comando que
          `DockerVinaService.build_vina_command` construye después del nombre
          de la imagen.
        - Aplica límites de recursos (`VINA_CPU_QUOTA`, `VINA_MEM_LIMIT`) y
          timeout (`VINA_TIMEOUT_SECONDS`).
        - Limita la concurrencia global mediante un semáforo
          (`VINA_MAX_PARALLEL_JOBS`).

        Returns:
            dict: {"success": bool, "exit_code": int, "stdout": str, "stderr": str}

        Raises:
            DockerJobRunnerError: si la imagen no existe localmente o se
            agota el timeout esperando el contenedor.
        """
        with _vina_semaphore:
            return self._run_container(input_dir, output_dir, vina_args)

    def _run_container(self, input_dir: str, output_dir: str, vina_args: List[str]) -> Dict:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        volumes = {
            str(Path(input_dir).resolve()): {'bind': '/input', 'mode': 'ro'},
            str(Path(output_dir).resolve()): {'bind': '/output', 'mode': 'rw'},
        }

        timeout = getattr(settings, 'VINA_TIMEOUT_SECONDS', 1200)
        container = None

        try:
            container = self.client.containers.run(
                self.image,
                command=vina_args,
                volumes=volumes,
                working_dir="/output",
                detach=True,
                cpu_period=100000,
                cpu_quota=getattr(settings, 'VINA_CPU_QUOTA', 100000),
                mem_limit=getattr(settings, 'VINA_MEM_LIMIT', '512m'),
            )

            try:
                exit_status = container.wait(timeout=timeout)
            except Exception as exc:
                logger.error("Timeout (%ss) esperando el contenedor Vina: %s", timeout, exc)
                try:
                    container.kill()
                except Exception:
                    pass
                raise DockerJobRunnerError(
                    f"Timeout ({timeout}s) ejecutando Vina en Docker"
                ) from exc

            exit_code = exit_status.get('StatusCode', -1) if isinstance(exit_status, dict) else int(exit_status)

            stdout = container.logs(stdout=True, stderr=False).decode('utf-8', errors='replace')
            stderr = container.logs(stdout=False, stderr=True).decode('utf-8', errors='replace')

            return {
                'success': exit_code == 0,
                'exit_code': exit_code,
                'stdout': stdout,
                'stderr': stderr,
            }

        except ImageNotFound as exc:
            raise DockerJobRunnerError(
                f"La imagen Docker '{self.image}' no está disponible localmente. "
                f"Ejecuta: docker pull {self.image}"
            ) from exc
        except ContainerError as exc:
            return {
                'success': False,
                'exit_code': exc.exit_status,
                'stdout': '',
                'stderr': str(exc),
            }
        finally:
            if container is not None:
                try:
                    container.remove(force=True)
                except Exception:
                    logger.warning("No se pudo eliminar el contenedor %s", getattr(container, 'id', '?'))
```

Notas de diseño:
- `vina_args` incluye el propio nombre del binario (`"vina"`) como primer elemento, igual que en `build_vina_command` (`cmd = ["docker", "run", ..., self.docker_image, "vina", receptor_file, ligand_file, ...]` → aquí `vina_args = ["vina", receptor_file, ligand_file, ...]`). Esto facilita que la tarea 11 reutilice directamente la sublista de `build_vina_command` que va después del nombre de la imagen.
- `volumes[input_dir]['mode'] = 'ro'`: en esta tarea el directorio de entrada se monta de solo lectura (más seguro). Si en la tarea 11 se detecta que Vina necesita escribir en `/input` (p.ej. archivos intermedios de preprocesado), esa tarea puede cambiar el modo a `'rw'` — documentarlo si ocurre.
- `_vina_semaphore` es un semáforo de **proceso** (no distribuido). Si se ejecutan varios workers Celery en procesos/contenedores distintos, cada uno limita su propia concurrencia a `VINA_MAX_PARALLEL_JOBS`; la tarea 11 puede documentar esta limitación o, si se desea un límite global estricto, considerar un semáforo distribuido (Redis) — fuera del alcance de esta tarea.

## Dependencias nuevas

- `docker>=7.0.0` (pip — SDK de Python para Docker, requiere acceso al socket de Docker del host, p.ej. `/var/run/docker.sock`).

## Criterios de aceptación / cómo verificar

1. `pip install -r requirements.txt` instala el paquete `docker` sin errores.
2. `python manage.py check` no produce errores tras los cambios en `settings.py`.
3. En `python manage.py shell`:
   ```python
   from django.conf import settings
   assert settings.VINA_DOCKER_IMAGE == 'cafernandezlo/dock-tools:v1.0'
   assert settings.VINA_MAX_PARALLEL_JOBS == 2
   assert settings.VINA_CPU_QUOTA == 100000
   assert settings.VINA_MEM_LIMIT == '512m'
   assert settings.VINA_TIMEOUT_SECONDS == 1200
   ```
4. Si el entorno tiene acceso a un daemon Docker (local o vía socket montado):
   ```python
   from core.services.docker_runner import DockerJobRunner

   runner = DockerJobRunner()
   # Probar con un comando trivial que no requiera archivos de entrada reales,
   # p.ej. "vina --help" (si la imagen lo soporta) usando dos directorios
   # temporales vacíos:
   import tempfile
   with tempfile.TemporaryDirectory() as in_dir, tempfile.TemporaryDirectory() as out_dir:
       result = runner.run_vina(in_dir, out_dir, ["vina", "--help"])
       assert "exit_code" in result
       print(result["stdout"][:200])
   ```
5. Si el daemon Docker NO está disponible, `DockerJobRunner()` lanza `DockerJobRunnerError` con un mensaje claro (no una excepción cruda de `docker.errors.DockerException`):
   ```python
   from core.services.docker_runner import DockerJobRunner, DockerJobRunnerError
   try:
       DockerJobRunner()
   except DockerJobRunnerError as e:
       print("Docker no disponible (esperado en CI sin Docker):", e)
   ```
6. Si la imagen configurada (`VINA_DOCKER_IMAGE`) no está descargada localmente, `run_vina(...)` lanza `DockerJobRunnerError` mencionando `docker pull <imagen>` (puede probarse cambiando temporalmente `settings.VINA_DOCKER_IMAGE` a un nombre inexistente, p.ej. `"imagen-que-no-existe:latest"`, e invocando `DockerJobRunner(image="imagen-que-no-existe:latest").run_vina(...)`).
7. (Opcional, si Docker está disponible) Verificar el límite de concurrencia: lanzar `VINA_MAX_PARALLEL_JOBS + 1` llamadas a `run_vina` en hilos distintos con un comando que tarde unos segundos (p.ej. `["vina", "--help"]` con `time.sleep` adicional si la imagen lo permite, o midiendo tiempos de inicio/fin) y comprobar que como máximo `VINA_MAX_PARALLEL_JOBS` se ejecutan en paralelo.

## Fuera de alcance

- No modificar `core/services/vina_service.py` ni `DockerVinaService._execute_with_fallback`/`build_vina_command`/`docker_image` (tarea `11_integracion_docker_runner_tasks.md`).
- No modificar `docker-compose.yml` (montaje del socket Docker `/var/run/docker.sock` para `web`/`celery_worker` — tarea `11_integracion_docker_runner_tasks.md`).
- No implementar directorios efímeros por-job (`VINA_JOBS_DIR`, `VINA_INPUT_DIR`, `VINA_OUTPUT_DIR`) — tarea `11_integracion_docker_runner_tasks.md`.
- No modificar `core/tasks.py`, `core/models.py` ni ningún flujo de `QueryHandler`.
- No implementar un semáforo distribuido (Redis) para limitar concurrencia entre múltiples workers/procesos.
