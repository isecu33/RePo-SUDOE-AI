import os
import json
import re
import pandas as pd
from django.conf import settings
from openai import OpenAI
import requests
from rdkit import Chem
from rdkit.Chem import Draw, Descriptors
from rdkit.Chem.rdMolDescriptors import CalcMolFormula
from difflib import get_close_matches
import subprocess
import time
from django.utils.translation import gettext as _

# Constantes para columnas de bases de datos
DRUG_COLUMNS = {
    'NAME': 'Name',
    'SMILES': 'SMILES', 
    'MOLECULAR_FORMULA': 'Molecular_Formula',
    'MOLECULAR_WEIGHT': 'Molecular_Weight',
    'DESCRIPTION': 'Description',
    'STATUS': 'Status',
    'INDICATIONS': 'Indications'
}

GENE_COLUMNS = {
    'HGNC_SYMBOL': 'hgnc_symbol',
    'GENE_NAME': 'gene_name',
    'PDB': 'pdb',
    'DISEASE_INFO': 'disease_info',
    'FUNCTION_INFO': 'function_info',
    'PATHWAY_INFO': 'pathway_info'
}

class QueryHandler:
    """
    Handler for processing molecular docking and general queries using OpenAI GPT-4.
    Realiza docking molecular entre medicamentos y genes.
    Ported from the original Flask app.py implementation.
    """
    
    def __init__(self, language='es'):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.language = language  # 'es' or 'en'
        # Bases de datos separadas para genes y medicamentos
        self.genes_db_path = os.path.join(os.path.dirname(__file__), '../data/genes/genes_db.xlsx')
        self.drugs_db_path = os.path.join(os.path.dirname(__file__), '../data/drugs/drug_db.xlsx')
        
        # Directorio temporal para descarga y preprocesamiento 
        self.temp_input_dir = os.path.join(os.path.dirname(__file__), '../input')
        os.makedirs(self.temp_input_dir, exist_ok=True)
        
        # Directorio final para archivos procesados
        self.final_input_dir = os.path.join(os.path.dirname(__file__), '../../input') 
        os.makedirs(self.final_input_dir, exist_ok=True)
        
        # Debug logging para verificar rutas
        print(f"[DEBUG] QueryHandler inicializado:")
        print(f"  - Directorio del archivo: {os.path.dirname(__file__)}")
        print(f"  - Temp input dir (core/input): {os.path.abspath(self.temp_input_dir)}")
        print(f"  - Final input dir (input): {os.path.abspath(self.final_input_dir)}")
        print(f"  - Temp dir existe: {os.path.exists(self.temp_input_dir)}")
        print(f"  - Final dir existe: {os.path.exists(self.final_input_dir)}")
    
    def load_genes_database(self):
        """Carga la base de datos de genes"""
        try:
            return pd.read_excel(self.genes_db_path, engine="openpyxl")
        except Exception as e:
            print(f"Error cargando base de datos de genes: {e}")
            return pd.DataFrame()
    
    def load_drugs_database(self):
        """Carga la base de datos de medicamentos"""
        try:
            return pd.read_excel(self.drugs_db_path, engine="openpyxl")
        except Exception as e:
            print(f"Error cargando base de datos de medicamentos: {e}")
            return pd.DataFrame()
        
    def process_query(self, user_query, estructura_seleccionada=None, confirmacion=False, manual_mode=None, vina_config=None, user_id=None):
        """Punto de entrada principal para procesar consultas"""
        try:

            intent = self.classify_intent(user_query)

            if intent == "docking":
                return self.handle_docking_flow(user_query, estructura_seleccionada, confirmacion, manual_mode, vina_config, user_id)
            else:
                return self.handle_information_query(user_query)

        except Exception as e:
            # Capturar errores específicos de OpenAI
            error_str = str(e)

            # Error de modelo inválido
            if "invalid model" in error_str.lower() or "model_not_found" in error_str.lower():
                return {
                    "type": "api_error",
                    "error": _("El servicio de IA no está disponible temporalmente. Por favor, contacta al administrador."),
                    "user_message": _("Lo siento, hay un problema de configuración en el sistema. Por favor, inténtalo más tarde o contacta con el soporte técnico."),
                    "technical_details": error_str
                }

            # Error de API key
            if "api key" in error_str.lower() or "authentication" in error_str.lower():
                return {
                    "type": "api_error",
                    "error": _("Error de autenticación con el servicio de IA."),
                    "user_message": _("Lo siento, hay un problema de configuración. Por favor, contacta al administrador."),
                    "technical_details": error_str
                }

            # Error de rate limit
            if "rate limit" in error_str.lower() or "quota" in error_str.lower():
                return {
                    "type": "api_error",
                    "error": _("Se ha excedido el límite de consultas. Intenta de nuevo en unos minutos."),
                    "user_message": _("El sistema está recibiendo muchas consultas. Por favor, espera un momento e inténtalo de nuevo."),
                    "technical_details": error_str
                }

            # Error de timeout
            if "timeout" in error_str.lower():
                return {
                    "type": "api_error",
                    "error": _("La consulta tardó demasiado tiempo. Intenta de nuevo."),
                    "user_message": _("La consulta está tardando más de lo normal. Por favor, inténtalo de nuevo."),
                    "technical_details": error_str
                }

            # Error genérico
            return {
                "type": "processing_error",
                "error": _("Error procesando tu consulta. Por favor, inténtalo de nuevo."),
                "user_message": _("Lo siento, ha ocurrido un error al procesar tu consulta. Por favor, inténtalo de nuevo o reformula tu pregunta."),
                "technical_details": error_str
            }
    
    def classify_intent(self, user_query):
        """Clasificar si es docking o consulta informativa"""
        if self.language == 'en':
            system_prompt = """
            Analyze the user's query and classify whether they want to:
            - "docking": Perform a molecular docking experiment (use words like "experiment", "docking", "simulate", "analyze interaction")
            - "information": Get information about genes, proteins, diseases, database statistics

            Answer ONLY: "docking" or "information"
            """
        else:
            system_prompt = """
            Analiza la consulta del usuario y clasifica si quiere:
            - "docking": Realizar un experimento de docking molecular (usar palabras como "experimento", "docking", "simular", "analizar interacción")
            - "information": Obtener información sobre genes, proteínas, enfermedades, estadísticas de la base de datos

            Responde SOLO: "docking" o "information"
            """
        
        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            temperature=0
        )
        
        return response.choices[0].message.content.strip().lower()
    
    
    
    
    
    def handle_information_query(self, user_query):
        """Maneja consultas informativas usando ambas bases de datos y OpenAI"""
        try:
            # Cargar ambas bases de datos
            genes_df = self.load_genes_database()
            drugs_df = self.load_drugs_database()
            
            # Preparar contexto combinado para OpenAI
            context = self.prepare_combined_database_context(genes_df, drugs_df, user_query)
            
            if self.language == 'en':
                system_prompt = f"""
                You are an expert in molecular biology. You have access to a database with information about genes, proteins, and drugs.

                Database information:
                {context}

                Answer the user's query in a natural and educational way, using the provided data.
                If the question is about general statistics (like total number of proteins), calculate the answer based on the data.

                IMPORTANT: You MUST respond ONLY in ENGLISH. Do not use Spanish or any other language.
                """
            else:
                system_prompt = f"""
                Eres un experto en biología molecular. Tienes acceso a una base de datos con información sobre genes, proteínas y medicamentos.

                Información de la base de datos:
                {context}

                Responde la consulta del usuario de manera natural y educativa, usando los datos proporcionados.
                Si la pregunta es sobre estadísticas generales (como número total de proteínas), calcula la respuesta basándote en los datos.

                IMPORTANTE: Debes responder SOLO en ESPAÑOL. No uses inglés ni ningún otro idioma.
                """
            
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
            
        except Exception as e:
            return {"error": f"Error procesando consulta informativa: {str(e)}"}
    
    
    def handle_docking_flow(self, user_query, estructura_seleccionada=None, confirmacion=False, manual_mode=None, vina_config=None, user_id=None):
        """Maneja el flujo completo de docking molecular"""
        
        # Paso 1: Extraer parámetros
        params = self.extract_docking_params(user_query)
        drug = params.get('drug') 
        gene = params.get('gene') 
        
        if not drug or not gene:
            return {"error": "No se pudo identificar el medicamento y/o el gen en tu consulta"}
        
        # Paso 2: Validar existencia en base de datos ANTES de pedir confirmación
        validation_result = self.validate_drug_and_gene(drug, gene)
        if not validation_result['valid']:
            return {
                "type": "validation_error",
                "error": validation_result['error'],
                "suggestions": validation_result.get('suggestions', []),
                "drug": drug,
                "gene": gene
            }
        
        # Paso 3: Pedir confirmación inicial
        if not confirmacion:
            return {
                "type": "confirmation",
                "message": _("¿Quieres lanzar un experimento de docking molecular entre %(drug)s y %(gene)s?") % {'drug': drug, 'gene': gene},
                "drug": drug,
                "gene": gene
            }
        
        # Paso 3: Buscar estructuras disponibles
        estructuras = self.find_gene_structures(gene)
        if not estructuras:
            return {"error": f"No se encontraron estructuras para el gen {gene}"}
        
        # Paso 4: Selección de estructura
        if not estructura_seleccionada:
            if len(estructuras) == 1:
                estructura_seleccionada = estructuras[0]['id']
            else:
                return {
                    "type": "structure_selection",
                    "message": _("Se encontraron múltiples estructuras para %(gene)s:") % {'gene': gene},
                    "options": estructuras,
                    "drug": drug,
                    "gene": gene
                }
        
        # Paso 5: Preparar archivos
        selected_structure = next((s for s in estructuras if s['id'] == estructura_seleccionada), None)
        if not selected_structure:
            return {"error": "Estructura seleccionada no válida"}
        
        # Descargar PDB y crear SDF
        try:
            print(f"Descargando PDB para estructura: {selected_structure['id']}")
            pdb_path = self.download_pdb_file(selected_structure['id'])
            print(f"Resultado descarga PDB: {pdb_path}")

            print(f"Creando SDF para medicamento: {drug}")
            sdf_result = self.create_sdf_file(drug)
            print(f"Resultado creación SDF: {sdf_result}")

            # Verificar si create_sdf_file retornó un error
            if isinstance(sdf_result, dict) and 'error' in sdf_result:
                return {
                    "type": "sdf_generation_error",
                    "error": sdf_result.get('user_message', sdf_result['error']),
                    "user_message": sdf_result.get('user_message'),
                    "technical_details": sdf_result.get('error'),
                    "drug": drug,
                    "gene": gene
                }

            sdf_path = sdf_result

            if not pdb_path:
                return {
                    "type": "file_preparation_error",
                    "error": f"Error descargando archivo PDB para {selected_structure['id']}",
                    "user_message": _("No se pudo descargar la estructura 3D de la proteína. Por favor, inténtalo de nuevo más tarde.")
                }
            if not sdf_path:
                return {
                    "type": "file_preparation_error",
                    "error": f"Error creando archivo SDF para {drug}",
                    "user_message": _("No se pudo procesar la estructura del medicamento. Por favor, inténtalo de nuevo.")
                }

        except Exception as e:
            print(f"Excepción en preparación de archivos: {e}")
            return {
                "type": "file_preparation_error",
                "error": f"Error preparando archivos: {str(e)}",
                "user_message": _("Ocurrió un error al preparar los archivos necesarios para el docking. Por favor, inténtalo de nuevo.")
            }

        # Paso 5.5: Generar análisis predictivo del experimento
        print(f"[Análisis] Generando análisis predictivo del experimento {drug} - {gene}...")
        try:
            predictive_analysis = self.generate_experiment_analysis(drug, gene, selected_structure['id'])
            print(f"[Análisis] Análisis generado exitosamente")
        except Exception as analysis_error:
            print(f"[Análisis] Error generando análisis: {analysis_error}")
            # Si falla, usar análisis por defecto
            predictive_analysis = {
                "summary": "Análisis no disponible en este momento.",
                "expected_interaction": "No determinado",
                "scientific_context": ""
            }

        # Paso 6: Preguntar modo de ejecución
        if manual_mode is None:
            return {
                "type": "mode_selection",
                "message": _("Archivos preparados. ¿Cómo quieres proceder?"),
                "drug": drug,
                "gene": gene,
                "structure": selected_structure['id'],
                "files_ready": True,
                "pdb_path": pdb_path,
                "sdf_path": sdf_path,
                "experiment_analysis": predictive_analysis  # NUEVO: Incluir análisis
            }

        # Paso 7: Ejecutar o preparar para descarga
        if manual_mode:
            return {
                "type": "manual_download",
                "message": _("Archivos listos para descarga manual:"),
                "files": {
                    "gene": pdb_path,
                    "drug": sdf_path
                },
                "instructions": _("Descarga los archivos y configura AutoDock Vina manualmente"),
                "experiment_analysis": predictive_analysis  # NUEVO: Incluir análisis también en modo manual
            }
        else:
            # Lanzar experimento automático con configuración personalizada
            result = self.run_autodock_vina(pdb_path, sdf_path, custom_config=vina_config, user_id=user_id)
            
            # Obtener información adicional del Excel
            info = self.get_compound_info(gene, drug)
            
            # Actualizar carpeta 3D_viewer después del docking exitoso
            if result.get('binding_affinity') and not result.get('error'):
                try:
                    print(f"[Visualizer] Preparando archivos para 3D viewer...")
                    from .visualizer_file_manager import prepare_latest_experiment
                    visualizer_result = prepare_latest_experiment()
                    
                    if visualizer_result.get('success'):
                        print(f"[Visualizer] ✓ Archivos preparados para visualización: {visualizer_result['experiment_key']}")
                        response_files = visualizer_result.get('files', {})
                        if response_files:
                            result['visualization_files_prepared'] = True
                            result['visualizer_files'] = response_files
                    else:
                        print(f"[Visualizer] ⚠ Error preparando visualización: {visualizer_result.get('error', 'Error desconocido')}")
                        
                except Exception as visualizer_error:
                    print(f"[Visualizer] Error actualizando carpeta 3D_viewer: {visualizer_error}")
                    import traceback
                    print(f"[Visualizer] Traceback: {traceback.format_exc()}")
            
            # Check if docking failed
            if result.get('error') or result.get('success') == False:
                response = {
                    "type": "docking_error",
                    "error": result.get('error', 'Unknown error occurred during docking'),
                    "docking_results": result,
                    "compound_info": info,
                    "gene": gene,
                    "drug": drug,
                    "structure": selected_structure['id']
                }

                # Add configuration info
                if vina_config:
                    response["vina_config_used"] = vina_config

                if 'config_used' in result:
                    response["vina_config_final"] = result['config_used']

                return response

            # Incluir información de configuración en la respuesta (success case)
            # Add actual binding affinity from docking results to experiment_analysis
            binding_affinity = result.get('binding_affinity')
            if binding_affinity is not None:
                predictive_analysis['binding_affinity'] = binding_affinity

            response = {
                "type": "docking_complete",
                "docking_results": result,
                "compound_info": info,
                "gene": gene,
                "drug": drug,
                "structure": selected_structure['id'],
                "experiment_analysis": predictive_analysis  # NUEVO: Incluir análisis en resultados
            }

            # Añadir información de la configuración utilizada si está disponible
            if vina_config:
                response["vina_config_used"] = vina_config

            if 'config_used' in result:
                response["vina_config_final"] = result['config_used']

            return response
        
        
        
    def extract_docking_params(self, user_query):
        """Extrae parámetros de docking (medicamento y gen) usando OpenAI"""
        if self.language == 'en':
            system_prompt = """
                You are an expert in molecular docking. Extract from the user's message:
                1. The name of the drug/medication as "drug".
                2. The name of the gene as "gene".
                3. If the user mentions a specific PDB structure, include it as a string in "estructura".
                If no structure is specified, use "estructura": null.

                Respond with a JSON in this exact format:
                {
                "drug": "drug name",
                "gene": "gene name",
                "estructura": "PDB code or null"
                }

                Only the JSON, no explanatory text.
                """
        else:
            system_prompt = """
                Eres un experto en docking molecular. Extrae del mensaje del usuario:
                1. El nombre del medicamento/fármaco como "drug".
                2. El nombre del gen como "gene".
                3. Si el usuario menciona alguna estructura PDB concreta, inclúyela como string en "estructura".
                Si no se especifica ninguna estructura, usa "estructura": null.

                Responde con un JSON en este formato exacto:
                {
                "drug": "nombre del medicamento",
                "gene": "nombre del gen",
                "estructura": "código PDB o null"
                }

                Solo el JSON, sin texto explicativo.
                """

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_query}
            ],
            temperature=0.3
        )

        content = response.choices[0].message.content.strip()
        json_match = re.search(r'\{[\s\S]*\}', content)
        if not json_match:
            raise ValueError(f"La respuesta de OpenAI no contiene JSON válido: {content}")

        return json.loads(json_match.group())
    
    def find_gene_structures(self, gene_name):
        """Busca estructuras PDB para un gen usando la base de datos de genes"""
        gene_matches = self.find_gene_matches(gene_name)
        
        if gene_matches.empty:
            return []
        
        primera = gene_matches.iloc[0]
        estructuras = []
        
        if pd.notna(primera.get('pdb')):
            pdbs = [p.strip() for p in str(primera['pdb']).split(';') if p.strip()]
            estructuras.extend([
                {
                    "id": pdb,
                    "type": "experimental",
                    "source": f"https://files.rcsb.org/download/{pdb}.pdb",
                    "description": f"Estructura experimental PDB: {pdb}"
                }
                for pdb in pdbs
            ])
        
        return estructuras
    
    def download_pdb_file(self, pdb_id):
        """
        Descarga archivo PDB, lo preprocesa en core/input y lo mueve a input/
        """
        print(f"[PDB] === INICIO DESCARGA Y PREPROCESAMIENTO {pdb_id} ===")
        
        # Archivo temporal en core/input
        temp_file_path = os.path.join(self.temp_input_dir, f"{pdb_id}.pdb")
        # Archivo final en input/
        final_file_path = os.path.join(self.final_input_dir, f"{pdb_id}.pdb")
        
        # Comprobar si el archivo final ya existe
        if os.path.exists(final_file_path):
            print(f"[PDB] Archivo procesado {pdb_id}.pdb ya existe en {final_file_path}")
            # Verificar que el archivo no esté vacío
            if os.path.getsize(final_file_path) > 0:
                print(f"[PDB] Usando archivo existente: {final_file_path}")
                return final_file_path
            else:
                print(f"[PDB] Archivo existe pero está vacío, re-procesando...")
        
        # PASO 1: Descargar archivo PDB original
        url = f"https://files.rcsb.org/download/{pdb_id}.pdb"
        try:
            print(f"[PDB] Descargando {pdb_id} desde {url}")
            print(f"[PDB] Destino temporal: {temp_file_path}")
            
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Validar contenido PDB antes de guardar
            pdb_content = response.text
            if not self._validate_pdb_content(pdb_content):
                print(f"[PDB] Error: Contenido PDB inválido para {pdb_id}")
                return None
            
            # Guardar archivo PDB original en directorio temporal
            with open(temp_file_path, 'w') as f:
                f.write(pdb_content)

            original_size = len(pdb_content)
            print(f"[PDB] Descarga completada: {original_size} bytes en {temp_file_path}")

            # OPCIÓN A: Dejar que Vina maneje el preprocesamiento internamente
            # El contenedor Docker de Vina tiene pdb4amber y meeko integrados
            # Si el preprocesamiento interno falla, vina_service.py tiene un fallback automático a --no-preprocessing
            print(f"[PDB] Usando archivo PDB sin preprocesamiento externo")
            print(f"[PDB] Vina manejará el preprocesamiento internamente con pdb4amber")

            # PASO 2: Mover archivo directamente al directorio final
            print(f"[PDB] --- MOVIENDO A DIRECTORIO FINAL ---")
            import shutil
            try:
                shutil.move(temp_file_path, final_file_path)
                final_size = os.path.getsize(final_file_path)
                print(f"[PDB] ✓ Archivo movido a {final_file_path}")
                print(f"[PDB] ✓ Tamaño: {final_size} bytes")
                print(f"[PDB] === DESCARGA COMPLETADA ===")
                return final_file_path
            except Exception as move_error:
                print(f"[PDB] Error moviendo archivo: {move_error}")
                return temp_file_path

            # ========== PREPROCESAMIENTO COMENTADO (OPCIÓN A) ==========
            # El siguiente código de preprocesamiento está comentado porque:
            # 1. Vina tiene preprocesamiento interno con pdb4amber que funciona bien
            # 2. Menos preprocesamiento = menos puntos de fallo
            # 3. Ya existe fallback automático a --no-preprocessing en vina_service.py
            #
            # Si necesitas reactivar el preprocesamiento, descomenta las siguientes líneas:
            """
            # PASO 2: Preprocesar archivo PDB con obabel CLI
            print(f"[PDB] --- INICIANDO PREPROCESAMIENTO ---")
            processed_file = self._preprocess_pdb_with_obabel_cli(temp_file_path, pdb_id)

            if processed_file:
                print(f"[PDB] ✓ Preprocesamiento obabel exitoso")

                # PASO 3: Aplicar correcciones adicionales
                print(f"[PDB] --- APLICANDO CORRECCIONES ADICIONALES ---")
                final_processed = self._apply_secondary_pdb_fixes(processed_file, pdb_id)

                if final_processed:
                    print(f"[PDB] ✓ Correcciones adicionales aplicadas")

                    # PASO 3.5: Renumerar residuos para eliminar huecos (fix interrupted residues)
                    print(f"[PDB] --- RENUMERANDO RESIDUOS ---")
                    renumbered = self._renumber_pdb_residues(temp_file_path, pdb_id)
                    if renumbered:
                        print(f"[PDB] ✓ Residuos renumerados correctamente")
                    else:
                        print(f"[PDB] ⚠ No se pudieron renumerar residuos, continuando...")

                    # PASO 4: Mover archivo procesado al directorio final
                    print(f"[PDB] --- MOVIENDO A DIRECTORIO FINAL ---")
                    import shutil
                    try:
                        shutil.move(temp_file_path, final_file_path)
                        final_size = os.path.getsize(final_file_path)
                        print(f"[PDB] ✓ Archivo movido a {final_file_path}")
                        print(f"[PDB] ✓ Tamaño final: {final_size} bytes")
                        print(f"[PDB] === PREPROCESAMIENTO COMPLETADO ===")
                        return final_file_path
                    except Exception as move_error:
                        print(f"[PDB] Error moviendo archivo: {move_error}")
                        return temp_file_path
                else:
                    print(f"[PDB] ⚠ Fallo correcciones adicionales, usando resultado obabel")
                    try:
                        import shutil
                        shutil.move(temp_file_path, final_file_path)
                        return final_file_path
                    except:
                        return temp_file_path
            else:
                print(f"[PDB] ⚠ Fallo preprocesamiento obabel")
                print(f"[PDB] --- INTENTANDO CORRECCIONES BÁSICAS ---")
                basic_fixed = self._apply_secondary_pdb_fixes(temp_file_path, pdb_id)

                if basic_fixed:
                    print(f"[PDB] ✓ Correcciones básicas aplicadas")
                    try:
                        import shutil
                        shutil.move(temp_file_path, final_file_path)
                        return final_file_path
                    except:
                        return temp_file_path
                else:
                    print(f"[PDB] ⚠ Usando archivo original sin modificaciones")
                    try:
                        import shutil
                        shutil.move(temp_file_path, final_file_path)
                        return final_file_path
                    except:
                        return temp_file_path
            """
                        
        except Exception as e:
            print(f"[PDB] ❌ Error durante descarga/procesamiento: {e}")
            import traceback
            print(f"[PDB] Traceback: {traceback.format_exc()}")
            return None
    
    def _validate_pdb_content(self, pdb_content):
        """Valida que el contenido PDB sea válido"""
        try:
            if not pdb_content or len(pdb_content.strip()) == 0:
                print("Error: PDB vacío o nulo")
                return False
            
            # Verificar que no sea una página de error HTML
            if pdb_content.strip().startswith('<'):
                print("Error: El contenido parece ser HTML, no un archivo PDB")
                return False
            
            # Verificar que contenga líneas ATOM o HETATM
            lines = pdb_content.split('\n')
            has_atoms = any(line.startswith(('ATOM', 'HETATM')) for line in lines)
            
            if not has_atoms:
                print("Advertencia: PDB no contiene líneas ATOM/HETATM")
                # No rechazar automáticamente, podría tener solo HEADER o estructuras alternativas
                # Verificar si al menos tiene contenido PDB válido
                has_pdb_lines = any(line.startswith(('HEADER', 'TITLE', 'COMPND', 'SOURCE', 'REMARK', 'ATOM', 'HETATM', 'CONECT', 'END')) for line in lines)
                if not has_pdb_lines:
                    print("Error: No se encontró contenido PDB válido")
                    return False
                else:
                    print("Advertencia: PDB sin átomos pero con contenido válido")
            
            # Verificar estructura básica (más permisivo)
            has_header = any(line.startswith('HEADER') for line in lines[:20])  # Buscar en más líneas
            has_end = any(line.startswith('END') for line in lines[-20:])      # Buscar en más líneas
            
            print(f"Validación PDB: ATOMS={has_atoms}, HEADER={has_header}, END={has_end}")
            print(f"Total líneas: {len(lines)}, Primeras líneas: {[l[:10] for l in lines[:3] if l.strip()]}")
            
            return True  # Aceptar si llegamos hasta aquí
            
        except Exception as e:
            print(f"Error validando PDB: {e}")
            return False
    
    def _clean_pdb_content(self, pdb_content, pdb_id):
        """Limpieza del contenido PDB para evitar errores en Vina"""
        try:
            lines = pdb_content.split('\n')
            cleaned_lines = []
            
            # Solo mantener el primer modelo si hay múltiples
            model_count = 0
            skip_models = False
            atom_count = 0
            
            for line in lines:
                # Controlar múltiples modelos
                if line.startswith('MODEL'):
                    model_count += 1
                    if model_count > 1:
                        skip_models = True
                        break
                elif line.startswith('ENDMDL'):
                    if model_count == 1:
                        cleaned_lines.append(line)
                        break
                
                # Omitir líneas que causan problemas
                if line.startswith(('ANISOU', 'SIGUIJ')):
                    continue  # Estas líneas causan problemas en pdb4amber
                
                # Limpiar líneas ATOM/HETATM problemáticas
                if line.startswith(('ATOM', 'HETATM')):
                    cleaned_line = self._clean_pdb_atom_line(line)
                    if cleaned_line:
                        cleaned_lines.append(cleaned_line)
                        atom_count += 1
                else:
                    # Mantener todas las demás líneas
                    cleaned_lines.append(line)
            
            result = '\n'.join(cleaned_lines)
            print(f"PDB procesado: {len(lines)} -> {len(cleaned_lines)} líneas, {atom_count} átomos válidos")
            return result
            
        except Exception as e:
            print(f"Error procesando PDB: {e}, usando contenido original")
            return pdb_content  # Devolver original si falla
    
    def _clean_pdb_atom_line(self, line):
        """Limpia líneas ATOM/HETATM para evitar problemas de valencia"""
        try:
            if len(line) < 78:  # Línea demasiado corta
                return None
            
            # Validar coordenadas
            try:
                x = float(line[30:38].strip())
                y = float(line[38:46].strip()) 
                z = float(line[46:54].strip())
                
                # Coordenadas extremas
                if abs(x) > 999 or abs(y) > 999 or abs(z) > 999:
                    return None
                    
            except ValueError:
                return None
            
            # Validar elemento químico
            element = line[76:78].strip() if len(line) > 77 else ""
            atom_name = line[12:16].strip()
            
            # Filtrar átomos problemáticos que pueden causar errores de valencia
            problematic_atoms = ['X', 'DU', 'LP', 'EP']  # Átomos dummy o ficticios
            if element in problematic_atoms or atom_name in problematic_atoms:
                print(f"Omitiendo átomo problemático: {atom_name} ({element})")
                return None
            
            # Verificar que el átomo tenga un nombre válido
            if not atom_name or not atom_name.replace('+', '').replace('-', '').replace("'", '').isalnum():
                return None
            
            return line
            
        except Exception as e:
            print(f"Error procesando línea de átomo: {e}")
            return None
    
    def _fix_valence_issues(self, mol, compound_name):
        """Corrige problemas de valencia en moléculas"""
        try:
            print(f"Validando valencia para {compound_name}...")
            
            # Método 1: Sanitización básica
            try:
                Chem.SanitizeMol(mol)
                print("✓ Validación molecular exitosa")
                return mol
            except Exception as sanitize_error:
                print(f"⚠ Error en sanitización: {sanitize_error}")
            
            # Método 2: Corregir con RemoveHs/AddHs
            try:
                mol_copy = Chem.Mol(mol)
                mol_copy = Chem.RemoveHs(mol_copy)
                mol_copy = Chem.AddHs(mol_copy, addCoords=True)
                Chem.SanitizeMol(mol_copy)
                print("✓ Molécula corregida con RemoveHs/AddHs")
                return mol_copy
            except Exception as e:
                print(f"⚠ Fallo corrección RemoveHs/AddHs: {e}")
            
            # Método 3: Corrección de valencia específica
            try:
                mol_copy = Chem.Mol(mol)
                
                # Remover hidrógenos explícitos
                mol_copy = Chem.RemoveHs(mol_copy)
                
                # Corregir valencia de átomos problemáticos
                for atom in mol_copy.GetAtoms():
                    # Resetear propiedades que pueden causar problemas
                    atom.SetFormalCharge(0)
                    atom.SetNumRadicalElectrons(0)
                
                # Añadir hidrógenos de nuevo
                mol_copy = Chem.AddHs(mol_copy)
                
                # Intentar sanitizar con configuración más permisiva
                Chem.SanitizeMol(mol_copy, 
                    sanitizeOps=Chem.SANITIZE_ALL ^ Chem.SANITIZE_PROPERTIES)
                
                print("✓ Molécula corregida con reseteo de propiedades")
                return mol_copy
                
            except Exception as e:
                print(f"⚠ Fallo corrección de valencia: {e}")
            
            # Método 4: Reconstruir desde SMILES simplificado
            try:
                # Obtener SMILES canónico sin estereoquímica
                smiles = Chem.MolToSmiles(mol, isomericSmiles=False)
                print(f"Intentando reconstruir desde SMILES simplificado: {smiles}")
                
                new_mol = Chem.MolFromSmiles(smiles)
                if new_mol:
                    new_mol = Chem.AddHs(new_mol)
                    Chem.SanitizeMol(new_mol)
                    print("✓ Molécula reconstruida desde SMILES")
                    return new_mol
                    
            except Exception as e:
                print(f"⚠ Fallo reconstrucción desde SMILES: {e}")
            
            # Método 5: Usar FixAtomBondTypes (si está disponible)
            try:
                from rdkit.Chem import rdMolStandardize
                mol_copy = Chem.Mol(mol)
                mol_copy = rdMolStandardize.Standardize(mol_copy)
                mol_copy = Chem.AddHs(mol_copy)
                Chem.SanitizeMol(mol_copy)
                print("✓ Molécula estandarizada")
                return mol_copy
            except ImportError:
                print("⚠ rdMolStandardize no disponible")
            except Exception as e:
                print(f"⚠ Fallo estandarización: {e}")
            
            print("✗ No se pudo corregir la molécula")
            return None
            
        except Exception as e:
            print(f"Error en corrección de valencia: {e}")
            return None
    
    def create_sdf_file(self, drug_name):
        """Crea archivo SDF desde SMILES usando la base de datos de medicamentos (si no existe ya)"""
        file_path = os.path.join(self.final_input_dir, f"{drug_name}.sdf")
        
        # Comprobar si el archivo ya existe
        if os.path.exists(file_path):
            print(f"Archivo SDF {drug_name}.sdf ya existe en {file_path}")
            # Verificar que el archivo no esté vacío
            if os.path.getsize(file_path) > 0:
                return file_path
            else:
                print(f"Archivo SDF {drug_name}.sdf existe pero está vacío, re-generando...")
        
        try:
            print(f"Generando archivo SDF para {drug_name}")
            
            # Buscar el medicamento en la base de datos de medicamentos
            drug_matches = self.find_drug_matches(drug_name)
            
            if drug_matches.empty:
                print(f"No se encontró {drug_name} en la base de datos de medicamentos")
                return None
            
            # Usar SMILES de la nueva base de datos (columna 'SMILES' con mayúscula)
            smiles = drug_matches.iloc[0]['SMILES']
            if pd.isna(smiles):
                print(f"No hay SMILES disponible para {drug_name}")
                return None
            
            print(f"Usando SMILES: {smiles}")
            
            # Crear molécula desde SMILES
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                print(f"Error creando molécula desde SMILES: {smiles}")
                return None
            
            # AÑADIR HIDRÓGENOS EXPLÍCITOS (soluciona el error de Meeko)
            mol = Chem.AddHs(mol)
            print(f"Hidrógenos explícitos añadidos. Átomos totales: {mol.GetNumAtoms()}")
            
            # Generar coordenadas 3D con mejor configuración
            from rdkit.Chem import AllChem
            
            # Intentar múltiples conformaciones para mejor geometría
            try:
                # Configuración mejorada para coordenadas 3D
                ps = AllChem.ETKDG()
                ps.randomSeed = 42  # Reproducibilidad

                # Usar maxIterations en lugar de maxAttempts (compatible con RDKit moderno)
                try:
                    ps.maxIterations = 1000  # RDKit >= 2020
                except AttributeError:
                    # Fallback para versiones antiguas
                    try:
                        ps.maxAttempts = 1000  # RDKit antiguo
                    except:
                        pass

                try:
                    ps.useSmallRingTorsions = True
                except AttributeError:
                    pass

                embed_result = AllChem.EmbedMolecule(mol, ps)
                if embed_result == -1:
                    print("Advertencia: Falló embed inicial, intentando método alternativo...")
                    # Intentar con parámetros más permisivos
                    try:
                        ps.useRandomCoords = True
                    except AttributeError:
                        pass
                    embed_result = AllChem.EmbedMolecule(mol, ps)

                if embed_result != -1:
                    # Optimización geométrica
                    try:
                        AllChem.UFFOptimizeMolecule(mol, maxIters=1000)
                        print("Optimización UFF completada")
                    except:
                        print("Advertencia: Optimización UFF falló, usando geometría sin optimizar")
                else:
                    print("Error: No se pudieron generar coordenadas 3D")
                    error_msg = f"No se pudo generar la estructura 3D para {drug_name}. El medicamento puede tener una estructura molecular compleja."
                    return {
                        'error_type': 'sdf_generation_failed',
                        'error': error_msg,
                        'user_message': _("No se pudo generar la estructura 3D del medicamento. Esto puede ocurrir con moléculas muy complejas o con metales de coordinación como Cisplatin.")
                    }

            except Exception as geom_error:
                print(f"Error en generación de geometría 3D: {geom_error}")
                error_msg = f"Error generando estructura 3D para {drug_name}: {str(geom_error)}"
                return {
                    'error_type': 'sdf_generation_error',
                    'error': error_msg,
                    'user_message': _("Error al generar la estructura 3D del medicamento. Algunos compuestos (como los que contienen metales) pueden requerir preparación manual.")
                }
            
            # Validar y corregir problemas de valencia
            mol = self._fix_valence_issues(mol, drug_name)
            if mol is None:
                print("Error: No se pudo corregir los problemas de valencia")
                return None
            
            # Guardar con el nombre original del fármaco
            writer = Chem.SDWriter(file_path)
            # Asegurarse de que la molécula tenga propiedades básicas
            mol.SetProp("_Name", drug_name)
            mol.SetProp("SMILES", smiles)
            writer.write(mol)
            writer.close()
            
            print(f"Archivo SDF generado exitosamente en {file_path}")
            return file_path
            
        except Exception as e:
            print(f"Error creando SDF para {drug_name}: {e}")
            return None
    
    def run_autodock_vina(self, receptor_path, drug_path, custom_config=None, user_id=None):
        """
        Ejecuta AutoDock Vina usando Docker (reemplaza implementación mock)

        Args:
            receptor_path: Ruta al archivo PDB del receptor
            drug_path: Ruta al archivo SDF del fármaco
            custom_config: Configuración personalizada (opcional)
            user_id: ID del usuario para guardar resultados en subdirectorio (opcional)

        Returns:
            dict: Resultados del docking
        """
        try:
            # Importar el servicio de Docker Vina
            from core.services.vina_service import DockerVinaService

            # Inicializar servicio
            base_dir = os.path.dirname(self.final_input_dir)
            print(f"[DEBUG] Inicializando DockerVinaService:")
            print(f"  - Input dir QueryHandler: {self.final_input_dir}")
            print(f"  - Base dir para Vina: {base_dir}")
            print(f"  - Receptor path recibido: {receptor_path}")
            print(f"  - Drug path recibido: {drug_path}")
            print(f"  - User ID: {user_id}")

            vina_service = DockerVinaService(base_dir=base_dir, user_id=user_id)
            
            # Configuración por defecto según documentación Docker
            default_config = {
                'use_box_enveloping': True,  # Usar box automático (recomendado)
                'padding': 2.0,              # Valor por defecto según documentación
                'cpu': 2,                    # Valor por defecto según documentación
                'exhaustiveness': 10,        # Valor por defecto según documentación
                'verbosity': 2,              # Valor por defecto según documentación
                'seed': 1367858384,          # Valor por defecto según documentación
                'scoring': 'vina',           # Valor por defecto según documentación
                'no_preprocessing': False,   # False por defecto (usar pdb4amber)
                'vre': False                 # Ejecutar en VRE de d4science
            }
            
            # Aplicar configuración personalizada si se proporciona
            if custom_config:
                default_config.update(custom_config)
            
            # Ejecutar docking
            result = vina_service.run_vina_docking(
                receptor_path=receptor_path,
                drug_path=drug_path,
                config=default_config
            )
            
            if result['success']:
                # Formatear resultado para compatibilidad con el frontend
                formatted_result = {
                    'binding_affinity': result.get('binding_affinity', 0.0),
                    'poses': result.get('poses', []),
                    'execution_time': result.get('execution_time', 0),
                    'config_used': result.get('config_used', {}),
                    'output_files': result.get('output_files', []),
                    'docker_command': result.get('docker_command', ''),
                    'visualization_data': {
                        'pdb_content': self._get_output_pdb_content(result.get('output_files', [])),
                        'binding_site': self._calculate_binding_site_from_results(result)
                    }
                }
                
                return formatted_result
            else:
                # Error en el docking
                return {
                    'error': result.get('error', 'Error desconocido en el docking'),
                    'execution_time': result.get('execution_time', 0),
                    'stdout': result.get('stdout', ''),
                    'stderr': result.get('stderr', '')
                }
                
        except Exception as e:
            # Error inesperado
            return {
                'error': f'Error ejecutando AutoDock Vina: {str(e)}',
                'execution_time': 0
            }
            
    def _get_output_pdb_content(self, output_files):
        """Obtener contenido PDB de los archivos de salida"""
        try:
            pdb_files = [f for f in output_files if f.endswith('.pdb')]
            if pdb_files:
                with open(pdb_files[0], 'r') as f:
                    return f.read()
        except:
            pass
        return "# PDB content not available"
    
    def _calculate_binding_site_from_results(self, result):
        """Calcular sitio de unión desde los resultados"""
        # Implementación básica - se puede mejorar
        return {'x': 0.0, 'y': 0.0, 'z': 0.0}
    
    def get_compound_info(self, drug_name, gene_name):
        """Obtiene información adicional de las bases de datos separadas"""
        info = {"drug_info": {}, "gene_info": {}}
        
        # Información del medicamento desde la base de datos de medicamentos
        drug_matches = self.find_drug_matches(drug_name)
        if not drug_matches.empty:
            drug_data = drug_matches.iloc[0]
            info["drug_info"] = {
                "name": drug_data.get('Name'),
                "molecular_formula": drug_data.get('Molecular_Formula'),
                "molecular_weight": drug_data.get('Molecular_Weight'),
                "smiles": drug_data.get('SMILES'),
                "description": drug_data.get('Description'),
                "status": drug_data.get('Status'),
                "indications": drug_data.get('Indications')
            }
        
        # Información del gen desde la base de datos de genes
        gene_matches = self.find_gene_matches(gene_name)
        if not gene_matches.empty:
            gene_data = gene_matches.iloc[0]
            info["gene_info"] = {
                "gene_name": gene_data.get('gene_name'),
                "hgnc_symbol": gene_data.get('hgnc_symbol'),
                "disease": gene_data.get('disease_info'),
                "pdb_structures": gene_data.get('pdb'),
                "function_info": gene_data.get('function_info'),
                "pathway_info": gene_data.get('pathway_info')
            }
        
        return info
    
    def prepare_combined_database_context(self, genes_df, drugs_df, user_query):
        """Prepara contexto combinado de ambas bases de datos para OpenAI"""
        context = ""
        
        # Información de la base de datos de genes
        if not genes_df.empty:
            context += f"Base de datos de GENES: {len(genes_df)} entradas\n"
            context += f"Columnas de genes: {', '.join(genes_df.columns.tolist())}\n"
            
            # Buscar menciones específicas en genes
            query_lower = user_query.lower()
            for col in ['hgnc_symbol', 'gene_name', 'disease_info']:
                if col in genes_df.columns:
                    matches = genes_df[genes_df[col].astype(str).str.contains(query_lower, case=False, na=False)]
                    if not matches.empty:
                        context += f"\nDatos relevantes de genes en {col}:\n"
                        context += matches.head(3)[['hgnc_symbol', 'gene_name']].to_string(index=False)
                        break
        
        # Información de la base de datos de medicamentos
        if not drugs_df.empty:
            context += f"\n\nBase de datos de MEDICAMENTOS: {len(drugs_df)} entradas\n"
            context += f"Columnas de medicamentos: {', '.join(drugs_df.columns.tolist())}\n"
            
            # Buscar menciones específicas en medicamentos
            for col in ['Name', 'Description', 'Indications']:
                if col in drugs_df.columns:
                    matches = drugs_df[drugs_df[col].astype(str).str.contains(query_lower, case=False, na=False)]
                    if not matches.empty:
                        context += f"\nDatos relevantes de medicamentos en {col}:\n"
                        context += matches.head(3)[['Name', 'Description']].to_string(index=False)
                        break
        
        # Estadísticas generales
        context += f"\n\nEstadísticas generales:\n"
        if not genes_df.empty and 'pdb' in genes_df.columns:
            pdb_available = genes_df['pdb'].notna().sum()
            context += f"Genes con estructuras PDB: {pdb_available}\n"
        
        if not drugs_df.empty and 'SMILES' in drugs_df.columns:
            smiles_available = drugs_df['SMILES'].notna().sum()
            context += f"Medicamentos con estructura SMILES: {smiles_available}\n"
        
        return context
    
    def prepare_database_context(self, df, user_query):
        """Prepara contexto relevante de la base de datos para OpenAI"""
        context = f"Total de entradas en la base de datos: {len(df)}\n"
        context += f"Columnas disponibles: {', '.join(df.columns.tolist())}\n\n"
        
        # Si la consulta menciona algo específico, filtrar datos relevantes
        query_lower = user_query.lower()
        
        # Buscar menciones específicas
        for col in ['hgnc_symbol', 'gene_name', 'uniprot_id']:
            if col in df.columns:
                matches = df[df[col].str.contains(query_lower, case=False, na=False)]
                if not matches.empty:
                    context += f"\nDatos relevantes encontrados en {col}:\n"
                    context += matches.head(5).to_string(index=False)
                    break
        
        # Estadísticas generales
        context += f"\n\nEstadísticas generales:\n"
        if 'disease' in df.columns:
            disease_counts = df['disease'].value_counts().head(5)
            context += f"Enfermedades más comunes: {disease_counts.to_dict()}\n"
        
        if 'pdb' in df.columns:
            pdb_available = df['pdb'].notna().sum()
            context += f"Proteínas con estructuras PDB: {pdb_available}\n"
        
        return context
    
    def validate_drug_and_gene(self, drug_name, gene_name):
        """
        Valida que el medicamento y el gen existan en las bases de datos correspondientes
        
        Args:
            drug_name: Nombre del medicamento/fármaco
            gene_name: Nombre del gen
            
        Returns:
            dict: Resultado de la validación con información detallada
        """
        try:
            validation_result = {
                'valid': False,
                'error': '',
                'suggestions': [],
                'info': {}
            }
            
            # Cargar base de datos de genes al inicio para evitar problemas de scope
            genes_df = self.load_genes_database()
            
            # Validar medicamento usando la base de datos de medicamentos
            drug_matches = self.find_drug_matches(drug_name)
            if drug_matches.empty:
                # Buscar medicamentos similares para sugerencias
                drugs_df = self.load_drugs_database()
                if not drugs_df.empty and 'Name' in drugs_df.columns:
                    similar_drugs = self.find_similar_entries(drugs_df, drug_name, 'Name')
                    validation_result['error'] = _("Drug '{drug_name}' not found in database.").format(drug_name=drug_name)
                    if similar_drugs:
                        validation_result['suggestions'].extend([
                            _("Similar drugs available: {drugs}").format(drugs=', '.join(similar_drugs[:5]))
                        ])
                return validation_result

            # Validar gen usando la base de datos de genes
            gene_matches = self.find_gene_matches(gene_name)
            if gene_matches.empty:
                # Buscar genes similares para sugerencias (genes_df ya está cargado)
                if not genes_df.empty:
                    similar_symbols = self.find_similar_entries(genes_df, gene_name, 'hgnc_symbol') if 'hgnc_symbol' in genes_df.columns else []
                    similar_genes = self.find_similar_entries(genes_df, gene_name, 'gene_name') if 'gene_name' in genes_df.columns else []

                    validation_result['error'] = _("Gene '{gene_name}' not found in database.").format(gene_name=gene_name)
                    suggestions = []
                    if similar_symbols:
                        suggestions.append(_("Similar symbols: {symbols}").format(symbols=', '.join(similar_symbols[:5])))
                    if similar_genes:
                        suggestions.append(_("Similar genes: {genes}").format(genes=', '.join(similar_genes[:5])))

                    if suggestions:
                        validation_result['suggestions'] = suggestions
                    else:
                        # Mostrar algunos genes disponibles
                        available_genes = genes_df['hgnc_symbol'].dropna().head(10).tolist() if 'hgnc_symbol' in genes_df.columns else []
                        validation_result['suggestions'] = [
                            _("Available genes: {genes}").format(genes=', '.join(available_genes))
                        ]

                return validation_result

            # Validar que el gen tenga estructuras PDB
            gene_data = gene_matches.iloc[0]
            pdb_structures = gene_data.get('pdb')

            if pd.isna(pdb_structures) or not str(pdb_structures).strip():
                validation_result['error'] = _("Gene '{gene_name}' has no PDB structures available.").format(gene_name=gene_name)
                # Buscar genes con estructuras PDB (genes_df ya está disponible)
                if not genes_df.empty and 'pdb' in genes_df.columns:
                    genes_with_pdb = genes_df[genes_df['pdb'].notna() & (genes_df['pdb'].str.strip() != '')]
                    if not genes_with_pdb.empty and 'hgnc_symbol' in genes_df.columns:
                        available_with_pdb = genes_with_pdb['hgnc_symbol'].head(5).tolist()
                        validation_result['suggestions'] = [
                            f"Genes con estructuras PDB: {', '.join(available_with_pdb)}"
                        ]
                return validation_result
            
            # Todo válido - preparar información
            drug_data = drug_matches.iloc[0]
            
            validation_result['valid'] = True
            validation_result['info'] = {
                'drug_info': {
                    'name': drug_data.get('Name'),  # Columna 'Name' con mayúscula
                    'molecular_formula': drug_data.get('Molecular_Formula'),  # Nueva columna
                    'molecular_weight': drug_data.get('Molecular_Weight'),  # Nueva columna
                    'smiles': drug_data.get('SMILES'),  # Columna 'SMILES' con mayúscula
                    'description': drug_data.get('Description'),  # Información adicional
                    'status': drug_data.get('Status')  # Estado del medicamento
                },
                'gene_info': {
                    'hgnc_symbol': gene_data.get('hgnc_symbol'),
                    'gene_name': gene_data.get('gene_name'),
                    'disease': gene_data.get('disease_info'),
                    'pdb_count': len([p.strip() for p in str(pdb_structures).split(';') if p.strip()])
                }
            }
            
            return validation_result
            
        except Exception as e:
            import traceback
            return {
                'valid': False,
                'error': f"Error validando datos: {str(e)}",
                'suggestions': ["Verifica que el archivo Excel esté disponible y tenga el formato correcto"],
                'debug_trace': traceback.format_exc()  # Para debug adicional
            }
    
    def find_drug_matches(self, drug_name):
        """Busca coincidencias de medicamento en la base de datos de medicamentos"""
        drugs_df = self.load_drugs_database()
        
        if drugs_df.empty or DRUG_COLUMNS['NAME'] not in drugs_df.columns:
            return pd.DataFrame()
        
        # Búsqueda exacta (case insensitive)
        exact_matches = drugs_df[drugs_df[DRUG_COLUMNS['NAME']].str.lower() == drug_name.lower()]
        if not exact_matches.empty:
            return exact_matches
        
        # Búsqueda parcial
        partial_matches = drugs_df[drugs_df[DRUG_COLUMNS['NAME']].str.contains(drug_name, case=False, na=False)]
        return partial_matches
    
    def find_gene_matches(self, gene_name):
        """Busca coincidencias de gen en la base de datos de genes"""
        genes_df = self.load_genes_database()
        
        if genes_df.empty:
            return pd.DataFrame()
            
        required_columns = [GENE_COLUMNS['HGNC_SYMBOL'], GENE_COLUMNS['GENE_NAME']]
        available_columns = [col for col in required_columns if col in genes_df.columns]
        
        if not available_columns:
            return pd.DataFrame()
        
        matches = pd.DataFrame()
        
        for col in available_columns:
            # Búsqueda exacta
            exact_matches = genes_df[genes_df[col].str.lower() == gene_name.lower()]
            if not exact_matches.empty:
                return exact_matches
            
            # Búsqueda parcial
            partial_matches = genes_df[genes_df[col].str.contains(gene_name, case=False, na=False)]
            if not partial_matches.empty and matches.empty:
                matches = partial_matches
        
        return matches
    
    def find_similar_entries(self, df, search_term, column):
        """Encuentra entradas similares para sugerencias usando fuzzy matching"""
        if column not in df.columns:
            return []

        # Obtener todos los valores válidos de la columna
        all_values = df[column].dropna().astype(str).tolist()

        if not all_values:
            return []

        # Usar difflib para encontrar coincidencias similares
        # get_close_matches devuelve las mejores coincidencias ordenadas por similitud
        close_matches = get_close_matches(
            search_term,
            all_values,
            n=10,  # máximo 10 sugerencias
            cutoff=0.3  # umbral de similitud (0.3 = 30% similar)
        )

        # Buscar también por palabras parciales para casos como acrónimos
        search_words = search_term.lower().split()
        partial_matches = []

        for word in search_words:
            if len(word) >= 3:  # Solo buscar palabras de 3+ caracteres
                for value in all_values:
                    if word.lower() in value.lower() and value not in close_matches:
                        partial_matches.append(value)

        # Combinar resultados, priorizando las coincidencias exactas
        all_suggestions = close_matches + partial_matches[:5]  # Limitar parciales a 5

        # Remover duplicados manteniendo el orden
        seen = set()
        unique_suggestions = []
        for item in all_suggestions:
            if item.lower() not in seen and item.lower() != search_term.lower():
                seen.add(item.lower())
                unique_suggestions.append(item)

        return unique_suggestions[:10]  # Limitar a 10 sugerencias totales

    def generate_experiment_analysis(self, drug_name, gene_name, pdb_id):
        """
        Genera información adicional del experimento usando datos de las bases de datos

        Args:
            drug_name: Nombre del medicamento
            gene_name: Nombre del gen
            pdb_id: ID de la estructura PDB seleccionada

        Returns:
            dict: Información del fármaco, gen/proteína y relaciones
        """
        try:
            # Buscar información del medicamento
            drug_matches = self.find_drug_matches(drug_name)
            drug_info = {}
            if not drug_matches.empty:
                drug_data = drug_matches.iloc[0]
                drug_info = {
                    'name': drug_data.get('Name', drug_name),
                    'description': drug_data.get('Description', ''),
                    'indications': drug_data.get('Indications', ''),
                    'status': drug_data.get('Status', ''),
                    'molecular_formula': drug_data.get('Molecular_Formula', ''),
                    'molecular_weight': drug_data.get('Molecular_Weight', '')
                }

            # Buscar información del gen
            gene_matches = self.find_gene_matches(gene_name)
            gene_info = {}
            if not gene_matches.empty:
                gene_data = gene_matches.iloc[0]
                gene_info = {
                    'hgnc_symbol': gene_data.get('hgnc_symbol', gene_name),
                    'gene_name': gene_data.get('gene_name', ''),
                    'disease_info': gene_data.get('disease_info', ''),
                    'function_info': gene_data.get('function_info', ''),
                    'pathway_info': gene_data.get('pathway_info', '')
                }

            # Helper function to clean NaN values
            def clean_value(value, default='No disponible'):
                """Convert NaN, None, or empty values to a default string"""
                if pd.isna(value) or value is None or (isinstance(value, str) and value.strip() == ''):
                    return default
                return str(value) if not isinstance(value, str) else value

            # Estructurar la respuesta con información directa de las bases de datos
            return {
                "drug_name": clean_value(drug_info.get('name'), drug_name),
                "drug_description": clean_value(drug_info.get('description')),
                "drug_indications": clean_value(drug_info.get('indications')),
                "drug_status": clean_value(drug_info.get('status')),
                "drug_molecular_formula": clean_value(drug_info.get('molecular_formula')),
                "drug_molecular_weight": clean_value(drug_info.get('molecular_weight')),
                "gene_name": clean_value(gene_info.get('hgnc_symbol'), gene_name),
                "gene_full_name": clean_value(gene_info.get('gene_name')),
                "gene_function": clean_value(gene_info.get('function_info')),
                "gene_diseases": clean_value(gene_info.get('disease_info')),
                "gene_pathways": clean_value(gene_info.get('pathway_info')),
                "pdb_structure": pdb_id,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
            }

        except Exception as e:
            print(f"[Análisis] Error generando análisis: {e}")
            import traceback
            print(f"[Análisis] Traceback: {traceback.format_exc()}")

            # Información básica de respaldo
            return {
                "drug_name": drug_name,
                "drug_description": "No disponible",
                "drug_indications": "No disponible",
                "drug_status": "No disponible",
                "drug_molecular_formula": "No disponible",
                "drug_molecular_weight": "No disponible",
                "gene_name": gene_name,
                "gene_full_name": "No disponible",
                "gene_function": "No disponible",
                "gene_diseases": "No disponible",
                "gene_pathways": "No disponible",
                "pdb_structure": pdb_id,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "error": str(e)
            }

    
    def _preprocess_pdb_with_obabel_cli(self, pdb_file_path, pdb_id):
        """
        Preprocesa el archivo PDB usando el comando obabel para optimizarlo para Vina
        Sobrescribe el archivo original con el mismo nombre
        
        Args:
            pdb_file_path: Ruta del archivo PDB a procesar
            pdb_id: ID del PDB para logs
            
        Returns:
            str: Ruta del archivo procesado (el mismo que el original)
        """
        try:
            print(f"[obabel] Iniciando preprocesamiento de {pdb_id}")
            
            # Crear archivo temporal para el procesamiento
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.pdb', delete=False) as temp_file:
                temp_path = temp_file.name
            
            # Encontrar ruta del obabel.exe
            obabel_path = self._find_obabel_executable()
            if not obabel_path:
                print(f"[obabel] Error: No se encontró el ejecutable obabel")
                return None
            
            # Comando obabel simplificado y robusto:
            # -p 7.4: Ajustar pH a 7.4 (fisiológico)
            # -h: Añadir hidrógenos (más compatible que --AddPolarH)
            obabel_command = [
                obabel_path,
                pdb_file_path,           # Archivo de entrada
                "-O", temp_path,         # Archivo de salida temporal
                "-p", "7.4",             # pH fisiológico
                "-h"                     # Añadir hidrógenos
            ]
            
            print(f"[obabel] === EJECUTANDO COMANDO OBABEL ===")
            print(f"[obabel] Comando: {' '.join(obabel_command)}")
            print(f"[obabel] Directorio de trabajo: {os.getcwd()}")
            print(f"[obabel] Archivo entrada: {pdb_file_path}")
            print(f"[obabel] Archivo salida temporal: {temp_path}")
            print(f"[obabel] Tamaño archivo entrada: {os.path.getsize(pdb_file_path)} bytes")
            
            # Ejecutar comando obabel con logs detallados
            print(f"[obabel] Iniciando subproceso...")
            start_time = time.time()
            
            result = subprocess.run(
                obabel_command,
                capture_output=True,
                text=True,
                timeout=60,  # Timeout de 60 segundos
                cwd=os.path.dirname(obabel_path)  # Ejecutar desde el directorio de obabel
            )
            
            execution_time = time.time() - start_time
            print(f"[obabel] Subproceso completado en {execution_time:.2f} segundos")
            print(f"[obabel] Código de retorno: {result.returncode}")
            
            # Mostrar logs de salida del comando
            if result.stdout:
                print(f"[obabel] === STDOUT ===")
                for line in result.stdout.strip().split('\n'):
                    if line.strip():
                        print(f"[obabel] STDOUT: {line}")
                print(f"[obabel] === FIN STDOUT ===")
            
            if result.stderr:
                print(f"[obabel] === STDERR ===")
                for line in result.stderr.strip().split('\n'):
                    if line.strip():
                        print(f"[obabel] STDERR: {line}")
                print(f"[obabel] === FIN STDERR ===")
            
            if result.returncode == 0:
                # Validar que el archivo temporal no esté vacío
                if not os.path.exists(temp_path) or os.path.getsize(temp_path) == 0:
                    print(f"[obabel] Error: Archivo procesado está vacío o no existe")
                    if result.stderr:
                        print(f"[obabel] Error stderr: {result.stderr.strip()}")
                    if result.stdout:
                        print(f"[obabel] Salida stdout: {result.stdout.strip()}")
                    
                    # Limpiar archivo temporal
                    try:
                        os.unlink(temp_path)
                    except:
                        pass
                    return None
                
                # Comando exitoso y archivo válido, reemplazar archivo original
                import shutil
                original_size = os.path.getsize(pdb_file_path)
                processed_size = os.path.getsize(temp_path)
                
                shutil.move(temp_path, pdb_file_path)
                
                print(f"[obabel] Preprocesamiento completado exitosamente")
                print(f"[obabel] Archivo sobrescrito: {pdb_file_path}")
                print(f"[obabel] Tamaño: {original_size} -> {processed_size} bytes")
                
                # Mostrar información de salida si hay
                if result.stdout.strip():
                    print(f"[obabel] Salida: {result.stdout.strip()}")
                    
                return pdb_file_path
                
            else:
                # Error en el comando
                print(f"[obabel] Error en preprocesamiento (código: {result.returncode})")
                if result.stderr:
                    print(f"[obabel] Error: {result.stderr.strip()}")
                if result.stdout:
                    print(f"[obabel] Salida: {result.stdout.strip()}")
                
                # Limpiar archivo temporal
                try:
                    os.unlink(temp_path)
                except:
                    pass
                    
                return None
                
        except subprocess.TimeoutExpired:
            print(f"[obabel] Error: Timeout en preprocesamiento de {pdb_id}")
            return None
        except FileNotFoundError:
            print(f"[obabel] Error: Comando 'obabel' no encontrado. Instala OpenBabel CLI")
            return None
        except Exception as e:
            print(f"[obabel] Error durante el preprocesamiento: {str(e)}")
            return None
    
    def _find_obabel_executable(self):
        """
        Encuentra la ruta del ejecutable obabel
        
        Returns:
            str: Ruta del ejecutable obabel o None si no se encuentra
        """
        try:
            # Intentar ubicaciones comunes
            possible_paths = [
                # En PATH del sistema
                "obabel",
                "obabel.exe",
                # En el directorio de OpenBabel Python
                os.path.join(os.path.dirname(os.__file__), '..', 'site-packages', 'openbabel', 'bin', 'obabel.exe'),
                # Ruta específica encontrada
                r"C:\Python312\Lib\site-packages\openbabel\bin\obabel.exe",
                # Otras ubicaciones posibles
                r"C:\Program Files\OpenBabel\obabel.exe",
                r"C:\Program Files (x86)\OpenBabel\obabel.exe"
            ]
            
            for path in possible_paths:
                # Expandir ruta relativa si es necesario
                if not os.path.isabs(path):
                    # Para comandos del sistema, intentar con subprocess directamente
                    if path in ["obabel", "obabel.exe"]:
                        try:
                            result = subprocess.run([path, "--version"], 
                                                   capture_output=True, timeout=5)
                            if result.returncode == 0:
                                return path
                        except:
                            continue
                else:
                    # Para rutas absolutas, verificar si existe el archivo
                    if os.path.exists(path) and os.path.isfile(path):
                        return path
            
            print("[obabel] No se encontró el ejecutable obabel en las ubicaciones esperadas")
            return None
            
        except Exception as e:
            print(f"[obabel] Error buscando ejecutable obabel: {str(e)}")
            return None
    
    def _apply_secondary_pdb_fixes(self, pdb_file_path, pdb_id):
        """
        Aplica correcciones adicionales al archivo PDB para mejorar compatibilidad con Vina
        Esta función implementa una versión simplificada de PDBFixer usando procesamiento de texto
        
        Args:
            pdb_file_path: Ruta del archivo PDB a corregir
            pdb_id: ID del PDB para logs
            
        Returns:
            str: Ruta del archivo corregido (el mismo que el original)
        """
        try:
            print(f"[PDBFix] Aplicando correcciones adicionales a {pdb_id}")
            
            # Leer archivo PDB
            with open(pdb_file_path, 'r') as f:
                lines = f.readlines()
            
            corrected_lines = []
            corrections_applied = {
                'waters_removed': 0,
                'heterogens_removed': 0,
                'invalid_atoms_fixed': 0,
                'duplicate_atoms_removed': 0
            }
            
            seen_atoms = set()  # Para detectar átomos duplicados
            
            for line in lines:
                line_type = line[:6].strip()
                
                # Mantener headers y metadata importantes
                if line_type in ['HEADER', 'TITLE', 'COMPND', 'SOURCE', 'SEQRES', 'HELIX', 'SHEET', 'SSBOND', 'LINK', 'CISPEP']:
                    corrected_lines.append(line)
                    continue
                
                # Procesar átomos
                if line_type in ['ATOM', 'HETATM']:
                    # Extraer información del átomo
                    try:
                        atom_name = line[12:16].strip()
                        residue_name = line[17:20].strip()
                        chain_id = line[21:22].strip()
                        residue_number = line[22:26].strip()
                        
                        # Eliminar moléculas de agua
                        if residue_name in ['HOH', 'WAT', 'H2O', 'TIP', 'SOL']:
                            corrections_applied['waters_removed'] += 1
                            continue
                        
                        # Eliminar heteroátomos no proteicos comunes (iones, buffer, etc.)
                        if line_type == 'HETATM':
                            # Mantener solo heteroátomos relevantes para la estructura proteica
                            non_protein_heterogens = {
                                'CL', 'NA', 'MG', 'CA', 'ZN', 'FE', 'K', 'BR', 'I',  # Iones
                                'SO4', 'PO4', 'NO3', 'ACE', 'NME', 'TFA',  # Buffer/solventes
                                'GOL', 'EDO', 'PEG', 'DMS', 'MPD',  # Crioprotectores
                                'BME', 'DTT', 'TCEP'  # Agentes reductores
                            }
                            
                            if residue_name in non_protein_heterogens:
                                corrections_applied['heterogens_removed'] += 1
                                continue
                        
                        # Verificar validez de coordenadas
                        try:
                            x_coord = float(line[30:38].strip())
                            y_coord = float(line[38:46].strip())
                            z_coord = float(line[46:54].strip())
                            
                            # Coordenadas extremas o inválidas
                            if any(abs(coord) > 9999 for coord in [x_coord, y_coord, z_coord]):
                                corrections_applied['invalid_atoms_fixed'] += 1
                                continue
                                
                        except ValueError:
                            corrections_applied['invalid_atoms_fixed'] += 1
                            continue
                        
                        # Detectar átomos duplicados
                        atom_key = f"{chain_id}_{residue_number}_{atom_name}"
                        if atom_key in seen_atoms:
                            corrections_applied['duplicate_atoms_removed'] += 1
                            continue
                        seen_atoms.add(atom_key)
                        
                        # Corregir formato de línea si es necesario
                        corrected_line = self._fix_pdb_line_format(line)
                        corrected_lines.append(corrected_line)
                        
                    except Exception as e:
                        print(f"[PDBFix] Error procesando línea de átomo: {e}")
                        corrections_applied['invalid_atoms_fixed'] += 1
                        continue
                
                # Mantener conexiones importantes
                elif line_type in ['CONECT', 'SSBOND']:
                    corrected_lines.append(line)
                
                # Mantener línea END
                elif line_type == 'END':
                    corrected_lines.append(line)
                    break
                
                # Saltar otras líneas (REMARK extensos, etc.)
                else:
                    continue
            
            # Asegurar que hay una línea END
            if not corrected_lines or not corrected_lines[-1].startswith('END'):
                corrected_lines.append('END\n')
            
            # Escribir archivo corregido
            with open(pdb_file_path, 'w') as f:
                f.writelines(corrected_lines)
            
            # Reportar correcciones aplicadas
            total_corrections = sum(corrections_applied.values())
            if total_corrections > 0:
                print(f"[PDBFix] Correcciones aplicadas:")
                if corrections_applied['waters_removed'] > 0:
                    print(f"  - Moléculas de agua eliminadas: {corrections_applied['waters_removed']}")
                if corrections_applied['heterogens_removed'] > 0:
                    print(f"  - Heteroátomos no proteicos eliminados: {corrections_applied['heterogens_removed']}")
                if corrections_applied['invalid_atoms_fixed'] > 0:
                    print(f"  - Átomos inválidos corregidos: {corrections_applied['invalid_atoms_fixed']}")
                if corrections_applied['duplicate_atoms_removed'] > 0:
                    print(f"  - Átomos duplicados eliminados: {corrections_applied['duplicate_atoms_removed']}")
                print(f"[PDBFix] Total: {total_corrections} correcciones aplicadas")
                print(f"[PDBFix] Líneas finales: {len(corrected_lines)}")
            else:
                print(f"[PDBFix] No se requirieron correcciones adicionales")
            
            return pdb_file_path
            
        except Exception as e:
            print(f"[PDBFix] Error durante correcciones adicionales: {str(e)}")
            return None
    
    def _fix_pdb_line_format(self, line):
        """
        Corrige formato de línea PDB para asegurar compatibilidad
        
        Args:
            line: Línea PDB original
            
        Returns:
            str: Línea corregida
        """
        try:
            # Asegurar longitud mínima de 80 caracteres
            if len(line) < 80:
                line = line.rstrip('\n').ljust(80) + '\n'
            
            # Validar y corregir campos numéricos críticos
            if line.startswith(('ATOM', 'HETATM')):
                # Asegurar que los campos de coordenadas estén bien formateados
                try:
                    # Extraer coordenadas
                    x = float(line[30:38].strip())
                    y = float(line[38:46].strip())
                    z = float(line[46:54].strip())
                    
                    # Reformatear con precisión adecuada
                    line = (line[:30] + 
                           f"{x:8.3f}" + 
                           f"{y:8.3f}" + 
                           f"{z:8.3f}" + 
                           line[54:])
                           
                except (ValueError, IndexError):
                    # Si hay error en coordenadas, mantener línea original
                    pass

            return line

        except Exception:
            # En caso de error, devolver línea original
            return line

    def _renumber_pdb_residues(self, pdb_file_path, pdb_id):
        """
        Renumera residuos consecutivamente para eliminar huecos (fix interrupted residues)

        Args:
            pdb_file_path: Ruta del archivo PDB a renumerar
            pdb_id: ID del PDB para logs

        Returns:
            bool: True si se renumeró exitosamente, False en caso contrario
        """
        try:
            print(f"[PDBRenumber] Iniciando renumeración de residuos para {pdb_id}")

            # Leer archivo PDB
            with open(pdb_file_path, 'r') as f:
                lines = f.readlines()

            renumbered_lines = []
            residue_map = {}  # Mapeo de (chain, old_resnum) -> new_resnum
            chain_counters = {}  # Contador de residuos por cadena

            # Primera pasada: construir el mapeo de renumeración
            for line in lines:
                line_type = line[:6].strip()
                if line_type in ['ATOM', 'HETATM']:
                    try:
                        chain_id = line[21:22].strip() if len(line) > 21 else 'A'
                        residue_number = line[22:26].strip()
                        residue_name = line[17:20].strip()

                        # Crear clave única para este residuo
                        residue_key = (chain_id, residue_number, residue_name)

                        # Si es un residuo nuevo, asignar nuevo número
                        if residue_key not in residue_map:
                            if chain_id not in chain_counters:
                                chain_counters[chain_id] = 1
                            residue_map[residue_key] = chain_counters[chain_id]
                            chain_counters[chain_id] += 1

                    except Exception as e:
                        print(f"[PDBRenumber] Error procesando línea: {e}")
                        continue

            # Segunda pasada: aplicar renumeración
            for line in lines:
                line_type = line[:6].strip()

                if line_type in ['ATOM', 'HETATM']:
                    try:
                        chain_id = line[21:22].strip() if len(line) > 21 else 'A'
                        residue_number = line[22:26].strip()
                        residue_name = line[17:20].strip()
                        residue_key = (chain_id, residue_number, residue_name)

                        if residue_key in residue_map:
                            new_resnum = residue_map[residue_key]
                            # Reemplazar número de residuo (columnas 23-26, justificado a la derecha)
                            line = line[:22] + f"{new_resnum:>4}" + line[26:]

                    except Exception as e:
                        print(f"[PDBRenumber] Error renumerando línea: {e}")

                renumbered_lines.append(line)

            # Escribir archivo renumerado
            with open(pdb_file_path, 'w') as f:
                f.writelines(renumbered_lines)

            print(f"[PDBRenumber] ✓ Renumeración completada: {len(residue_map)} residuos únicos")
            print(f"[PDBRenumber] ✓ Cadenas procesadas: {list(chain_counters.keys())}")

            return True

        except Exception as e:
            print(f"[PDBRenumber] Error durante renumeración: {e}")
            import traceback
            print(f"[PDBRenumber] Traceback: {traceback.format_exc()}")
            return False