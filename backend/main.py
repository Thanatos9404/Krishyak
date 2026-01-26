"""
FastAPI main application for Krishyak
AI-powered farming decision support system for Indian farmers
Version: 1.1.0 (Government-Ready with Security Hardening)
"""
import time
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, File, UploadFile, Form, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator
from typing import Dict, List, Optional
import uvicorn

# Security and logging imports
from security import security_config, InputSanitizer, FileValidator, generate_request_id
from logging_config import setup_logging, request_logger

# Engine imports
from simulation_engine import SimulationEngine
from price_forecaster import PriceForecaster
from yield_estimator import YieldEstimator
from cost_calculator import CostCalculator
from risk_engine import RiskEngine
from data_loader import DataLoader
import config
import os
from disease_detector import detect_disease_mock, CROP_DISEASES
from jam_trinity import get_jam_service, JAMTrinityService
from land_records import get_land_service, LandRecordsService

# Initialize logging
logger = setup_logging()

# Rate limiting setup (in-memory for simplicity, use Redis in production)
from collections import defaultdict
from datetime import datetime, timedelta

class RateLimiter:
    """Simple in-memory rate limiter"""
    def __init__(self):
        self.requests = defaultdict(list)
        self.rate_per_minute = security_config.rate_limit_per_minute
        self.rate_per_day = security_config.rate_limit_per_day
    
    def is_allowed(self, client_ip: str) -> tuple[bool, str]:
        """Check if request is allowed, returns (allowed, reason)"""
        now = datetime.now()
        minute_ago = now - timedelta(minutes=1)
        day_ago = now - timedelta(days=1)
        
        # Clean old entries
        self.requests[client_ip] = [
            t for t in self.requests[client_ip] 
            if t > day_ago
        ]
        
        # Check minute limit
        minute_requests = sum(1 for t in self.requests[client_ip] if t > minute_ago)
        if minute_requests >= self.rate_per_minute:
            return False, f"Rate limit exceeded: {self.rate_per_minute} requests per minute"
        
        # Check daily limit
        if len(self.requests[client_ip]) >= self.rate_per_day:
            return False, f"Rate limit exceeded: {self.rate_per_day} requests per day"
        
        # Record this request
        self.requests[client_ip].append(now)
        return True, ""

rate_limiter = RateLimiter()

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
    title="Krishyak - AI Farm Decision Simulator",
    description="AI-powered farming decision support system for Indian farmers",
    version="1.1.0",
    lifespan=lifespan,
    docs_url="/docs" if security_config.is_development else None,
    redoc_url="/redoc" if security_config.is_development else None,
)

# CORS middleware with secure configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=security_config.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    max_age=600,  # Cache preflight for 10 minutes
)

@app.middleware("http")
async def request_middleware(request: Request, call_next):
    """Request logging, rate limiting, and error handling middleware"""
    start_time = time.time()
    request_id = request.headers.get("X-Request-ID", generate_request_id())
    
    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    
    # Rate limiting
    allowed, reason = rate_limiter.is_allowed(client_ip)
    if not allowed:
        logger.warning(f"Rate limit exceeded for {client_ip}")
        return JSONResponse(
            status_code=429,
            content={"success": False, "error": reason, "request_id": request_id}
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
        request_logger.log_error(request_id, e, f"Unhandled error in {request.url.path}")
        
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": "Internal server error",
                "request_id": request_id
            }
        )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Custom HTTP exception handler with structured response"""
    request_id = request.headers.get("X-Request-ID", generate_request_id())
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": exc.detail,
            "request_id": request_id
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    request_id = request.headers.get("X-Request-ID", generate_request_id())
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    
    # Don't expose internal errors in production
    error_message = str(exc) if security_config.is_development else "An unexpected error occurred"
    
    return JSONResponse(
        status_code=500,
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


# ==============================================================================
# SOIL SENSOR ENDPOINTS (Phase 2: IoT Integration)
# ==============================================================================

from sensor_adapter import (
    sensor_manager, SoilData, SensorVendor, 
    ConnectionStatus, SensorInfo
)
from soil_data_cache import soil_cache
from datetime import datetime

class ManualSoilInput(BaseModel):
    """Pydantic model for manual soil data input"""
    device_id: str = Field(..., description="Device/plot identifier")
    nitrogen: float = Field(..., ge=0, le=500, description="Nitrogen in kg/ha")
    phosphorus: float = Field(..., ge=0, le=200, description="Phosphorus in kg/ha")
    potassium: float = Field(..., ge=0, le=500, description="Potassium in kg/ha")
    ph: float = Field(..., ge=0, le=14, description="Soil pH (0-14)")
    moisture: float = Field(..., ge=0, le=100, description="Moisture percentage")
    temperature: float = Field(default=25.0, ge=-10, le=60, description="Soil temperature °C")
    organic_carbon: Optional[float] = Field(None, ge=0, le=20, description="Organic carbon %")


@app.get("/sensors")
async def list_sensors():
    """
    List all connected soil sensors
    Returns devices from all configured vendors + manual inputs
    """
    try:
        devices = await sensor_manager.get_all_device_status()
        cached_devices = soil_cache.list_cached_devices()
        
        return {
            "success": True,
            "sensors": [d.to_dict() for d in devices],
            "cached_devices": cached_devices,
            "cache_stats": soil_cache.get_cache_stats()
        }
    except Exception as e:
        logger.error(f"Error listing sensors: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sensors/{device_id}/data")
async def get_sensor_data(device_id: str, use_cache: bool = True):
    """
    Get latest soil data for a device
    
    Args:
        device_id: Sensor device identifier
        use_cache: If True, return cached data when sensor unavailable
    
    Returns:
        Latest soil reading with NPK, pH, moisture, temperature
    """
    try:
        # Try to get fresh data from sensor
        data = await sensor_manager.get_soil_data(device_id)
        
        if data:
            # Cache the fresh data
            soil_cache.save(device_id, data)
            return {
                "success": True,
                "data": data.to_dict(),
                "source": data.source,
                "is_stale": False
            }
        
        # Fallback to cache
        if use_cache:
            cached = soil_cache.get_latest(device_id)
            if cached:
                return {
                    "success": True,
                    "data": cached.to_dict(),
                    "source": "cached",
                    "is_stale": soil_cache.is_stale(device_id),
                    "last_updated": soil_cache.get_last_update_time(device_id).isoformat() if soil_cache.get_last_update_time(device_id) else None
                }
        
        # No data available
        return {
            "success": False,
            "error": "No soil data available for this device",
            "device_id": device_id
        }
        
    except Exception as e:
        logger.error(f"Error getting sensor data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sensors/manual")
async def submit_manual_soil_data(input_data: ManualSoilInput):
    """
    Submit manually measured soil data
    
    Use this endpoint when IoT sensors are unavailable.
    Data will be stored and used in simulations.
    """
    try:
        # Create SoilData from input
        soil_data = SoilData(
            device_id=input_data.device_id,
            timestamp=datetime.now(),
            nitrogen=input_data.nitrogen,
            phosphorus=input_data.phosphorus,
            potassium=input_data.potassium,
            ph=input_data.ph,
            moisture=input_data.moisture,
            temperature=input_data.temperature,
            organic_carbon=input_data.organic_carbon,
            source="manual",
            vendor=SensorVendor.MANUAL.value
        )
        
        # Validate data
        if not soil_data.is_valid():
            raise HTTPException(
                status_code=400,
                detail="Soil data values are out of valid range"
            )
        
        # Save to sensor manager and cache
        sensor_manager.set_manual_data(input_data.device_id, soil_data)
        soil_cache.save(input_data.device_id, soil_data)
        
        logger.info(f"Manual soil data saved for device: {input_data.device_id}")
        
        return {
            "success": True,
            "message": "Soil data saved successfully",
            "data": soil_data.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving manual soil data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sensors/{device_id}/history")
async def get_sensor_history(device_id: str, days: int = 7):
    """
    Get historical soil data for a device
    
    Args:
        device_id: Sensor device identifier
        days: Number of days of history (default: 7, max: 30)
    """
    if days > 30:
        days = 30
    
    try:
        history = soil_cache.get_history(device_id, days)
        
        return {
            "success": True,
            "device_id": device_id,
            "days": days,
            "readings": [h.to_dict() for h in history],
            "count": len(history)
        }
        
    except Exception as e:
        logger.error(f"Error getting sensor history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/sensors/status")
async def get_sensors_status():
    """
    Get connection status of all configured sensors
    """
    try:
        devices = await sensor_manager.get_all_device_status()
        
        connected = sum(1 for d in devices if d.status == ConnectionStatus.CONNECTED)
        disconnected = sum(1 for d in devices if d.status == ConnectionStatus.DISCONNECTED)
        
        return {
            "success": True,
            "total_devices": len(devices),
            "connected": connected,
            "disconnected": disconnected,
            "devices": [d.to_dict() for d in devices]
        }
        
    except Exception as e:
        logger.error(f"Error getting sensor status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


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
        logger.error(f"Error fetching current weather: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/weather/forecast")
async def get_weather_forecast(location: LocationRequest, hours: int = 48):
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
        logger.error(f"Error fetching forecast: {e}")
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
        logger.error(f"Error generating alerts: {e}")
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
        logger.error(f"Error fetching rain forecast: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# PEST INTELLIGENCE ENDPOINTS (Phase 4: Pest & Disease Intelligence)
# ==============================================================================

from pest_intelligence import pest_service
from pest_data_store import pest_store, FarmerPestReport

class PestReportInput(BaseModel):
    """Input model for farmer pest reports"""
    pest_type: str = Field(..., min_length=2, max_length=100, description="Type of pest observed")
    pest_name: str = Field(..., min_length=2, max_length=100, description="Common name of pest")
    crop: str = Field(..., min_length=2, max_length=50, description="Affected crop")
    severity: str = Field(..., pattern="^(low|medium|high)$", description="Severity level")
    description: str = Field("", max_length=500, description="Description of the sighting")
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    district: str = Field(..., min_length=2, max_length=100, description="District name")
    state: str = Field(..., min_length=2, max_length=100, description="State name")
    photo_url: Optional[str] = Field(None, description="Optional photo URL")

class PestAlertRequest(BaseModel):
    """Request model for pest alerts"""
    state: str = Field(..., min_length=2, max_length=100, description="State name")
    district: Optional[str] = Field(None, description="District name (optional)")
    crop: Optional[str] = Field(None, description="Crop type filter (optional)")

class PestPredictionRequest(BaseModel):
    """Request model for pest outbreak predictions"""
    crop: str = Field(..., min_length=2, max_length=50, description="Crop type")
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    temperature: float = Field(25.0, ge=-10, le=60, description="Current temperature in Celsius")
    humidity: float = Field(60.0, ge=0, le=100, description="Current humidity percentage")
    rainfall: float = Field(0.0, ge=0, description="Recent rainfall in mm")


@app.post("/pest/report")
async def submit_pest_report(report: PestReportInput):
    """
    Submit a farmer pest sighting report.
    Reports are stored for trend analysis and alerts.
    """
    try:
        import hashlib
        from datetime import datetime
        
        # Generate anonymous farmer ID from IP (for hackathon)
        farmer_id = hashlib.md5(f"farmer_{datetime.now().timestamp()}".encode()).hexdigest()[:8]
        
        # Create report object
        pest_report = FarmerPestReport(
            id="",  # Will be generated
            farmer_id=farmer_id,
            pest_type=report.pest_type,
            pest_name=report.pest_name,
            crop=report.crop,
            severity=report.severity,
            description=report.description,
            location={"lat": report.lat, "lng": report.lon},
            district=report.district,
            state=report.state,
            photo_url=report.photo_url
        )
        
        # Save report
        report_id = pest_store.save_farmer_report(pest_report)
        
        logger.info(f"Pest report submitted: {report_id} - {report.pest_name} in {report.state}")
        
        return {
            "success": True,
            "report_id": report_id,
            "message": "Pest report submitted successfully. Thank you for contributing!"
        }
        
    except Exception as e:
        logger.error(f"Error submitting pest report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pest/alerts")
async def get_pest_alerts(request: PestAlertRequest):
    """
    Get active pest alerts for a region.
    Combines government data and farmer reports.
    """
    try:
        # Get alerts from pest service
        alerts = pest_service.get_alerts(
            state=request.state,
            district=request.district,
            crop=request.crop
        )
        
        # Get recent farmer reports for the region
        farmer_reports = pest_store.get_reports_by_region(
            state=request.state,
            district=request.district,
            days=14
        )
        
        # Get seasonal risk
        seasonal_risk = None
        if request.crop:
            seasonal_risk = pest_service.get_seasonal_risk(request.crop)
        
        return {
            "success": True,
            "state": request.state,
            "district": request.district,
            "total_alerts": len(alerts),
            "alerts": alerts,
            "farmer_reports": [r.to_dict() for r in farmer_reports[:10]],
            "seasonal_risk": seasonal_risk
        }
        
    except Exception as e:
        logger.error(f"Error fetching pest alerts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pest/history")
async def get_pest_history(
    crop: str,
    state: str,
    years: int = 3
):
    """
    Get historical pest outbreak data for trend analysis.
    """
    try:
        history = pest_service.get_history(crop=crop, state=state, years=years)
        
        # Get statistics from farmer reports
        stats = pest_store.get_report_statistics(days=365)
        
        return {
            "success": True,
            "crop": crop,
            "state": state,
            "years": years,
            "outbreaks": history,
            "report_statistics": stats
        }
        
    except Exception as e:
        logger.error(f"Error fetching pest history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/pest/prediction")
async def get_pest_prediction(request: PestPredictionRequest):
    """
    Get pest outbreak predictions based on crop, weather, and location.
    Uses weather correlation and historical patterns.
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
        logger.error(f"Error generating pest prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/pest/statistics")
async def get_pest_statistics(days: int = 30):
    """
    Get aggregated pest report statistics.
    Useful for dashboards and trend monitoring.
    """
    try:
        stats = pest_store.get_report_statistics(days=days)
        
        return {
            "success": True,
            "statistics": stats
        }
        
    except Exception as e:
        logger.error(f"Error fetching pest statistics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ==============================================================================
# FERTILIZER ANALYZER ENDPOINTS (Phase 5: Fertilizer Analyzer Engine)
# ==============================================================================

from fertilizer_analyzer import fertilizer_analyzer

class FertilizerRecommendationRequest(BaseModel):
    """Request model for fertilizer recommendations"""
    crop: str = Field(..., min_length=2, max_length=50, description="Crop type")
    area_hectares: float = Field(1.0, ge=0.1, le=1000, description="Farm area in hectares")
    growth_stage: str = Field("basal", description="Current growth stage")
    prefer_organic: bool = Field(False, description="Prefer organic alternatives")
    soil_n: Optional[float] = Field(None, ge=0, description="Soil nitrogen (ppm)")
    soil_p: Optional[float] = Field(None, ge=0, description="Soil phosphorus (ppm)")
    soil_k: Optional[float] = Field(None, ge=0, description="Soil potassium (ppm)")
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
        if any([request.soil_n, request.soil_p, request.soil_k]):
            soil_data = {
                "N": request.soil_n or 0,
                "P": request.soil_p or 0,
                "K": request.soil_k or 0,
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
        logger.error(f"Error generating fertilizer recommendation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/fertilizer/schedule")
async def get_fertilizer_schedule(crop: str, area_hectares: float = 1.0):
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
        logger.error(f"Error generating fertilizer schedule: {e}")
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
        logger.error(f"Error fetching organic alternatives: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# JAM TRINITY VERIFICATION ENDPOINTS
# ============================================================================

class ConsentRequest(BaseModel):
    """Request to create a consent record"""
    purpose: str = Field(..., description="Purpose of data access")
    scopes: List[str] = Field(..., description="Scopes to grant access to")


class AadhaarVerifyRequest(BaseModel):
    """Request to verify Aadhaar"""
    aadhaar_last4: str = Field(..., min_length=4, max_length=4, pattern="^[0-9]{4}$")
    consent_id: str = Field(..., description="Consent ID from consent request")
    name: Optional[str] = Field(None, description="Name to verify against Aadhaar")


class TokenRequest(BaseModel):
    """Request using Aadhaar token"""
    aadhaar_token: str = Field(..., description="Token from Aadhaar verification")
    consent_id: str = Field(..., description="Consent ID")


@app.post("/consent/request")
async def request_consent(request: ConsentRequest):
    """
    Request user consent for data access.
    Returns a consent_id that must be confirmed by user before verification.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        result = jam_service.request_consent(
            purpose=request.purpose,
            scopes=request.scopes
        )
        
        return {
            "success": True,
            "data": result
        }
        
    except Exception as e:
        logger.error(f"Consent request error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consent/grant/{consent_id}")
async def grant_consent(consent_id: str):
    """
    User grants consent (in real app, this would be after showing consent UI).
    For demo, this immediately activates the consent.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        consent = jam_service.consent_manager.get_consent(consent_id)
        
        if not consent:
            raise HTTPException(status_code=404, detail="Consent not found")
        
        return {
            "success": True,
            "consent_id": consent_id,
            "status": "granted",
            "expires_at": consent.expires_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Consent grant error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/consent/revoke/{consent_id}")
async def revoke_consent(consent_id: str):
    """
    User revokes previously granted consent.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        success = jam_service.consent_manager.revoke_consent(consent_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Consent not found")
        
        return {
            "success": True,
            "consent_id": consent_id,
            "status": "revoked"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Consent revoke error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/verify/aadhaar")
async def verify_aadhaar(request: AadhaarVerifyRequest):
    """
    Verify Aadhaar and get tokenized reference.
    Does NOT store full Aadhaar number - only uses last 4 digits for demo.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        
        result = jam_service.verify_aadhaar(
            aadhaar_last4=request.aadhaar_last4,
            consent_id=request.consent_id,
            name_to_verify=request.name
        )
        
        if result.error:
            return {
                "success": False,
                "error": result.error
            }
        
        return {
            "success": True,
            "data": {
                "verified": result.verified,
                "token": result.token,
                "name_verified": result.name_verified,
                "demographic_match": result.demographic_match,
                "consent_id": result.consent_id
            }
        }
        
    except Exception as e:
        logger.error(f"Aadhaar verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/verify/land")
async def verify_land_records(request: TokenRequest):
    """
    Get verified land records using Aadhaar token.
    Returns land holding details without exposing sensitive data.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        
        result = jam_service.get_land_records(
            aadhaar_token=request.aadhaar_token,
            consent_id=request.consent_id
        )
        
        if result.error:
            return {
                "success": False,
                "error": result.error
            }
        
        return {
            "success": True,
            "data": {
                "verified": result.verified,
                "state": result.state,
                "district": result.district,
                "total_area_hectares": result.total_area_hectares,
                "irrigated_percentage": result.irrigated_percentage,
                "farmer_category": result.farmer_category,
                "survey_numbers": result.survey_numbers,
                "ownership_verified": result.ownership_verified
            }
        }
        
    except Exception as e:
        logger.error(f"Land verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/verify/jan-dhan")
async def verify_jan_dhan(request: TokenRequest):
    """
    Verify Jan Dhan bank account linkage.
    Returns masked account details and DBT status.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        
        result = jam_service.verify_jan_dhan(
            aadhaar_token=request.aadhaar_token,
            consent_id=request.consent_id
        )
        
        if result.error:
            return {
                "success": False,
                "error": result.error
            }
        
        return {
            "success": True,
            "data": {
                "linked": result.linked,
                "bank_name": result.bank_name,
                "account_masked": result.account_masked,
                "dbt_enabled": result.dbt_enabled,
                "pm_kisan_beneficiary": result.pm_kisan_beneficiary,
                "last_dbt_date": result.last_dbt_date
            }
        }
        
    except Exception as e:
        logger.error(f"Jan Dhan verification error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/verify/pm-kisan-status")
async def get_pm_kisan_status(request: TokenRequest):
    """
    Get PM-KISAN enrollment and payment status.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        
        result = jam_service.get_pm_kisan_status(
            aadhaar_token=request.aadhaar_token,
            consent_id=request.consent_id
        )
        
        return {
            "success": True,
            "data": {
                "enrolled": result.enrolled,
                "beneficiary_id": result.beneficiary_id,
                "installments_received": result.installments_received,
                "last_installment_date": result.last_installment_date,
                "last_installment_amount": result.last_installment_amount,
                "next_installment_expected": result.next_installment_expected,
                "bank_verified": result.bank_verified
            }
        }
        
    except Exception as e:
        logger.error(f"PM-KISAN status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/farmer/profile")
async def get_farmer_profile(request: TokenRequest):
    """
    Get unified farmer profile with all verifications.
    Combines land records, bank details, and scheme eligibility.
    """
    try:
        jam_service = get_jam_service(security_config.secret_key)
        
        profile = jam_service.get_unified_farmer_profile(
            aadhaar_token=request.aadhaar_token,
            consent_id=request.consent_id
        )
        
        return {
            "success": True,
            "data": profile
        }
        
    except Exception as e:
        logger.error(f"Farmer profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/land/supported-states")
async def get_supported_states():
    """
    Get list of states with land records integration.
    """
    try:
        land_service = get_land_service()
        states = land_service.get_supported_states()
        
        return {
            "success": True,
            "data": states
        }
        
    except Exception as e:
        logger.error(f"Supported states error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Run server
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

