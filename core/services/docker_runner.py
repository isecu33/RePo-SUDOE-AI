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
from django.conf import settings
from docker.errors import ContainerError, DockerException, ImageNotFound

logger = logging.getLogger(__name__)


class DockerJobRunnerError(Exception):
    """Error al preparar o ejecutar un contenedor Docker de Vina."""

    pass


# Semáforo a nivel de proceso: limita cuántos contenedores Vina se ejecutan
# simultáneamente desde ESTE proceso (p.ej. un worker Celery). Combinado con
# CELERY_WORKER_CONCURRENCY, controla la carga total sobre el host Docker.
_vina_semaphore = threading.Semaphore(getattr(settings, "VINA_MAX_PARALLEL_JOBS", 2))


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

    def _run_container(
        self, input_dir: str, output_dir: str, vina_args: List[str]
    ) -> Dict:
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        volumes = {
            str(Path(input_dir).resolve()): {"bind": "/input", "mode": "ro"},
            str(Path(output_dir).resolve()): {"bind": "/output", "mode": "rw"},
        }

        timeout = getattr(settings, "VINA_TIMEOUT_SECONDS", 1200)
        container = None

        try:
            container = self.client.containers.run(
                self.image,
                command=vina_args,
                volumes=volumes,
                working_dir="/output",
                detach=True,
                cpu_period=100000,
                cpu_quota=getattr(settings, "VINA_CPU_QUOTA", 100000),
                mem_limit=getattr(settings, "VINA_MEM_LIMIT", "512m"),
            )

            try:
                exit_status = container.wait(timeout=timeout)
            except Exception as exc:
                logger.error(
                    "Timeout (%ss) esperando el contenedor Vina: %s", timeout, exc
                )
                try:
                    container.kill()
                except Exception:
                    pass
                raise DockerJobRunnerError(
                    f"Timeout ({timeout}s) ejecutando Vina en Docker"
                ) from exc

            exit_code = (
                exit_status.get("StatusCode", -1)
                if isinstance(exit_status, dict)
                else int(exit_status)
            )

            stdout = container.logs(stdout=True, stderr=False).decode(
                "utf-8", errors="replace"
            )
            stderr = container.logs(stdout=False, stderr=True).decode(
                "utf-8", errors="replace"
            )

            return {
                "success": exit_code == 0,
                "exit_code": exit_code,
                "stdout": stdout,
                "stderr": stderr,
            }

        except ImageNotFound as exc:
            raise DockerJobRunnerError(
                f"La imagen Docker '{self.image}' no está disponible localmente. "
                f"Ejecuta: docker pull {self.image}"
            ) from exc
        except ContainerError as exc:
            return {
                "success": False,
                "exit_code": exc.exit_status,
                "stdout": "",
                "stderr": str(exc),
            }
        finally:
            if container is not None:
                try:
                    container.remove(force=True)
                except Exception:
                    logger.warning(
                        "No se pudo eliminar el contenedor %s",
                        getattr(container, "id", "?"),
                    )
