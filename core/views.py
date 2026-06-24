import json

from django.db.models import Avg, Count
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from accounts.decorators import full_access_required

from .models import DockingJob, MolecularQuery, ProteinDatabase
from .services.molecular_utils import MolecularUtils
from .services.query_handler import QueryHandler


@full_access_required
@csrf_exempt
@require_http_methods(["POST"])
def molecular_query_api(request):
    """
    Direct API endpoint for molecular queries.
    Alternative to the frontend chat interface.
    """
    try:
        data = json.loads(request.body)
        user_query = data.get("query", "")
        estructura_seleccionada = data.get("estructura_seleccionada")
        confirmacion = data.get("confirmacion", False)

        if not user_query.strip():
            return JsonResponse(
                {"success": False, "error": "Query cannot be empty"}, status=400
            )

        query_handler = QueryHandler(user=request.user)
        result = query_handler.process_query(
            user_query=user_query,
            estructura_seleccionada=estructura_seleccionada,
            confirmacion=confirmacion,
        )

        return JsonResponse({"success": True, "result": result})

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def protein_lookup_api(request):
    """
    API endpoint for protein/gene lookup.
    """
    try:
        query = request.GET.get("q", "").strip()
        if not query:
            return JsonResponse(
                {"success": False, "error": 'Query parameter "q" is required'},
                status=400,
            )

        # Search in protein database
        matches = (
            ProteinDatabase.objects.filter(hgnc_symbol__icontains=query)
            | ProteinDatabase.objects.filter(gene_name__icontains=query)
            | ProteinDatabase.objects.filter(synonyms__icontains=query)
        )

        results = []
        for protein in matches[:10]:  # Limit to 10 results
            results.append(
                {
                    "hgnc_symbol": protein.hgnc_symbol,
                    "gene_name": protein.gene_name,
                    "description": protein.description,
                    "pdb_codes": protein.get_pdb_list(),
                    "uniprot_id": protein.uniprot_id,
                    "structures_available": len(protein.get_pdb_list()),
                }
            )

        return JsonResponse(
            {"success": True, "results": results, "total_found": matches.count()}
        )

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def structure_info_api(request):
    """
    API endpoint to get information about a specific PDB structure.
    """
    try:
        pdb_code = request.GET.get("pdb_code", "").strip().upper()
        if not pdb_code:
            return JsonResponse(
                {"success": False, "error": "pdb_code parameter is required"},
                status=400,
            )

        # Find proteins with this PDB code
        proteins = ProteinDatabase.objects.filter(pdb_codes__icontains=pdb_code)

        if not proteins.exists():
            return JsonResponse(
                {
                    "success": False,
                    "error": f"PDB code {pdb_code} not found in database",
                },
                status=404,
            )

        structure_info = {
            "pdb_code": pdb_code,
            "download_url": f"https://files.rcsb.org/download/{pdb_code}.pdb",
            "proteins": [],
        }

        for protein in proteins:
            structure_info["proteins"].append(
                {
                    "hgnc_symbol": protein.hgnc_symbol,
                    "gene_name": protein.gene_name,
                    "description": protein.description,
                }
            )

        return JsonResponse({"success": True, "structure_info": structure_info})

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@csrf_exempt
@require_http_methods(["POST"])
def validate_molecule_api(request):
    """
    API endpoint to validate a molecule file using RDKit.
    """
    try:
        if request.FILES.get("file"):
            # File upload validation
            uploaded_file = request.FILES["file"]
            result = MolecularUtils.process_uploaded_molecule(uploaded_file)
        elif request.POST.get("smiles"):
            # SMILES validation
            smiles = request.POST.get("smiles")
            mol = MolecularUtils.mol_from_smiles(smiles)
            if mol:
                properties = MolecularUtils.get_molecule_properties(mol)
                image = MolecularUtils.generate_molecule_image(mol)
                result = {
                    "success": True,
                    "properties": properties,
                    "image": image,
                    "smiles": smiles,
                }
            else:
                result = {"success": False, "error": "Invalid SMILES string"}
        else:
            return JsonResponse(
                {
                    "success": False,
                    "error": "Either file or smiles parameter is required",
                },
                status=400,
            )

        return JsonResponse(result)

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def query_stats_api(request):
    """
    API endpoint to get query statistics and analytics.
    """
    try:
        # Basic statistics
        total_queries = MolecularQuery.objects.count()
        successful_queries = MolecularQuery.objects.filter(success=True).count()

        # Query type breakdown
        query_types = MolecularQuery.objects.values("query_type").annotate(
            count=Count("query_type")
        )

        # Performance statistics
        avg_processing_time = MolecularQuery.objects.filter(
            processing_time_ms__isnull=False
        ).aggregate(avg_time=Avg("processing_time_ms"))["avg_time"]

        # Recent activity (last 10 queries)
        recent_queries = MolecularQuery.objects.select_related(
            "user", "chat_session"
        ).order_by("-created_at")[:10]

        recent_activity = []
        for query in recent_queries:
            recent_activity.append(
                {
                    "user": query.user.get_full_name() or query.user.email,
                    "query_type": query.query_type,
                    "success": query.success,
                    "processing_time_ms": query.processing_time_ms,
                    "created_at": query.created_at.isoformat(),
                }
            )

        stats = {
            "total_queries": total_queries,
            "successful_queries": successful_queries,
            "success_rate": (
                (successful_queries / total_queries * 100) if total_queries > 0 else 0
            ),
            "query_types": list(query_types),
            "avg_processing_time_ms": avg_processing_time,
            "recent_activity": recent_activity,
            "protein_database_size": ProteinDatabase.objects.count(),
        }

        return JsonResponse({"success": True, "stats": stats})

    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


@full_access_required
@require_http_methods(["GET"])
def docking_job_status(request, job_id):
    """
    Devuelve el estado actual de un DockingJob para polling desde el frontend.

    Respuesta JSON:
      - siempre: {"job_id": ..., "status": ..., "progress": ...}
      - si status == "completed": ademas {"result": <dict>}
      - si status == "failed": ademas {"error": <mensaje>, "result": <dict si disponible>}
    """
    try:
        job = DockingJob.objects.get(id=job_id, user=request.user)
    except DockingJob.DoesNotExist:
        return JsonResponse({"error": "Job no encontrado"}, status=404)

    data = {
        "job_id": str(job.id),
        "status": job.status,
        "progress": job.progress,
    }

    if job.status == "completed":
        data["result"] = job.result_data
    elif job.status == "failed":
        data["error"] = job.error_message
        if job.result_data:
            data["result"] = job.result_data

    return JsonResponse(data)
