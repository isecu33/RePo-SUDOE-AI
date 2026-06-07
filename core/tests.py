from django.test import TestCase
from django.contrib.auth import get_user_model
from core.models import ProteinDatabase, StructureCache, MolecularQuery
from core.services.visualizer_file_manager import VisualizerFileManager
import tempfile
import os
from pathlib import Path

User = get_user_model()


class ProteinDatabaseModelTests(TestCase):
    """Unit tests for ProteinDatabase model"""

    def setUp(self):
        self.protein = ProteinDatabase.objects.create(
            hgnc_symbol='CDK4',
            gene_name='Cyclin-dependent kinase 4',
            pdb_codes='2W96;2W9F;2W9Z',
            description='Cell cycle regulator',
            chromosome='12',
            uniprot_id='P11802'
        )

    def test_protein_creation(self):
        """Test protein database entry is created correctly"""
        self.assertEqual(self.protein.hgnc_symbol, 'CDK4')
        self.assertEqual(self.protein.gene_name, 'Cyclin-dependent kinase 4')
        self.assertIsNotNone(self.protein.created_at)

    def test_get_pdb_list(self):
        """Test PDB code parsing from semicolon-separated string"""
        pdb_list = self.protein.get_pdb_list()
        self.assertEqual(len(pdb_list), 3)
        self.assertIn('2W96', pdb_list)
        self.assertIn('2W9F', pdb_list)
        self.assertIn('2W9Z', pdb_list)

    def test_get_pdb_list_empty(self):
        """Test empty PDB list handling"""
        protein = ProteinDatabase.objects.create(
            hgnc_symbol='TEST',
            gene_name='Test Gene',
            pdb_codes=''
        )
        self.assertEqual(protein.get_pdb_list(), [])

    def test_get_structures_info(self):
        """Test structure information formatting"""
        structures = self.protein.get_structures_info()
        self.assertEqual(len(structures), 3)
        self.assertEqual(structures[0]['tipo'], 'experimental')
        self.assertEqual(structures[0]['id'], '2W96')
        self.assertIn('rcsb.org', structures[0]['fuente'])

    def test_string_representation(self):
        """Test model __str__ method"""
        expected = "CDK4 - Cyclin-dependent kinase 4"
        self.assertEqual(str(self.protein), expected)


class StructureCacheModelTests(TestCase):
    """Unit tests for StructureCache model"""

    def setUp(self):
        self.cache_entry = StructureCache.objects.create(
            pdb_code='7LXT',
            structure_data='ATOM      1  N   ALA A   1      10.000  10.000  10.000',
            download_url='https://files.rcsb.org/download/7LXT.pdb',
            file_size=1024,
            is_valid_structure=True
        )

    def test_cache_creation(self):
        """Test structure cache entry is created correctly"""
        self.assertEqual(self.cache_entry.pdb_code, '7LXT')
        self.assertTrue(self.cache_entry.is_valid_structure)
        self.assertEqual(self.cache_entry.access_count, 0)

    def test_mark_accessed(self):
        """Test access tracking functionality"""
        initial_count = self.cache_entry.access_count
        self.cache_entry.mark_accessed()
        self.assertEqual(self.cache_entry.access_count, initial_count + 1)
        self.assertIsNotNone(self.cache_entry.last_accessed)

    def test_unique_pdb_code(self):
        """Test PDB code uniqueness constraint"""
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            StructureCache.objects.create(
                pdb_code='7LXT',  # Duplicate
                structure_data='test',
                download_url='https://example.com',
                file_size=100
            )


class MolecularQueryModelTests(TestCase):
    """Unit tests for MolecularQuery logging model"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_query_creation(self):
        """Test molecular query logging"""
        query = MolecularQuery.objects.create(
            user=self.user,
            query_type='docking',
            original_query='Docking de Abemaciclib con CDK4',
            extracted_parameters={'drug': 'Abemaciclib', 'gene': 'CDK4'},
            response_data={'status': 'success'},
            success=True,
            processing_time_ms=1500,
            openai_calls=2
        )

        self.assertEqual(query.query_type, 'docking')
        self.assertTrue(query.success)
        self.assertEqual(query.openai_calls, 2)
        self.assertIn('Abemaciclib', query.extracted_parameters['drug'])

    def test_query_ordering(self):
        """Test queries are ordered by creation date (newest first)"""
        query1 = MolecularQuery.objects.create(
            user=self.user,
            query_type='general',
            original_query='Query 1'
        )
        query2 = MolecularQuery.objects.create(
            user=self.user,
            query_type='general',
            original_query='Query 2'
        )

        queries = MolecularQuery.objects.all()
        self.assertEqual(queries[0].id, query2.id)  # Newest first


class VisualizerFileManagerTests(TestCase):
    """Unit tests for VisualizerFileManager service"""

    def setUp(self):
        # Create temporary directory structure
        self.temp_dir = tempfile.mkdtemp()
        self.user_id = 1

        # Create user output directory
        self.user_output = Path(self.temp_dir) / 'output' / str(self.user_id)
        self.user_output.mkdir(parents=True, exist_ok=True)

        # Create sample PDBQT and log files
        pdbqt_file = self.user_output / '7LXT_Abemaciclib_out.pdbqt'
        pdbqt_file.write_text('MODEL 1\nATOM      1  N   ALA A   1\nENDMDL\n')

        log_file = self.user_output / '7LXT_Abemaciclib_vina.log'
        log_file.write_text('REMARK VINA RESULT:    -8.5\n')

        self.file_manager = VisualizerFileManager(
            project_root=self.temp_dir,
            user_id=self.user_id
        )

    def tearDown(self):
        # Clean up temporary directory
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_detect_experiment_files(self):
        """Test experiment file detection for specific user"""
        experiments = self.file_manager.detect_experiment_files()

        self.assertGreater(len(experiments), 0)
        exp_key = '7LXT_Abemaciclib'
        self.assertIn(exp_key, experiments)
        self.assertEqual(experiments[exp_key]['estructura_id'], '7LXT')
        self.assertEqual(experiments[exp_key]['drug_id'], 'Abemaciclib')

    def test_user_isolation(self):
        """Test that file manager only detects files for specific user"""
        # Create files for another user
        other_user_output = Path(self.temp_dir) / 'output' / '2'
        other_user_output.mkdir(parents=True, exist_ok=True)
        other_file = other_user_output / '2P9R_Palbociclib_out.pdbqt'
        other_file.write_text('MODEL 1\nENDMDL\n')

        # Manager should only see user 1's files
        experiments = self.file_manager.detect_experiment_files()

        self.assertIn('7LXT_Abemaciclib', experiments)
        self.assertNotIn('2P9R_Palbociclib', experiments)

    def test_get_available_experiments(self):
        """Test experiment list generation with metadata"""
        experiments = self.file_manager.get_available_experiments()

        self.assertIsInstance(experiments, list)
        if len(experiments) > 0:
            exp = experiments[0]
            self.assertIn('id', exp)
            self.assertIn('name', exp)
            self.assertIn('estructura_id', exp)
            self.assertIn('drug_id', exp)
            self.assertIn('has_pdbqt', exp)
            self.assertIn('has_log', exp)


class PDBQTParsingTests(TestCase):
    """Unit tests for PDBQT file parsing logic"""

    def test_extract_model_from_pdbqt(self):
        """Test extraction of MODEL blocks from PDBQT content"""
        pdbqt_content = """MODEL 1
REMARK VINA RESULT:    -8.5      0.000      0.000
ROOT
ATOM      1  N   UNL     1      10.000  10.000  10.000
ENDROOT
TORSDOF 5
ENDMDL
MODEL 2
REMARK VINA RESULT:    -8.2      1.500      2.000
ATOM      1  N   UNL     1      11.000  11.000  11.000
ENDMDL"""

        # Simulate MODEL extraction (simplified logic)
        models = []
        current_model = []
        in_model = False

        for line in pdbqt_content.split('\n'):
            if line.startswith('MODEL'):
                in_model = True
                current_model = [line]
            elif line.startswith('ENDMDL'):
                current_model.append(line)
                models.append('\n'.join(current_model))
                in_model = False
                current_model = []
            elif in_model:
                current_model.append(line)

        self.assertEqual(len(models), 2)
        self.assertIn('MODEL 1', models[0])
        self.assertIn('-8.5', models[0])
        self.assertIn('MODEL 2', models[1])

    def test_binding_affinity_extraction(self):
        """Test extraction of binding affinity from Vina log"""
        log_content = """#################################################################
# If you used AutoDock Vina in your work, please cite:          #
#################################################################

mode |   affinity | dist from best mode
     | (kcal/mol) | rmsd l.b.| rmsd u.b.
-----+------------+----------+----------
   1       -8.330      0.000      0.000
   2       -8.256      2.898      9.934"""

        # Extract binding affinity (first mode)
        lines = log_content.split('\n')
        affinity = None
        for line in lines:
            if line.strip().startswith('1'):
                parts = line.split()
                affinity = float(parts[1])
                break

        self.assertIsNotNone(affinity)
        self.assertEqual(affinity, -8.330)
