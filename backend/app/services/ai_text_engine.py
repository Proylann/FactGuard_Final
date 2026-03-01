import os
from transformers import pipeline, AutoModelForSequenceClassification, AutoTokenizer

class AITextDetector:
    _instance = None

    def __new__(cls):
        """Ensures only one instance of the model exists in memory."""
        if cls._instance is None:
            cls._instance = super(AITextDetector, cls).__new__(cls)
            # Path to your ML_models folder
            BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            MODEL_PATH = os.path.join(BASE_DIR, "ML_models")
            
            print(f"Loading AI Model from {MODEL_PATH}...")
            tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
            model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
            
            # The 'pipeline' handles tokenization and scoring automatically
            cls._instance.detector = pipeline(
                "text-classification", 
                model=model, 
                tokenizer=tokenizer
            )
        return cls._instance

    def analyze(self, text: str):
        """Performs inference and returns the dynamic confidence score."""
        if not text.strip():
            return None
            
        # result looks like: [{'label': 'Fake', 'score': 0.99}]
        result = self.detector(text)[0]
        
        is_ai = result['label'] == "Fake"
        # The 'score' is your Dynamic Confidence Score
        confidence = round(result['score'] * 100, 2)
        
        return {
            "confidence": confidence,
            "status": "Synthetic (AI)" if is_ai else "Authentic (Human)",
            "is_synthetic": is_ai,
            "artifacts": ["Predictable Pattern"] if is_ai else ["Natural Variance"]
        }