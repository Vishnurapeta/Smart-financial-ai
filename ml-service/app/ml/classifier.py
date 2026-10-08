"""Machine Learning Classifier: TF-IDF + Logistic Regression Baseline."""

import os
import json
import logging
from typing import Tuple, Dict, Any
import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score
from app.ml.dataset import TRAINING_DATA
from app.ml.preprocessor import clean_text

logger = logging.getLogger("ml_service")

ARTIFACTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "models", "artifacts")
MODEL_PATH = os.path.join(ARTIFACTS_DIR, "transaction_classifier.joblib")
MANIFEST_PATH = os.path.join(ARTIFACTS_DIR, "model_manifest.json")


class TransactionClassifier:
    """TF-IDF vectorizer + Logistic Regression model for financial transaction categorization."""

    def __init__(self):
        self.pipeline: Pipeline | None = None
        self.is_loaded = False
        self.metadata: Dict[str, Any] = {}

    def train_and_serialize(self) -> Dict[str, Any]:
        """Train the TF-IDF + Logistic Regression model on dataset and serialize artifacts."""
        os.makedirs(ARTIFACTS_DIR, exist_ok=True)

        texts = [clean_text(item[0]) for item in TRAINING_DATA]
        labels = [item[1] for item in TRAINING_DATA]

        logger.info(
            "Training transaction classifier on %d samples across %d classes...",
            len(texts),
            len(set(labels)),
        )

        # Feature Pipeline: Character/word n-grams with sublinear TF scaling
        pipeline = Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        ngram_range=(1, 2),
                        min_df=1,
                        sublinear_tf=True,
                        strip_accents="unicode",
                    ),
                ),
                (
                    "clf",
                    LogisticRegression(
                        C=2.5,
                        max_iter=1000,
                        class_weight="balanced",
                        solver="lbfgs",
                        random_state=42,
                    ),
                ),
            ]
        )

        pipeline.fit(texts, labels)

        # In-sample evaluation
        predictions = pipeline.predict(texts)
        acc = float(accuracy_score(labels, predictions))

        metadata = {
            "model_name": "transaction_category_tfidf_logreg",
            "version": "1.0.0",
            "framework": "scikit-learn",
            "training_samples": len(texts),
            "num_classes": len(set(labels)),
            "accuracy": round(acc, 4),
            "classes": sorted(list(set(labels))),
            "hyperparameters": {
                "ngram_range": [1, 2],
                "sublinear_tf": True,
                "C": 2.5,
                "solver": "lbfgs",
                "max_iter": 1000,
            },
        }

        # Serialize model pipeline and metadata manifest
        joblib.dump(pipeline, MODEL_PATH)
        with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        self.pipeline = pipeline
        self.is_loaded = True
        self.metadata = metadata

        logger.info(
            f"Model successfully trained & serialized to {MODEL_PATH} (Accuracy: {acc:.4f})"
        )
        return metadata

    def load_model(self) -> bool:
        """Load trained serialized model from disk, or train on the fly if missing."""
        if os.path.exists(MODEL_PATH) and os.path.exists(MANIFEST_PATH):
            try:
                self.pipeline = joblib.load(MODEL_PATH)
                with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                self.is_loaded = True
                logger.info(f"Loaded existing model artifact (v{self.metadata.get('version')})")
                return True
            except Exception as e:
                logger.warning(f"Failed to load model from {MODEL_PATH}, retrain needed: {e}")

        logger.info("Artifact not found or invalid; executing training...")
        self.train_and_serialize()
        return True

    def predict(self, raw_text: str) -> Tuple[str, float]:
        """Predict category slug and confidence probability for raw input text."""
        if not self.is_loaded or self.pipeline is None:
            self.load_model()

        cleaned = clean_text(raw_text)
        if not cleaned:
            # Fallback for empty strings
            return "shopping-retail", 0.30

        probs = self.pipeline.predict_proba([cleaned])[0]
        classes = self.pipeline.classes_

        top_idx = int(np.argmax(probs))
        predicted_class = str(classes[top_idx])
        confidence = float(probs[top_idx])

        return predicted_class, round(confidence, 4)


# Global singleton classifier instance
classifier = TransactionClassifier()
