"""FastAPI main application for Krishyak"""
from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Dict, List, Optional
import uvicorn

from simulation_engine import SimulationEngine
from price_forecaster import PriceForecaster
from yield_estimator import YieldEstimator
from cost_calculator import CostCalculator
from risk_engine import RiskEngine
from data_loader import DataLoader
import config
import os
from disease_detector import detect_disease_mock, CROP_DISEASES

# Initialize FastAPI app
app = FastAPI(
    title="Krishyak - AI Farm Decision Simulator",
    description="AI-powered farming decision support system for Indian farmers",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize engines
simulation_engine = SimulationEngine()
price_forecaster = PriceForecaster()
yield_estimator = YieldEstimator()
cost_calculator = CostCalculator()
risk_engine = RiskEngine()
data_loader = DataLoader()

# Pydantic models for request/response
class FarmingInput(BaseModel):
    crop: str = Field(..., description="Crop type")
    soil_type: str = Field(..., description="Soil type")
    area_hectares: float = Field(..., gt=0, description="Cultivation area in hectares")
    seed_quality: float = Field(..., ge=0, le=1, description="Seed quality (0-1 scale)")
    expected_rainfall: float = Field(..., ge=0, description="Expected rainfall in mm")
    rainfall_delay: int = Field(0, ge=0, description="Monsoon delay in days")
    irrigation_frequency: int = Field(..., ge=0, description="Irrigation times per month")
    fertilizer_mix: Dict[str, float] = Field(..., description="Fertilizer quantities (kg/hectare)")
    pest_probability: float = Field(..., ge=0, le=1, description="Pest attack probability (0-1)")
    labour_days: float = Field(30, gt=0, description="Labour days required")
    pest_control_intensity: float = Field(0.5, ge=0, le=1, description="Pest control intensity")
    sale_month: int = Field(2, ge=0, le=12, description="Planned sale month (0-12)")
    current_market_price: float = Field(2000, gt=0, description="Current market price per quintal")
    seed_quantity_kg: Optional[float] = None

class SimulationRequest(BaseModel):
    farming_input: FarmingInput
    num_simulations: int = Field(500, ge=100, le=2000, description="Number of micro-simulations")

class PriceForecastRequest(BaseModel):
    commodity: str
    current_price: float
    forecast_days: int = Field(60, ge=1, le=180)

# API Endpoints

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Krishyak - AI Farm Decision Simulator API",
        "version": "1.0.0",
        "endpoints": ["/simulate", "/forecast_prices", "/compare_scenarios", "/recommend", "/crops", "/soils"]
    }

@app.get("/crops")
async def get_crops():
    """Get list of supported crops"""
    return {"crops": config.CROPS}

@app.get("/soils")
async def get_soil_types():
    """Get list of soil types"""
    return {"soil_types": config.SOIL_TYPES}

@app.get("/fertilizers")
async def get_fertilizers():
    """Get fertilizer information"""
    return {"fertilizers": config.FERTILIZERS}

@app.post("/simulate")
async def simulate_farming(request: SimulationRequest):
    """
    Run comprehensive farming simulation
    Returns yield estimation, cost analysis, risk assessment, and profitability
    """
    try:
        params = request.farming_input.dict()
        
        # Set default seed quantity if not provided
        if params["seed_quantity_kg"] is None:
            params["seed_quantity_kg"] = params["area_hectares"] * 50
        
        # Run simulation
        result = simulation_engine._simulate_scenario(params, "current")
        
        return {
            "success": True,
            "data": result
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

@app.post("/forecast_prices")
async def forecast_commodity_prices(request: PriceForecastRequest):
    """
    Forecast commodity prices for next N days
    Returns price predictions and optimal selling window
    """
    try:
        forecast = price_forecaster.forecast_prices(
            request.commodity,
            request.current_price,
            request.forecast_days
        )
        
        return {
            "success": True,
            "data": forecast
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast error: {str(e)}")

@app.post("/compare_scenarios")
async def compare_scenarios(request: SimulationRequest):
    """
    Compare Current Plan vs AI Optimal Plan vs Worst Case
    Returns detailed comparison with What-If analysis
    """
    try:
        params = request.farming_input.dict()
        
        if params["seed_quantity_kg"] is None:
            params["seed_quantity_kg"] = params["area_hectares"] * 50
        
        # Run What-If simulation
        results = simulation_engine.run_whatif_simulation(
            params,
            request.num_simulations
        )
        
        return {
            "success": True,
            "data": results
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")

@app.post("/recommend")
async def get_recommendations(request: SimulationRequest):
    """
    Get AI-powered recommendations for optimal farming strategy
    Returns actionable insights and optimization suggestions
    """
    try:
        params = request.farming_input.dict()
        
        if params["seed_quantity_kg"] is None:
            params["seed_quantity_kg"] = params["area_hectares"] * 50
        
        # Run What-If simulation
        results = simulation_engine.run_whatif_simulation(params, 300)
        
        # Extract key recommendations
        recommendation_data = {
            "recommendation_text": results["recommendation"],
            "current_profit": results["current_plan"]["profit"],
            "optimal_profit": results["ai_optimal_plan"]["profit"],
            "profit_improvement": results["ai_optimal_plan"]["profit"] - results["current_plan"]["profit"],
            "current_risk": results["current_plan"]["risk"]["overall_risk_score"],
            "optimal_risk": results["ai_optimal_plan"]["risk"]["overall_risk_score"],
            "risk_reduction": results["current_plan"]["risk"]["overall_risk_score"] - results["ai_optimal_plan"]["risk"]["overall_risk_score"],
            "key_insights": results["ai_optimal_plan"]["risk"]["insights"],
            "optimal_parameters": results["ai_optimal_plan"]["parameters_used"]
        }
        
        return {
            "success": True,
            "data": recommendation_data
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Krishyak API"}


# ============ DISEASE DETECTION ENDPOINTS ============

@app.post("/detect_disease")
async def detect_disease(
    file: UploadFile = File(...),
    crop_type: str = Form(None)
):
    """
    Detect plant disease from uploaded image.
    Priority: Trained ML Model > Plant.ID API > Mock detection
    
    Args:
        file: Image file (JPG, PNG)
        crop_type: Optional crop type for more accurate detection
    
    Returns:
        Disease detection result with treatment recommendations
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Read file content
    try:
        contents = await file.read()
        
        # Check file size (max 10MB)
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error reading file: {str(e)}")
    
    # Use multi-source detection: ML Model > Reverse Image Search > Pattern Matching
    from disease_detector import detect_disease_multisource, get_detection_status
    
    try:
        result = detect_disease_multisource(contents, crop_type)
        status = get_detection_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Disease detection failed: {str(e)}")
    
    # Determine mode from detection sources (check for 'sources', not 'sources_used')
    sources = result.get("sources", [])
    source_names = [s.get("name", "").lower() for s in sources]
    
    if any("ml model" in name or "trained" in name for name in source_names):
        mode = "trained_model"
    elif any("visual" in name or "search" in name for name in source_names):
        mode = "visual_search"
    else:
        mode = "pattern_matching"
    
    return {
        "success": True,
        "data": result,
        "mode": mode,
        "detection_status": status
    }



@app.get("/diseases")
async def get_diseases():
    """Get list of supported disease categories by crop"""
    return {
        "success": True,
        "data": {
            crop: [d["name"] for d in diseases]
            for crop, diseases in CROP_DISEASES.items()
        }
    }


@app.get("/diseases/{crop}")
async def get_diseases_by_crop(crop: str):
    """Get diseases for a specific crop"""
    crop_lower = crop.lower()
    if crop_lower not in CROP_DISEASES:
        raise HTTPException(
            status_code=404,
            detail=f"Crop '{crop}' not found. Available: {', '.join(CROP_DISEASES.keys())}"
        )
    
    return {
        "success": True,
        "crop": crop,
        "diseases": CROP_DISEASES[crop_lower]
    }

# Run server
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
