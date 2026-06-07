from django.urls import path
from . import views

app_name = 'core'

urlpatterns = [
    # Molecular intelligence API endpoints
    path('api/molecular-query/', views.molecular_query_api, name='molecular_query_api'),
    path('api/protein-lookup/', views.protein_lookup_api, name='protein_lookup_api'),
    path('api/structure-info/', views.structure_info_api, name='structure_info_api'),
    path('api/validate-molecule/', views.validate_molecule_api, name='validate_molecule_api'),
    
    # Analytics and monitoring
    path('api/query-stats/', views.query_stats_api, name='query_stats_api'),
]