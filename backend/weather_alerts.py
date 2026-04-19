"""
Weather Alert System - Rain and Weather Notifications for Farmers
Provides thresholds-based alerts, rain predictions, and farming advisories

Features:
- Multi-source weather data integration (OpenWeather, IMD fallback)
- Customizable alert thresholds per crop
- Location-based weather monitoring
- Farming activity advisories
- Extreme weather warnings
"""

import os
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


class AlertSeverity(str, Enum):
    """Alert severity levels"""
    INFO = "info"          # General information
    ADVISORY = "advisory"  # Recommended action
    WARNING = "warning"    # Significant risk
    CRITICAL = "critical"  # Immediate action required


class AlertType(str, Enum):
    """Types of weather alerts"""
    RAIN = "rain"
    DROUGHT = "drought"
    FROST = "frost"
    HEATWAVE = "heatwave"
    STORM = "storm"
    WIND = "wind"
    HUMIDITY = "humidity"
    IRRIGATION = "irrigation"
    SPRAY = "spray"  # Pesticide/fertilizer application timing


@dataclass
class WeatherAlert:
    """Weather alert data model"""
    id: str
    type: AlertType
    severity: AlertSeverity
    title: str
    message: str
    recommendation: str
    start_time: datetime
    end_time: Optional[datetime] = None
    location: Optional[str] = None
    crop: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['type'] = self.type.value
        data['severity'] = self.severity.value
        data['start_time'] = self.start_time.isoformat()
        if self.end_time:
            data['end_time'] = self.end_time.isoformat()
        return data


@dataclass
class WeatherForecast:
    """Weather forecast data"""
    timestamp: datetime
    temperature: float  # Celsius
    feels_like: float
    humidity: float     # percentage
    wind_speed: float   # km/h
    wind_direction: str
    precipitation: float  # mm
    precipitation_probability: float  # percentage
    cloud_cover: float    # percentage
    condition: str
    icon: str
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data


# Crop-specific thresholds for alerts
CROP_THRESHOLDS = {
    "Rice": {
        "min_temp": 15, "max_temp": 40,
        "min_humidity": 60, "max_humidity": 95,
        "drought_days": 7,
        "optimal_rain_mm": 150,  # per month
        "spray_wind_max": 15,    # km/h
    },
    "Wheat": {
        "min_temp": 5, "max_temp": 30,
        "min_humidity": 40, "max_humidity": 80,
        "drought_days": 10,
        "optimal_rain_mm": 100,
        "spray_wind_max": 12,
    },
    "Cotton": {
        "min_temp": 18, "max_temp": 38,
        "min_humidity": 50, "max_humidity": 85,
        "drought_days": 14,
        "optimal_rain_mm": 80,
        "spray_wind_max": 10,
    },
    "Sugarcane": {
        "min_temp": 20, "max_temp": 42,
        "min_humidity": 70, "max_humidity": 95,
        "drought_days": 5,
        "optimal_rain_mm": 200,
        "spray_wind_max": 15,
    },
    "default": {
        "min_temp": 10, "max_temp": 40,
        "min_humidity": 40, "max_humidity": 90,
        "drought_days": 10,
        "optimal_rain_mm": 100,
        "spray_wind_max": 12,
    }
}


class WeatherAlertService:
    """
    Weather Alert Service
    Monitors weather conditions and generates farming alerts
    """
    
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1/forecast"
        self.timeout = 10.0
        self._cache: Dict[str, Dict] = {}  # Simple in-memory cache
    
    async def get_current_weather(
        self, 
        lat: float, 
        lon: float
    ) -> Optional[Dict[str, Any]]:
        """Fetch current weather from Open-Meteo API"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    self.base_url,
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,wind_speed_10m,weather_code",
                        "timezone": "auto"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    curr = data.get("current", {})
                    return {
                        "temperature": curr.get("temperature_2m", 25),
                        "feels_like": curr.get("apparent_temperature", 25),
                        "humidity": curr.get("relative_humidity_2m", 50),
                        "wind_speed": curr.get("wind_speed_10m", 10),
                        "condition": "Clear" if curr.get("weather_code", 0) <= 3 else "Cloudy",
                        "description": "Open-Meteo Advisory",
                        "icon": "02d",
                        "location": "Local",
                        "timestamp": datetime.now().isoformat(),
                        "source": "Open-Meteo (Estimate)"
                    }
                    
        except Exception as e:
            logger.error(f"Weather API error: {e}")
        
        return self._get_mock_weather(lat, lon)
    
    async def get_forecast(
        self, 
        lat: float, 
        lon: float, 
        hours: int = 48
    ) -> List[WeatherForecast]:
        """Get hourly weather forecast from Open-Meteo"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    self.base_url,
                    params={
                        "latitude": lat,
                        "longitude": lon,
                        "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,weather_code",
                        "timezone": "auto"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    hourly = data.get("hourly", {})
                    forecasts = []
                    
                    limit = min(hours, len(hourly.get("time", [])))
                    
                    for i in range(limit):
                        if i % 3 != 0: continue # emulate 3-hour intervals
                        forecasts.append(WeatherForecast(
                            timestamp=datetime.fromisoformat(hourly["time"][i]),
                            temperature=hourly["temperature_2m"][i],
                            feels_like=hourly["apparent_temperature"][i],
                            humidity=hourly["relative_humidity_2m"][i],
                            wind_speed=hourly["wind_speed_10m"][i],
                            wind_direction=self._get_wind_direction(hourly["wind_direction_10m"][i]),
                            precipitation=hourly["precipitation"][i],
                            precipitation_probability=hourly["precipitation_probability"][i],
                            cloud_cover=hourly["cloud_cover"][i],
                            condition="Rain" if hourly["weather_code"][i] >= 60 else "Clear",
                            icon="02d"
                        ))
                    
                    return forecasts
                    
        except Exception as e:
            logger.error(f"Forecast API error: {e}")
        
        return self._get_mock_forecast(lat, lon, hours)
    
    async def generate_alerts(
        self, 
        lat: float, 
        lon: float, 
        crop: str = "default"
    ) -> List[WeatherAlert]:
        """Generate weather alerts based on forecast and crop thresholds"""
        alerts = []
        thresholds = CROP_THRESHOLDS.get(crop, CROP_THRESHOLDS["default"])
        
        # Get current weather and forecast
        current = await self.get_current_weather(lat, lon)
        forecast = await self.get_forecast(lat, lon, 48)
        
        if not current:
            return alerts
        
        alert_id_base = datetime.now().strftime("%Y%m%d%H%M")
        
        # Check temperature extremes
        temp = current.get("temperature", 25)
        if temp < thresholds["min_temp"]:
            alerts.append(WeatherAlert(
                id=f"{alert_id_base}_frost",
                type=AlertType.FROST,
                severity=AlertSeverity.WARNING if temp < thresholds["min_temp"] - 5 else AlertSeverity.ADVISORY,
                title=f"Low Temperature Alert",
                message=f"Current temperature is {temp:.1f}°C, below optimal {thresholds['min_temp']}°C for {crop}",
                recommendation="Cover sensitive crops. Delay irrigation to avoid frost damage.",
                start_time=datetime.now(),
                crop=crop
            ))
        elif temp > thresholds["max_temp"]:
            alerts.append(WeatherAlert(
                id=f"{alert_id_base}_heat",
                type=AlertType.HEATWAVE,
                severity=AlertSeverity.WARNING if temp > thresholds["max_temp"] + 5 else AlertSeverity.ADVISORY,
                title=f"High Temperature Alert",
                message=f"Current temperature is {temp:.1f}°C, above optimal {thresholds['max_temp']}°C for {crop}",
                recommendation="Increase irrigation frequency. Apply mulch to reduce soil temperature.",
                start_time=datetime.now(),
                crop=crop
            ))
        
        # Check for rain in forecast
        rain_expected = sum(f.precipitation for f in forecast[:8])  # Next 24 hours
        rain_probability = max((f.precipitation_probability for f in forecast[:8]), default=0)
        
        if rain_probability > 70:
            # Heavy rain expected
            if rain_expected > 50:
                alerts.append(WeatherAlert(
                    id=f"{alert_id_base}_heavy_rain",
                    type=AlertType.RAIN,
                    severity=AlertSeverity.WARNING,
                    title="Heavy Rain Expected",
                    message=f"Approximately {rain_expected:.0f}mm rain expected in next 24 hours",
                    recommendation="Delay fertilizer/pesticide application. Ensure drainage is clear. Harvest ripe crops if possible.",
                    start_time=datetime.now(),
                    end_time=datetime.now() + timedelta(hours=24),
                    crop=crop
                ))
            else:
                alerts.append(WeatherAlert(
                    id=f"{alert_id_base}_rain",
                    type=AlertType.RAIN,
                    severity=AlertSeverity.INFO,
                    title="Rain Expected",
                    message=f"About {rain_expected:.0f}mm rain expected in next 24 hours ({rain_probability:.0f}% probability)",
                    recommendation="Good time to delay irrigation. Plan indoor activities.",
                    start_time=datetime.now(),
                    crop=crop
                ))
        
        # Check wind for spraying advisory
        wind_speed = current.get("wind_speed", 0)
        if wind_speed > thresholds["spray_wind_max"]:
            alerts.append(WeatherAlert(
                id=f"{alert_id_base}_wind",
                type=AlertType.SPRAY,
                severity=AlertSeverity.ADVISORY,
                title="Avoid Spraying",
                message=f"Wind speed is {wind_speed:.0f} km/h - too high for effective spraying",
                recommendation=f"Wait for wind to drop below {thresholds['spray_wind_max']} km/h before applying pesticides or fertilizers.",
                start_time=datetime.now(),
                crop=crop
            ))
        
        # Check humidity
        humidity = current.get("humidity", 50)
        if humidity > thresholds["max_humidity"]:
            alerts.append(WeatherAlert(
                id=f"{alert_id_base}_humidity",
                type=AlertType.HUMIDITY,
                severity=AlertSeverity.ADVISORY,
                title="High Humidity Alert",
                message=f"Humidity is {humidity:.0f}% - increased disease risk",
                recommendation="Monitor for fungal diseases. Ensure good air circulation around plants.",
                start_time=datetime.now(),
                crop=crop
            ))
        
        # Irrigation advisory
        if rain_probability < 30 and humidity < thresholds["min_humidity"]:
            alerts.append(WeatherAlert(
                id=f"{alert_id_base}_irrigation",
                type=AlertType.IRRIGATION,
                severity=AlertSeverity.INFO,
                title="Irrigation Recommended",
                message=f"Low humidity ({humidity:.0f}%) and no rain expected",
                recommendation="Consider irrigating crops today. Best time: early morning or evening.",
                start_time=datetime.now(),
                crop=crop
            ))
        
        return alerts
    
    async def get_rain_forecast_summary(
        self, 
        lat: float, 
        lon: float
    ) -> Dict[str, Any]:
        """Get summarized rain forecast for next 7 days"""
        forecast = await self.get_forecast(lat, lon, 168)  # 7 days
        
        daily_rain = {}
        for f in forecast:
            day_key = f.timestamp.strftime("%Y-%m-%d")
            if day_key not in daily_rain:
                daily_rain[day_key] = {"rain_mm": 0, "probability": 0}
            daily_rain[day_key]["rain_mm"] += f.precipitation
            daily_rain[day_key]["probability"] = max(
                daily_rain[day_key]["probability"],
                f.precipitation_probability
            )
        
        total_rain = sum(d["rain_mm"] for d in daily_rain.values())
        rain_days = sum(1 for d in daily_rain.values() if d["rain_mm"] > 0)
        
        return {
            "total_rain_mm": round(total_rain, 1),
            "rain_days": rain_days,
            "daily_forecast": [
                {"date": k, **v} for k, v in daily_rain.items()
            ],
            "summary": self._generate_rain_summary(total_rain, rain_days)
        }
    
    def _generate_rain_summary(self, total_rain: float, rain_days: int) -> str:
        """Generate human-readable rain summary"""
        if total_rain < 10:
            return "Very little rain expected. Plan for regular irrigation."
        elif total_rain < 50:
            return f"Light to moderate rain ({total_rain:.0f}mm) expected over {rain_days} days."
        elif total_rain < 100:
            return f"Good rainfall ({total_rain:.0f}mm) expected. Reduce irrigation accordingly."
        else:
            return f"Heavy rainfall ({total_rain:.0f}mm) expected. Ensure proper drainage."
    
    def _get_wind_direction(self, degrees: float) -> str:
        """Convert wind degrees to direction"""
        directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
        idx = round(degrees / 45) % 8
        return directions[idx]
    
    def _get_mock_weather(self, lat: float, lon: float) -> Dict[str, Any]:
        """Deterministic seasonal fallback estimate"""
        is_north = lat > 23
        base_temp = 20.0 if is_north else 28.0
        
        return {
            "temperature": base_temp,
            "feels_like": base_temp + 1.0,
            "humidity": 65.0,
            "wind_speed": 10.0,
            "condition": "Cloudy",
            "description": "Fallback estimate (Network unavailable)",
            "icon": "02d",
            "location": "Regional Fallback",
            "timestamp": datetime.now().isoformat(),
            "source": "Static Default"
        }
    
    def _get_mock_forecast(
        self, 
        lat: float, 
        lon: float, 
        hours: int
    ) -> List[WeatherForecast]:
        """Deterministic forecast fallback"""
        forecasts = []
        base_time = datetime.now().replace(minute=0, second=0, microsecond=0)
        
        for i in range(hours // 3):
            timestamp = base_time + timedelta(hours=i * 3)
            # Simple diurnal cycle simulate
            is_day = 6 <= timestamp.hour <= 18
            
            forecasts.append(WeatherForecast(
                timestamp=timestamp,
                temperature=28.0 if is_day else 22.0,
                feels_like=29.0 if is_day else 21.0,
                humidity=60.0,
                wind_speed=8.0,
                wind_direction="E",
                precipitation=0.0,
                precipitation_probability=20.0,
                cloud_cover=50.0,
                condition="Clouds",
                icon="02d"
            ))
        
        return forecasts


# Global instance
weather_alert_service = WeatherAlertService()
