import os
from transformers import pipeline, AutoModelForSequenceClassification, AutoTokenizer

class AITextDetector:
    _instance = None

    def __new__(cls):
        """Ensures only one instance of the model exists in memory."""
        if cls._instance is None:
            cls._instance = super(AITextDetector, cls).__new__(cls)
            cls._instance.detector = None
            cls._instance.model_path = cls._instance._resolve_model_path()
            cls._instance.load_error = None
            cls._instance._load_model()
        return cls._instance

    def _resolve_model_path(self) -> str:
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        candidate_paths = [
            os.path.join(base_dir, "ML_models", "text_detector"),
            os.path.join(base_dir, "ML_models"),
        ]
        for path in candidate_paths:
            if os.path.isdir(path):
                return path
        return candidate_paths[0]

    def _load_model(self) -> None:
        if self.detector is not None:
            return

        try:
            print(f"Loading AI Model from {self.model_path}...")
            tokenizer = AutoTokenizer.from_pretrained(self.model_path)
            model = AutoModelForSequenceClassification.from_pretrained(self.model_path)
            self.detector = pipeline(
                "text-classification",
                model=model,
                tokenizer=tokenizer,
            )
            self.load_error = None
        except Exception as exc:
            self.load_error = str(exc)
            raise RuntimeError(f"AI text model could not be loaded: {self.load_error}") from exc

    def ensure_model_loaded(self) -> None:
        self._load_model()

    def get_status(self):
        return {
            "loaded": self.detector is not None,
            "model_path": self.model_path,
            "error": self.load_error,
        }

    def analyze(self, text: str):
        """Performs inference and returns the dynamic confidence score."""
        if not text.strip():
            return None

        self.ensure_model_loaded()
            
        # result looks like: [{'label': 'Fake', 'score': 0.99}]
        result = self.detector(text)[0]

        label = str(result.get('label', '')).strip().lower()
        is_ai = label == "fake"
        # The 'score' is your Dynamic Confidence Score
        confidence = round(float(result.get('score', 0)) * 100, 2)
        
        return {
            "confidence": confidence,
            "status": "Synthetic (AI)" if is_ai else "Authentic (Human)",
            "is_synthetic": is_ai,
            "artifacts": ["Predictable Pattern"] if is_ai else ["Natural Variance"]
        }
