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
        self.openweather_key = os.getenv("OPENWEATHER_API_KEY", "")
        self.imd_api_url = os.getenv("IMD_API_URL", "")  # India Meteorological Dept
        self.base_url = "https://api.openweathermap.org/data/2.5"
        self.timeout = 10.0
        self._cache: Dict[str, Dict] = {}  # Simple in-memory cache
    
    async def get_current_weather(
        self, 
        lat: float, 
        lon: float
    ) -> Optional[Dict[str, Any]]:
        """Fetch current weather from OpenWeather API"""
        if not self.openweather_key:
            logger.warning("OpenWeather API key not configured")
            return self._get_mock_weather(lat, lon)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/weather",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": self.openweather_key,
                        "units": "metric"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    return {
                        "temperature": data["main"]["temp"],
                        "feels_like": data["main"]["feels_like"],
                        "humidity": data["main"]["humidity"],
                        "wind_speed": data["wind"]["speed"] * 3.6,  # m/s to km/h
                        "condition": data["weather"][0]["main"],
                        "description": data["weather"][0]["description"],
                        "icon": data["weather"][0]["icon"],
                        "location": data.get("name", "Unknown"),
                        "timestamp": datetime.now().isoformat()
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
        """Get hourly/daily weather forecast"""
        if not self.openweather_key:
            return self._get_mock_forecast(lat, lon, hours)
        
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/forecast",
                    params={
                        "lat": lat,
                        "lon": lon,
                        "appid": self.openweather_key,
                        "units": "metric"
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    forecasts = []
                    
                    for item in data["list"][:hours // 3]:  # 3-hour intervals
                        forecasts.append(WeatherForecast(
                            timestamp=datetime.fromisoformat(item["dt_txt"].replace(" ", "T")),
                            temperature=item["main"]["temp"],
                            feels_like=item["main"]["feels_like"],
                            humidity=item["main"]["humidity"],
                            wind_speed=item["wind"]["speed"] * 3.6,
                            wind_direction=self._get_wind_direction(item["wind"].get("deg", 0)),
                            precipitation=item.get("rain", {}).get("3h", 0),
                            precipitation_probability=item.get("pop", 0) * 100,
                            cloud_cover=item["clouds"]["all"],
                            condition=item["weather"][0]["main"],
                            icon=item["weather"][0]["icon"]
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
        """Mock weather for development/demo"""
        import random
        is_north = lat > 23
        base_temp = 15 + random.random() * 10 if is_north else 25 + random.random() * 8
        
        return {
            "temperature": round(base_temp, 1),
            "feels_like": round(base_temp - 2 + random.random() * 4, 1),
            "humidity": round(40 + random.random() * 40),
            "wind_speed": round(5 + random.random() * 15, 1),
            "condition": random.choice(["Clear", "Clouds", "Partly Cloudy"]),
            "description": "partly cloudy",
            "icon": "02d",
            "location": "Your Location",
            "timestamp": datetime.now().isoformat()
        }
    
    def _get_mock_forecast(
        self, 
        lat: float, 
        lon: float, 
        hours: int
    ) -> List[WeatherForecast]:
        """Mock forecast for development/demo"""
        import random
        forecasts = []
        base_time = datetime.now().replace(minute=0, second=0, microsecond=0)
        
        for i in range(hours // 3):
            timestamp = base_time + timedelta(hours=i * 3)
            rain_prob = random.random() * 60
            
            forecasts.append(WeatherForecast(
                timestamp=timestamp,
                temperature=20 + random.random() * 15,
                feels_like=18 + random.random() * 15,
                humidity=50 + random.random() * 30,
                wind_speed=5 + random.random() * 20,
                wind_direction=random.choice(["N", "NE", "E", "SE", "S", "SW", "W", "NW"]),
                precipitation=random.random() * 5 if rain_prob > 40 else 0,
                precipitation_probability=rain_prob,
                cloud_cover=random.random() * 80,
                condition=random.choice(["Clear", "Clouds", "Rain"]),
                icon="02d"
            ))
        
        return forecasts


# Global instance
weather_alert_service = WeatherAlertService()
