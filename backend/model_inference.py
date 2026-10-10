"""
Plant Disease Inference Module
Loads trained model and performs predictions on uploaded images
"""

import os
import json
import numpy as np
from pathlib import Path
import importlib.util
from threading import Lock

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Lazy load TensorFlow (only when needed)
tf = None
keras = None

# Keep model and label map together. Never silently fall back to older weights.
bundle = Path(os.getenv('KRISHYAK_DISEASE_BUNDLE') or
              Path(__file__).parent / 'models' / 'active').resolve()
_runtime = os.getenv('KRISHYAK_DISEASE_RUNTIME', 'auto').lower()
if _runtime not in {'auto', 'keras', 'litert'}:
    raise ValueError('KRISHYAK_DISEASE_RUNTIME must be auto, keras, or litert')
_use_litert = _runtime == 'litert' or (_runtime == 'auto' and (
    os.getenv('VERCEL') == '1' or importlib.util.find_spec('tensorflow') is None))
MODEL_PATH = str(bundle / ('model.tflite' if _use_litert else 'model.keras'))
CLASS_INDICES_PATH = str(bundle / 'class_indices.json')
IMG_SIZE = (224, 224)

# Global model cache
_model = None
_class_indices = None
_load_lock = Lock()

# Disease metadata for treatment recommendations
DISEASE_METADATA = {
    "Rice Blast": {
        "crop": "rice",
        "severity": "high",
        "treatment": [
            "Apply Tricyclazole 75% WP @ 0.6g/L water",
            "Use Carbendazim 50% WP @ 1g/L as foliar spray",
            "Remove and destroy infected plant debris"
        ],
        "prevention": [
            "Use resistant varieties (Pusa Basmati, IR64)",
            "Balanced fertilizer application",
            "Avoid excessive nitrogen"
        ]
    },
    "Becterial Blight in Rice": {
        "crop": "rice",
        "severity": "high",
        "treatment": [
            "Spray Streptomycin sulphate + Tetracycline @ 300g/ha",
            "Apply Copper oxychloride @ 1.25 kg/ha",
            "Drain water from field"
        ],
        "prevention": [
            "Use disease-free seeds",
            "Avoid clipping of seedlings during transplanting",
            "Do not apply excess nitrogen"
        ]
    },
    "Brownspot": {
        "crop": "rice",
        "severity": "medium",
        "treatment": [
            "Spray Mancozeb 75% WP @ 2.5g/L",
            "Apply Propiconazole 25% EC @ 1ml/L",
            "Ensure balanced NPK nutrition"
        ],
        "prevention": [
            "Use certified disease-free seeds",
            "Add potash to soil",
            "Avoid water stress"
        ]
    },
    "Tungro": {
        "crop": "rice",
        "severity": "high",
        "treatment": [
            "No direct cure - remove infected plants",
            "Control leafhopper vectors with Imidacloprid",
            "Use light traps to monitor vectors"
        ],
        "prevention": [
            "Grow resistant varieties",
            "Synchronize planting dates",
            "Control green leafhopper population"
        ]
    },
    "Common_Rust": {
        "crop": "maize",
        "severity": "medium",
        "treatment": [
            "Apply Mancozeb @ 2.5g/L at first symptoms",
            "Spray Propiconazole @ 1ml/L",
            "Two applications at 15-day interval"
        ],
        "prevention": [
            "Grow resistant hybrids",
            "Early planting",
            "Balanced fertilization"
        ]
    },
    "Gray_Leaf_Spot": {
        "crop": "maize",
        "severity": "medium",
        "treatment": [
            "Apply foliar fungicides at early tasseling",
            "Use Azoxystrobin or Pyraclostrobin",
            "Repeat application if needed"
        ],
        "prevention": [
            "Crop rotation with non-host crops",
            "Residue management",
            "Use tolerant hybrids"
        ]
    },
    "Wheat___Yellow_Rust": {
        "crop": "wheat",
        "severity": "high",
        "treatment": [
            "Spray Propiconazole 25% EC @ 0.1%",
            "Apply Tebuconazole 25% EC @ 1ml/L",
            "First spray at disease appearance"
        ],
        "prevention": [
            "Grow resistant varieties (HD 2967, HD 3086)",
            "Timely sowing",
            "Avoid excessive nitrogen"
        ]
    },
    "Wheat Brown leaf Rust": {
        "crop": "wheat",
        "severity": "medium",
        "treatment": [
            "Spray Mancozeb 75% WP @ 0.25%",
            "Apply Propiconazole @ 0.1%",
            "Repeat after 15 days if needed"
        ],
        "prevention": [
            "Use resistant varieties",
            "Optimal sowing time",
            "Balanced fertilization"
        ]
    },
    "Wheat black rust": {
        "crop": "wheat",
        "severity": "high",
        "treatment": [
            "Spray Propiconazole @ 0.1%",
            "Apply Tebuconazole 25% EC",
            "Immediate action at first symptoms"
        ],
        "prevention": [
            "Eliminate barberry bushes nearby",
            "Grow resistant varieties",
            "Early sowing"
        ]
    },
    "Wheat leaf blight": {
        "crop": "wheat",
        "severity": "medium",
        "treatment": [
            "Spray Mancozeb @ 2.5g/L",
            "Apply Propiconazole if severe",
            "Ensure proper drainage"
        ],
        "prevention": [
            "Use disease-free seeds",
            "Crop rotation",
            "Avoid waterlogging"
        ]
    },
    "Leaf Curl": {
        "crop": "cotton",
        "severity": "high",
        "treatment": [
            "Control whitefly with Imidacloprid @ 0.5ml/L",
            "Remove infected plants early",
            "Use yellow sticky traps"
        ],
        "prevention": [
            "Grow resistant varieties",
            "Early sowing",
            "Destroy crop residues"
        ]
    },
    "Anthracnose on Cotton": {
        "crop": "cotton",
        "severity": "high",
        "treatment": [
            "Spray Mancozeb @ 2.5g/L",
            "Apply Carbendazim @ 1g/L",
            "Remove infected bolls"
        ],
        "prevention": [
            "Use disease-free seeds",
            "Crop rotation",
            "Proper drainage"
        ]
    },
    "bacterial_blight in Cotton": {
        "crop": "cotton",
        "severity": "high",
        "treatment": [
            "Spray Streptocycline @ 0.01%",
            "Copper oxychloride @ 0.3%",
            "Remove infected plants"
        ],
        "prevention": [
            "Use certified seeds",
            "Seed treatment",
            "Crop rotation"
        ]
    },
    "Mosaic sugarcane": {
        "crop": "sugarcane",
        "severity": "medium",
        "treatment": [
            "Remove and destroy infected plants",
            "Control aphid vectors",
            "Use virus-free planting material"
        ],
        "prevention": [
            "Use disease-free setts",
            "Hot water treatment of setts",
            "Control aphids"
        ]
    },
    "RedRot sugarcane": {
        "crop": "sugarcane",
        "severity": "high",
        "treatment": [
            "No effective chemical control",
            "Remove and burn infected plants",
            "Avoid ratoon from infected fields"
        ],
        "prevention": [
            "Use resistant varieties",
            "Treat setts with Carbendazim",
            "Crop rotation"
        ]
    }
}

# Default treatment for unknown diseases
DEFAULT_TREATMENT = {
    "treatment": [
        "Consult local agricultural officer",
        "Take sample for laboratory diagnosis",
        "Isolate affected plants"
    ],
    "prevention": [
        "Regular field monitoring",
        "Balanced fertilization",
        "Crop rotation"
    ]
}


class LiteRTClassifier:
    """Float32 adapter; serialize interpreter mutation across concurrent requests."""
    def __init__(self, path):
        from ai_edge_litert.interpreter import Interpreter
        self.interpreter = Interpreter(model_path=path, num_threads=2)
        self.interpreter.allocate_tensors()
        inputs = self.interpreter.get_input_details()
        outputs = self.interpreter.get_output_details()
        if len(inputs) != 1 or len(outputs) != 1:
            raise ValueError('Expected one classifier input and output')
        self.input, self.output = inputs[0], outputs[0]
        if self.input['dtype'] != np.float32 or self.output['dtype'] != np.float32:
            raise ValueError('Expected unquantized float32 classifier tensors')
        self.input_shape = tuple(self.input['shape'])
        self.output_shape = tuple(self.output['shape'])
        self.lock = Lock()

    def predict(self, values, verbose=0):
        if values.shape != self.input_shape or values.dtype != np.float32:
            raise ValueError('Unexpected classifier input tensor')
        with self.lock:
            self.interpreter.set_tensor(self.input['index'], values)
            self.interpreter.invoke()
            return self.interpreter.get_tensor(self.output['index'])


def load_model():
    """Load the trained model and class indices"""
    global _model, _class_indices, tf, keras
    
    if _model is not None:
        return _model, _class_indices
    
    # Check if model exists
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            f"Model not found at {MODEL_PATH}. "
            "Please train the model first using: python train_model.py"
        )
    
    if not os.path.exists(CLASS_INDICES_PATH):
        raise FileNotFoundError(
            f"Class indices not found at {CLASS_INDICES_PATH}. "
            "Please train the model first."
        )
    
    print("Loading plant disease detection model...")
    with _load_lock:
        if _model is None:
            if MODEL_PATH.endswith('.tflite'):
                import hashlib
                verification = json.loads((Path(MODEL_PATH).parent / 'runtime-verification.json').read_text())
                if hashlib.sha256(Path(MODEL_PATH).read_bytes()).hexdigest() != verification['artifact_sha256']:
                    raise ValueError('Classifier runtime artifact digest mismatch')
                if hashlib.sha256(Path(CLASS_INDICES_PATH).read_bytes()).hexdigest() != verification['class_indices_sha256']:
                    raise ValueError('Classifier label map digest mismatch')
                candidate = LiteRTClassifier(MODEL_PATH)
            else:
                import tensorflow as tf_import
                from tensorflow import keras as keras_import
                tf, keras = tf_import, keras_import
                candidate = keras.models.load_model(MODEL_PATH, compile=False)
            with open(CLASS_INDICES_PATH, 'r') as f:
                labels = json.load(f)
            if (not isinstance(labels, dict) or not labels
                    or set(labels) != {str(index) for index in range(len(labels))}
                    or any(not isinstance(label, str) or not label.strip() for label in labels.values())
                    or len(set(labels.values())) != len(labels)):
                raise ValueError('Class map must contain unique names indexed by canonical consecutive integers')
            if (not isinstance(candidate.output_shape, tuple) or len(candidate.output_shape) != 2
                    or candidate.output_shape[-1] != len(labels)):
                raise ValueError('Model output and class map do not match')
            if not isinstance(candidate.input_shape, tuple) or len(candidate.input_shape) != 4 or candidate.input_shape[1:] != (224, 224, 3):
                raise ValueError('Expected a 224x224 RGB image model')
            _class_indices = labels
            _model = candidate
    
    print(f"Model loaded successfully. {len(_class_indices)} classes available.")
    return _model, _class_indices


def class_crop(label: str):
    """Explicit legacy aliases plus the crop___condition convention for new datasets."""
    name = label.casefold()
    if '___' in name:
        name = name.split('___')[0]
    for crop in ['sugarcane', 'cotton', 'wheat', 'rice', 'maize', 'tomato', 'potato',
                 'apple', 'blueberry', 'cherry', 'grape', 'orange', 'peach', 'pepper',
                 'raspberry', 'soybean', 'squash', 'strawberry']:
        if crop in name:
            return crop
    if 'corn' in name:
        return 'maize'
    return {'brownspot': 'rice', 'tungro': 'rice', 'leaf smut': 'rice',
            'common_rust': 'maize', 'gray_leaf_spot': 'maize', 'army worm': 'maize',
            'flag smut': 'wheat', 'leaf curl': 'cotton', 'wilt': 'cotton'}.get(name)


def predict_from_image(image_data: bytes, crop_type: str = None) -> dict:
    """
    Predict disease from image bytes
    
    Args:
        image_data: Image file as bytes
        
    Returns:
        dict with prediction results
    """
    global tf, keras
    
    try:
        model, class_indices = load_model()
    except (FileNotFoundError, ImportError, OSError, ValueError, RuntimeError, KeyError):
        return {
            "status": "unavailable",
            "message": "Image classifier could not be loaded. Install the ML dependencies and a compatible model bundle.",
            "model_available": False
        }
    
    try:
        # Load and preprocess image
        from PIL import Image, ImageOps
        import io
        
        with Image.open(io.BytesIO(image_data)) as original:
            if original.width * original.height > 25_000_000:
                raise ValueError("Image exceeds 25 megapixels")
            ImageOps.exif_transpose(original, in_place=True)
            # Match the white upload-preview background instead of classifying invisible RGB pixels.
            if original.mode in ('RGBA', 'LA') or 'transparency' in original.info:
                with original.convert('RGBA') as rgba:
                    with Image.new('RGBA', rgba.size, (255, 255, 255, 255)) as background:
                        with Image.alpha_composite(background, rgba) as composited:
                            with composited.convert('RGB') as rgb:
                                with rgb.resize(IMG_SIZE) as resized:
                                    img_array = np.asarray(resized, dtype=np.float32) / np.float32(255.0)
            else:
                with original.convert('RGB') as rgb:
                    with rgb.resize(IMG_SIZE) as resized:
                        img_array = np.asarray(resized, dtype=np.float32) / np.float32(255.0)
        img_array = np.expand_dims(img_array, axis=0)
    except (OSError, ValueError, Image.DecompressionBombError):
        return {"status": "invalid_image", "message": "The image could not be decoded. Upload a JPG, PNG or WebP image of at most 25 megapixels.",
                "model_available": True}
    except Exception:
        return {"status": "unavailable", "message": "The classifier could not process this request. Please try again later.",
                "model_available": True}

    try:
        predictions = np.asarray(model.predict(img_array, verbose=0))
        if (predictions.shape != (1, len(class_indices))
                or not np.all(np.isfinite(predictions))
                or np.any(predictions < 0) or np.any(predictions > 1)
                or not np.isclose(predictions.sum(), 1.0, atol=1e-4)):
            raise ValueError("Classifier returned an invalid probability distribution")
        predicted_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][predicted_idx])
        
        # Get class name
        class_name = class_indices.get(str(predicted_idx), "Unknown")
        
        # Get top 3 predictions
        top_indices = np.argsort(predictions[0])[-3:][::-1]
        top_predictions = [
            {
                "class": class_indices.get(str(idx), "Unknown"),
                "confidence": float(predictions[0][idx])
            }
            for idx in top_indices
        ]
        requested_crop = (crop_type or '').casefold().strip()
        requested_crop = {'corn': 'maize', 'grapes': 'grape', 'citrus': 'orange'}.get(requested_crop, requested_crop)
        supported = set(filter(None, map(class_crop, class_indices.values())))
        reason = None
        if requested_crop and requested_crop not in supported:
            reason = "This crop is not supported by the installed classifier."
        elif requested_crop and class_crop(class_name) != requested_crop:
            reason = "The predicted crop does not match the selected crop. Please verify the crop and photograph."
        elif confidence < 0.75:
            reason = "The classifier is uncertain. Obtain a clearer photograph and expert confirmation."
        if reason:
            return {"status": "uncertain", "message": reason, "disease": None,
                    "confidence": confidence, "top_predictions": top_predictions,
                    "model_available": True, "treatment": None}
        
        # Check if it's a healthy class
        is_healthy = "healthy" in class_name.lower()
        
        # Get treatment info
        if is_healthy:
            return {
                "status": "healthy",
                "crop_detected": class_crop(class_name),
                "disease": None,
                "confidence": confidence,
                "message": f"Classifier suggests a healthy class ({class_name}); this does not rule out disease.",
                "top_predictions": top_predictions,
                "suggestions": [
                    "Continue regular monitoring",
                    "Maintain balanced fertilization",
                    "Ensure proper irrigation",
                    "Watch for early signs of stress"
                ],
                "model_available": True
            }
        else:
            # Get disease metadata
            metadata = DISEASE_METADATA.get(class_name, DEFAULT_TREATMENT)
            
            return {
                "status": "disease_detected",
                "disease": {
                    "id": class_name.lower().replace(" ", "_"),
                    "name": class_name,
                    # Classification does not measure lesion area or field disease severity.
                    "severity": None,
                    "severity_source": "not_measured",
                    "confidence": confidence
                },
                "top_predictions": top_predictions,
                "treatment": {
                    "chemical": metadata.get("treatment", DEFAULT_TREATMENT["treatment"]),
                    "prevention": metadata.get("prevention", DEFAULT_TREATMENT["prevention"])
                },
                "crop_detected": class_crop(class_name) or metadata.get("crop", "unknown"),
                "message": f"Detected: {class_name}",
                "model_available": True
            }
            
    except Exception:
        return {
            "status": "unavailable",
            "message": "The classifier could not complete inference. Please try again later.",
            "model_available": True
        }



def is_model_available() -> bool:
    """Check if trained model is available"""
    return (os.path.exists(MODEL_PATH) and os.path.exists(CLASS_INDICES_PATH)
            and importlib.util.find_spec('ai_edge_litert' if MODEL_PATH.endswith('.tflite') else 'tensorflow') is not None
            and importlib.util.find_spec('PIL') is not None)


def get_available_classes() -> list:
    """Get list of classes the model can detect"""
    if not os.path.exists(CLASS_INDICES_PATH):
        return []
    
    with open(CLASS_INDICES_PATH, 'r') as f:
        class_indices = json.load(f)
    
    return list(class_indices.values())


def get_model_identity() -> str:
    """Expose the selected bundle's identifier without leaking a server path."""
    try:
        metadata = json.loads((Path(MODEL_PATH).parent / 'release.json').read_text(encoding='utf-8'))
        identifier = metadata.get('model_id')
        if isinstance(identifier, str) and len(identifier) <= 100:
            return identifier
    except (OSError, ValueError, AttributeError):
        pass
    return 'custom-disease-bundle'


if __name__ == "__main__":
    # Test the inference
    print("Testing inference module...")
    
    if is_model_available():
        print("✅ Model is available")
        classes = get_available_classes()
        print(f"✅ {len(classes)} classes: {classes[:5]}...")
    else:
        print("❌ Model not trained yet. Run train_model.py first.")
