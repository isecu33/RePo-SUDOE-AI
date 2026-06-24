import base64
import os
from io import BytesIO

import requests
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from rdkit import Chem
from rdkit.Chem import AllChem, Draw


class MolecularUtils:
    """
    Utilities for molecular structure processing using RDKit.
    Ported and adapted from rdkit_load.py for Django integration.
    """

    @staticmethod
    def download_and_load_molecule(estructura_info):
        """
        Descarga y carga una molécula desde una estructura PDB.

        Args:
            estructura_info (dict): Información de la estructura con formato:
                {
                    "tipo": "experimental",
                    "id": "1ABC",
                    "fuente": "https://files.rcsb.org/download/1ABC.pdb"
                }

        Returns:
            rdkit.Chem.Mol: Molécula cargada o None si falla
        """
        if not estructura_info or not isinstance(estructura_info, dict):
            print("No se encontró estructura válida en el JSON.")
            return None

        url = estructura_info.get("fuente")
        if not url:
            print("No se encontró URL de la estructura.")
            return None

        print(f"Descargando estructura desde: {url}")

        try:
            response = requests.get(url, timeout=30)
            if response.status_code != 200:
                print(
                    f"No se pudo descargar la estructura. Status: {response.status_code}"
                )
                return None

            pdb_data = response.text

            # Cargar la molécula en RDKit
            mol = Chem.MolFromPDBBlock(pdb_data, sanitize=False)
            if mol:
                try:
                    Chem.SanitizeMol(mol)
                except Exception as e:
                    print("Fallo al sanitizar la molécula:", e)
                    return None

            if mol is None:
                print("No se pudo cargar la molécula en RDKit.")
                return None

            print("Molécula cargada correctamente en RDKit.")
            # Generar coordenadas 2D si no existen
            AllChem.Compute2DCoords(mol)
            return mol

        except Exception as e:
            print(f"Error al descargar o procesar la estructura: {e}")
            return None

    @staticmethod
    def mol_from_smiles(smiles_string):
        """
        Crea una molécula RDKit desde un string SMILES.

        Args:
            smiles_string (str): String SMILES

        Returns:
            rdkit.Chem.Mol: Molécula cargada o None si falla
        """
        try:
            mol = Chem.MolFromSmiles(smiles_string)
            if mol is None:
                print("SMILES inválido.")
                return None

            # Generar coordenadas 2D
            AllChem.Compute2DCoords(mol)
            return mol

        except Exception as e:
            print(f"Error al procesar SMILES: {e}")
            return None

    @staticmethod
    def generate_molecule_image(mol, width=300, height=300):
        """
        Genera una imagen PNG de la molécula.

        Args:
            mol (rdkit.Chem.Mol): Molécula RDKit
            width (int): Ancho de la imagen
            height (int): Alto de la imagen

        Returns:
            str: Imagen en base64 o None si falla
        """
        try:
            if mol is None:
                return None

            # Generar la imagen
            img = Draw.MolToImage(mol, size=(width, height))

            # Convertir a base64
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            img_base64 = base64.b64encode(buffer.getvalue()).decode()

            return f"data:image/png;base64,{img_base64}"

        except Exception as e:
            print(f"Error al generar imagen de la molécula: {e}")
            return None

    @staticmethod
    def save_molecule_image(
        mol, filename="molecule.png", upload_path="molecular_images/"
    ):
        """
        Guarda una imagen de la molécula en el sistema de archivos de Django.

        Args:
            mol (rdkit.Chem.Mol): Molécula RDKit
            filename (str): Nombre del archivo
            upload_path (str): Ruta de subida

        Returns:
            str: Ruta del archivo guardado o None si falla
        """
        try:
            if mol is None:
                return None

            # Generar la imagen
            img = Draw.MolToImage(mol)

            # Convertir a bytes
            buffer = BytesIO()
            img.save(buffer, format="PNG")

            # Guardar usando Django storage
            file_path = os.path.join(upload_path, filename)
            saved_path = default_storage.save(file_path, ContentFile(buffer.getvalue()))

            return saved_path

        except Exception as e:
            print(f"Error al guardar imagen de la molécula: {e}")
            return None

    @staticmethod
    def get_molecule_properties(mol):
        """
        Calcula propiedades básicas de la molécula.

        Args:
            mol (rdkit.Chem.Mol): Molécula RDKit

        Returns:
            dict: Propiedades de la molécula
        """
        if mol is None:
            return {}

        try:
            from rdkit.Chem import Descriptors

            properties = {
                "molecular_weight": Descriptors.MolWt(mol),
                "logp": Descriptors.MolLogP(mol),
                "hbd": Descriptors.NumHDonors(mol),
                "hba": Descriptors.NumHAcceptors(mol),
                "tpsa": Descriptors.TPSA(mol),
                "rotatable_bonds": Descriptors.NumRotatableBonds(mol),
                "heavy_atom_count": Descriptors.HeavyAtomCount(mol),
                "ring_count": Descriptors.RingCount(mol),
                "aromatic_rings": Descriptors.NumAromaticRings(mol),
                "lipinski_violations": Descriptors.NumLipinskiViolations(mol),
            }

            return properties

        except Exception as e:
            print(f"Error al calcular propiedades de la molécula: {e}")
            return {}

    @staticmethod
    def validate_molecule_file(file_content, file_extension):
        """
        Valida si el contenido del archivo puede ser procesado por RDKit.

        Args:
            file_content (str): Contenido del archivo
            file_extension (str): Extensión del archivo (.pdb, .sdf, etc.)

        Returns:
            bool: True si es válido, False si no
        """
        try:
            mol = None

            if file_extension.lower() in [".pdb", ".ent"]:
                mol = Chem.MolFromPDBBlock(file_content, sanitize=False)
            elif file_extension.lower() in [".sdf", ".mol"]:
                mol = Chem.MolFromMolBlock(file_content, sanitize=False)
            elif file_extension.lower() in [".mol2"]:
                mol = Chem.MolFromMol2Block(file_content, sanitize=False)

            if mol is None:
                return False

            # Intentar sanitizar
            try:
                Chem.SanitizeMol(mol)
                return True
            except Exception:
                return False

        except Exception:
            return False

    @staticmethod
    def process_uploaded_molecule(uploaded_file):
        """
        Procesa un archivo de molécula subido y extrae información básica.

        Args:
            uploaded_file: Archivo subido de Django

        Returns:
            dict: Información de la molécula procesada
        """
        try:
            file_extension = os.path.splitext(uploaded_file.name)[1].lower()
            file_content = uploaded_file.read().decode("utf-8")

            # Validar archivo
            if not MolecularUtils.validate_molecule_file(file_content, file_extension):
                return {
                    "success": False,
                    "error": "Archivo de molécula inválido o corrupto",
                }

            # Cargar molécula
            mol = None
            if file_extension in [".pdb", ".ent"]:
                mol = Chem.MolFromPDBBlock(file_content)
            elif file_extension in [".sdf", ".mol"]:
                mol = Chem.MolFromMolBlock(file_content)
            elif file_extension in [".mol2"]:
                mol = Chem.MolFromMol2Block(file_content)

            if mol is None:
                return {"success": False, "error": "No se pudo cargar la molécula"}

            # Generar información
            properties = MolecularUtils.get_molecule_properties(mol)
            image_base64 = MolecularUtils.generate_molecule_image(mol)

            return {
                "success": True,
                "properties": properties,
                "image": image_base64,
                "smiles": Chem.MolToSmiles(mol) if mol else None,
            }

        except Exception as e:
            return {
                "success": False,
                "error": f"Error al procesar la molécula: {str(e)}",
            }
