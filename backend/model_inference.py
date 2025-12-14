"""
Plant Disease Inference Module
Loads trained model and performs predictions on uploaded images
"""

import os
import json
import numpy as np
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')

os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Lazy load TensorFlow (only when needed)
tf = None
keras = None

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "plant_disease_model.h5")
CLASS_INDICES_PATH = os.path.join(os.path.dirname(__file__), "models", "class_indices.json")
IMG_SIZE = (224, 224)

# Global model cache
_model = None
_class_indices = None

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
    
    # Import TensorFlow
    import tensorflow as tf_import
    from tensorflow import keras as keras_import
    tf = tf_import
    keras = keras_import
    
    print("Loading plant disease detection model...")
    _model = keras.models.load_model(MODEL_PATH)
    
    with open(CLASS_INDICES_PATH, 'r') as f:
        _class_indices = json.load(f)
    
    print(f"Model loaded successfully. {len(_class_indices)} classes available.")
    return _model, _class_indices


def predict_from_image(image_data: bytes) -> dict:
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
    except FileNotFoundError as e:
        return {
            "status": "error",
            "message": str(e),
            "model_available": False
        }
    
    try:
        # Load and preprocess image
        from PIL import Image
        import io
        
        img = Image.open(io.BytesIO(image_data))
        img = img.convert('RGB')
        img = img.resize(IMG_SIZE)
        
        # Convert to array and normalize
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        
        # Predict
        predictions = model.predict(img_array, verbose=0)
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
        
        # Check if it's a healthy class
        is_healthy = "healthy" in class_name.lower()
        
        # Get treatment info
        if is_healthy:
            return {
                "status": "healthy",
                "disease": None,
                "confidence": confidence,
                "message": f"Plant appears healthy ({class_name})",
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
                    "severity": metadata.get("severity", "medium"),
                    "confidence": confidence
                },
                "top_predictions": top_predictions,
                "treatment": {
                    "chemical": metadata.get("treatment", DEFAULT_TREATMENT["treatment"]),
                    "prevention": metadata.get("prevention", DEFAULT_TREATMENT["prevention"])
                },
                "crop_detected": metadata.get("crop", "unknown"),
                "message": f"Detected: {class_name}",
                "model_available": True
            }
            
    except Exception as e:
        return {
            "status": "error",
            "message": f"Error processing image: {str(e)}",
            "model_available": True
        }


def is_model_available() -> bool:
    """Check if trained model is available"""
    return os.path.exists(MODEL_PATH) and os.path.exists(CLASS_INDICES_PATH)


def get_available_classes() -> list:
    """Get list of classes the model can detect"""
    if not os.path.exists(CLASS_INDICES_PATH):
        return []
    
    with open(CLASS_INDICES_PATH, 'r') as f:
        class_indices = json.load(f)
    
    return list(class_indices.values())


if __name__ == "__main__":
    # Test the inference
    print("Testing inference module...")
    
    if is_model_available():
        print("✅ Model is available")
        classes = get_available_classes()
        print(f"✅ {len(classes)} classes: {classes[:5]}...")
    else:
        print("❌ Model not trained yet. Run train_model.py first.")
