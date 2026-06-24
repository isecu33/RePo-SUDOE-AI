"""
Visualizer File Manager for RePo-SUDOE-AI
Handles automatic detection and management of experiment files for 3D visualization
"""

import glob
import logging
import re
from pathlib import Path
from typing import Dict, List

logger = logging.getLogger(__name__)


class VisualizerFileManager:
    """
    Manages files for the 3D molecular visualizer.
    Automatically detects experiment files matching the pattern and copies them to the visualizer directory.
    """

    def __init__(self, project_root: str = None, user_id: int = None):
        if project_root is None:
            # Auto-detect project root based on current file location
            current_file = Path(__file__)
            self.project_root = current_file.parent.parent.parent
        else:
            self.project_root = Path(project_root)

        self.output_dir = self.project_root / "output"
        self.user_id = user_id

        # File patterns
        self.pdbqt_pattern = r"^([A-Za-z0-9]+)_([A-Za-z0-9_]+)_out\.pdbqt$"
        self.log_pattern = r"^([A-Za-z0-9]+)_([A-Za-z0-9_]+)_vina\.log$"

        logger.info(
            f"VisualizerFileManager initialized with project root: {self.project_root}, user_id: {user_id}"
        )

    def detect_experiment_files(self) -> Dict[str, Dict[str, str]]:
        """
        Detect experiment files in the output directory matching the pattern.
        If user_id is set, only scans that user's folder. Otherwise scans all.

        Returns:
            Dict mapping experiment identifiers to file paths
            Format: {
                "6TAV_Abemaciclib": {
                    "estructura_id": "6TAV",
                    "drug_id": "Abemaciclib",
                    "pdbqt_file": "path/to/6TAV_Abemaciclib_out.pdbqt",
                    "log_file": "path/to/6TAV_Abemaciclib_vina.log",
                    "user_folder": "username" or None
                }
            }
        """
        experiments = {}

        if not self.output_dir.exists():
            logger.warning(f"Output directory not found: {self.output_dir}")
            return experiments

        pdbqt_files = []

        # If user_id is specified, only scan that user's folder
        if self.user_id:
            user_output_dir = self.output_dir / str(self.user_id)
            if user_output_dir.exists():
                pdbqt_files = glob.glob(str(user_output_dir / "*_out.pdbqt"))
                logger.info(f"Scanning only user {self.user_id} folder")
            else:
                logger.warning(f"User folder not found: {user_output_dir}")
        else:
            # Scan root output directory
            pdbqt_files = glob.glob(str(self.output_dir / "*_out.pdbqt"))

            # Also scan all user subdirectories
            user_folders = [d for d in self.output_dir.iterdir() if d.is_dir()]
            for user_folder in user_folders:
                user_pdbqt_files = glob.glob(str(user_folder / "*_out.pdbqt"))
                pdbqt_files.extend(user_pdbqt_files)

        logger.info(f"Found {len(pdbqt_files)} PDBQT files")

        for pdbqt_file in pdbqt_files:
            filepath = Path(pdbqt_file)
            filename = filepath.name

            # Determine if file is in user folder
            user_folder = None
            if filepath.parent != self.output_dir:
                user_folder = filepath.parent.name

            # Match against pattern
            match = re.match(self.pdbqt_pattern, filename)
            if match:
                estructura_id = match.group(1)
                drug_id = match.group(2)
                experiment_key = f"{estructura_id}_{drug_id}"

                # Look for corresponding log file in same directory as pdbqt
                log_filename = f"{estructura_id}_{drug_id}_vina.log"
                log_filepath = filepath.parent / log_filename

                experiment = {
                    "estructura_id": estructura_id,
                    "drug_id": drug_id,
                    "pdbqt_file": str(filepath),
                    "log_file": str(log_filepath) if log_filepath.exists() else None,
                    "experiment_key": experiment_key,
                    "user_folder": user_folder,
                }

                experiments[experiment_key] = experiment
                logger.info(
                    f"Detected experiment: {experiment_key} (user: {user_folder or 'root'})"
                )

        return experiments

    def prepare_visualizer_files(self, experiment_key: str = None) -> Dict[str, any]:
        """
        Get experiment data directly from output folder for visualization.

        Args:
            experiment_key: Specific experiment to prepare. If None, prepares the most recent.

        Returns:
            Dict containing experiment data and file paths for visualization
        """
        try:
            # Detect available experiments
            experiments = self.detect_experiment_files()

            if not experiments:
                logger.warning("No experiment files detected")
                return {"success": False, "error": "No experiment files found"}

            # Select experiment to visualize
            if experiment_key is None:
                # Get the most recent experiment (by file modification time)
                latest_experiment = None
                latest_time = 0

                for key, exp in experiments.items():
                    if exp["pdbqt_file"] and Path(exp["pdbqt_file"]).exists():
                        file_time = Path(exp["pdbqt_file"]).stat().st_mtime
                        if file_time > latest_time:
                            latest_time = file_time
                            latest_experiment = key

                experiment_key = latest_experiment

            if experiment_key not in experiments:
                return {
                    "success": False,
                    "error": f"Experiment {experiment_key} not found",
                }

            # Prepare result with direct file paths from output directory
            experiment_data = experiments[experiment_key]
            result = {
                "success": True,
                "experiment_key": experiment_key,
                "estructura_id": experiment_data["estructura_id"],
                "drug_id": experiment_data["drug_id"],
                "files": {
                    "pdbqt": (
                        experiment_data["pdbqt_file"]
                        if experiment_data["pdbqt_file"]
                        and Path(experiment_data["pdbqt_file"]).exists()
                        else None
                    ),
                    "log": (
                        experiment_data["log_file"]
                        if experiment_data["log_file"]
                        and Path(experiment_data["log_file"]).exists()
                        else None
                    ),
                },
                "output_dir": str(self.output_dir),
            }

            logger.info(f"Successfully prepared visualizer files for: {experiment_key}")
            return result

        except Exception as e:
            logger.error(f"Error in prepare_visualizer_files: {e}")
            return {"success": False, "error": str(e)}

    def get_available_experiments(self) -> List[Dict[str, str]]:
        """
        Get list of all available experiments for visualization.

        Returns:
            List of experiment dictionaries with metadata
        """
        experiments = self.detect_experiment_files()
        experiment_list = []

        for key, exp in experiments.items():
            pdbqt_path = Path(exp["pdbqt_file"]) if exp["pdbqt_file"] else None
            log_path = Path(exp["log_file"]) if exp["log_file"] else None

            # Get file modification time for sorting
            mod_time = (
                pdbqt_path.stat().st_mtime if pdbqt_path and pdbqt_path.exists() else 0
            )

            experiment_info = {
                "id": key,
                "name": f"{exp['estructura_id']} + {exp['drug_id']}",
                "key": key,
                "estructura_id": exp["estructura_id"],
                "drug_id": exp["drug_id"],
                "has_pdbqt": bool(pdbqt_path and pdbqt_path.exists()),
                "has_log": bool(log_path and log_path.exists()),
                "user_folder": exp.get("user_folder"),
                "date": mod_time,
            }

            experiment_list.append(experiment_info)

        # Sort by date (most recent first)
        experiment_list.sort(key=lambda x: x["date"], reverse=True)

        logger.info(f"Returning {len(experiment_list)} experiments")
        return experiment_list


# Utility functions for integration with Django views


def get_file_manager(user_id: int = None) -> VisualizerFileManager:
    """Get configured file manager instance for specific user."""
    return VisualizerFileManager(user_id=user_id)


def prepare_latest_experiment(user_id: int = None):
    """Prepare latest experiment directly from output folder for specific user."""
    try:
        manager = get_file_manager(user_id=user_id)
        return manager.prepare_visualizer_files()
    except Exception as e:
        return {"success": False, "error": str(e)}


def prepare_specific_experiment(
    estructura_id: str, drug_id: str, user_id: int = None
) -> Dict[str, any]:
    """Prepare a specific experiment for visualization for specific user."""
    manager = get_file_manager(user_id=user_id)
    experiment_key = f"{estructura_id}_{drug_id}"
    return manager.prepare_visualizer_files(experiment_key)


def get_experiment_list(user_id: int = None) -> List[Dict[str, str]]:
    """Get list of available experiments for specific user."""
    manager = get_file_manager(user_id=user_id)
    return manager.get_available_experiments()
