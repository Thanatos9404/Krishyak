"""
Disease detection through the installed classifier.
Unavailable and uncertain predictions remain explicit.
"""
from typing import Any, Dict

# Disease category catalogue by crop (served by GET /diseases); not a diagnosis.
CROP_DISEASES = {
    "rice": ["rice_blast", "becterial_blight_rice", "brownspot", "tungro"],
    "wheat": ["wheat_yellow_rust", "wheat_brown_rust", "wheat_black_rust", "wheat_leaf_blight"],
    "cotton": ["leaf_curl", "anthracnose_cotton", "bacterial_blight_cotton"],
    "maize": ["common_rust", "gray_leaf_spot", "maize_ear_rot", "maize_fall_armyworm"],
    "sugarcane": ["mosaic_sugarcane", "redrot_sugarcane", "redrust_sugarcane"],
    "tomato": ["tomato_early_blight", "tomato_late_blight", "tomato_leaf_mold", "tomato_mosaic"],
    "potato": ["potato_early_blight", "potato_late_blight"],
    "mango": ["mango_anthracnose", "mango_powdery_mildew"],
    "grapes": ["grape_downy_mildew", "grape_powdery_mildew"],
    "citrus": ["citrus_canker", "citrus_greening"],
    "chilli": ["chilli_leaf_curl", "chilli_anthracnose"],
}


def detect_disease_multisource(image_data: bytes, crop_type: str = None) -> Dict[str, Any]:
    """Only a real classifier can produce a diagnosis. Never synthesize sources."""
    from model_inference import get_model_identity, predict_from_image
    result = predict_from_image(image_data, crop_type=crop_type)
    result['model_version'] = get_model_identity()
    result["sources"] = []
    if result.get("status") in ("healthy", "disease_detected", "uncertain"):
        confidence = result.get("confidence", (result.get("disease") or {}).get("confidence"))
        result["sources"] = [{"name": "Trained ML Model", "confidence": confidence, "icon": "🌿"}]
        result["combined_confidence"] = confidence
    return result


def get_detection_status() -> Dict[str, Any]:
    from model_inference import class_crop, get_available_classes, get_model_identity, is_model_available
    classes = get_available_classes()
    available = is_model_available()
    return {"model_available": available, "multi_source_available": False,
            "model_version": get_model_identity(),
            "sources": ["Trained ML Model"] if available else [],
            "classes": classes, "supported_crops": sorted(set(filter(None, map(class_crop, classes))))}
