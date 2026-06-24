# File location: RePo-SUDOE-AI/frontend/views.py
import json
import logging
import os
import time
import traceback
from datetime import datetime

from django.http import FileResponse, HttpResponse, JsonResponse
from django.shortcuts import render
from django.utils import translation
from django.utils.translation import gettext as _
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.decorators import full_access_required

# Configurar logging
logger = logging.getLogger(__name__)

# Si no existe, crear el logger
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)


@full_access_required
def index(request):
    """Vista principal que renderiza el frontend de RePo-SUDOE-AI"""
    logger.info("Renderizando vista principal de RePo-SUDOE-AI")
    return render(request, "frontend/index.html")


@full_access_required
@csrf_exempt
@require_http_methods(["POST"])
def chat_message(request):
    """
    Maneja los mensajes del chat para experimentos de docking e información molecular
    """
    start_time = time.time()
    logger.info("=== INICIO DE PROCESAMIENTO DE MENSAJE ===")

    try:
        # Parsear datos de entrada
        try:
            data = json.loads(request.body)
            logger.info(f"Datos recibidos: {data}")
        except json.JSONDecodeError as e:
            logger.error(f"Error parseando JSON: {e}")
            return JsonResponse(
                {"success": False, "error": "Invalid JSON data"}, status=400
            )

        message = data.get("message", "")
        session_id = data.get("session_id")
        estructura_seleccionada = data.get("estructura_seleccionada")
        confirmacion = data.get("confirmacion", False)
        manual_mode = data.get("manual_mode")
        vina_config = data.get("vina_config")  # Nueva configuración de Vina

        logger.info(
            f"Parámetros extraídos - Message: {message}, Session: {session_id}, "
            f"Estructura: {estructura_seleccionada}, Confirmación: {confirmacion}, "
            f"Manual mode: {manual_mode}, Vina config: {vina_config}"
        )

        if not message.strip():
            logger.warning("Mensaje vacío recibido")
            return JsonResponse(
                {"success": False, "error": "El mensaje no puede estar vacío"},
                status=400,
            )

        # Import services locally to avoid circular imports
        try:
            logger.debug("Importando QueryHandler...")
            from core.services.query_handler import QueryHandler

            logger.debug("QueryHandler importado correctamente")
        except ImportError as e:
            logger.error(f"Error importando QueryHandler: {e}")
            return JsonResponse(
                {"success": False, "error": f"Error importing QueryHandler: {str(e)}"},
                status=500,
            )

        try:
            logger.debug("Importando modelos...")
            from core.models import MolecularQuery

            from .models import ChatSession

            logger.debug("Modelos importados correctamente")
        except ImportError as e:
            logger.error(f"Error importando modelos: {e}")
            return JsonResponse(
                {"success": False, "error": f"Error importing models: {str(e)}"},
                status=500,
            )

        # Activate language based on request body (priority) or cookie
        try:
            language_code = data.get("language") or request.COOKIES.get(
                "django_language", "es"
            )
            logger.debug(f"Activating language: {language_code}")
            translation.activate(language_code)
            request.LANGUAGE_CODE = language_code
        except Exception as lang_error:
            logger.warning(f"Could not activate language: {lang_error}, using default")
            translation.activate("es")

        # Initialize query handler with language
        try:
            logger.debug(f"Inicializando QueryHandler con idioma: {language_code}")
            query_handler = QueryHandler(language=language_code, user=request.user)
            logger.debug("QueryHandler inicializado correctamente")
        except Exception as e:
            logger.error(f"Error inicializando QueryHandler: {e}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            return JsonResponse(
                {
                    "success": False,
                    "error": f"Error initializing QueryHandler: {str(e)}",
                },
                status=500,
            )

        # Get or create chat session
        try:
            if session_id:
                try:
                    chat_session = ChatSession.objects.get(
                        id=session_id, user=request.user
                    )
                    logger.debug(f"Chat session existente encontrada: {session_id}")
                except ChatSession.DoesNotExist:
                    chat_session = ChatSession.objects.create(user=request.user)
                    logger.debug(
                        f"Chat session no encontrada, creada nueva: {chat_session.id}"
                    )
            else:
                chat_session = ChatSession.objects.create(user=request.user)
                logger.debug(f"Nueva chat session creada: {chat_session.id}")

            # Guardar mensaje del usuario
            from .models import ChatMessage

            user_message = ChatMessage.objects.create(
                session=chat_session, sender="user", content=message
            )
            logger.debug(f"Mensaje del usuario guardado: {user_message.id}")

        except Exception as e:
            logger.error(f"Error manejando chat session: {e}")
            return JsonResponse(
                {"success": False, "error": f"Error handling chat session: {str(e)}"},
                status=500,
            )

        # Process query using the new simplified handler
        try:
            logger.info("Procesando query con QueryHandler...")
            logger.debug(
                f"Parámetros para process_query: user_query={message}, "
                f"estructura_seleccionada={estructura_seleccionada}, "
                f"confirmacion={confirmacion}, manual_mode={manual_mode}"
            )

            # Force translation context to ensure QueryHandler uses correct language
            with translation.override(language_code):
                result = query_handler.process_query(
                    user_query=message,
                    estructura_seleccionada=estructura_seleccionada,
                    confirmacion=confirmacion,
                    manual_mode=manual_mode,
                    vina_config=vina_config,  # Pasar configuración de Vina
                    user_id=request.user.id,  # Pasar ID del usuario para subdirectorios
                )

            logger.info(f"Resultado de QueryHandler: {result}")

        except Exception as e:
            logger.error(f"Error procesando query: {e}")
            logger.error(f"Traceback completo: {traceback.format_exc()}")
            return JsonResponse(
                {"success": False, "error": f"Error processing query: {str(e)}"},
                status=500,
            )

        # Determine response based on result type
        response_data = {
            "success": True,
            "session_id": str(chat_session.id),
            "timestamp": datetime.now().isoformat(),
            "processing_time_ms": int((time.time() - start_time) * 1000),
        }

        logger.debug("Determinando tipo de respuesta...")

        # Verificar primero el tipo
        result_type = result.get("type")

        # Manejar errores de API, procesamiento, generación de archivos
        if result_type in [
            "api_error",
            "processing_error",
            "sdf_generation_error",
            "file_preparation_error",
        ]:
            logger.error(f"Error de tipo {result_type}: {result.get('error')}")
            response_data["type"] = result_type
            response_data["success"] = False
            # Usar user_message si está disponible, sino error
            response_data["message"] = result.get("user_message", result.get("error"))
            response_data["error"] = result.get("error")
            # Loguear detalles técnicos pero no enviarlos al usuario
            if "technical_details" in result:
                logger.error(f"Detalles técnicos: {result['technical_details']}")
            # Incluir información del fármaco y gen si está disponible
            if "drug" in result:
                response_data["drug"] = result["drug"]
            if "gene" in result:
                response_data["gene"] = result["gene"]

        elif result_type == "confirmation":
            logger.debug("Tipo: confirmation")
            response_data["type"] = "confirmation"
            response_data["message"] = result["message"]
            response_data["drug"] = result["drug"]
            response_data["gene"] = result["gene"]
            response_data["validation_info"] = result.get("validation_info", {})

        elif result_type == "validation_error":
            logger.debug("Tipo: validation_error")
            response_data["type"] = "validation_error"
            response_data["message"] = result[
                "error"
            ]  # Usar 'error' como 'message' para el chat
            response_data["error"] = result["error"]
            response_data["suggestions"] = result.get("suggestions", [])
            response_data["drug"] = result["drug"]
            response_data["gene"] = result["gene"]

        elif result_type == "structure_selection":
            logger.debug("Tipo: structure_selection")
            response_data["type"] = "structure_selection"
            response_data["message"] = result["message"]
            response_data["options"] = result["options"]
            response_data["drug"] = result["drug"]
            response_data["gene"] = result["gene"]

        elif result_type == "mode_selection":
            logger.debug("Tipo: mode_selection")
            response_data["type"] = "mode_selection"
            response_data["message"] = result["message"]
            response_data["drug"] = result["drug"]
            response_data["gene"] = result["gene"]
            response_data["structure"] = result["structure"]
            response_data["files_ready"] = result["files_ready"]
            response_data["experiment_analysis"] = result.get(
                "experiment_analysis", {}
            )  # NUEVO

        elif result_type == "manual_download":
            logger.debug("Tipo: manual_download")
            response_data["type"] = "manual_download"
            response_data["message"] = result["message"]
            response_data["files"] = result["files"]
            response_data["instructions"] = result["instructions"]
            response_data["experiment_analysis"] = result.get(
                "experiment_analysis", {}
            )  # NUEVO

        elif result_type == "docking_complete":
            logger.debug("Tipo: docking_complete")
            response_data["type"] = "docking_complete"
            response_data["message"] = result.get(
                "message", str(_("Docking experiment completed successfully"))
            )
            response_data["docking_results"] = result["docking_results"]
            response_data["compound_info"] = result["compound_info"]
            response_data["drug"] = result["drug"]
            response_data["gene"] = result["gene"]
            response_data["structure"] = result["structure"]
            response_data["experiment_analysis"] = result.get(
                "experiment_analysis", {}
            )  # NUEVO

        elif result_type == "docking_error":
            logger.debug("Tipo: docking_error")
            response_data["type"] = "docking_error"
            response_data["success"] = False
            response_data["error"] = result.get(
                "error", str(_("Error during docking experiment"))
            )
            response_data["message"] = result.get(
                "error", str(_("Error during docking experiment"))
            )
            response_data["docking_results"] = result.get("docking_results", {})
            response_data["compound_info"] = result.get("compound_info", {})
            response_data["drug"] = result.get("drug", "")
            response_data["gene"] = result.get("gene", "")
            response_data["structure"] = result.get("structure", "")
            response_data["vina_config_used"] = result.get("vina_config_used", {})

        elif result_type == "information":
            logger.debug("Tipo: information")
            response_data["type"] = "information"
            response_data["message"] = result["response"]

        elif "error" in result and not result_type:
            # Solo tratar como error general si no tiene tipo específico
            logger.warning(f"Error general en result: {result['error']}")
            response_data["success"] = False
            response_data["error"] = result["error"]
            response_data["message"] = f"Error: {result['error']}"

        else:
            logger.warning(f"Tipo de resultado no reconocido: {result_type}")
            response_data["message"] = result.get("message", "Respuesta procesada")
            response_data["data"] = result

        # Log molecular query for analytics
        try:
            logger.debug("Guardando query molecular para analytics...")
            query_type = result.get("type", "general")
            MolecularQuery.objects.create(
                user=request.user,
                chat_session=chat_session,
                query_type=query_type,
                original_query=message,
                extracted_parameters=result.get("drug", {}),
                response_data=result,
                success=response_data["success"],
                processing_time_ms=response_data["processing_time_ms"],
                openai_calls=1,
            )
            logger.debug("Query molecular guardada correctamente")
        except Exception as log_error:
            logger.error(f"Error guardando molecular query: {log_error}")

        # Guardar respuesta del asistente
        try:
            assistant_message = ChatMessage.objects.create(
                session=chat_session,
                sender="assistant",
                content=response_data.get("message", "Respuesta procesada"),
                metadata=response_data,
            )
            logger.debug(f"Mensaje del asistente guardado: {assistant_message.id}")
        except Exception as save_error:
            logger.error(f"Error guardando mensaje del asistente: {save_error}")

        # logger.info(f"=== RESPUESTA FINAL ===")
        # logger.info(f"Response data: {response_data}")
        # logger.info(f"=== FIN DE PROCESAMIENTO ({response_data['processing_time_ms']}ms) ===")

        return JsonResponse(response_data)

    except Exception as e:
        logger.error(f"=== ERROR CRÍTICO EN CHAT_MESSAGE ===")  # noqa: F541
        logger.error(f"Error: {e}")
        logger.error(f"Traceback completo: {traceback.format_exc()}")

        # Log error
        try:
            MolecularQuery.objects.create(
                user=request.user,
                query_type="general",
                original_query=message if "message" in locals() else "Unknown",
                success=False,
                error_message=str(e),
                processing_time_ms=int((time.time() - start_time) * 1000),
            )
        except:  # noqa: E722
            logger.error("No se pudo guardar el error en MolecularQuery")

        return JsonResponse(
            {
                "success": False,
                "error": str(e),
                "timestamp": datetime.now().isoformat(),
            },
            status=500,
        )


# Resto de las vistas con logging añadido...


@full_access_required
@csrf_exempt
@require_http_methods(["GET"])
def download_file(request, file_type, filename):
    """
    Permite descargar archivos preparados para docking manual
    """
    logger.info(f"Descarga solicitada - Tipo: {file_type}, Archivo: {filename}")

    try:
        # Import services to get directories
        from core.services.query_handler import QueryHandler
        from core.services.vina_service import DockerVinaService

        # Try both input and output directories
        query_handler = QueryHandler(user=request.user)
        vina_service = DockerVinaService()

        # Check input directories first (both temp and final), then output directory
        file_path = os.path.join(query_handler.final_input_dir, filename)
        if not os.path.exists(file_path):
            file_path = os.path.join(query_handler.temp_input_dir, filename)
        if not os.path.exists(file_path):
            file_path = os.path.join(vina_service.output_dir, filename)
        logger.debug(f"Ruta del archivo: {file_path}")

        if not os.path.exists(file_path):
            logger.error(f"Archivo no encontrado: {file_path}")
            return JsonResponse(
                {"success": False, "error": "Archivo no encontrado"}, status=404
            )

        logger.info(f"Sirviendo archivo: {filename}")
        response = FileResponse(
            open(file_path, "rb"), as_attachment=True, filename=filename
        )

        return response

    except Exception as e:
        logger.error(f"Error en download_file: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@csrf_exempt
@require_http_methods(["POST"])
def upload_file(request):
    """
    Maneja la subida de archivos PDBQT/PDB para modo manual
    """
    logger.info("=== INICIO DE UPLOAD DE ARCHIVO ===")

    try:
        file_type = request.POST.get("file_type")
        uploaded_file = request.FILES.get("file")

        logger.info(f"Tipo de archivo: {file_type}, Archivo: {uploaded_file}")

        if not uploaded_file:
            logger.error("No se proporcionó archivo")
            return JsonResponse(
                {"success": False, "error": "No file provided"}, status=400
            )

        # Validar tipos de archivo
        allowed_extensions = {
            "receptor": [".pdbqt", ".pdb", ".ent", ".xyz", ".pqr", ".mcif", ".mmcif"],
            "drug": [
                ".pdbqt",
                ".can",
                ".mdl",
                ".mol",
                ".mol2",
                ".pdb",
                ".sd",
                ".sdf",
                ".smi",
                ".smiles",
                ".xyz",
            ],
            "pose": [".pdbqt", ".pdb"],
        }

        file_extension = os.path.splitext(uploaded_file.name)[1].lower()
        logger.debug(f"Extensión del archivo: {file_extension}")

        if file_extension not in allowed_extensions.get(file_type, []):
            logger.error(
                f"Tipo de archivo no válido: {file_extension} para {file_type}"
            )
            return JsonResponse(
                {
                    "success": False,
                    "error": f'Invalid file type for {file_type}. Allowed: {", ".join(allowed_extensions.get(file_type, []))}',  # noqa: E501
                },
                status=400,
            )

        # Validación molecular opcional con RDKit
        molecular_info = None
        if file_extension in [".pdb", ".ent", ".sdf", ".mol", ".mol2"]:
            try:
                logger.debug("Intentando validación molecular con RDKit...")
                from core.services.molecular_utils import MolecularUtils

                uploaded_file.seek(0)
                molecular_result = MolecularUtils.process_uploaded_molecule(
                    uploaded_file
                )

                if molecular_result["success"]:
                    molecular_info = {
                        "properties": molecular_result.get("properties", {}),
                        "smiles": molecular_result.get("smiles"),
                        "has_image": molecular_result.get("image") is not None,
                    }
                    logger.debug("Validación molecular exitosa")

                uploaded_file.seek(0)

            except Exception as mol_error:
                logger.warning(f"No se pudo procesar molécula con RDKit: {mol_error}")

        # Guardar archivo en la carpeta input de RePo-SUDOE-AI
        from core.services.vina_service import DockerVinaService

        vina_service = DockerVinaService()

        # Usar directorio input de DockerVinaService
        input_dir = vina_service.input_dir
        file_path = os.path.join(input_dir, uploaded_file.name)

        # Escribir el archivo directamente al directorio input
        with open(file_path, "wb") as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)

        logger.info(f"Archivo guardado en: {file_path}")

        response_data = {
            "success": True,
            "filename": uploaded_file.name,
            "file_path": file_path,
            "file_size": uploaded_file.size,
            "file_type": file_type,
        }

        if molecular_info:
            response_data["molecular_info"] = molecular_info

        logger.info(f"Upload completado exitosamente")  # noqa: F541
        return JsonResponse(response_data)

    except Exception as e:
        logger.error(f"Error en upload_file: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@csrf_exempt
@require_http_methods(["POST"])
def run_docking(request):
    """
    Ejecuta la simulación de docking molecular para archivos subidos manualmente
    usando handle_docking_flow con archivos pre-subidos
    """
    logger.info("=== INICIO DE RUN DOCKING (Manual Mode) ===")

    try:
        data = json.loads(request.body)
        logger.info(f"Datos para docking: {data}")

        receptor_file = data.get("receptor_file")
        drug_file = data.get("drug_file")
        pose_file = data.get("pose_file")
        vina_config = data.get("vina_config", {})

        logger.info(f"Receptor file: {receptor_file}")
        logger.info(f"Drug file: {drug_file}")
        logger.info(f"Pose file: {pose_file}")
        logger.info(f"Vina config received: {vina_config}")

        if not receptor_file or not drug_file:
            logger.error("Faltan archivos receptor o droga")
            return JsonResponse(
                {"success": False, "error": "Receptor and drug files are required"},
                status=400,
            )

        # Verify files exist
        import os

        if not os.path.exists(receptor_file):
            logger.error(f"Receptor file does not exist: {receptor_file}")
            return JsonResponse(
                {
                    "success": False,
                    "error": f"Receptor file not found: {receptor_file}",
                },
                status=400,
            )

        if not os.path.exists(drug_file):
            logger.error(f"Drug file does not exist: {drug_file}")
            return JsonResponse(
                {"success": False, "error": f"Drug file not found: {drug_file}"},
                status=400,
            )

        logger.info("All required files exist, proceeding with docking")

        # Import QueryHandler
        from core.services.query_handler import QueryHandler

        query_handler = QueryHandler(user=request.user)  # noqa: F841

        # Call handle_docking_flow but skip the parsing steps and go directly to execution
        # Since we have pre-uploaded files, we'll use the vina service directly
        from core.services.vina_service import DockerVinaService

        vina_service = DockerVinaService()

        logger.info(
            f"Running docking with files: receptor={receptor_file}, drug={drug_file}"
        )
        logger.info(f"Vina config: {vina_config}")

        # Execute the docking with uploaded files and custom configuration
        # Merge the vina_config properly - VinaService will handle the merging with defaults
        final_config = {}

        if vina_config:
            logger.info(f"Processing vina_config: {vina_config}")

            # Handle box configuration
            # Frontend sends use_box_enveloping: true for automatic, false for manual
            if "use_box_enveloping" in vina_config:
                final_config["use_box_enveloping"] = vina_config["use_box_enveloping"]

                if vina_config["use_box_enveloping"]:
                    # Automatic box enveloping
                    if vina_config.get("padding"):
                        final_config["padding"] = vina_config["padding"]
                else:
                    # Manual box configuration
                    if vina_config.get("box_center"):
                        final_config["box_center"] = vina_config["box_center"]
                    if vina_config.get("box_size"):
                        final_config["box_size"] = vina_config["box_size"]

            # Handle execution parameters
            if vina_config.get("use_custom_execution"):
                if vina_config.get("exhaustiveness"):
                    final_config["exhaustiveness"] = vina_config["exhaustiveness"]
                if vina_config.get("num_modes"):
                    final_config["num_modes"] = vina_config["num_modes"]
                if vina_config.get("energy_range"):
                    final_config["energy_range"] = vina_config["energy_range"]
                if vina_config.get("cpu"):
                    final_config["cpu"] = vina_config["cpu"]
                if vina_config.get("seed"):
                    final_config["seed"] = vina_config["seed"]

        logger.info(f"Final config for VinaService: {final_config}")

        result = vina_service.run_vina_docking(
            receptor_path=receptor_file, drug_path=drug_file, config=final_config
        )

        if result.get("error"):
            logger.error(f"Docking failed: {result['error']}")
            logger.error(f"Stdout: {result.get('stdout', 'N/A')}")
            logger.error(f"Stderr: {result.get('stderr', 'N/A')}")
            return JsonResponse(
                {
                    "success": False,
                    "error": result["error"],
                    "details": {
                        "stdout": result.get("stdout", ""),
                        "stderr": result.get("stderr", ""),
                    },
                },
                status=400,
            )

        logger.info(f"Docking completado exitosamente")  # noqa: F541

        # Update 3D viewer files if docking was successful
        # if result.get('binding_affinity'):
        #     try:
        #         from core.services.visualizer_file_manager import VisualizerFileManager
        #         viz_manager = VisualizerFileManager()

        #         # Generate experiment key based on files
        #         experiment_key = f"manual_{int(time.time())}"

        #         # Update visualizer files
        #         viz_manager.update_visualizer_files(
        #             result=result,
        #             experiment_key=experiment_key,
        #             receptor_name="manual_receptor",
        #             drug_name="manual_drug"
        #         )
        #         logger.info("Visualizer files updated successfully")
        #     except Exception as e:
        #         logger.warning(f"Could not update visualizer files: {e}")

        return JsonResponse(
            {
                "success": True,
                "results": result,
                "message": "Manual docking simulation completed successfully",
            }
        )

    except Exception as e:
        logger.error(f"Error en run_docking: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def get_chat_history(request):
    """Retorna el historial de chat del usuario - últimos 7 chats ordenados por fecha"""
    logger.info("Solicitando historial de chat")

    try:
        from .models import ChatSession

        # Obtener solo los últimos 7 chats ordenados por fecha (más reciente primero)
        chat_sessions = ChatSession.objects.filter(user=request.user).order_by(
            "-updated_at"
        )[:7]
        logger.debug(f"Encontradas {chat_sessions.count()} sesiones de chat")

        chat_history = []
        for session in chat_sessions:
            # Obtener el primer mensaje del usuario para el preview
            first_message = session.messages.filter(sender="user").first()
            if first_message:
                # Crear un resumen de máximo una línea (80 caracteres)
                preview = first_message.content.strip()
                if len(preview) > 80:
                    preview = preview[:77] + "..."
                # Eliminar saltos de línea para mantenerlo en una línea
                preview = preview.replace("\n", " ").replace("\r", " ")
            else:
                preview = "Nuevo chat"

            chat_history.append(
                {
                    "id": str(session.id),
                    "timestamp": session.updated_at.isoformat(),
                    "preview": preview,
                }
            )

        logger.info(f"Devolviendo {len(chat_history)} chats en el historial")

        return JsonResponse({"success": True, "chats": chat_history})

    except Exception as e:
        logger.error(f"Error en get_chat_history: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def get_chat_messages(request, chat_id):
    """Retorna los mensajes de un chat específico"""
    logger.info(f"Solicitando mensajes del chat: {chat_id}")

    try:
        from .models import ChatMessage, ChatSession  # noqa: F401

        # Verificar que el chat pertenece al usuario
        try:
            chat_session = ChatSession.objects.get(id=chat_id, user=request.user)
        except ChatSession.DoesNotExist:
            logger.error(f"Chat {chat_id} no encontrado para el usuario")
            return JsonResponse(
                {"success": False, "error": "Chat not found"}, status=404
            )

        # Obtener todos los mensajes del chat ordenados por timestamp
        messages = chat_session.messages.all().order_by("timestamp")
        logger.debug(f"Encontrados {messages.count()} mensajes")

        chat_messages = []
        for message in messages:
            chat_messages.append(
                {
                    "id": message.id,
                    "sender": message.sender,
                    "content": message.content,
                    "timestamp": message.timestamp.isoformat(),
                    "metadata": message.metadata,
                }
            )

        logger.info(f"Devolviendo {len(chat_messages)} mensajes del chat {chat_id}")

        return JsonResponse(
            {
                "success": True,
                "chat_id": str(chat_session.id),
                "messages": chat_messages,
            }
        )

    except Exception as e:
        logger.error(f"Error en get_chat_messages: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["DELETE"])
def delete_chat(request, chat_id):
    """Elimina un chat específico"""
    logger.info(f"Eliminando chat: {chat_id}")

    try:
        from .models import ChatSession

        chat_session = ChatSession.objects.get(id=chat_id, user=request.user)
        chat_session.delete()

        logger.info(f"Chat {chat_id} eliminado exitosamente")

        return JsonResponse(
            {"success": True, "message": f"Chat {chat_id} deleted successfully"}
        )

    except ChatSession.DoesNotExist:
        logger.error(f"Chat {chat_id} no encontrado")
        return JsonResponse({"success": False, "error": "Chat not found"}, status=404)
    except Exception as e:
        logger.error(f"Error en delete_chat: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def serve_output_file(request, filename):
    """
    Serve files from the output directory (PDBQT files, logs, etc.)
    Only serves files from current user's folder.
    """
    user_id = request.user.id
    logger.info(f"Serving output file for user {user_id}: {filename}")

    try:
        # Import services
        from core.services.vina_service import DockerVinaService
        from core.services.visualizer_file_manager import get_file_manager

        # Get file manager for current user only
        file_manager = get_file_manager(user_id=user_id)
        experiments = file_manager.detect_experiment_files()

        file_path = None

        # Search for the file in current user's experiments only
        for exp_key, exp_data in experiments.items():
            # Check if this experiment has the requested file
            if (
                exp_data.get("pdbqt_file")
                and os.path.basename(exp_data["pdbqt_file"]) == filename
            ):
                file_path = exp_data["pdbqt_file"]
                logger.info(f"Found file in user's experiment: {exp_key}")
                break
            elif (
                exp_data.get("log_file")
                and os.path.basename(exp_data["log_file"]) == filename
            ):
                file_path = exp_data["log_file"]
                logger.info(f"Found file in user's experiment: {exp_key}")
                break

        # If not found in experiments, try current user's output folder directly
        if not file_path:
            vina_service = DockerVinaService(user_id=user_id)
            potential_path = os.path.join(vina_service.output_dir, filename)
            if os.path.exists(potential_path):
                file_path = potential_path
                logger.info(f"Found file in user's output folder")  # noqa: F541

        if not file_path or not os.path.exists(file_path):
            logger.error(f"Output file not found for user {user_id}: {filename}")
            return JsonResponse(
                {"success": False, "error": "File not found"}, status=404
            )

        # Determine content type based on file extension
        content_type = "text/plain"
        if filename.endswith(".pdbqt"):
            content_type = "chemical/x-pdbqt"
        elif filename.endswith(".pdb"):
            content_type = "chemical/x-pdb"
        elif filename.endswith(".log"):
            content_type = "text/plain"
        elif filename.endswith(".sdf"):
            content_type = "chemical/x-sdf"

        logger.info(f"Serving file: {filename} with content type: {content_type}")

        # For text-based files, we can serve the content directly
        if filename.endswith((".pdbqt", ".pdb", ".log", ".sdf")):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            response = HttpResponse(content, content_type=content_type)
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            response["Access-Control-Allow-Origin"] = "*"  # Enable CORS for frontend
            return response
        else:
            # For binary files, use FileResponse
            response = FileResponse(
                open(file_path, "rb"), content_type=content_type, filename=filename
            )
            response["Access-Control-Allow-Origin"] = "*"  # Enable CORS for frontend
            return response

    except Exception as e:
        logger.error(f"Error serving output file: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def list_user_experiments(request):
    """
    List all experiments for the current user from their output subdirectory
    """
    try:
        import glob
        from datetime import datetime

        from core.services.vina_service import DockerVinaService

        user_id = request.user.id
        logger.info(f"[list_user_experiments] User ID: {user_id}")

        vina_service = DockerVinaService(user_id=user_id)
        output_dir = vina_service.output_dir
        logger.info(f"[list_user_experiments] Output dir: {output_dir}")
        logger.info(
            f"[list_user_experiments] Output dir exists: {os.path.exists(output_dir)}"
        )

        experiments = []

        # Check if user output directory exists
        if not os.path.exists(output_dir):
            logger.warning(
                f"[list_user_experiments] Output directory does not exist: {output_dir}"
            )
            return JsonResponse({"success": True, "experiments": []})

        # Find all .pdbqt output files (ligand docking results)
        # Pattern matches both *_out.pdbqt and *_output.pdbqt
        pdbqt_files = glob.glob(os.path.join(output_dir, "*_out.pdbqt"))
        logger.info(f"[list_user_experiments] Found {len(pdbqt_files)} PDBQT files")

        for pdbqt_file in pdbqt_files:
            basename = os.path.basename(pdbqt_file)

            # Skip .sdf files that might match pattern
            if basename.endswith(".pdbqt.sdf"):
                continue

            # Extract experiment name (remove _out.pdbqt)
            experiment_name = basename.replace("_out.pdbqt", "")

            # Get file modification time
            mtime = os.path.getmtime(pdbqt_file)
            date_str = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")

            # Check for related files
            log_file = os.path.join(output_dir, f"{experiment_name}_vina.log")
            # Try to find receptor file (could be .pdb or .pdbqt)
            receptor_file_pdbqt = os.path.join(
                output_dir, f"{experiment_name.split('_')[0]}.pdbqt"
            )
            receptor_file_pdb = os.path.join(
                output_dir, f"{experiment_name.split('_')[0]}.pdb"
            )

            # Determine which receptor file exists
            if os.path.exists(receptor_file_pdbqt):
                receptor_file = receptor_file_pdbqt
            elif os.path.exists(receptor_file_pdb):
                receptor_file = receptor_file_pdb
            else:
                receptor_file = None

            experiments.append(
                {
                    "name": experiment_name,
                    "date": date_str,
                    "files": {
                        "output": basename,
                        "log": (
                            os.path.basename(log_file)
                            if os.path.exists(log_file)
                            else None
                        ),
                        "receptor": (
                            os.path.basename(receptor_file)
                            if receptor_file and os.path.exists(receptor_file)
                            else None
                        ),
                    },
                }
            )

        # Sort by date (newest first)
        experiments.sort(key=lambda x: x["date"], reverse=True)

        logger.info(f"[list_user_experiments] Returning {len(experiments)} experiments")
        for exp in experiments:
            logger.info(f"  - {exp['name']} ({exp['date']})")

        return JsonResponse({"success": True, "experiments": experiments})

    except Exception as e:
        logger.error(f"Error listing user experiments: {e}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def serve_input_file(request, filename):
    """
    Serve files from the input directory (PDB files, SDF files, etc.)
    Only serves files from current user's folder.
    """
    user_id = request.user.id
    logger.info(f"Serving input file for user {user_id}: {filename}")

    try:
        # Import services
        from pathlib import Path  # noqa: F401

        from core.services.vina_service import DockerVinaService

        file_path = None

        # Get current user's input directory
        vina_service = DockerVinaService(user_id=user_id)

        # Try current user's input folder
        user_input_path = vina_service.input_dir / filename
        if user_input_path.exists():
            file_path = str(user_input_path)
            logger.info(f"Found file in user's input folder")  # noqa: F541

        if not file_path or not os.path.exists(file_path):
            logger.error(f"Input file not found for user {user_id}: {filename}")
            return JsonResponse(
                {"success": False, "error": "File not found"}, status=404
            )

        # Determine content type based on file extension
        content_type = "text/plain"
        if filename.endswith(".pdb"):
            content_type = "chemical/x-pdb"
        elif filename.endswith(".sdf"):
            content_type = "chemical/x-sdf"
        elif filename.endswith(".mol"):
            content_type = "chemical/x-mol"
        elif filename.endswith(".mol2"):
            content_type = "chemical/x-mol2"

        logger.info(f"Serving file: {filename} with content type: {content_type}")

        # Serve text-based molecular files directly
        if filename.endswith((".pdb", ".sdf", ".mol", ".mol2")):
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            response = HttpResponse(content, content_type=content_type)
            response["Content-Disposition"] = f'inline; filename="{filename}"'
            response["Access-Control-Allow-Origin"] = "*"  # Enable CORS for frontend
            return response
        else:
            # For binary files, use FileResponse
            response = FileResponse(
                open(file_path, "rb"), content_type=content_type, filename=filename
            )
            response["Access-Control-Allow-Origin"] = "*"  # Enable CORS for frontend
            return response

    except Exception as e:
        logger.error(f"Error serving input file: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def download_experiment_zip(request, experiment_key):
    """
    Download all experiment files as a ZIP archive.
    Includes: receptor.pdb, ligand.sdf, output.pdbqt, and vina.log
    """
    logger.info(f"Creating ZIP download for experiment: {experiment_key}")

    try:
        import zipfile
        from io import BytesIO

        # Parse experiment key to get structure_id and drug_name
        parts = experiment_key.split("_", 1)
        if len(parts) != 2:
            return JsonResponse(
                {"success": False, "error": "Invalid experiment key format"}, status=400
            )

        structure_id, drug_name = parts

        # Import services to get directories
        from core.services.query_handler import QueryHandler
        from core.services.vina_service import DockerVinaService

        query_handler = QueryHandler(user=request.user)
        # Use user's subdirectory
        user_id = request.user.id
        vina_service = DockerVinaService(user_id=user_id)

        # Create in-memory ZIP file
        zip_buffer = BytesIO()

        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            files_added = 0

            # 1. Receptor PDB file from input
            receptor_filename = f"{structure_id}.pdb"
            receptor_path = os.path.join(
                query_handler.final_input_dir, receptor_filename
            )
            if not os.path.exists(receptor_path):
                receptor_path = os.path.join(
                    query_handler.temp_input_dir, receptor_filename
                )

            if os.path.exists(receptor_path):
                zip_file.write(receptor_path, f"receptor_{receptor_filename}")
                files_added += 1
                logger.debug(f"Added receptor: {receptor_filename}")
            else:
                logger.warning(f"Receptor file not found: {receptor_filename}")

            # 2. Ligand SDF file from input
            ligand_filename = f"{drug_name}.sdf"
            ligand_path = os.path.join(query_handler.final_input_dir, ligand_filename)
            if not os.path.exists(ligand_path):
                ligand_path = os.path.join(
                    query_handler.temp_input_dir, ligand_filename
                )

            if os.path.exists(ligand_path):
                zip_file.write(ligand_path, f"ligand_{ligand_filename}")
                files_added += 1
                logger.debug(f"Added ligand: {ligand_filename}")
            else:
                logger.warning(f"Ligand file not found: {ligand_filename}")

            # 3. Output PDBQT file
            output_filename = f"{structure_id}_{drug_name}_out.pdbqt"
            output_path = os.path.join(vina_service.output_dir, output_filename)

            if os.path.exists(output_path):
                zip_file.write(output_path, f"output_{output_filename}")
                files_added += 1
                logger.debug(f"Added output: {output_filename}")
            else:
                logger.warning(f"Output file not found: {output_filename}")

            # 4. Vina log file
            log_filename = f"{structure_id}_{drug_name}_vina.log"
            log_path = os.path.join(vina_service.output_dir, log_filename)

            if os.path.exists(log_path):
                zip_file.write(log_path, f"log_{log_filename}")
                files_added += 1
                logger.debug(f"Added log: {log_filename}")
            else:
                logger.warning(f"Log file not found: {log_filename}")

        if files_added == 0:
            logger.error(f"No files found for experiment: {experiment_key}")
            return JsonResponse(
                {"success": False, "error": "No experiment files found"}, status=404
            )

        # Prepare response with ZIP file
        zip_buffer.seek(0)
        response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = (
            f'attachment; filename="{experiment_key}_experiment.zip"'
        )

        logger.info(
            f"Successfully created ZIP with {files_added} files for experiment: {experiment_key}"
        )
        return response

    except Exception as e:
        logger.error(f"Error creating ZIP download: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def get_visualizer_files(request):
    """
    Get experiment files for 3D visualization.
    Automatically detects and prepares the latest experiment files.
    """
    logger.info("Getting visualizer files")

    try:
        # Import visualizer file manager
        from core.services.visualizer_file_manager import (
            get_file_manager,
            prepare_latest_experiment,
        )

        # Prepare the latest experiment files
        result = prepare_latest_experiment()

        if not result.get("success"):
            logger.warning(
                f"No experiment files prepared: {result.get('error', 'Unknown error')}"
            )
            return JsonResponse(
                {
                    "success": False,
                    "error": result.get("error", "No experiment files available"),
                }
            )

        # Read file contents
        manager = get_file_manager()
        file_contents = manager.get_visualizer_files_content()

        if not file_contents:
            logger.warning("No file contents available")
            return JsonResponse(
                {"success": False, "error": "No file contents available"}
            )

        # Prepare response data
        response_data = {
            "success": True,
            "experiment": {
                "key": result["experiment_key"],
                "estructura_id": result["estructura_id"],
                "drug_id": result["drug_id"],
            },
            "files": {},
        }

        # Add file contents
        for filename, content in file_contents.items():
            if filename.endswith("_out.pdbqt"):
                response_data["files"]["pdbqt_content"] = content
            elif filename.endswith("_vina.log"):
                response_data["files"]["log_content"] = content

        logger.info(
            f"Successfully prepared visualizer files for experiment: {result['experiment_key']}"
        )
        return JsonResponse(response_data)

    except ImportError as e:
        logger.error(f"Import error in visualizer files: {e}")
        return JsonResponse(
            {"success": False, "error": "Visualizer file manager not available"},
            status=500,
        )

    except Exception as e:
        logger.error(f"Error getting visualizer files: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def get_available_experiments(request):
    """
    Get list of available experiments for visualization (only for current user).
    """
    user_id = request.user.id
    logger.info(f"Getting available experiments list for user: {user_id}")

    try:
        from core.services.visualizer_file_manager import get_experiment_list

        # Pass user_id to only get experiments for this user
        experiments = get_experiment_list(user_id=user_id)

        logger.info(
            f"Found {len(experiments)} available experiments for user {user_id}"
        )

        # Return in format expected by frontend
        return JsonResponse({"status": "success", "experiments": experiments})

    except Exception as e:
        logger.error(f"Error getting available experiments: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse(
            {"status": "error", "success": False, "error": str(e)}, status=500
        )


@full_access_required
@require_http_methods(["GET"])
def get_specific_experiment(request, experiment_key):
    """
    Get a specific experiment by key for visualization.
    """
    logger.info(f"Getting specific experiment: {experiment_key}")

    try:
        from core.services.visualizer_file_manager import prepare_specific_experiment

        # Parse experiment key to get estructura_id and drug_id
        parts = experiment_key.split("_", 1)
        if len(parts) != 2:
            return JsonResponse(
                {"success": False, "error": "Invalid experiment key format"}, status=400
            )

        estructura_id, drug_id = parts
        result = prepare_specific_experiment(estructura_id, drug_id)

        if not result.get("success"):
            logger.warning(
                f"Failed to prepare experiment {experiment_key}: {result.get('error', 'Unknown error')}"
            )
            return JsonResponse(
                {"success": False, "error": result.get("error", "Experiment not found")}
            )

        # Read file contents
        from core.services.visualizer_file_manager import get_file_manager

        manager = get_file_manager()
        file_contents = manager.get_visualizer_files_content()

        if not file_contents:
            logger.warning(f"No file contents for experiment {experiment_key}")
            return JsonResponse(
                {"success": False, "error": "No file contents available"}
            )

        # Prepare response data
        response_data = {
            "success": True,
            "experiment": {
                "key": result["experiment_key"],
                "estructura_id": result["estructura_id"],
                "drug_id": result["drug_id"],
            },
            "files": {},
        }

        # Add file contents
        for filename, content in file_contents.items():
            if filename.endswith("_out.pdbqt"):
                response_data["files"]["pdbqt_content"] = content
            elif filename.endswith("_vina.log"):
                response_data["files"]["log_content"] = content

        logger.info(f"Successfully prepared specific experiment: {experiment_key}")
        return JsonResponse(response_data)

    except Exception as e:
        logger.error(f"Error getting specific experiment {experiment_key}: {e}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def get_pdb_center(request, pdb_id):
    """
    Calcula el centro de masa de un PDB por su ID (ej: 2P9R).
    Busca el archivo en input/ y devuelve las coordenadas [x, y, z].
    """
    try:
        from core.services.query_handler import QueryHandler
        from core.services.vina_service import DockerVinaService

        query_handler = QueryHandler(user=request.user)

        # Buscar el PDB en input/ (final y temp)
        pdb_filename = f"{pdb_id}.pdb"
        pdb_path = os.path.join(query_handler.final_input_dir, pdb_filename)
        if not os.path.exists(pdb_path):
            pdb_path = os.path.join(query_handler.temp_input_dir, pdb_filename)

        if not os.path.exists(pdb_path):
            logger.warning(f"PDB no encontrado para calcular centro: {pdb_filename}")
            return JsonResponse(
                {"success": False, "error": f"PDB {pdb_id} no encontrado en input/"},
                status=404,
            )

        center = DockerVinaService._calculate_pdb_center(pdb_path)
        if center:
            logger.info(f"Centro calculado para {pdb_id}: {center}")
            return JsonResponse({"success": True, "center": center})
        else:
            return JsonResponse(
                {
                    "success": False,
                    "error": "No se pudieron calcular las coordenadas del centro",
                },
                status=500,
            )

    except Exception as e:
        logger.error(f"Error calculando centro de {pdb_id}: {e}")
        return JsonResponse({"success": False, "error": str(e)}, status=500)
