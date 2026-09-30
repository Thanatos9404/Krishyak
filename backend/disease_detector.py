"""
Disease detection through the installed classifier.
Unavailable and uncertain predictions remain explicit.
"""
from typing import Dict, List, Any, Optional

# Disease keywords for matching with image search results
DISEASE_KEYWORDS = {
    # Rice diseases
    "rice_blast": ["rice blast", "magnaporthe", "pyricularia", "blast disease rice", "leaf blast rice"],
    "becterial_blight_rice": ["bacterial blight rice", "xanthomonas", "kresek", "leaf blight rice"],
    "brownspot": ["brown spot rice", "bipolaris", "helminthosporium", "leaf spot rice"],
    "tungro": ["tungro", "rice tungro", "tungro virus", "grassy stunt"],
    
    # Wheat diseases
    "wheat_yellow_rust": ["yellow rust wheat", "stripe rust", "puccinia striiformis"],
    "wheat_brown_rust": ["brown rust wheat", "leaf rust wheat", "puccinia triticina"],
    "wheat_black_rust": ["black rust wheat", "stem rust", "puccinia graminis"],
    "wheat_leaf_blight": ["leaf blight wheat", "alternaria", "spot blotch wheat"],
    
    # Cotton diseases
    "leaf_curl": ["leaf curl cotton", "cotton leaf curl", "clcuv", "whitefly cotton"],
    "anthracnose_cotton": ["anthracnose cotton", "colletotrichum", "boll rot cotton"],
    "bacterial_blight_cotton": ["bacterial blight cotton", "angular leaf spot cotton"],
    
    # Maize diseases
    "common_rust": ["common rust maize", "puccinia sorghi", "rust corn"],
    "gray_leaf_spot": ["gray leaf spot", "cercospora zeae", "gls maize"],
    "maize_ear_rot": ["ear rot maize", "fusarium", "gibberella corn"],
    "maize_fall_armyworm": ["fall armyworm", "spodoptera frugiperda", "armyworm maize"],
    
    # Sugarcane diseases
    "mosaic_sugarcane": ["mosaic sugarcane", "scmv", "sugarcane mosaic virus"],
    "redrot_sugarcane": ["red rot sugarcane", "colletotrichum falcatum"],
    "redrust_sugarcane": ["red rust sugarcane", "puccinia sugarcane"],
    
    # Tomato diseases
    "tomato_early_blight": ["early blight tomato", "alternaria solani", "target spot tomato"],
    "tomato_late_blight": ["late blight tomato", "phytophthora infestans"],
    "tomato_leaf_mold": ["leaf mold tomato", "passalora fulva"],
    "tomato_mosaic": ["mosaic virus tomato", "tomv", "tomato mosaic"],
    
    # Potato diseases
    "potato_early_blight": ["early blight potato", "alternaria potato"],
    "potato_late_blight": ["late blight potato", "phytophthora potato"],
    
    # Mango diseases
    "mango_anthracnose": ["anthracnose mango", "colletotrichum mango"],
    "mango_powdery_mildew": ["powdery mildew mango", "oidium mangiferae"],
    
    # Grape diseases
    "grape_downy_mildew": ["downy mildew grape", "plasmopara viticola"],
    "grape_powdery_mildew": ["powdery mildew grape", "uncinula necator"],
    
    # Citrus diseases
    "citrus_canker": ["citrus canker", "xanthomonas citri"],
    "citrus_greening": ["citrus greening", "huanglongbing", "hlb citrus"],
    
    # Chilli diseases
    "chilli_leaf_curl": ["leaf curl chilli", "chilli leaf curl virus"],
    "chilli_anthracnose": ["anthracnose chilli", "colletotrichum capsici"],
}

# Treatment database
TREATMENTS = {
    "rice_blast": {
        "name": "Rice Blast",
        "severity": "high",
        "chemical": ["Tricyclazole 75% WP @ 0.6g/L", "Carbendazim 50% WP @ 1g/L"],
        "organic": ["Neem oil spray", "Pseudomonas fluorescens"],
        "prevention": ["Use resistant varieties", "Balanced fertilization", "Avoid excess nitrogen"]
    },
    "becterial_blight_rice": {
        "name": "Bacterial Blight",
        "severity": "high",
        "chemical": ["Streptocycline @ 0.01%", "Copper oxychloride @ 0.3%"],
        "organic": ["Bordeaux mixture"],
        "prevention": ["Use disease-free seeds", "Avoid clipping seedlings", "Drain fields"]
    },
    "brownspot": {
        "name": "Brown Spot",
        "severity": "medium",
        "chemical": ["Mancozeb 75% WP @ 2.5g/L", "Propiconazole 25% EC @ 1ml/L"],
        "organic": ["Trichoderma viride"],
        "prevention": ["Balanced NPK nutrition", "Avoid water stress"]
    },
    "tungro": {
        "name": "Tungro",
        "severity": "high",
        "chemical": ["Imidacloprid for leafhopper control"],
        "organic": ["Light traps", "Remove infected plants"],
        "prevention": ["Grow resistant varieties", "Control leafhopper population"]
    },
    "common_rust": {
        "name": "Common Rust",
        "severity": "medium",
        "chemical": ["Mancozeb @ 2.5g/L", "Propiconazole @ 1ml/L"],
        "organic": ["Remove infected leaves"],
        "prevention": ["Grow resistant hybrids", "Early planting"]
    },
    "gray_leaf_spot": {
        "name": "Gray Leaf Spot",
        "severity": "medium",
        "chemical": ["Azoxystrobin", "Pyraclostrobin"],
        "organic": ["Crop rotation"],
        "prevention": ["Residue management", "Use tolerant hybrids"]
    },
    "wheat_yellow_rust": {
        "name": "Yellow Rust",
        "severity": "high",
        "chemical": ["Propiconazole 25% EC @ 0.1%", "Tebuconazole 25% EC"],
        "organic": ["Sulfur dust"],
        "prevention": ["Timely sowing", "Use resistant varieties"]
    },
    "leaf_curl": {
        "name": "Leaf Curl Virus",
        "severity": "high",
        "chemical": ["Imidacloprid @ 0.5ml/L for whitefly"],
        "organic": ["Neem oil spray", "Yellow sticky traps"],
        "prevention": ["Early planting", "Remove infected plants"]
    },
    "tomato_late_blight": {
        "name": "Late Blight",
        "severity": "high",
        "chemical": ["Metalaxyl + Mancozeb @ 2.5g/L"],
        "organic": ["Copper hydroxide spray"],
        "prevention": ["Good drainage", "Avoid overhead irrigation"]
    },
    "tomato_early_blight": {
        "name": "Early Blight",
        "severity": "medium",
        "chemical": ["Mancozeb 75% WP @ 2.5g/L", "Chlorothalonil @ 2g/L"],
        "organic": ["Copper-based fungicides"],
        "prevention": ["Crop rotation", "Mulching"]
    },
}

# Crop-specific default diseases (when model not available)
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
    from model_inference import predict_from_image, get_model_identity
    result = predict_from_image(image_data, crop_type=crop_type)
    result['model_version'] = get_model_identity()
    result["sources"] = []
    if result.get("status") in ("healthy", "disease_detected", "uncertain"):
        confidence = result.get("confidence", (result.get("disease") or {}).get("confidence"))
        result["sources"] = [{"name": "Trained ML Model", "confidence": confidence, "icon": "🌿"}]
        result["combined_confidence"] = confidence
    return result


def detect_disease_mock(crop_type: str = None) -> Dict[str, Any]:
    return {"status": "unavailable", "disease": None, "sources": [],
            "message": "A working trained classifier is required for image diagnosis."}


def get_detection_status() -> Dict[str, Any]:
    from model_inference import is_model_available, get_available_classes, class_crop, get_model_identity
    classes = get_available_classes()
    available = is_model_available()
    return {"model_available": available, "multi_source_available": False,
            "model_version": get_model_identity(),
            "sources": ["Trained ML Model"] if available else [],
            "classes": classes, "supported_crops": sorted(set(filter(None, map(class_crop, classes))))}
