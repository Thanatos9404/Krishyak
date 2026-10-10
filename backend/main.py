"""
FastAPI main application for Krishyak
AI-powered farming decision support system for Indian farmers
Version: 1.1.0 (Government-Ready with Security Hardening)
"""
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field, validator
from typing import Dict, Optional, Literal
import uvicorn

# Security and logging imports
from security import security_config, InputSanitizer, FileValidator, generate_request_id, normalize_request_id
from security import client_ip as resolve_client_ip
from logging_config import setup_logging, request_logger

# Engine imports
from simulation_engine import SimulationEngine
from price_forecaster import PriceForecaster
from yield_estimator import YieldEstimator
from cost_calculator import CostCalculator
from risk_engine import RiskEngine
from data_loader import DataLoader
import config
from disease_detector import CROP_DISEASES

# Initialize logging
logger = setup_logging()

from rate_limiter import RateLimiter
from remote_sensing.router import router as remote_sensing_router

rate_limiter = RateLimiter(security_config.rate_limit_per_minute, security_config.rate_limit_per_day)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management"""
    logger.info("🌾 Krishyak API starting up...")
    logger.info(f"Environment: {security_config.environment}")
    logger.info(f"CORS Origins: {security_config.cors_origins}")
    yield
    logger.info("🌾 Krishyak API shutting down...")

# Initialize FastAPI app
app = FastAPI(
    title="Krishyak API",
    description="Farming decision support system for Indian farmers",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if security_config.is_development else None,
    redoc_url="/redoc" if security_config.is_development else None,
)
app.include_router(remote_sensing_router)
from v2.application import install_v2
install_v2(app)

# CORS middleware with secure configuration. Keep the stable production alias
# explicit so a stale deployment environment cannot silently remove it.
cors_origins = list(dict.fromkeys([
    *security_config.cors_origins,
    "https://krishyak.vercel.app",
    "https://krishyak-yashvardhan-thanvis-projects.vercel.app",
]))

@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """Request logging, rate limiting, and error handling middleware"""
    start_time = time.time()
    request_id = normalize_request_id(request.headers.get("X-Request-ID"))
    request.state.request_id = request_id
    
    # Get client IP
    client_ip = resolve_client_ip(request)
    
    # Rate limiting
    # Stateless liveness probes must not consume the application request budget.
    # Readiness and business endpoints retain their existing limits.
    liveness_probe = request.method == 'GET' and request.url.path == '/health/live'
    allowed, reason = (True, '') if liveness_probe or request.url.path.startswith('/api/v2') else rate_limiter.is_allowed(client_ip)
    quotas = getattr(request.app.state, 'v2_quotas', None)
    if allowed and quotas is not None and not liveness_probe and not request.url.path.startswith('/api/v2'):
        # Shared across serverless instances; the in-memory limiter alone is
        # per process. Fails closed if the shared store is unavailable.
        from v2.usage import public_budget
        try:
            await run_in_threadpool(public_budget, quotas, request.url.path, client_ip)
        except HTTPException as error:
            allowed, reason = False, error.detail
            if error.status_code != 429:
                return JSONResponse(status_code=503, content={"success": False, "error": reason, "request_id": request_id},
                                    headers={"X-Request-ID": request_id})
    if not allowed:
        logger.warning(f"Rate limit exceeded for {client_ip}")
        return JSONResponse(
            status_code=429,
            content={"success": False, "error": reason, "request_id": request_id},
            headers={"X-Request-ID": request_id}
        )
    
    # Log request
    request_logger.log_request(
        request_id=request_id,
        method=request.method,
        path=request.url.path,
        user_ip=client_ip
    )
    
    try:
        response = await call_next(request)
        
        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Log response
        request_logger.log_response(
            request_id=request_id,
            status_code=response.status_code,
            duration_ms=duration_ms,
            path=request.url.path
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
        
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        request_logger.log_error(request_id, e, "Unhandled private API error" if request.url.path.startswith('/api/v2') else f"Unhandled error in {request.url.path}")
        if request.url.path.startswith('/api/v2'):
            return JSONResponse(status_code=500, headers={"X-Request-ID": request_id, "Cache-Control": "no-store"}, content={"error": {"code": "INTERNAL_ERROR", "message": "The service could not complete this request", "retryable": False, "request_id": request_id}})
        
        return JSONResponse(
            status_code=500,
            headers={"X-Request-ID": request_id},
            content={
                "success": False,
                "error": "Internal server error",
                "request_id": request_id
            }
        )

# Register outside request middleware so preflight and early error responses get CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID", "X-CSRF-Token"],
    expose_headers=["X-Request-ID"],
    max_age=600,
)

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler with structured response"""
    request_id = getattr(request.state, 'request_id', None) or normalize_request_id(request.headers.get("X-Request-ID"))
    if request.scope.get('path', '').startswith('/api/v2'):
        return JSONResponse(status_code=exc.status_code, headers={**(exc.headers or {}), "X-Request-ID": request_id},
            content={"error": {"code": {401: "SESSION_REQUIRED", 403: "ACCESS_DENIED", 404: "NOT_FOUND", 409: "CONFLICT", 429: "RATE_LIMITED", 503: "UNAVAILABLE"}.get(exc.status_code, "INVALID_REQUEST"),
                               "message": "Service unavailable" if exc.status_code >= 500 and exc.status_code != 503 else exc.detail,
                               "retryable": exc.status_code in {429, 503}, "request_id": request_id}})
    return JSONResponse(
        status_code=exc.status_code,
        headers={**(exc.headers or {}), "X-Request-ID": request_id},
        content={
            "success": False,
            "error": "Internal server error" if exc.status_code == 500 else exc.detail,
            "request_id": request_id
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    if request.url.path.startswith('/api/v2'):
        return JSONResponse(status_code=422, content={"error": {"code": "INVALID_REQUEST", "message": "Check the supplied values, dates, and supported units.", "retryable": False,
                            "request_id": getattr(request.state, 'request_id', None)}})
    from fastapi.exception_handlers import request_validation_exception_handler
    return await request_validation_exception_handler(request, exc)

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    request_id = getattr(request.state, 'request_id', None) or normalize_request_id(request.headers.get("X-Request-ID"))
    logger.error("Unhandled exception (%s)", type(exc).__name__, extra={"request_id": request_id})
    
    # Don't expose internal errors in production
    error_message = "Internal server error"
    
    return JSONResponse(
        status_code=500,
        headers={"X-Request-ID": request_id},
        content={
            "success": False,
            "error": error_message,
            "request_id": request_id
        }
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
    model_config = {"allow_inf_nan": False}
    crop: str = Field(..., description="Crop type")
    soil_type: str = Field(..., description="Soil type")
    area_hectares: float = Field(..., gt=0, le=1000000, description="Cultivation area in hectares")
    seed_quality: float = Field(..., ge=0, le=1, description="Seed quality (0-1 scale)")
    expected_rainfall: float = Field(..., ge=0, le=20000, description="Expected rainfall in mm")
    rainfall_delay: int = Field(0, ge=0, le=365, description="Monsoon delay in days")
    irrigation_frequency: int = Field(..., ge=0, le=100, description="Irrigation times per month")
    fertilizer_mix: Dict[str, float] = Field(..., description="Fertilizer quantities (kg/hectare)")
    pest_probability: float = Field(..., ge=0, le=1, description="Pest attack probability (0-1)")
    labour_days: float = Field(30, gt=0, le=10000000, description="Total person-days required across the farm")
    pest_control_intensity: float = Field(0.5, ge=0, le=1, description="Pest control intensity")
    sale_month: int = Field(2, ge=0, le=12, description="Planned sale month (0-12)")
    current_market_price: float = Field(2000, gt=0, le=10000000, description="Current market price per quintal")
    seed_quantity_kg: Optional[float] = Field(None, ge=0, le=100000000)
    season_months: float = Field(4, gt=0, le=24, description="Season duration used for monthly irrigation costs")

    @validator('fertilizer_mix')
    def validate_fertilizers(cls, value):
        import math
        if any(name not in config.FERTILIZERS or not math.isfinite(qty) or not 0 <= qty <= 100000 for name, qty in value.items()):
            raise ValueError('Fertilizers must be known products with finite non-negative quantities')
        return value

    @validator('crop')
    def validate_crop(cls, value):
        if value not in config.CROPS:
            raise ValueError('Unsupported crop')
        return value

    @validator('soil_type')
    def validate_soil(cls, value):
        if value not in config.SOIL_TYPES:
            raise ValueError('Unsupported soil type')
        return value

class SimulationRequest(BaseModel):
    farming_input: FarmingInput
    num_simulations: int = Field(500, ge=100, le=2000, description="Number of micro-simulations")

app.state.planning_input_model = FarmingInput
app.state.planning_engine = simulation_engine

class PriceForecastRequest(BaseModel):
    model_config = {"allow_inf_nan": False}
    commodity: str
    current_price: float = Field(..., gt=0, le=10000000)
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
def simulate_farming(request: SimulationRequest):
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
        
        from hybrid_inference import PredictionRouter
        final_result, meta = PredictionRouter.route_simulation(params, result)

        return {
            "success": True,
            "data": final_result,
            "metadata": meta.dict()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")

@app.post("/forecast_prices")
def forecast_commodity_prices(request: PriceForecastRequest):
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
        
        from hybrid_inference import PredictionRouter
        final_result, meta = PredictionRouter.route_price(request.commodity, forecast)

        return {
            "success": True,
            "data": final_result,
            "metadata": meta.dict()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast error: {str(e)}")

@app.post("/compare_scenarios")
def compare_scenarios(request: SimulationRequest):
    """
    Compare Current Plan vs Optimized Plan vs Worst Case
    Runs multiple scenarios and returns comparative data.
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
        
        from hybrid_inference import PredictionRouter
        final_result, meta = PredictionRouter.route_simulation(params, results)

        return {
            "success": True,
            "data": final_result,
            "metadata": meta.dict()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Comparison error: {str(e)}")

@app.post("/recommend")
def get_recommendations(request: SimulationRequest):
    """
    Get model-based recommendations for optimal farming strategy
    Analyzes parameters and suggests optimizations for better yield/profit.
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
        
        from hybrid_inference import PredictionRouter
        final_result, meta = PredictionRouter.route_simulation(params, recommendation_data)

        return {
            "success": True,
            "data": final_result,
            "metadata": meta.dict()
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
    Runs the installed classifier; unsupported or uncertain images do not produce treatments.
    
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
        contents = await file.read(10 * 1024 * 1024 + 1)
        
        # Check file size (max 10MB)
        if len(contents) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
        FileValidator.validate_image_upload(contents, file.content_type, file.filename or '')
        
    except HTTPException:
        raise
    except ValueError:
        raise HTTPException(status_code=400, detail="File content does not match an accepted image format.")
    except Exception as e:
        logger.error("Image upload read failed (%s)", type(e).__name__)
        raise HTTPException(status_code=500, detail="Image upload could not be read.")
    
    # Real model inference only; unavailable and uncertain outcomes are preserved.
    from disease_detector import detect_disease_multisource, get_detection_status
    
    try:
        from starlette.concurrency import run_in_threadpool
        result = await run_in_threadpool(detect_disease_multisource, contents, crop_type)
        status = get_detection_status()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Disease detection failed: {str(e)}")
    
    if result.get('status') == 'unavailable':
        raise HTTPException(status_code=503, detail=result['message'])
    if result.get('status') == 'invalid_image':
        raise HTTPException(status_code=400, detail=result['message'])
    from hybrid_inference import PredictionRouter
    final_result, meta = PredictionRouter.route_disease(crop_type or "", result, {})

    mode = meta.prediction_mode
    
    return {
        "success": True,
        "data": final_result,
        "mode": mode,
        "detection_status": status,
        "metadata": meta.dict()
    }



@app.get("/disease-capabilities")
def disease_capabilities():
    from disease_detector import get_detection_status
    return {"success": True, "data": get_detection_status()}


@app.get("/diseases")
async def get_diseases():
    """Get list of supported disease categories by crop"""
    return {
        "success": True,
        "data": {
            crop: diseases
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


# ==============================================================================
# WEATHER ALERT ENDPOINTS (Phase 3: Weather & Rain Alert System)
# ==============================================================================

from weather_alerts import weather_alert_service, AlertSeverity

class LocationRequest(BaseModel):
    """Request model for location-based weather queries"""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    crop: Optional[str] = Field(None, description="Crop type for specific thresholds")


@app.post("/weather/current")
async def get_current_weather(location: LocationRequest):
    """
    Get current weather conditions for a location
    """
    try:
        weather = await weather_alert_service.get_current_weather(
            location.lat, location.lon
        )
        
        if weather:
            return {
                "success": True,
                "data": weather
            }
        
        return {
            "success": False,
            "error": "Could not fetch weather data"
        }
        
    except Exception as e:
        logger.error(f"Error fetching current weather: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/weather/forecast")
async def get_weather_forecast(location: LocationRequest, hours: int = Query(48, ge=1, le=168)):
    """
    Get weather forecast for next 48 hours (default)
    """
    if hours > 168:  # Max 7 days
        hours = 168
    
    try:
        forecast = await weather_alert_service.get_forecast(
            location.lat, location.lon, hours
        )
        
        return {
            "success": True,
            "hours": hours,
            "forecast": [f.to_dict() for f in forecast],
            "count": len(forecast)
        }
        
    except Exception as e:
        logger.error(f"Error fetching forecast: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/weather/alerts")
async def get_weather_alerts(location: LocationRequest):
    """
    Get weather alerts and farming advisories for a location
    
    Generates crop-specific alerts based on:
    - Temperature extremes (frost, heatwave)
    - Rain predictions
    - Wind speed (spray timing)
    - Humidity levels (disease risk)
    - Irrigation recommendations
    """
    try:
        crop = location.crop or "default"
        alerts = await weather_alert_service.generate_alerts(
            location.lat, location.lon, crop
        )
        
        # Group by severity
        by_severity = {
            "critical": [],
            "warning": [],
            "advisory": [],
            "info": []
        }
        
        for alert in alerts:
            by_severity[alert.severity.value].append(alert.to_dict())
        
        return {
            "success": True,
            "crop": crop,
            "total_alerts": len(alerts),
            "by_severity": by_severity,
            "alerts": [a.to_dict() for a in alerts]
        }
        
    except Exception as e:
        logger.error(f"Error generating alerts: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/weather/rain-forecast")
async def get_rain_forecast(location: LocationRequest):
    """
    Get 7-day rain forecast summary
    Useful for irrigation and farming activity planning
    """
    try:
        summary = await weather_alert_service.get_rain_forecast_summary(
            location.lat, location.lon
        )
        
        return {
            "success": True,
            **summary
        }
        
    except Exception as e:
        logger.error(f"Error fetching rain forecast: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# PEST INTELLIGENCE ENDPOINTS (Phase 4: Pest & Disease Intelligence)
# ==============================================================================

from pest_intelligence import pest_service

class PestPredictionRequest(BaseModel):
    """Request model for pest outbreak predictions"""
    model_config = {"allow_inf_nan": False}
    crop: str = Field(..., min_length=2, max_length=50, description="Crop type")
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    temperature: float = Field(..., ge=-10, le=60, description="Current temperature in Celsius")
    humidity: float = Field(..., ge=0, le=100, description="Current humidity percentage")
    rainfall: float = Field(..., ge=0, le=10000, description="Recent rainfall in mm")


@app.post("/pest/prediction")
async def get_pest_prediction(request: PestPredictionRequest):
    """
    Get pest outbreak predictions based on crop, weather, and location.
    Uses an uncalibrated weather/season suitability index; no regional outbreak feed.
    """
    try:
        weather = {
            "temperature": request.temperature,
            "humidity": request.humidity,
            "rainfall": request.rainfall
        }
        
        predictions = pest_service.get_predictions(
            crop=request.crop,
            weather=weather,
            lat=request.lat,
            lng=request.lon
        )
        
        # Get seasonal risk for context
        seasonal_risk = pest_service.get_seasonal_risk(request.crop)
        
        return {
            "success": True,
            "crop": request.crop,
            "location": {"lat": request.lat, "lon": request.lon},
            "weather_conditions": weather,
            "predictions": predictions,
            "seasonal_context": seasonal_risk
        }
        
    except Exception as e:
        logger.error(f"Error generating pest prediction: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# FERTILIZER ANALYZER ENDPOINTS (Phase 5: Fertilizer Analyzer Engine)
# ==============================================================================

from fertilizer_analyzer import fertilizer_analyzer

class FertilizerRecommendationRequest(BaseModel):
    """Request model for fertilizer recommendations"""
    model_config = {'allow_inf_nan': False}
    crop: str = Field(..., min_length=2, max_length=50, description="Crop type")
    area_hectares: float = Field(1.0, ge=0.1, le=1000, description="Farm area in hectares")
    growth_stage: Literal["basal", "early_vegetative", "late_vegetative", "flowering", "grain_filling", "maturity"] = "basal"
    prefer_organic: bool = Field(False, description="Prefer organic alternatives")
    soil_n: Optional[float] = Field(None, ge=0, description="Soil available nitrogen (kg/ha)")
    soil_p: Optional[float] = Field(None, ge=0, description="Soil available phosphorus (kg/ha)")
    soil_k: Optional[float] = Field(None, ge=0, description="Soil available potassium (kg/ha)")
    soil_ph: Optional[float] = Field(None, ge=0, le=14, description="Soil pH")


@app.post("/fertilizer/recommendation")
async def get_fertilizer_recommendation(request: FertilizerRecommendationRequest):
    """
    Get personalized fertilizer recommendation based on crop and soil data.
    Returns NPK dosages, costs, and application methods.
    """
    try:
        # Build soil data dict if provided
        soil_data = None
        if any(v is not None for v in [request.soil_n, request.soil_p, request.soil_k, request.soil_ph]):
            soil_data = {
                "N": request.soil_n,
                "P": request.soil_p,
                "K": request.soil_k,
                "pH": request.soil_ph
            }
        
        recommendation = fertilizer_analyzer.get_recommendation(
            crop=request.crop,
            soil_data=soil_data,
            area_hectares=request.area_hectares,
            growth_stage=request.growth_stage,
            prefer_organic=request.prefer_organic
        )
        
        logger.info(f"Fertilizer recommendation generated for {request.crop}")
        
        return {
            "success": True,
            **recommendation
        }
        
    except Exception as e:
        logger.error(f"Error generating fertilizer recommendation: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/fertilizer/schedule")
async def get_fertilizer_schedule(crop: str, area_hectares: float = Query(1.0, gt=0, le=1000)):
    """
    Get complete fertilizer application schedule for the crop.
    Returns timing for each growth stage with dosages.
    """
    try:
        schedule = fertilizer_analyzer.get_schedule(
            crop=crop,
            area_hectares=area_hectares
        )
        
        return {
            "success": True,
            **schedule
        }
        
    except Exception as e:
        logger.error(f"Error generating fertilizer schedule: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/fertilizer/alternatives")
async def get_organic_alternatives(crop: str):
    """
    Get organic alternatives for chemical fertilizers.
    Includes INM (Integrated Nutrient Management) recommendations.
    """
    try:
        alternatives = fertilizer_analyzer.get_organic_alternatives(crop=crop)
        
        return {
            "success": True,
            **alternatives
        }
        
    except Exception as e:
        logger.error(f"Error fetching organic alternatives: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# MSP AND MANDI PRICE ENDPOINTS (Phase 5: Government Data Integration)
# ==============================================================================

from gov_api_service import (
    get_all_msp, get_msp_for_crop, fetch_msp_from_api,
    fetch_mandi_prices, get_all_states, INDIAN_STATES, fetch_districts, fetch_tehsils
)


@app.get("/api/msp/prices")
async def get_msp_prices():
    """
    Get all current MSP (Minimum Support Prices) for supported crops.
    Source-linked publications with a season and product basis for each record.
    """
    try:
        msp_data = get_all_msp()
        
        return {
            "success": True,
            "data": msp_data,
            "total_crops": len(msp_data["crops"])
        }
        
    except Exception as e:
        logger.error(f"Error fetching MSP prices: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/msp/prices/{crop}")
async def get_msp_for_specific_crop(crop: str):
    """
    Get MSP for a specific crop.
    
    Args:
        crop: Crop name (e.g., "Rice", "Wheat", "Cotton")
    """
    try:
        msp = get_msp_for_crop(crop)
        
        if msp:
            return {
                "success": True,
                "data": msp
            }
        
        return {
            "success": False,
            "error": f"MSP data not available for crop: {crop}",
            "available_crops": list(get_all_msp()["crops"].keys())
        }
        
    except Exception as e:
        logger.error(f"Error fetching MSP for {crop}: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/mandi/prices")
async def get_live_mandi_prices(
    commodity: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=100)
):
    """
    Get live mandi (market) prices from data.gov.in.
    
    Args:
        commodity: Filter by commodity name (e.g., "Rice", "Wheat")
        state: Filter by state name
        district: Filter by district name
        limit: Maximum number of results (default: 50, max: 100)
    """
    
    try:
        prices = await fetch_mandi_prices(
            commodity=commodity,
            state=state,
            district=district,
            limit=limit
        )
        
        return {
            "success": prices.get("available", False),
            **prices
        }
        
    except Exception as e:
        logger.error(f"Error fetching mandi prices: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/locations/states")
async def get_indian_states():
    """
    Get list of all Indian states and union territories.
    """
    try:
        return {
            "success": True,
            "states": INDIAN_STATES,
            "total": len(INDIAN_STATES)
        }
        
    except Exception as e:
        logger.error(f"Error fetching states: {type(e).__name__}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/locations/districts")
async def get_district_suggestions(state: str = Query(min_length=1, max_length=100)):
    return {"success": True, "districts": await fetch_districts(state),
            "source": "local_registration_suggestions", "complete": False,
            "allows_free_entry": True}


@app.get("/api/locations/tehsils")
async def get_tehsil_suggestions(state: str = Query(min_length=1, max_length=100),
                                district: str = Query(min_length=1, max_length=100)):
    return {"success": True, "tehsils": await fetch_tehsils(state, district),
            "source": "local_registration_suggestions", "complete": False,
            "allows_free_entry": True}


# Run server
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

