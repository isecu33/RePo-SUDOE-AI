import os
import subprocess
import json
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from django.utils.translation import gettext as _

logger = logging.getLogger(__name__)

class BindingAffinityClassifier:
    """
    Clasifica la afinidad de unión según estándares de drug discovery
    """
    
    @staticmethod
    def classify_binding_affinity(affinity: float) -> Dict[str, str]:
        """
        Clasifica el binding affinity según reglas prácticas de drug discovery
        
        Args:
            affinity: Valor de afinidad de unión en kcal/mol (número negativo esperado)
            
        Returns:
            Dict con: 'level', 'icon', 'color', 'description', 'is_success'
        """
        if affinity is None:
            return {
                'level': 'unknown',
                'icon': '❓',
                'color': 'gray',
                'description': _('Afinidad desconocida'),
                'is_success': False
            }
        
        # Convertir a valor positivo para comparación más intuitiva
        abs_affinity = abs(affinity)
        
        if abs_affinity > 10.0:  # < -10
            return {
                'level': 'excellent',
                'icon': '🟣',
                'color': 'purple',
                'description': _('Muy fuerte') + f' ({affinity:.2f} kcal/mol) - ' + _('Muy interesante'),
                'is_success': True
            }
        elif abs_affinity >= 8.0:  # < -8.0 a -10.0
            return {
                'level': 'very_good',
                'icon': '🔵',
                'color': 'blue',
                'description': _('Muy buena') + f' ({affinity:.2f} kcal/mol) - ' + _('Interesante para estudio'),
                'is_success': True
            }
        elif abs_affinity >= 6.5:  # < -6.5 a -8.0
            return {
                'level': 'good',
                'icon': '🟢',
                'color': 'green',
                'description': _('Buena afinidad') + f' ({affinity:.2f} kcal/mol)',
                'is_success': True
            }
        elif abs_affinity >= 5.0:  # -5.0 a -6.5
            return {
                'level': 'moderate',
                'icon': '🟡',
                'color': 'yellow',
                'description': _('Interacción moderada') + f' ({affinity:.2f} kcal/mol)',
                'is_success': False
            }
        else:  # > -5.0
            return {
                'level': 'weak',
                'icon': '🔴',
                'color': 'red',
                'description': _('Débil / Irrelevante') + f' ({affinity:.2f} kcal/mol)',
                'is_success': False
            }

class DockerVinaService:
    """
    Servicio para ejecutar AutoDock Vina usando Docker
    """
    
    def __init__(self, base_dir: str = None, user_id: int = None):
        """
        Inicializar el servicio de Docker Vina

        Args:
            base_dir: Directorio base para input/output (por defecto: directorio del proyecto RePo-SUDOE-AI)
            user_id: ID del usuario para crear subdirectorio específico en output (opcional)
        """
        if base_dir:
            self.base_dir = Path(base_dir)
        else:
            # Usar la ruta del archivo actual para determinar el directorio del proyecto
            # Este archivo está en core/services/vina_service.py
            # El proyecto está 2 niveles arriba: core/services -> core -> RePo-SUDOE-AI
            current_file = Path(__file__).resolve()  # /path/to/RePo-SUDOE-AI/core/services/vina_service.py
            project_root = current_file.parent.parent.parent  # /path/to/RePo-SUDOE-AI
            self.base_dir = project_root
        self.input_dir = self.base_dir / "input"

        # Crear subdirectorio por usuario si se proporciona user_id
        if user_id:
            self.output_dir = self.base_dir / "output" / str(user_id)
        else:
            self.output_dir = self.base_dir / "output"

        self.docker_image = "cafernandezlo/dock-tools:v1.0"

        # Crear directorios si no existen
        self.input_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"DockerVinaService inicializado - Input: {self.input_dir}, Output: {self.output_dir}")
    
    def validate_docker_availability(self) -> Tuple[bool, str]:
        """
        Verificar que Docker esté disponible y la imagen esté descargada
        
        Returns:
            Tuple[bool, str]: (is_available, message)
        """
        try:
            # Verificar que Docker esté ejecutándose
            result = subprocess.run(
                ["docker", "--version"], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            
            if result.returncode != 0:
                return False, "Docker no está instalado o no está ejecutándose"
            
            # Verificar que la imagen esté disponible
            result = subprocess.run(
                ["docker", "images", self.docker_image, "--format", "{{.Repository}}:{{.Tag}}"],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if self.docker_image not in result.stdout:
                return False, f"La imagen {self.docker_image} no está descargada. Ejecuta: docker pull {self.docker_image}"
            
            return True, "Docker y la imagen están disponibles"
            
        except subprocess.TimeoutExpired:
            return False, "Timeout verificando Docker"
        except FileNotFoundError:
            return False, "Docker no está instalado"
        except Exception as e:
            return False, f"Error verificando Docker: {str(e)}"
    
    def prepare_input_files(self, receptor_path: str, drug_path: str) -> Tuple[bool, str, Dict[str, str]]:
        """
        Verificar que los archivos estén en el directorio input/ con sus nombres originales
        
        Args:
            receptor_path: Ruta al archivo del receptor
            drug_path: Ruta al archivo del fármaco
            
        Returns:
            Tuple[bool, str, Dict]: (success, message, file_mapping con nombres originales)
        """
        try:
            file_mapping = {}
            
            logger.info(f"=== DIAGNÓSTICO DE ARCHIVOS ===")
            logger.info(f"Receptor solicitado: {receptor_path}")
            logger.info(f"Fármaco solicitado: {drug_path}")
            logger.info(f"Directorio input: {self.input_dir}")
            logger.info(f"Directorio input existe: {self.input_dir.exists()}")
            
            # Listar todos los archivos en el directorio input
            if self.input_dir.exists():
                input_files = list(self.input_dir.glob("*"))
                logger.info(f"Archivos encontrados en {self.input_dir}:")
                for file in input_files:
                    logger.info(f"  - {file.name} (tamaño: {file.stat().st_size} bytes)")
            else:
                logger.error(f"El directorio input {self.input_dir} no existe!")
                
            # Listar archivos en directorio base también
            base_files = list(self.base_dir.glob("*"))
            logger.info(f"Archivos en directorio base {self.base_dir}:")
            for file in base_files:
                if file.is_file():
                    logger.info(f"  - {file.name}")
            logger.info(f"=== FIN DIAGNÓSTICO ===")
            
            logger.debug(f"Verificando archivos - Receptor: {receptor_path}, Fármaco: {drug_path}")
            logger.debug(f"Directorio input configurado: {self.input_dir}")
            
            # Verificar archivo receptor
            receptor_src = Path(receptor_path)
            logger.debug(f"Ruta receptor absoluta: {receptor_src.absolute()}")
            logger.debug(f"Receptor existe: {receptor_src.exists()}")
            
            if not receptor_src.exists():
                # Intentar buscar en directorio input si la ruta no es absoluta
                if not receptor_src.is_absolute():
                    alternative_path = self.input_dir / receptor_src
                    logger.debug(f"Probando ruta alternativa: {alternative_path}")
                    if alternative_path.exists():
                        receptor_src = alternative_path
                        logger.info(f"Archivo receptor encontrado en ruta alternativa: {receptor_src}")
                    else:
                        return False, f"Archivo receptor no encontrado en {receptor_path} ni en {alternative_path}", {}
                else:
                    return False, f"Archivo receptor no encontrado: {receptor_path}", {}
            
            # Verificar formato receptor
            logger.debug(f"Extensión receptor: {receptor_src.suffix.lower()}")
            if receptor_src.suffix.lower() not in ['.pdb', '.pdbqt']:
                return False, f"Formato de receptor no soportado: {receptor_src.suffix}", {}
            
            # Verificar tamaño del archivo receptor
            receptor_size = receptor_src.stat().st_size
            logger.debug(f"Tamaño archivo receptor: {receptor_size} bytes")
            if receptor_size == 0:
                return False, f"Archivo receptor está vacío: {receptor_src}", {}
            
            # Usar nombre original del archivo receptor
            receptor_filename = receptor_src.name
            file_mapping['receptor'] = receptor_filename
            file_mapping['receptor_path'] = str(receptor_src)
            
            # Verificar archivo fármaco
            drug_src = Path(drug_path)
            logger.debug(f"Ruta fármaco absoluta: {drug_src.absolute()}")
            logger.debug(f"Fármaco existe: {drug_src.exists()}")
            
            if not drug_src.exists():
                # Intentar buscar en directorio input si la ruta no es absoluta
                if not drug_src.is_absolute():
                    alternative_path = self.input_dir / drug_src
                    logger.debug(f"Probando ruta alternativa fármaco: {alternative_path}")
                    if alternative_path.exists():
                        drug_src = alternative_path
                        logger.info(f"Archivo fármaco encontrado en ruta alternativa: {drug_src}")
                    else:
                        return False, f"Archivo fármaco no encontrado en {drug_path} ni en {alternative_path}", {}
                else:
                    return False, f"Archivo fármaco no encontrado: {drug_path}", {}
            
            # Verificar formato fármaco
            logger.debug(f"Extensión fármaco: {drug_src.suffix.lower()}")
            if drug_src.suffix.lower() not in ['.sdf', '.mol', '.mol2']:
                return False, f"Formato de fármaco no soportado: {drug_src.suffix}", {}
            
            # Verificar tamaño del archivo fármaco
            drug_size = drug_src.stat().st_size
            logger.debug(f"Tamaño archivo fármaco: {drug_size} bytes")
            if drug_size == 0:
                return False, f"Archivo fármaco está vacío: {drug_src}", {}
            
            # Usar nombre original del archivo fármaco
            drug_filename = drug_src.name
            file_mapping['ligand'] = drug_filename
            file_mapping['ligand_path'] = str(drug_src)
            
            logger.info(f"Archivos verificados exitosamente:")
            logger.info(f"  - Receptor: {receptor_filename} ({receptor_size} bytes)")
            logger.info(f"  - Fármaco: {drug_filename} ({drug_size} bytes)")
            
            return True, "Archivos verificados correctamente", file_mapping
            
        except Exception as e:
            logger.error(f"Error verificando archivos: {e}")
            logger.error(f"Traceback: ", exc_info=True)
            return False, f"Error verificando archivos: {str(e)}", {}
    
    @staticmethod
    def _calculate_pdb_center(pdb_path: str) -> Optional[List[float]]:
        """
        Calcula el centro de masa de un archivo PDB promediando las coordenadas
        de todos los átomos ATOM (no HETATM). Útil cuando el usuario no especifica
        box_center explícitamente.

        Args:
            pdb_path: Ruta al archivo PDB

        Returns:
            Lista [x, y, z] redondeado a 2 decimales, o None si no se puede calcular
        """
        try:
            xs, ys, zs = [], [], []
            with open(pdb_path, 'r') as f:
                for line in f:
                    if line.startswith("ATOM"):
                        # Formato PDB fijo: columnas 31-38 (x), 39-46 (y), 47-54 (z)
                        x = float(line[30:38])
                        y = float(line[38:46])
                        z = float(line[46:54])
                        xs.append(x)
                        ys.append(y)
                        zs.append(z)
            if xs:
                center = [
                    round(sum(xs) / len(xs), 2),
                    round(sum(ys) / len(ys), 2),
                    round(sum(zs) / len(zs), 2)
                ]
                logger.info(f"Centro de masa calculado del PDB ({len(xs)} átomos): {center}")
                return center
            else:
                logger.warning("No se encontraron registros ATOM en el PDB para calcular centro de masa")
                return None
        except Exception as e:
            logger.error(f"Error calculando centro de masa del PDB: {e}")
            return None

    def build_vina_command(self, receptor_file: str, ligand_file: str, config: Dict) -> List[str]:
        """
        Construir el comando de Docker para AutoDock Vina según la documentación oficial
        
        Args:
            receptor_file: Nombre del archivo receptor (ej: 2mm3.pdb)
            ligand_file: Nombre del archivo del ligando (ej: Abemaciclib.sdf)
            config: Configuración de parámetros
            
        Returns:
            List[str]: Comando de Docker como lista
        """
        cmd = [
            "docker", "run", "-it", "--rm",
            "-v", f"{self.input_dir}:/input",
            "-v", f"{self.output_dir}:/output",
            self.docker_image,
            "vina",
            receptor_file,
            ligand_file
        ]
        
        # BOX PARAMETERS
        if config.get('use_box_enveloping', True):
            cmd.append("--box_enveloping")
            # padding es requerido con --box_enveloping
            padding = config.get('padding', 2.0)
            cmd.extend(["--padding", str(padding)])
        else:
            box_size = config.get('box_size', [20, 20, 20])
            box_center = config.get('box_center', [0, 0, 0])
            cmd.extend(["--box_size"] + [str(x) for x in box_size])
            cmd.extend(["--box_center"] + [str(x) for x in box_center])
        
        # OPTIONAL PARAMETERS
        if config.get('no_preprocessing', False):
            cmd.append("--no-preprocessing")
        
        if config.get('vre', False):
            cmd.append("--vre")
        
        if config.get('cpu') is not None:
            cmd.extend(["--cpu", str(config['cpu'])])
        
        if config.get('exhaustiveness') is not None:
            cmd.extend(["--exhaustiveness", str(config['exhaustiveness'])])
        
        if config.get('verbosity') is not None:
            cmd.extend(["--verbosity", str(config['verbosity'])])
        
        if config.get('seed') is not None:
            cmd.extend(["--seed", str(config['seed'])])
        
        if config.get('scoring'):
            scoring = config['scoring']
            if scoring in ['vina', 'ad4']: 
                cmd.extend(["--scoring", scoring])
        
        
        logger.info(f"Comando construido: {' '.join(cmd)}")
        return cmd
    
    def get_experiment_id(self, receptor_path: str, drug_path: str, config: Dict) -> str:
        """
        Generar ID único del experimento basado en archivos y configuración
        
        Args:
            receptor_path: Ruta al archivo del receptor
            drug_path: Ruta al archivo del fármaco  
            config: Configuración del experimento
            
        Returns:
            str: ID único del experimento
        """
        import hashlib
        from pathlib import Path
        
        receptor_name = Path(receptor_path).name
        drug_name = Path(drug_path).name
        
        experiment_params = {
            'receptor': receptor_name,
            'drug': drug_name,
            'box_size': config.get('box_size'),
            'box_center': config.get('box_center'),
            'use_box_enveloping': config.get('use_box_enveloping'),
            'padding': config.get('padding'),
            'exhaustiveness': config.get('exhaustiveness'),
            'scoring': config.get('scoring', 'vina')
        }
        
        # Crear hash del experimento
        experiment_string = str(sorted(experiment_params.items()))
        experiment_hash = hashlib.md5(experiment_string.encode()).hexdigest()[:12]
        
        # Formato: receptor_drug_hash
        experiment_id = f"{receptor_name.split('.')[0]}_{drug_name.split('.')[0]}_{experiment_hash}"
        return experiment_id
    
    # def check_previous_experiment(self, receptor_path: str, drug_path: str, config: Dict) -> Dict:
    #     """
    #     Comprobar si ya existe un experimento previo con los mismos parámetros
        
    #     Args:
    #         receptor_path: Ruta al archivo del receptor
    #         drug_path: Ruta al archivo del fármaco
    #         config: Configuración del experimento
            
    #     Returns:
    #         Dict: Resultados previos si existen, None si no
    #     """
    #     experiment_id = self.get_experiment_id(receptor_path, drug_path, config)
        
    #     # Buscar archivos de output con este ID
    #     output_pattern = f"*{experiment_id}*"
    #     matching_files = list(self.output_dir.glob(output_pattern))
        
    #     # También buscar por los nombres de archivos principales
    #     receptor_name = Path(receptor_path).stem  # sin extensión
    #     drug_name = Path(drug_path).stem
        
    #     # Buscar archivos típicos de AutoDock Vina
    #     possible_output_files = [
    #         f"{drug_name}_out.pdbqt",
    #         f"ligand_out.pdbqt", 
    #         f"output.pdbqt",
    #         f"vina_output.txt",
    #         f"{receptor_name}_{drug_name}_out.pdbqt"
    #     ]
        
    #     existing_output_files = []
    #     for filename in possible_output_files:
    #         output_file = self.output_dir / filename
    #         if output_file.exists():
    #             existing_output_files.append(output_file)
        
    #     if existing_output_files:
    #         print(f"Experimento previo encontrado: {experiment_id}")
    #         print(f"Archivos encontrados: {[f.name for f in existing_output_files]}")
            
    #         # Intentar cargar resultados previos
    #         try:
    #             # Buscar archivo de log si existe
    #             log_files = list(self.output_dir.glob("*.log"))
    #             log_content = ""
    #             if log_files:
    #                 with open(log_files[0], 'r') as f:
    #                     log_content = f.read()
                
    #             # Crear estructura de resultados simulando el formato normal
    #             cached_results = {
    #                 'success': True,
    #                 'cached': True,
    #                 'experiment_id': experiment_id,
    #                 'binding_affinity': None,
    #                 'poses': [],
    #                 'execution_time': 0,
    #                 'config_used': config,
    #                 'output_files': [str(f) for f in existing_output_files],
    #                 'message': f'Resultados cargados desde experimento previo: {experiment_id}'
    #             }
                
    #             # Intentar parsear resultados si hay archivo PDBQT
    #             pdbqt_files = [f for f in existing_output_files if f.suffix == '.pdbqt']
    #             if pdbqt_files and log_content:
    #                 parsed_results = self.parse_vina_results(log_content, "", None)
    #                 cached_results.update(parsed_results)
                
    #             return cached_results
                
    #         except Exception as e:
    #             print(f"Error cargando resultados previos: {e}")
        
    #     return None
    
    def run_vina_docking(self, receptor_path: str, drug_path: str, config: Dict = None) -> Dict:
        """
        Ejecutar docking molecular con AutoDock Vina usando Docker
        
        Args:
            receptor_path: Ruta al archivo del receptor
            drug_path: Ruta al archivo del fármaco
            config: Configuración de parámetros (opcional)
            
        Returns:
            Dict: Resultado del docking
        """
        start_time = time.time()
        
        # Configuración por defecto según documentación del Docker
        default_config = {
            'use_box_enveloping': True,  # Usar box automático (recomendado)
            'padding': 2.0,  # Valor por defecto según documentación
            'box_size': [20, 20, 20],  # Valores por defecto para modo manual
            'box_center': [0, 0, 0],   # Valores por defecto para modo manual
            'cpu': 2,                  # Valor por defecto según documentación
            'exhaustiveness': 10,      # Valor por defecto según documentación
            'verbosity': 2,            # Valor por defecto según documentación
            'seed': 1367858384,        # Valor por defecto según documentación
            'scoring': 'vina',         # Valor por defecto según documentación
            'no_preprocessing': False, # False por defecto (usar pdb4amber)
            'vre': False               # Ejecutar en VRE de d4science
        }
        
        if config:
            default_config.update(config)
        
        logger.info(f"Iniciando docking con configuración: {default_config}")
        
        try:
            # 1. Verificar si ya existe un experimento previo
            # cached_results = self.check_previous_experiment(receptor_path, drug_path, default_config)
            # if cached_results:
            #     logger.info("Experimento previo encontrado, devolviendo resultados cacheados")
            #     cached_results['execution_time'] = time.time() - start_time
            #     return cached_results
            
            # 2. Verificar Docker
            docker_available, docker_message = self.validate_docker_availability()
            if not docker_available:
                return {
                    'success': False,
                    'error': f"Docker no disponible: {docker_message}",
                    'execution_time': time.time() - start_time
                }
            
            # 3. Preparar archivos
            files_ready, files_message, file_mapping = self.prepare_input_files(receptor_path, drug_path)
            if not files_ready:
                return {
                    'success': False,
                    'error': f"Error preparando archivos: {files_message}",
                    'execution_time': time.time() - start_time
                }
            
            # 3.5 Calcular centro de masa del receptor si box_center no fue especificado
            if not default_config.get('use_box_enveloping', True) and default_config.get('box_center', [0, 0, 0]) == [0, 0, 0]:
                # El usuario no especificó box_center → calcular automáticamente desde el PDB
                receptor_pdb_path = str(self.input_dir / file_mapping['receptor'])
                calculated_center = self._calculate_pdb_center(receptor_pdb_path)
                if calculated_center:
                    default_config['box_center'] = calculated_center
                    logger.info(f"box_center actualizado automáticamente a: {calculated_center}")
                else:
                    logger.warning("No se pudo calcular centro de masa; se usará box_center [0, 0, 0]")

            # 4. Construir comando con nombres originales
            receptor_filename = file_mapping['receptor']
            ligand_filename = file_mapping['ligand']
            cmd = self.build_vina_command(receptor_filename, ligand_filename, default_config)
            
            # Build manual command for display
            manual_cmd = f"docker run -it --rm -v $PWD/input:/input -v $PWD/output:/output {self.docker_image} vina {receptor_filename} {ligand_filename}"
            if default_config.get('use_box_enveloping'):
                manual_cmd += f" --box_enveloping --padding {default_config.get('padding', 2.0)}"
            else:
                box_size = default_config.get('box_size', [20, 20, 20])
                box_center = default_config.get('box_center', [0, 0, 0])
                manual_cmd += f" --box_size {' '.join(map(str, box_size))} --box_center {' '.join(map(str, box_center))}"
            
            # Add other parameters
            if default_config.get('cpu'):
                manual_cmd += f" --cpu {default_config['cpu']}"
            if default_config.get('exhaustiveness'):
                manual_cmd += f" --exhaustiveness {default_config['exhaustiveness']}"
            if default_config.get('verbosity') is not None:
                manual_cmd += f" --verbosity {default_config['verbosity']}"
            if default_config.get('seed'):
                manual_cmd += f" --seed {default_config['seed']}"
            if default_config.get('num_modes'):
                manual_cmd += f" --num_modes {default_config['num_modes']}"
            if default_config.get('energy_range'):
                manual_cmd += f" --energy_range {default_config['energy_range']}"
                
            logger.info(f" EXECUTING VINA COMMAND:")
            logger.info(f"  Full command: {' '.join(cmd)}")
            logger.info(f"  Receptor: {receptor_filename}")
            logger.info(f"  Ligand: {ligand_filename}")  
            logger.info(f"  Configuration: {default_config}")
            
            print(f"\n{'='*60}")
            print(f"VINA EXECUTION")
            print(f"{'='*60}")
            print(f"DOCKER COMMAND:")
            print(f"   {' '.join(cmd)}")
            print(f"{'='*60}\n")
            
            # 5. Ejecutar Docker con sistema de fallback
            result = self._execute_with_fallback(cmd, default_config, receptor_filename, ligand_filename)
            
            execution_time = time.time() - start_time
            
            if not result['success']:
                logger.error(f"Error en Docker Vina: {result['error']}")
                return {
                    'success': False,
                    'error': result['error'],
                    'stdout': result.get('stdout', ''),
                    'stderr': result.get('stderr', ''),
                    'execution_time': execution_time,
                }
            
            # 6. Procesar resultados
            results = self.parse_vina_results(result['stdout'], result['stderr'], file_mapping)
            
            # 7. Clasificar el binding affinity y generar mensaje
            affinity_info = BindingAffinityClassifier.classify_binding_affinity(
                results.get('binding_affinity')
            )
            
            # Generar mensaje de finalización detallado
            if results.get('binding_affinity') is not None:
                num_poses = len(results.get('poses', []))
                poses_text = _('pose') if num_poses == 1 else _('poses')
                message = (
                    f"{affinity_info['icon']} {_('Docking completado')}: "
                    f"{affinity_info['description']} | "
                    f"{num_poses} {poses_text} {_('generadas')}"
                )
            else:
                message = _("Docking completado pero no se encontraron resultados")
            
            results.update({
                'success': True,
                'execution_time': execution_time,
                'config_used': result.get('config_used', default_config),
                'docker_command': result.get('final_command', ' '.join(cmd)),
                'manual_command': manual_cmd,
                'receptor_file': receptor_filename,
                'ligand_file': ligand_filename,
                'stdout': result['stdout'],
                'stderr': result['stderr'],
                'message': message,
                'affinity_classification': affinity_info,
            })
            
            logger.info(f"Docking completado exitosamente en {execution_time:.2f} segundos")
            logger.info(f"Binding affinity classification: {affinity_info}")
            return results
            
        except subprocess.TimeoutExpired:
            return {
                'success': False,
                'error': 'Timeout: El docking tardó más de 10 minutos',
                'execution_time': time.time() - start_time
            }
        except Exception as e:
            logger.error(f"Error ejecutando docking: {e}")
            return {
                'success': False,
                'error': f"Error inesperado: {str(e)}",
                'execution_time': time.time() - start_time
            }
    
    def parse_vina_results(self, stdout: str, stderr: str, file_mapping: Dict = None) -> Dict:
        """
        Parsear los resultados de AutoDock Vina
        
        Args:
            stdout: Salida estándar del comando
            stderr: Salida de error del comando
            
        Returns:
            Dict: Resultados parseados
        """
        results = {
            'binding_affinity': None,
            'poses': [],
            'output_files': [],
            'log_info': {}
        }
        
        try:
            # Buscar archivos de salida
            output_files = list(self.output_dir.glob("*"))
            results['output_files'] = [str(f) for f in output_files]
            
            # Parsear stdout para extraer resultados
            lines = stdout.split('\n')
            parsing_results = False
            
            for line in lines:
                # Buscar tabla de resultados
                if 'mode |   affinity | dist from best mode' in line:
                    parsing_results = True
                    continue

                if parsing_results:
                    # Skip separator line and empty lines
                    if line.startswith('-----') or not line.strip():
                        continue

                    # Skip header continuation line (units)
                    if '(kcal/mol)' in line and 'rmsd' in line:
                        continue

                    # Parsear línea de resultado (datos separados por espacios, no pipes)
                    parts = line.split()
                    if len(parts) >= 4:
                        try:
                            mode = int(parts[0])
                            affinity = float(parts[1])
                            rmsd_lb = float(parts[2])
                            rmsd_ub = float(parts[3])

                            pose = {
                                'pose': mode,
                                'affinity': affinity,
                                'rmsd_lb': rmsd_lb,
                                'rmsd_ub': rmsd_ub
                            }

                            results['poses'].append(pose)

                            # La primera pose es la mejor
                            if mode == 1:
                                results['binding_affinity'] = affinity

                        except (ValueError, IndexError):
                            continue
            
            # Extraer información del log
            if 'Computing Vina grid' in stdout:
                results['log_info']['grid_computed'] = True
            
            if 'Performing search' in stdout:
                results['log_info']['search_performed'] = True
            
            # Si no se encontraron poses en stdout, intentar desde el archivo .log
            if not results['poses']:
                # Filtrar por nombre del experimento actual si está disponible
                if file_mapping:
                    receptor_stem = Path(file_mapping.get('receptor', '')).stem
                    ligand_stem = Path(file_mapping.get('ligand', '')).stem
                    experiment_prefix = f"{receptor_stem}_{ligand_stem}"
                    log_files = [f for f in output_files if f.suffix == '.log' and experiment_prefix in f.name]
                    logger.info(f"Looking for log files with prefix: {experiment_prefix}")
                else:
                    log_files = [f for f in output_files if f.suffix == '.log']
                if log_files:
                    logger.info(f"Parsing results from log file: {log_files[0]}")
                    try:
                        with open(log_files[0], 'r') as f:
                            log_content = f.read()
                            # Parse log file - data lines use whitespace, not pipes
                            log_lines = log_content.split('\n')
                            parsing_results = False
                            for line in log_lines:
                                if 'mode |   affinity | dist from best mode' in line:
                                    parsing_results = True
                                    continue
                                if parsing_results:
                                    # Skip separator lines and empty lines
                                    if line.startswith('-----') or not line.strip():
                                        continue
                                    # Skip header continuation line (units)
                                    if '(kcal/mol)' in line and 'rmsd' in line:
                                        continue
                                    # Data lines are whitespace-separated, not pipe-separated
                                    parts = line.split()
                                    if len(parts) >= 4:  # mode, affinity, rmsd_lb, rmsd_ub
                                        try:
                                            mode = int(parts[0])
                                            affinity = float(parts[1])
                                            rmsd_lb = float(parts[2])
                                            rmsd_ub = float(parts[3])
                                            pose = {
                                                'pose': mode,
                                                'affinity': affinity,
                                                'rmsd_lb': rmsd_lb,
                                                'rmsd_ub': rmsd_ub
                                            }
                                            results['poses'].append(pose)
                                            if mode == 1:
                                                results['binding_affinity'] = affinity
                                            logger.debug(f"Parsed pose {mode}: {affinity} kcal/mol")
                                        except (ValueError, IndexError) as e:
                                            logger.debug(f"Could not parse line as pose data: {line}")
                                            continue
                    except Exception as e:
                        logger.error(f"Error reading log file: {e}")

            # Si aún no hay poses, intentar desde archivos PDBQT
            if not results['poses']:
                pdbqt_files = [f for f in output_files if f.suffix == '.pdbqt']
                if pdbqt_files:
                    results['poses'] = self.parse_pdbqt_output(pdbqt_files[0])
                    if results['poses']:
                        results['binding_affinity'] = results['poses'][0]['affinity']
            
            # Cargar estructuras para visualización 3D
            self.load_structure_files(results, file_mapping)
            
        except Exception as e:
            logger.error(f"Error parseando resultados: {e}")
            results['parse_error'] = str(e)
        
        return results
    
    def parse_pdbqt_output(self, pdbqt_file: Path) -> List[Dict]:
        """
        Parsear archivo PDBQT de salida para extraer poses
        
        Args:
            pdbqt_file: Archivo PDBQT de salida
            
        Returns:
            List[Dict]: Lista de poses
        """
        poses = []
        
        try:
            with open(pdbqt_file, 'r') as f:
                content = f.read()
                
            current_pose = None
            for line in content.split('\n'):
                if line.startswith('MODEL'):
                    pose_num = int(line.split()[1])
                    current_pose = {'pose': pose_num, 'affinity': 0.0, 'rmsd_lb': 0.0, 'rmsd_ub': 0.0}
                
                elif line.startswith('REMARK VINA RESULT:'):
                    if current_pose:
                        parts = line.split()
                        if len(parts) >= 4:
                            current_pose['affinity'] = float(parts[3])
                        if len(parts) >= 6:
                            current_pose['rmsd_lb'] = float(parts[4])
                            current_pose['rmsd_ub'] = float(parts[5])
                
                elif line.startswith('ENDMDL'):
                    if current_pose:
                        poses.append(current_pose)
                        current_pose = None
        
        except Exception as e:
            logger.error(f"Error parseando PDBQT: {e}")
        
        return poses
    
    def parse_log_file_results(self, log_content: str) -> Dict:
        """
        Parsear resultados de Vina desde archivo de log
        
        Args:
            log_content: Contenido del archivo de log
            
        Returns:
            Dict: Resultados parseados del log
        """
        results = {
            'binding_affinity': None,
            'poses': [],
            'log_info': {}
        }
        
        try:
            lines = log_content.split('\n')
            parsing_results = False
            
            for line in lines:
                # Buscar tabla de resultados
                if 'mode |   affinity | dist from best mode' in line:
                    parsing_results = True
                    continue

                if parsing_results:
                    # Skip separator line and empty lines
                    if line.startswith('-----') or not line.strip():
                        continue

                    # Skip header continuation line (units)
                    if '(kcal/mol)' in line and 'rmsd' in line:
                        continue

                    # Parsear línea de resultado (datos separados por espacios, no pipes)
                    parts = line.split()
                    if len(parts) >= 4:
                        try:
                            mode = int(parts[0])
                            affinity = float(parts[1])
                            rmsd_lb = float(parts[2])
                            rmsd_ub = float(parts[3])

                            pose = {
                                'pose': mode,
                                'affinity': affinity,
                                'rmsd_lb': rmsd_lb,
                                'rmsd_ub': rmsd_ub
                            }

                            results['poses'].append(pose)

                            # La primera pose es la mejor
                            if mode == 1:
                                results['binding_affinity'] = affinity

                        except (ValueError, IndexError):
                            continue
            
            # Extraer información adicional del log
            if 'Computing Vina grid' in log_content:
                results['log_info']['grid_computed'] = True
            
            if 'Performing docking' in log_content:
                results['log_info']['docking_performed'] = True
                
            # Extraer configuración utilizada
            config_info = {}
            for line in lines:
                if line.startswith('Rigid receptor:'):
                    config_info['receptor'] = line.split(':', 1)[1].strip()
                elif line.startswith('Ligand:'):
                    config_info['ligand'] = line.split(':', 1)[1].strip()
                elif line.startswith('Grid center:'):
                    config_info['grid_center'] = line.split(':', 1)[1].strip()
                elif line.startswith('Grid size'):
                    config_info['grid_size'] = line.split(':', 1)[1].strip()
                elif line.startswith('Exhaustiveness:'):
                    config_info['exhaustiveness'] = line.split(':', 1)[1].strip()
                elif line.startswith('CPU:'):
                    config_info['cpu'] = line.split(':', 1)[1].strip()
            
            if config_info:
                results['log_info']['config'] = config_info
                
        except Exception as e:
            logger.error(f"Error parseando log file: {e}")
            results['parse_error'] = str(e)
        
        return results
    
    def get_output_files(self) -> List[Dict]:
        """
        Obtener lista de archivos de salida con información
        
        Returns:
            List[Dict]: Lista de archivos con metadata
        """
        files = []
        
        try:
            for file_path in self.output_dir.iterdir():
                if file_path.is_file():
                    file_info = {
                        'name': file_path.name,
                        'path': str(file_path),
                        'size': file_path.stat().st_size,
                        'modified': file_path.stat().st_mtime,
                        'extension': file_path.suffix
                    }
                    files.append(file_info)
        
        except Exception as e:
            logger.error(f"Error obteniendo archivos de salida: {e}")
        
        return files
    
    def cleanup_files(self, keep_latest: int = 5) -> bool:
        """
        Limpiar archivos antiguos de input/output
        
        Args:
            keep_latest: Número de archivos más recientes a mantener
            
        Returns:
            bool: True si la limpieza fue exitosa
        """
        try:
            for directory in [self.input_dir, self.output_dir]:
                files = sorted(directory.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True)
                
                # Mantener solo los archivos más recientes
                for file_path in files[keep_latest:]:
                    if file_path.is_file():
                        file_path.unlink()
                        logger.info(f"Archivo eliminado: {file_path}")
            
            return True
            
        except Exception as e:
            logger.error(f"Error en limpieza: {e}")
            return False
    
    def _execute_with_fallback(self, original_cmd: List[str], config: Dict, receptor_file: str, ligand_file: str) -> Dict:
        """
        Ejecuta el comando Docker con sistema de fallback para configuraciones alternativas
        
        Args:
            original_cmd: Comando original a ejecutar
            config: Configuración original
            receptor_file: Nombre del archivo receptor
            ligand_file: Nombre del archivo ligando
            
        Returns:
            Dict: Resultado de la ejecución con información de fallback
        """
        # Ejecutar docking directamente sin fallbacks
        try:
            logger.info("=== DIAGNÓSTICO PRE-EJECUCIÓN ===")
            logger.info(f"Comando a ejecutar: {' '.join(original_cmd)}")
            logger.info("Montajes de volúmenes Docker:")
            logger.info(f"  - Host input: {self.input_dir} -> Container: /input")
            logger.info(f"  - Host output: {self.output_dir} -> Container: /output")
            logger.info(f"Directorio de trabajo: {self.base_dir}")
            logger.info(f"Directorio input: {self.input_dir}")
            logger.info(f"Directorio output: {self.output_dir}")
            
            # Verificar que los directorios existen
            logger.info(f"Input existe: {self.input_dir.exists()}")
            logger.info(f"Output existe: {self.output_dir.exists()}")
            
            # Listar archivos en input justo antes de la ejecución
            if self.input_dir.exists():
                input_files = list(self.input_dir.glob("*"))
                logger.info("Archivos en input antes de ejecución:")
                for file in input_files:
                    logger.info(f"  - {file.name} (tamaño: {file.stat().st_size} bytes)")
            
            # Verificar permisos de Docker en los directorios
            logger.info("=== VERIFICACIÓN DOCKER ===")
            try:
                # Test básico de Docker
                docker_test = subprocess.run(
                    ["docker", "run", "--rm", "hello-world"],
                    capture_output=True,
                    text=True,
                    timeout=30
                )
                if docker_test.returncode == 0:
                    logger.info("✓ Docker funciona correctamente")
                else:
                    logger.warning(f"⚠ Docker test falló: {docker_test.stderr}")
            except Exception as e:
                logger.error(f"✗ Error probando Docker: {e}")
            
            logger.info("=== EJECUTANDO DOCKING ===")
            
            # Ejecutar comando directamente
            result = subprocess.run(
                original_cmd,
                capture_output=True,
                text=True,
                timeout=1800,  # 30 minutos timeout
                cwd=self.base_dir
            )

            if result.returncode == 0:
                logger.info("Docking ejecutado exitosamente")
                return {
                    'success': True,
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                    'config_used': config,
                    'final_command': ' '.join(original_cmd)
                }
            else:
                error_msg = result.stderr
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

                    # Update config to skip preprocessing
                    fallback_config = config.copy()
                    fallback_config['no_preprocessing'] = True

                    # Build new command with --no-preprocessing
                    fallback_cmd = self.build_vina_command(receptor_file, ligand_file, fallback_config)

                    logger.info(f"🔄 Retry command: {' '.join(fallback_cmd)}")

                    # Execute fallback command
                    fallback_result = subprocess.run(
                        fallback_cmd,
                        capture_output=True,
                        text=True,
                        timeout=1800,  # 30 minutos timeout
                        cwd=self.base_dir
                    )

                    if fallback_result.returncode == 0:
                        logger.info("✅ Docking succeeded with --no-preprocessing")
                        return {
                            'success': True,
                            'stdout': fallback_result.stdout,
                            'stderr': fallback_result.stderr,
                            'config_used': fallback_config,
                            'final_command': ' '.join(fallback_cmd),
                            'fallback_used': True,
                            'fallback_reason': 'Preprocessing failed, retried without preprocessing'
                        }
                    else:
                        logger.error(f"❌ Fallback also failed: {fallback_result.stderr}")
                        error_msg = fallback_result.stderr

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
                    'stdout': result.stdout,
                    'stderr': result.stderr,
                }
                    
        except subprocess.TimeoutExpired:
            logger.error("Timeout en docking")
            return {
                'success': False,
                'error': "Timeout: El proceso de docking tardó más de 10 minutos",
            }
            
        except Exception as e:
            logger.error(f"Error inesperado en docking: {e}")
            return {
                'success': False,
                'error': f"Error inesperado: {str(e)}",
            }
    
    def load_structure_files(self, results: Dict, file_mapping: Dict = None) -> None:
        """
        Cargar archivos de estructura para visualización 3D
        
        Args:
            results: Diccionario de resultados para actualizar
            file_mapping: Mapeo de archivos con nombres originales
        """
        try:
            if file_mapping:
                # Usar nombres originales de archivos
                receptor_filename = file_mapping.get('receptor')
                ligand_filename = file_mapping.get('ligand')
                
                # Cargar estructura del receptor desde input
                if receptor_filename:
                    receptor_file = self.input_dir / receptor_filename
                    if receptor_file.exists():
                        with open(receptor_file, 'r') as f:
                            results['receptor_structure'] = f.read()
                        logger.info(f"Estructura del receptor cargada: {receptor_file}")
                
                # Cargar estructura del ligando original desde input  
                if ligand_filename:
                    ligand_input_file = self.input_dir / ligand_filename
                    if ligand_input_file.exists():
                        with open(ligand_input_file, 'r') as f:
                            results['ligand_input_structure'] = f.read()
                        logger.info(f"Estructura del ligando original cargada: {ligand_input_file}")
            else:
                # Fallback a nombres fijos si no hay file_mapping
                receptor_file = self.input_dir / "receptor.pdb"
                if receptor_file.exists():
                    with open(receptor_file, 'r') as f:
                        results['receptor_structure'] = f.read()
                    logger.info(f"Estructura del receptor cargada: {receptor_file}")
                
                ligand_input_file = self.input_dir / "ligand.sdf"
                if ligand_input_file.exists():
                    with open(ligand_input_file, 'r') as f:
                        results['ligand_input_structure'] = f.read()
                    logger.info(f"Estructura del ligando original cargada: {ligand_input_file}")
            
            # Cargar resultado del docking (ligando con poses) desde output
            # Buscar archivos con patrón {pdb_id}_{drug}_out.pdbqt
            ligand_output_files = list(self.output_dir.glob("*_out.pdbqt"))
            if not ligand_output_files:
                # Fallback: buscar ligand_out.pdbqt o cualquier archivo con ligand
                ligand_output_files = list(self.output_dir.glob("ligand_out.pdbqt"))
                if not ligand_output_files:
                    ligand_output_files = list(self.output_dir.glob("*ligand*.pdbqt"))
            
            if ligand_output_files:
                with open(ligand_output_files[0], 'r') as f:
                    results['ligand_docked_structure'] = f.read()
                logger.info(f"Resultado del docking cargado: {ligand_output_files[0]}")
            
            # Cargar archivos de log si existen (buscar específicamente archivos vina.log)
            log_files = list(self.output_dir.glob("*_vina.log"))
            if not log_files:
                # Fallback: cualquier archivo .log
                log_files = list(self.output_dir.glob("*.log"))
            
            if log_files:
                with open(log_files[0], 'r') as f:
                    log_content = f.read()
                    results['docking_log'] = log_content
                    # Parse log file for results (prioritize log file over stdout)
                    if log_content:
                        log_results = self.parse_log_file_results(log_content)
                        # Update results with log file data, overwriting any previous values
                        if log_results.get('binding_affinity') is not None:
                            results['binding_affinity'] = log_results['binding_affinity']
                        if log_results.get('poses'):
                            results['poses'] = log_results['poses']
                        if log_results.get('log_info'):
                            results['log_info'].update(log_results['log_info'])
                logger.info(f"Log del docking cargado: {log_files[0]}")
            else:
                logger.warning("No se encontraron archivos de log de Vina")
            
            # Listar todos los archivos de output disponibles
            output_files = list(self.output_dir.glob("*"))
            results['output_file_list'] = [
                {
                    'name': f.name,
                    'path': str(f),
                    'size': f.stat().st_size,
                    'type': f.suffix
                }
                for f in output_files if f.is_file()
            ]
            
        except Exception as e:
            logger.error(f"Error cargando archivos de estructura: {e}")
            results['structure_load_error'] = str(e)
    
    def validate_box_config(self, config):
        """Validate box configuration before running docking"""
        if config.get('use_box_enveloping'):
            if not all(isinstance(v, (int, float)) for v in config.get('box_size', [])):
                raise ValueError("Invalid box size values")
            if not all(isinstance(v, (int, float)) for v in config.get('box_center', [])):
                raise ValueError("Invalid box center values")
            
            # Set default values if not provided
            if 'padding' not in config:
                config['padding'] = 2.0
            if 'box_size' not in config:
                config['box_size'] = [20.0, 20.0, 20.0]
            if 'box_center' not in config:
                config['box_center'] = [0.0, 0.0, 0.0]

        return config