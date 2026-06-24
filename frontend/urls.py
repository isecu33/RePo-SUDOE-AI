from django.urls import path

from . import views

app_name = "frontend"

urlpatterns = [
    # Vista principal
    path("", views.index, name="index"),
    # API endpoints para chat y docking
    path("api/chat/", views.chat_message, name="chat_message"),
    path("api/upload/", views.upload_file, name="upload_file"),
    path("api/docking/", views.run_docking, name="run_docking"),
    # Endpoints para historial de chat
    path("api/chat-history/", views.get_chat_history, name="get_chat_history"),
    path(
        "api/chat/<uuid:chat_id>/messages/",
        views.get_chat_messages,
        name="get_chat_messages",
    ),
    path("api/chat/<uuid:chat_id>/delete/", views.delete_chat, name="delete_chat"),
    # Endpoint para descargas de archivos preparados
    path(
        "api/download/<str:file_type>/<str:filename>/",
        views.download_file,
        name="download_file",
    ),
    # Endpoint para servir archivos de output (PDBQT, logs, etc.)
    path(
        "api/output/<str:filename>/", views.serve_output_file, name="serve_output_file"
    ),
    # Endpoint para listar experimentos del usuario
    path(
        "api/list-experiments/",
        views.list_user_experiments,
        name="list_user_experiments",
    ),
    # Endpoint para servir archivos de input (PDB, SDF, etc.)
    path("api/input/<str:filename>/", views.serve_input_file, name="serve_input_file"),
    # Endpoint para descargar experimentos completos como ZIP
    path(
        "api/download-experiment/<str:experiment_key>/",
        views.download_experiment_zip,
        name="download_experiment_zip",
    ),
    # Endpoint para obtener archivos del visualizador 3D
    path(
        "api/get-visualizer-files/",
        views.get_visualizer_files,
        name="get_visualizer_files",
    ),
    # Endpoints para gestión de experimentos en el visualizador
    path(
        "api/get-available-experiments/",
        views.get_available_experiments,
        name="get_available_experiments",
    ),
    path(
        "api/get-specific-experiment/<str:experiment_key>/",
        views.get_specific_experiment,
        name="get_specific_experiment",
    ),
    # Endpoint para calcular centro de masa de un PDB
    path("api/pdb-center/<str:pdb_id>/", views.get_pdb_center, name="get_pdb_center"),
]
