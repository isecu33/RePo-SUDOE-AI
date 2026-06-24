# Integrar DockerJobRunner en DockerVinaService (Docker-por-job real)

## Contexto

`RePo-SUDOE-AI_v2` es una plataforma Django de docking molecular asistido por IA. `core/services/vina_service.py` (`DockerVinaService`) es el servicio que ejecuta AutoDock Vina. Actualmente:

- `__init__` (línea ~86) define `self.input_dir = self.base_dir / "input"` y `self.output_dir = self.base_dir / "output" / str(user_id)` (directorios COMPARTIDOS por toda la aplicación, no por-job), y `self.docker_image = "cafernandezlo/dock-tools:v1.0"` (hardcodeado, línea ~111).
- `build_vina_command(receptor_file, ligand_file, config)` (línea ~317) construye el comando completo `["docker", "run", "-it", "--rm", "-v", ..., self.docker_image, "vina", receptor_file, ligand_file, ...]`.
- `run_vina_docking(receptor_path, drug_path, config=None)` (línea ~492) orquesta todo el flujo: valida Docker, prepara archivos (`prepare_input_files`), construye el comando (`build_vina_command`), y llama a `_execute_with_fallback(cmd, config, receptor_filename, ligand_filename)`.
- `_execute_with_fallback` (línea ~1001) ejecuta el comando con `subprocess.run(original_cmd, capture_output=True, text=True, timeout=1800, cwd=self.base_dir)`, con lógica de reintento (`fallback`) usando `--no-preprocessing` si detecta ciertos errores de preprocesado (`pdb4amber`, `IndexError: list index out of range`, `cannot stat`, `_cleaned.pdb`, `CONECT record`).
- `parse_vina_results(stdout, stderr, file_mapping)` (línea ~671) lee los archivos de resultado desde `self.output_dir.glob("*")`.

La tarea `10_docker_job_runner_vina.md` (ya completada) creó `core/services/docker_runner.py` con la clase `DockerJobRunner` (usa el SDK `docker` en vez de `subprocess` + CLI), que ejecuta `vina <args...>` en un contenedor efímero dado un `input_dir`/`output_dir`, aplicando límites de recursos (`VINA_CPU_QUOTA`, `VINA_MEM_LIMIT`), timeout (`VINA_TIMEOUT_SECONDS`) y un semáforo de concurrencia (`VINA_MAX_PARALLEL_JOBS`). También añadió a `config/settings.py` las variables `VINA_DOCKER_IMAGE`, `VINA_MAX_PARALLEL_JOBS`, `VINA_CPU_QUOTA`, `VINA_MEM_LIMIT`, `VINA_TIMEOUT_SECONDS`.

`ROADMAP.md`, Fase 3 ("Docker-por-job para Vina"), pide completar la integración: que `DockerVinaService` use `DockerJobRunner` para ejecutar Vina en un **directorio efímero por-job** (no en los directorios compartidos `input/`/`output/`), y que la imagen Docker sea configurable.

`.env.example` ya define `VINA_JOBS_DIR=/tmp/vina_jobs` (directorio base para los directorios efímeros de cada job), `VINA_INPUT_DIR=/app/input` y `VINA_OUTPUT_DIR=/app/output` (estas dos últimas NO se usan en esta tarea — ver "Fuera de alcance").

Consulta `ROADMAP.md`, Fase 3, para el contexto general.

## Objetivo

Al terminar, `DockerVinaService.run_vina_docking(...)` debe ejecutar AutoDock Vina mediante `DockerJobRunner` (SDK de Docker) en un directorio efímero único por job bajo `settings.VINA_JOBS_DIR`, usando `settings.VINA_DOCKER_IMAGE` como imagen (en lugar del valor hardcodeado), copiando los resultados a `self.output_dir` al finalizar para que `parse_vina_results` y el resto del flujo sigan funcionando sin cambios — manteniendo exactamente la misma forma de los dicts devueltos por `run_vina_docking` (`success`, `error`, `stdout`, `stderr`, `binding_affinity`, `poses`, `output_files`, `fallback_used`, etc.).

## Pre-requisitos

- `10_docker_job_runner_vina.md` (clase `DockerJobRunner`, settings `VINA_DOCKER_IMAGE`/`VINA_MAX_PARALLEL_JOBS`/`VINA_CPU_QUOTA`/`VINA_MEM_LIMIT`/`VINA_TIMEOUT_SECONDS`).

No depende de las tareas 05-09 (Celery/DockingJob/polling): `DockerVinaService.run_vina_docking` es el mismo método tanto si se llama de forma síncrona (código actual) como desde `core/tasks.run_docking_job` (tarea 07, si ya está implementada). Esta tarea no cambia la firma pública de `run_vina_docking` ni de `parse_vina_results`.

## Archivos a crear/modificar

- `config/settings.py`: añadir `VINA_JOBS_DIR`.
- `core/services/vina_service.py`: usar `settings.VINA_DOCKER_IMAGE`, añadir `build_vina_args`, `_create_job_directories`, reescribir `_execute_with_fallback` y `validate_docker_availability`, ajustar `run_vina_docking` para usar directorios efímeros por-job.
- `docker-compose.yml`: montar el socket de Docker y `VINA_JOBS_DIR` en el/los servicio(s) que ejecutan código Django (`web`, y `celery_worker` si ya existe de la tarea 05).

## Especificación detallada

### 1. `config/settings.py`

En la misma sección añadida por la tarea 10 ("AutoDock Vina vía Docker"), añade:

```python
VINA_JOBS_DIR = os.getenv('VINA_JOBS_DIR', '/tmp/vina_jobs')
```

(Nombre ya definido en `.env.example`.)

### 2. `core/services/vina_service.py` — imports y `__init__`

Añade al bloque de imports (inicio del archivo):

```python
import uuid
import shutil
import docker
from docker.errors import DockerException, ImageNotFound
from django.conf import settings

from core.services.docker_runner import DockerJobRunner, DockerJobRunnerError
```

En `__init__` (línea ~111), sustituye:

```python
self.docker_image = "cafernandezlo/dock-tools:v1.0"
```

por:

```python
self.docker_image = settings.VINA_DOCKER_IMAGE
```

El resto de `__init__` (cálculo de `self.base_dir`, `self.input_dir`, `self.output_dir`, creación de directorios) **no cambia**.

### 3. Nuevo método `build_vina_args` (extraído de `build_vina_command`)

Añade este nuevo método, justo antes o después de `build_vina_command` (línea ~317):

```python
def build_vina_args(self, receptor_file: str, ligand_file: str, config: Dict) -> List[str]:
    """
    Construye la lista de argumentos para el binario `vina` DENTRO del
    contenedor (sin el prefijo `docker run ... <imagen>`), para usar con
    DockerJobRunner.run_vina(). Misma lógica de parámetros que
    build_vina_command, extraída para reutilización.
    """
    args = ["vina", receptor_file, ligand_file]

    # BOX PARAMETERS
    if config.get('use_box_enveloping', True):
        args.append("--box_enveloping")
        padding = config.get('padding', 2.0)
        args.extend(["--padding", str(padding)])
    else:
        box_size = config.get('box_size', [20, 20, 20])
        box_center = config.get('box_center', [0, 0, 0])
        args.extend(["--box_size"] + [str(x) for x in box_size])
        args.extend(["--box_center"] + [str(x) for x in box_center])

    # OPTIONAL PARAMETERS
    if config.get('no_preprocessing', False):
        args.append("--no-preprocessing")

    if config.get('vre', False):
        args.append("--vre")

    if config.get('cpu') is not None:
        args.extend(["--cpu", str(config['cpu'])])

    if config.get('exhaustiveness') is not None:
        args.extend(["--exhaustiveness", str(config['exhaustiveness'])])

    if config.get('verbosity') is not None:
        args.extend(["--verbosity", str(config['verbosity'])])

    if config.get('seed') is not None:
        args.extend(["--seed", str(config['seed'])])

    if config.get('scoring'):
        scoring = config['scoring']
        if scoring in ['vina', 'ad4']:
            args.extend(["--scoring", scoring])

    return args
```

### 4. Reescribir `build_vina_command` para reutilizar `build_vina_args`

`build_vina_command` se sigue usando en `run_vina_docking` para construir `manual_cmd`/logging (no para ejecutar). Sustitúyelo por:

```python
def build_vina_command(self, receptor_file: str, ligand_file: str, config: Dict) -> List[str]:
    """
    Construye el comando Docker CLI completo (solo para logging/visualización
    del comando "manual" que se muestra al usuario). La ejecución real usa
    build_vina_args + DockerJobRunner.
    """
    cmd = [
        "docker", "run", "-it", "--rm",
        "-v", f"{self.input_dir}:/input",
        "-v", f"{self.output_dir}:/output",
        self.docker_image,
    ]
    cmd.extend(self.build_vina_args(receptor_file, ligand_file, config))

    logger.info(f"Comando construido: {' '.join(cmd)}")
    return cmd
```

El resultado de `build_vina_command` para los mismos `receptor_file`/`ligand_file`/`config` debe ser idéntico al actual (mismo orden de flags) — solo cambia `self.docker_image` (ahora viene de settings en vez de estar hardcodeado).

### 5. Nuevo método `_create_job_directories`

Añade un nuevo método de instancia (p.ej. cerca de `prepare_input_files`):

```python
def _create_job_directories(self) -> Tuple[Path, Path, Path]:
    """
    Crea un directorio efímero único para este job de docking, con
    subdirectorios input/ y output/, bajo settings.VINA_JOBS_DIR.

    Returns:
        Tuple[Path, Path, Path]: (job_dir, job_input_dir, job_output_dir)
    """
    jobs_root = Path(getattr(settings, 'VINA_JOBS_DIR', '/tmp/vina_jobs'))
    job_dir = jobs_root / uuid.uuid4().hex
    job_input_dir = job_dir / "input"
    job_output_dir = job_dir / "output"
    job_input_dir.mkdir(parents=True, exist_ok=True)
    job_output_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Directorio efímero de job creado: {job_dir}")
    return job_dir, job_input_dir, job_output_dir
```

### 6. `run_vina_docking` — usar directorios efímeros por-job

En `run_vina_docking` (línea ~492), justo después de:

```python
            # 4. Construir comando con nombres originales
            receptor_filename = file_mapping['receptor']
            ligand_filename = file_mapping['ligand']
            cmd = self.build_vina_command(receptor_filename, ligand_filename, default_config)
```

inserta la creación del directorio efímero del job y la copia de los archivos de entrada hacia él:

```python
            # 4.5 Crear directorio efímero para este job (Docker-por-job) y
            # copiar en él los archivos de entrada que usará el contenedor
            job_dir, job_input_dir, job_output_dir = self._create_job_directories()
            shutil.copy2(file_mapping['receptor_path'], job_input_dir / receptor_filename)
            shutil.copy2(file_mapping['ligand_path'], job_input_dir / ligand_filename)

            vina_args = self.build_vina_args(receptor_filename, ligand_filename, default_config)
```

Después (manteniendo la construcción de `manual_cmd` tal cual está, ya que solo se usa para mostrar información al usuario), sustituye la llamada:

```python
            # 5. Ejecutar Docker con sistema de fallback
            result = self._execute_with_fallback(cmd, default_config, receptor_filename, ligand_filename)
```

por:

```python
            # 5. Ejecutar Docker con sistema de fallback (Docker-por-job vía DockerJobRunner)
            result = self._execute_with_fallback(
                vina_args, default_config, receptor_filename, ligand_filename,
                job_input_dir, job_output_dir,
            )
```

Inmediatamente después de comprobar `if not result['success']:` (que devuelve el error y NO continúa), pero ANTES del paso 6 (`# 6. Procesar resultados` / `self.parse_vina_results(...)`), añade la copia de los resultados desde el directorio efímero hacia `self.output_dir` (para que `parse_vina_results`, que lee `self.output_dir.glob("*")`, siga funcionando sin cambios) y la limpieza del directorio efímero:

```python
            # 5.5 Copiar los resultados del directorio efímero del job al
            # directorio de output persistente del usuario, y limpiar el
            # directorio efímero
            for output_file in job_output_dir.glob("*"):
                if output_file.is_file():
                    shutil.copy2(output_file, self.output_dir / output_file.name)

            shutil.rmtree(job_dir, ignore_errors=True)

            # 6. Procesar resultados
            results = self.parse_vina_results(result['stdout'], result['stderr'], file_mapping)
```

Si ocurre una excepción ANTES de `_execute_with_fallback` (p.ej. al copiar los archivos de entrada en el paso 4.5), el bloque `except Exception as e:` general de `run_vina_docking` ya captura y devuelve `{'success': False, 'error': ..., 'execution_time': ...}` — no se requiere manejo adicional, pero si quieres evitar dejar directorios huérfanos en `VINA_JOBS_DIR` en ese caso, puedes envolver el paso 4.5 en un `try/except` que llame a `shutil.rmtree(job_dir, ignore_errors=True)` antes de re-lanzar. Esto es opcional (mejora de robustez, no bloqueante para los criterios de aceptación).

### 7. Reescribir `_execute_with_fallback`

Sustituye COMPLETAMENTE el método `_execute_with_fallback` (línea ~1001) por:

```python
def _execute_with_fallback(
    self,
    vina_args: List[str],
    config: Dict,
    receptor_file: str,
    ligand_file: str,
    job_input_dir: Path,
    job_output_dir: Path,
) -> Dict:
    """
    Ejecuta `vina <vina_args...>` dentro de un contenedor Docker efímero
    (vía DockerJobRunner, SDK de Docker), con sistema de fallback a
    --no-preprocessing si se detecta un error de preprocesado.
    """
    try:
        runner = DockerJobRunner(image=self.docker_image)
    except DockerJobRunnerError as e:
        logger.error(f"DockerJobRunner no disponible: {e}")
        return {'success': False, 'error': f"Docker no disponible: {e}"}

    logger.info("=== EJECUTANDO DOCKING (DockerJobRunner) ===")
    logger.info(f"  Imagen: {self.docker_image}")
    logger.info(f"  Input job dir: {job_input_dir}")
    logger.info(f"  Output job dir: {job_output_dir}")
    logger.info(f"  vina args: {' '.join(vina_args)}")

    def _docker_cmd_str(args: List[str]) -> str:
        return ' '.join(
            ["docker", "run", "--rm",
             "-v", f"{job_input_dir}:/input",
             "-v", f"{job_output_dir}:/output",
             self.docker_image] + args
        )

    try:
        exec_result = runner.run_vina(str(job_input_dir), str(job_output_dir), vina_args)
    except DockerJobRunnerError as e:
        logger.error(f"Error ejecutando Vina en Docker: {e}")
        return {'success': False, 'error': str(e)}

    if exec_result['success']:
        logger.info("Docking ejecutado exitosamente")
        return {
            'success': True,
            'stdout': exec_result['stdout'],
            'stderr': exec_result['stderr'],
            'config_used': config,
            'final_command': _docker_cmd_str(vina_args),
        }

    error_msg = exec_result['stderr']
    logger.error(f"Error en docking: {error_msg}")

    # Check if preprocessing failed and retry with --no-preprocessing
    preprocessing_errors = [
        "pdb4amber",
        "IndexError: list index out of range",
        "cannot stat",
        "_cleaned.pdb",
        "CONECT record"
    ]
    is_preprocessing_error = any(err in error_msg for err in preprocessing_errors)

    if is_preprocessing_error and not config.get('no_preprocessing', False):
        logger.warning("⚠ Preprocessing failed, retrying with --no-preprocessing")

        fallback_config = config.copy()
        fallback_config['no_preprocessing'] = True
        fallback_args = self.build_vina_args(receptor_file, ligand_file, fallback_config)

        logger.info(f"🔄 Retry args: {' '.join(fallback_args)}")

        try:
            fallback_result = runner.run_vina(str(job_input_dir), str(job_output_dir), fallback_args)
        except DockerJobRunnerError as e:
            logger.error(f"Error ejecutando fallback de Vina en Docker: {e}")
            fallback_result = {'success': False, 'stdout': '', 'stderr': str(e)}

        if fallback_result['success']:
            logger.info("✅ Docking succeeded with --no-preprocessing")
            return {
                'success': True,
                'stdout': fallback_result['stdout'],
                'stderr': fallback_result['stderr'],
                'config_used': fallback_config,
                'final_command': _docker_cmd_str(fallback_args),
                'fallback_used': True,
                'fallback_reason': 'Preprocessing failed, retried without preprocessing',
            }
        else:
            logger.error(f"❌ Fallback also failed: {fallback_result['stderr']}")
            error_msg = fallback_result['stderr']

    # Proporcionar mensaje específico según el tipo de error
    if "valence" in error_msg.lower():
        friendly_error = f"Error de valencia molecular: Los archivos contienen estructuras con valencias incorrectas. Error: {error_msg}"
    elif "interrupted residues" in error_msg.lower():
        friendly_error = f"Error en estructura PDB: Residuos interrumpidos o numeración no consecutiva. Error: {error_msg}"
    elif "No such file or directory" in error_msg:
        friendly_error = f"Archivos no encontrados: Verifique que los archivos estén en la carpeta correcta. Error: {error_msg}"
    else:
        friendly_error = f"Error en docking: {error_msg}"

    return {
        'success': False,
        'error': friendly_error,
        'stdout': exec_result['stdout'],
        'stderr': exec_result['stderr'],
    }
```

Notas:
- El test de conectividad `docker run --rm hello-world` (que usaba `subprocess`) se elimina: `DockerJobRunner(image=self.docker_image)` ya falla con `DockerJobRunnerError` si el daemon Docker no es accesible, y `runner.run_vina(...)` falla con `DockerJobRunnerError` si la imagen no existe localmente — ambos casos quedan cubiertos por los `try/except` anteriores.
- Las claves devueltas (`success`, `stdout`, `stderr`, `config_used`, `final_command`, `fallback_used`, `fallback_reason`, `error`) son las MISMAS que antes — `run_vina_docking` no necesita cambios adicionales para consumir este resultado (aparte de los del punto 6).

### 8. Reescribir `validate_docker_availability` (SDK en lugar de CLI)

Sustituye el método `validate_docker_availability` (línea ~119) por:

```python
def validate_docker_availability(self) -> Tuple[bool, str]:
    """
    Verificar que el daemon Docker esté accesible (vía SDK) y que la
    imagen configurada (settings.VINA_DOCKER_IMAGE) esté disponible
    localmente.
    """
    try:
        client = docker.from_env()
        client.ping()
    except DockerException as e:
        return False, f"Docker no está disponible: {e}"

    try:
        client.images.get(self.docker_image)
    except ImageNotFound:
        return False, f"La imagen {self.docker_image} no está descargada. Ejecuta: docker pull {self.docker_image}"
    except DockerException as e:
        return False, f"Error verificando la imagen Docker: {e}"

    return True, "Docker y la imagen están disponibles"
```

Esto elimina la dependencia del binario `docker` CLI (solo necesita acceso al socket de Docker), consistente con el resto de la integración basada en SDK.

### 9. `import subprocess` y `except subprocess.TimeoutExpired`

Tras estos cambios, `_execute_with_fallback` ya no usa `subprocess`. El import `import subprocess` (línea 2) y los bloques `except subprocess.TimeoutExpired:` que quedan en `run_vina_docking` (paso "## 657") siguen siendo código Python válido (no se disparan nunca, pero no rompen nada). Puedes dejarlos tal cual (recomendado, cambio mínimo) o eliminarlos junto con el import si prefieres limpieza; si los eliminas, asegúrate de que no quede ninguna otra referencia a `subprocess` en el archivo (búscalo con `grep -n subprocess core/services/vina_service.py`).

### 10. `docker-compose.yml`

Para que el contenedor `web` (y `celery_worker`, si la tarea `05_setup_celery_redis.md` ya está implementada) puedan usar el SDK `docker` para lanzar contenedores Vina en el HOST (patrón "Docker-out-of-Docker"), necesitan:

1. Acceso al socket de Docker del host: montar `/var/run/docker.sock:/var/run/docker.sock`.
2. Que `VINA_JOBS_DIR` se monte con la **misma ruta** dentro y fuera del contenedor — los volúmenes que `DockerJobRunner` pide al daemon Docker (`job_input_dir`/`job_output_dir`, calculados dentro del contenedor `web`/`celery_worker`) son interpretados por el daemon Docker del HOST, así que la ruta debe existir y coincidir en ambos lados.

En el servicio `web`, añade a `volumes`:

```yaml
  web:
    # ...
    volumes:
      - .:/app
      - static_volume:/app/staticfiles
      - media_volume:/app/media
      - /var/run/docker.sock:/var/run/docker.sock
      - ${VINA_JOBS_DIR:-/tmp/vina_jobs}:${VINA_JOBS_DIR:-/tmp/vina_jobs}
```

Si el servicio `celery_worker` ya existe (añadido por la tarea `05_setup_celery_redis.md`), añade las mismas dos líneas a sus `volumes`:

```yaml
  celery_worker:
    # ...
    volumes:
      - .:/app
      - media_volume:/app/media
      - /var/run/docker.sock:/var/run/docker.sock
      - ${VINA_JOBS_DIR:-/tmp/vina_jobs}:${VINA_JOBS_DIR:-/tmp/vina_jobs}
```

Si `celery_worker` todavía NO existe (tarea 05 no implementada), añade solo los cambios al servicio `web` y deja un comentario en `docker-compose.yml` junto al bloque `web` indicando que `celery_worker` (cuando se añada) necesita los mismos dos volúmenes — para que quien implemente la tarea 05 no lo olvide.

**Nota sobre permisos del socket Docker**: dependiendo del sistema host, el proceso dentro del contenedor (`web`/`celery_worker`) puede necesitar pertenecer al grupo `docker` (o ejecutarse como root) para poder leer/escribir en `/var/run/docker.sock`. Si al verificar (sección siguiente) aparece un error de permisos (`PermissionError` / `docker.errors.DockerException: ... Permission denied`), documenta el problema en un comentario en `docker-compose.yml` (p.ej. añadir `user: root` o `group_add: ["<gid del grupo docker del host>"]` al servicio afectado) — la solución exacta depende del host y queda fuera del alcance estricto de esta tarea si no se puede verificar en el entorno de desarrollo actual.

## Dependencias nuevas

Ninguna adicional (usa `docker` ya añadido en la tarea 10, `shutil`/`uuid` son de la librería estándar).

## Criterios de aceptación / cómo verificar

1. `python manage.py check` no produce errores.
2. Búsqueda de texto: `subprocess.run` ya NO debe aparecer en `core/services/vina_service.py` salvo, opcionalmente, dentro de bloques `except subprocess.TimeoutExpired` no eliminados (ver punto 9). `cafernandezlo/dock-tools:v1.0` ya NO debe aparecer como literal hardcodeado (debe venir de `settings.VINA_DOCKER_IMAGE`).
3. En `python manage.py shell`:
   ```python
   from django.conf import settings
   from core.services.vina_service import DockerVinaService

   svc = DockerVinaService()
   assert svc.docker_image == settings.VINA_DOCKER_IMAGE

   job_dir, job_input, job_output = svc._create_job_directories()
   assert job_input.exists() and job_output.exists()
   assert str(job_input).startswith(settings.VINA_JOBS_DIR)

   args = svc.build_vina_args("1JM7.pdb", "Aspirin.sdf", {"use_box_enveloping": True, "padding": 2.0, "cpu": 2})
   assert args[:3] == ["vina", "1JM7.pdb", "Aspirin.sdf"]
   assert "--box_enveloping" in args and "--padding" in args and "--cpu" in args

   cmd = svc.build_vina_command("1JM7.pdb", "Aspirin.sdf", {"use_box_enveloping": True, "padding": 2.0, "cpu": 2})
   assert cmd[0:4] == ["docker", "run", "-it", "--rm"]
   assert svc.docker_image in cmd
   assert cmd[-len(args):] == args  # los argumentos de vina van al final del comando completo

   import shutil
   shutil.rmtree(job_dir, ignore_errors=True)
   ```
4. `validate_docker_availability()`:
   - Si Docker NO está disponible en el entorno: devuelve `(False, "Docker no está disponible: ...")`.
   - Si Docker está disponible pero la imagen `settings.VINA_DOCKER_IMAGE` no está descargada: devuelve `(False, "La imagen ... no está descargada. Ejecuta: docker pull ...")`.
   - Si ambos están disponibles: devuelve `(True, "Docker y la imagen están disponibles")`.
5. (Si Docker y la imagen `cafernandezlo/dock-tools:v1.0` están disponibles en el entorno, y existen archivos de prueba PDB/SDF reales en `input/`) Ejecuta un docking real:
   ```python
   from core.services.vina_service import DockerVinaService

   svc = DockerVinaService(user_id=1)
   result = svc.run_vina_docking("<ruta_pdb_real>", "<ruta_sdf_real>")
   assert result['success'] is True
   assert 'binding_affinity' in result
   assert result['output_files']  # archivos copiados a self.output_dir
   ```
   Verifica también que, tras la ejecución, NO queda ningún directorio residual bajo `settings.VINA_JOBS_DIR` (se limpió con `shutil.rmtree`).
6. Verifica manualmente (lectura de código) que la lógica de fallback `--no-preprocessing` (líneas que comprueban `preprocessing_errors`) sigue presente y usa `build_vina_args`/`runner.run_vina` igual que el camino principal.
7. `docker-compose config` valida la sintaxis del `docker-compose.yml` actualizado sin errores.
8. Si Docker está disponible: `docker-compose up -d web` (y `celery_worker` si existe) y, dentro del contenedor (`docker-compose exec web python manage.py shell`), repetir el punto 3 — confirma que el contenedor puede acceder al socket Docker del host (`docker.from_env().ping()` no lanza excepción).

## Fuera de alcance

- No modificar `parse_vina_results`, `load_structure_files`, `BindingAffinityClassifier`, ni la firma pública de `run_vina_docking` (sigue devolviendo el mismo dict).
- No usar ni modificar `VINA_INPUT_DIR`/`VINA_OUTPUT_DIR` (quedan reservados para una futura unificación de configuración de paths de `self.base_dir`/`self.input_dir`/`self.output_dir`; cambiarlos ahora podría romper el cálculo actual de `self.base_dir` en entornos de desarrollo no-Docker).
- No modificar `core/services/docker_runner.py` (tarea `10_docker_job_runner_vina.md`) salvo que durante la integración se descubra un bug bloqueante — en ese caso, documenta el cambio mínimo necesario y por qué.
- No modificar `core/tasks.py`, `core/models.py`, `core/views.py`, `core/urls.py` ni el frontend.
- No resolver de forma definitiva problemas de permisos del socket Docker específicos de un host concreto (más allá de documentarlos como se indica en el punto 10).
- No implementar un semáforo distribuido (Redis) para `VINA_MAX_PARALLEL_JOBS` entre múltiples procesos/contenedores (ya señalado como fuera de alcance en la tarea 10).
