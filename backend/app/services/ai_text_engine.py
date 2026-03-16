import os
import re

from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline

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
        word_count = len(re.findall(r"\b\w+\b", text))

        if self._is_insufficient_text(text, word_count):
            return {
                "confidence": 0.0,
                "fake_score": 0.0,
                "real_score": 0.0,
                "status": "Authentic (Human)",
                "is_synthetic": False,
                "artifacts": ["Insufficient text for reliable AI detection"],
            }

        results = self.detector(text, top_k=None)
        if isinstance(results, dict):
            results = [results]

        fake_score = 0.0
        real_score = 0.0
        top_label = ""
        top_score = 0.0
        for item in results:
            raw_label = str(item.get("label", "")).strip()
            normalized_label = self._normalize_label(raw_label)
            score = float(item.get("score", 0.0))
            if score >= top_score:
                top_score = score
                top_label = normalized_label
            if normalized_label == "fake":
                fake_score = score
            elif normalized_label == "real":
                real_score = score

        if fake_score == 0.0 and real_score == 0.0:
            if top_label == "fake":
                fake_score = top_score
                real_score = max(0.0, 1.0 - top_score)
            elif top_label == "real":
                real_score = top_score
                fake_score = max(0.0, 1.0 - top_score)

        heuristic_score, heuristic_artifacts = self._heuristic_synthetic_score(text, word_count)
        synthetic_probability = max(fake_score, heuristic_score)
        is_ai = synthetic_probability >= 0.5
        confidence = round(synthetic_probability * 100, 2)

        artifacts = []
        if heuristic_artifacts:
            artifacts.extend(heuristic_artifacts)
        artifacts.append("Predictable Pattern" if is_ai else "Natural Variance")

        return {
            "confidence": confidence,
            "fake_score": confidence,
            "real_score": round(real_score * 100, 2),
            "status": "Synthetic (AI)" if is_ai else "Authentic (Human)",
            "is_synthetic": is_ai,
            "artifacts": artifacts,
        }

    def _normalize_label(self, label: str) -> str:
        lowered = label.strip().lower()
        if lowered in {"fake", "synthetic", "ai", "generated"}:
            return "fake"
        if lowered in {"real", "human", "authentic"}:
            return "real"
        if lowered == "label_0":
            return "fake"
        if lowered == "label_1":
            return "real"
        return lowered

    def _is_insufficient_text(self, text: str, word_count: int) -> bool:
        cleaned = re.sub(r"\s+", " ", text).strip()
        if len(cleaned) < 25:
            return True
        if word_count <= 4:
            return True
        return False

    def _heuristic_synthetic_score(self, text: str, word_count: int) -> tuple[float, list[str]]:
        lowered = text.lower()
        artifacts: list[str] = []
        score = 0.0

        disclosure_patterns = (
            "not authentic",
            "ai-generated",
            "ai generated",
            "generated by ai",
            "written by ai",
            "chatgpt",
            "synthetic text",
            "this is fake",
        )
        if any(pattern in lowered for pattern in disclosure_patterns):
            score = max(score, 0.9)
            artifacts.append("Self-disclosed synthetic wording")

        ai_style_patterns = (
            "in today's",
            "in today’s",
            "rapidly evolving",
            "plays a crucial role",
            "is transforming",
            "providing instant",
            "moreover",
            "furthermore",
            "overall,",
            "in conclusion",
            "it is important to note",
            "when it comes to",
        )
        matched_ai_style = [pattern for pattern in ai_style_patterns if pattern in lowered]
        if matched_ai_style:
            base_score = 0.55 if word_count >= 8 else 0.0
            if base_score > 0:
                score = max(score, min(0.75, base_score + (0.05 * (len(matched_ai_style) - 1))))
                artifacts.append("Generic AI-style phrasing")

        comma_count = text.count(",")
        if word_count >= 10 and comma_count >= 2 and re.search(r"\b\w+ing\b", lowered):
            score = max(score, 0.58)
            artifacts.append("List-like generated cadence")

        suspicious_tokens = []
        for token in re.findall(r"[a-zA-Z]{6,}", text):
            normalized = token.lower()
            unique_ratio = len(set(normalized)) / max(len(normalized), 1)
            repeated_pair = any(normalized[i:i + 2] == normalized[i + 2:i + 4] for i in range(max(len(normalized) - 3, 0)))
            if unique_ratio <= 0.5 or repeated_pair:
                suspicious_tokens.append(token)

        if suspicious_tokens:
            score = max(score, 0.65 if len(suspicious_tokens) == 1 else 0.75)
            artifacts.append(f"Unnatural token pattern: {suspicious_tokens[0][:24]}")

        return score, artifacts
