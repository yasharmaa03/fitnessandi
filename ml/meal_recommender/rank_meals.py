"""
rank_meals.py - LightGBM meal ranking service for Railway deployment

Loads the trained meal_ranker.txt model and provides ranking predictions
for meal candidates based on user profile and nutritional fit.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List

import lightgbm as lgb

logger = logging.getLogger(__name__)

# Model paths
_MODEL_DIR = Path(__file__).parent
_MODEL_PATH = _MODEL_DIR / "meal_ranker.txt"
_SCHEMA_PATH = _MODEL_DIR / "feature_schema.json"


class MealRanker:
    """LightGBM-based meal ranker for personalized recommendations"""

    def __init__(self):
        self.model = None
        self.schema = None
        self._load_model()

    def _load_model(self):
        """Load LightGBM model and feature schema"""
        try:
            # Load feature schema
            if not _SCHEMA_PATH.exists():
                raise FileNotFoundError(f"Feature schema not found: {_SCHEMA_PATH}")

            with open(_SCHEMA_PATH, "r", encoding="utf-8") as f:
                self.schema = json.load(f)
            
            logger.info(
                f"Loaded feature schema (version: {self.schema['version']}, "
                f"features: {self.schema['feature_count']})"
            )

            # Load LightGBM model
            if not _MODEL_PATH.exists():
                raise FileNotFoundError(f"Model file not found: {_MODEL_PATH}")

            self.model = lgb.Booster(model_file=str(_MODEL_PATH))
            logger.info(f"Loaded LightGBM model from {_MODEL_PATH}")

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise

    def validate_features(self, features: List[float]) -> bool:
        """
        Validate feature vector against schema
        
        Args:
            features: List of 7 floats representing meal features
            
        Returns:
            True if valid, False otherwise
        """
        if not self.schema:
            logger.error("Schema not loaded")
            return False

        expected_count = self.schema["feature_count"]
        if len(features) != expected_count:
            logger.error(
                f"Feature count mismatch: expected {expected_count}, got {len(features)}"
            )
            return False

        # Check all values are valid numbers
        for i, value in enumerate(features):
            if not isinstance(value, (int, float)) or not (-1e10 < value < 1e10):
                logger.error(f"Invalid feature value at index {i}: {value}")
                return False

        return True

    def rank_meals(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rank meal candidates using LightGBM model
        
        Args:
            candidates: List of meal objects with 'features' field
                Each candidate must have:
                {
                    "meal_id": str,
                    "features": [f1, f2, f3, f4, f5, f6, f7],
                    ... (other meal data)
                }
                
        Returns:
            Same list of candidates with 'score' field added, sorted by score (desc)
        """
        if not self.model:
            raise RuntimeError("Model not loaded")

        if not candidates:
            return []

        # Extract and validate feature vectors
        feature_vectors = []
        for i, candidate in enumerate(candidates):
            if "features" not in candidate:
                logger.warning(f"Candidate {i} missing 'features' field, skipping")
                continue

            features = candidate["features"]
            if not self.validate_features(features):
                logger.warning(f"Candidate {i} has invalid features, skipping")
                continue

            feature_vectors.append(features)

        if not feature_vectors:
            logger.error("No valid feature vectors found")
            return candidates

        # Run batch prediction
        try:
            scores = self.model.predict(feature_vectors)
            
            # Attach scores to candidates
            valid_idx = 0
            for candidate in candidates:
                if "features" in candidate and self.validate_features(candidate["features"]):
                    candidate["score"] = float(scores[valid_idx])
                    valid_idx += 1
                else:
                    candidate["score"] = -999.0  # Penalty for invalid features

            # Sort by score (descending)
            ranked = sorted(candidates, key=lambda x: x.get("score", -999.0), reverse=True)
            
            logger.info(f"Ranked {len(ranked)} candidates")
            return ranked

        except Exception as e:
            logger.error(f"Prediction failed: {e}")
            raise


# Global ranker instance
_ranker_instance = None


def get_ranker() -> MealRanker:
    """Get or create global meal ranker instance"""
    global _ranker_instance
    if _ranker_instance is None:
        _ranker_instance = MealRanker()
    return _ranker_instance
