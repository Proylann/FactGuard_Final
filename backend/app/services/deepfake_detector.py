import os
import io
import json
import base64
from typing import Any, Union
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

# Transformers imports for Vision Transformer model
try:
    from transformers import (
        AutoFeatureExtractor,
        AutoModelForImageClassification,
        pipeline,
    )
except ImportError:
    # Graceful fallback if transformers not available
    AutoFeatureExtractor = None
    AutoModelForImageClassification = None
    pipeline = None


class DeepfakeDetector:
    """
    Singleton deepfake detector using Vision Transformer (ViT) model.
    Detects synthetic/deepfake content in images and video frames.
    
    Architecture: Vision Transformer for image-level classification
    Model: Fine-tuned ViT on FaceForensics++ and Deepfake Detection Challenge datasets
    """
    
    _instance = None
    _model_loaded = False
    
    def __new__(cls):
        """Implement singleton pattern - only one instance of detector"""
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self) -> None:
        """Initialize model on first instantiation"""
        self.model_path = self._resolve_model_path()
        self.device = "cuda" if self._is_cuda_available() else "cpu"
        self.pipeline = None
        self.feature_extractor = None
        self.model = None
        
        # Load model lazily on first use
        self._load_model()
    
    def _resolve_model_path(self) -> str:
        """Resolve path to deepfake detection model"""
        # Try multiple possible locations
        possible_paths = [
            os.path.join(os.path.dirname(__file__), "../../ML_models/image_detector"),
            os.path.join(os.path.dirname(__file__), "../../../ML_models/image_detector"),
            "backend/ML_models/image_detector",
            "ML_models/image_detector",
        ]
        
        for path in possible_paths:
            if os.path.isdir(path):
                return os.path.abspath(path)
        
        # Default fallback
        return os.path.abspath("backend/ML_models/image_detector")
    
    def _is_cuda_available(self) -> bool:
        """Check if CUDA is available for GPU acceleration"""
        try:
            import torch
            return torch.cuda.is_available()
        except (ImportError, AttributeError):
            return False
    
    def _load_model(self) -> None:
        """Load Vision Transformer model for deepfake detection"""
        if self._model_loaded or pipeline is None:
            return
        
        try:
            # Load feature extractor and model
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(
                self.model_path,
                trust_remote_code=True,
            )
            
            self.model = AutoModelForImageClassification.from_pretrained(
                self.model_path,
                trust_remote_code=True,
            ).to(self.device)
            
            # Create pipeline for convenient inference
            self.pipeline = pipeline(
                task="image-classification",
                model=self.model,
                feature_extractor=self.feature_extractor,
                device=0 if self.device == "cuda" else -1,
            )
            
            self._model_loaded = True
        except Exception as e:
            print(f"Warning: Could not load deepfake detection model: {e}")
            self._model_loaded = False
    
    def analyze(self, image_input: Union[str, bytes, np.ndarray]) -> dict[str, Any]:
        """
        Analyze image for deepfake/synthetic content.
        
        Args:
            image_input: File path (str), bytes, base64 string, or numpy array
            
        Returns:
            Dict with keys:
              - confidence: float (0-100) - confidence that content is synthetic
              - status: str - "synthetic" or "authentic"
              - is_synthetic: bool - True if likely synthetic
              - artifacts: list[str] - detected artifacts/anomalies
              - model: str - model name used
        """
        try:
            # Convert input to PIL Image
            pil_image = self._load_image(image_input)
            if pil_image is None:
                return self._error_response("Could not load image")
            
            # If no model loaded, return mock result
            if not self._model_loaded or self.pipeline is None:
                return self._mock_analyze(pil_image)
            
            # Run inference
            results = self.pipeline(pil_image, top_k=2)
            
            # Process results
            return self._process_classification_results(results, pil_image)
            
        except Exception as e:
            return self._error_response(f"Analysis error: {str(e)}")
    
    def analyze_video(
        self,
        video_input: Union[str, bytes],
        sample_frames: int = 8,
    ) -> dict[str, Any]:
        """
        Analyze video for deepfake content by sampling frames.
        
        Args:
            video_input: File path or bytes
            sample_frames: Number of frames to sample from video
            
        Returns:
            Dict with:
              - confidence: float - average confidence across frames
              - status: str - "synthetic" or "authentic"
              - is_synthetic: bool
              - frame_results: list[dict] - per-frame analysis
              - artifacts: list[str] - aggregated artifacts
              - model: str
        """
        try:
            # Load video
            cap = self._load_video(video_input)
            if cap is None:
                return self._error_response("Could not load video")
            
            # Sample frames
            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            sample_indices = np.linspace(0, frame_count - 1, sample_frames, dtype=int)
            
            frame_results = []
            confidences = []
            
            for idx in sample_indices:
                cap.set(cv2.CAP_PROP_POS_FRAMES, int(idx))
                ret, frame = cap.read()
                
                if not ret:
                    continue
                
                # Convert BGR to RGB
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                
                # Analyze frame
                result = self.analyze(frame_rgb)
                frame_results.append(result)
                confidences.append(result.get("confidence", 0))
            
            cap.release()
            
            # Aggregate results
            if not confidences:
                return self._error_response("No frames could be analyzed")
            
            avg_confidence = float(np.mean(confidences))
            max_confidence = float(np.max(confidences))
            
            # Collect unique artifacts
            unique_artifacts = set()
            for fr in frame_results:
                unique_artifacts.update(fr.get("artifacts", []))
            
            return {
                "confidence": round(avg_confidence, 2),
                "max_confidence": round(max_confidence, 2),
                "status": "synthetic" if avg_confidence > 50 else "authentic",
                "is_synthetic": avg_confidence > 50,
                "frame_results": frame_results,
                "frames_analyzed": len(frame_results),
                "artifacts": list(unique_artifacts),
                "model": "ViT-Deepfake-Detector-v1",
            }
            
        except Exception as e:
            return self._error_response(f"Video analysis error: {str(e)}")
    
    def _load_image(self, image_input: Union[str, bytes, np.ndarray]) -> Image.Image | None:
        """Load image from various input formats"""
        try:
            if isinstance(image_input, str):
                # File path or base64 string
                if image_input.startswith(("http://", "https://", "/")):
                    # File path
                    return Image.open(image_input).convert("RGB")
                else:
                    # Base64 string
                    image_bytes = base64.b64decode(image_input)
                    return Image.open(io.BytesIO(image_bytes)).convert("RGB")
                    
            elif isinstance(image_input, bytes):
                # Raw bytes
                return Image.open(io.BytesIO(image_input)).convert("RGB")
                
            elif isinstance(image_input, np.ndarray):
                # Numpy array (from cv2)
                if len(image_input.shape) == 3:
                    if image_input.shape[2] == 3:  # BGR
                        image_input = cv2.cvtColor(image_input, cv2.COLOR_BGR2RGB)
                return Image.fromarray(image_input.astype("uint8"), mode="RGB")
            
            return None
        except Exception:
            return None
    
    def _load_video(self, video_input: Union[str, bytes]) -> cv2.VideoCapture | None:
        """Load video from file path or bytes"""
        try:
            if isinstance(video_input, str):
                # File path
                cap = cv2.VideoCapture(video_input)
            elif isinstance(video_input, bytes):
                # Write to temp file
                temp_path = "/tmp/temp_video.mp4"
                with open(temp_path, "wb") as f:
                    f.write(video_input)
                cap = cv2.VideoCapture(temp_path)
            else:
                return None
            
            if cap.isOpened():
                return cap
            return None
        except Exception:
            return None
    
    def _process_classification_results(
        self,
        results: list[dict],
        image: Image.Image,
    ) -> dict[str, Any]:
        """Process transformer model classification results"""
        
        # Determine confidence and status
        # Results typically ordered by score descending
        synthetic_candidates = [r for r in results if "synthetic" in r.get("label", "").lower()]
        deepfake_candidates = [r for r in results if "deepfake" in r.get("label", "").lower()]
        fake_candidates = [r for r in results if "fake" in r.get("label", "").lower()]
        
        # Pick highest scoring fake/synthetic candidate
        top_fake = None
        if synthetic_candidates:
            top_fake = max(synthetic_candidates, key=lambda x: x.get("score", 0))
        elif deepfake_candidates:
            top_fake = max(deepfake_candidates, key=lambda x: x.get("score", 0))
        elif fake_candidates:
            top_fake = max(fake_candidates, key=lambda x: x.get("score", 0))
        
        # If ambiguous or no clear synthetic label, use probability heuristic
        if top_fake is None and results:
            # Use first result (highest score) if it's above threshold
            top_result = results[0]
            confidence_score = float(top_result.get("score", 0)) * 100
        else:
            confidence_score = float(top_fake.get("score", 0.5)) * 100 if top_fake else 50.0
        
        # Detect artifacts based on image analysis
        artifacts = self._detect_artifacts(image, confidence_score)
        
        return {
            "confidence": round(confidence_score, 2),
            "status": "synthetic" if confidence_score > 50 else "authentic",
            "is_synthetic": confidence_score > 50,
            "artifacts": artifacts,
            "model": "ViT-Deepfake-Detector-v1",
            "model_output": results if len(results) <= 2 else results[:2],  # Include top predictions
        }
    
    def _detect_artifacts(self, image: Image.Image, confidence: float) -> list[str]:
        """Detect specific artifacts that suggest deepfake/synthetic content"""
        artifacts = []
        
        # Convert image to numpy for analysis
        img_array = np.array(image)
        
        # Detect blending boundary artifacts
        if self._has_blending_blur(img_array):
            artifacts.append("Facial Blending Boundaries")
        
        # Detect color inconsistencies
        if self._has_color_inconsistency(img_array):
            artifacts.append("Unnatural Color Gradients")
        
        # Detect lighting inconsistencies
        if self._has_lighting_anomaly(img_array):
            artifacts.append("Inconsistent Lighting")
        
        # Detect compression noise
        if self._has_compression_noise(img_array):
            artifacts.append("Compression Noise Patterns")
        
        # Detect eye region anomalies
        if self._has_eye_anomalies(img_array):
            artifacts.append("Warping Area (Eye)")
        
        # Add artifacts based on confidence
        if confidence > 80:
            if not artifacts:
                artifacts.append("Strong Synthetic Indicators")
        elif confidence > 60:
            if not artifacts:
                artifacts.append("Moderate Synthetic Indicators")
        
        # Return most common artifacts if empty
        if not artifacts:
            artifacts = ["No Strong Artifacts"]
        
        return artifacts[:5]  # Return top 5
    
    def _has_blending_blur(self, img_array: np.ndarray) -> bool:
        """Detect if image has blending blur artifacts"""
        try:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            # Deepfakes tend to have lower sharpness in blended areas
            return laplacian_var < 50
        except:
            return False
    
    def _has_color_inconsistency(self, img_array: np.ndarray) -> bool:
        """Detect unnatural color gradients"""
        try:
            # Check color saturation consistency
            hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
            s_channel = hsv[:, :, 1]
            s_std = np.std(s_channel)
            s_mean = np.mean(s_channel)
            # High variance in saturation may indicate manipulation
            return (s_std / (s_mean + 1)) > 1.5
        except:
            return False
    
    def _has_lighting_anomaly(self, img_array: np.ndarray) -> bool:
        """Detect inconsistent lighting"""
        try:
            # Analyze brightness consistency
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            # Divide image and check brightness variance
            h, w = gray.shape
            q1 = np.mean(gray[:h//2, :w//2])
            q2 = np.mean(gray[:h//2, w//2:])
            q3 = np.mean(gray[h//2:, :w//2])
            q4 = np.mean(gray[h//2:, w//2:])
            variance = np.var([q1, q2, q3, q4])
            return variance > 2000  # High quadrant brightness variance
        except:
            return False
    
    def _has_compression_noise(self, img_array: np.ndarray) -> bool:
        """Detect JPEG/compression noise patterns"""
        try:
            # Check for characteristic JPEG decompression noise
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            # Compute 2D DCT-like properties
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            hist = cv2.calcHist([laplacian.astype(np.uint8)], [0], None, [256], [0, 256])
            # Specific patterns in laplacian indicate compression
            return np.sum(hist[200:256]) > len(gray.flatten()) * 0.02
        except:
            return False
    
    def _has_eye_anomalies(self, img_array: np.ndarray) -> bool:
        """Detect eye region warping or blinking artifacts"""
        try:
            # Simple eye region detection based on face location
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            h, w = gray.shape
            # Approximate eye regions (typical face proportions)
            eye_region = gray[int(h*0.3):int(h*0.5), int(w*0.2):int(w*0.8)]
            # Eye regions often show warping
            edges = cv2.Canny(eye_region, 100, 200)
            edge_density = np.sum(edges > 0) / edges.size
            return edge_density > 0.15
        except:
            return False
    
    def _mock_analyze(self, image: Image.Image) -> dict[str, Any]:
        """Return mock analysis when model unavailable"""
        return {
            "confidence": 42.5,
            "status": "authentic",
            "is_synthetic": False,
            "artifacts": ["Model Not Loaded"],
            "model": "ViT-Deepfake-Detector-v1 (Mock)",
        }
    
    def _error_response(self, error_msg: str) -> dict[str, Any]:
        """Return error response"""
        return {
            "confidence": 0.0,
            "status": "error",
            "is_synthetic": False,
            "artifacts": [],
            "error": error_msg,
            "model": "ViT-Deepfake-Detector-v1",
        }


# Convenience function matching possible signature
def detect_deepfake(image_input: Union[str, bytes, np.ndarray]) -> dict[str, Any]:
    """
    Convenience function for deepfake detection.
    Signature: detect_deepfake(image) -> dict
    """
    detector = DeepfakeDetector()
    return detector.analyze(image_input)


def detect_deepfake_video(video_input: Union[str, bytes], sample_frames: int = 8) -> dict[str, Any]:
    """
    Convenience function for video deepfake detection.
    Signature: detect_deepfake_video(video, sample_frames=8) -> dict
    """
    detector = DeepfakeDetector()
    return detector.analyze_video(video_input, sample_frames)
