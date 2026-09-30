"""
Soil Sensor Adapter - Unified Interface for IoT Soil Sensors
Supports multiple vendors with graceful fallback to manual input

Vendors:
- Fasal: fasal.co IoT platform
- CropIn: cropin.com smart farming
- SoilMatic: Generic soil sensor protocol
- Manual: User-entered data fallback
"""

import os
import logging
import math
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, asdict
from enum import Enum
import httpx

logger = logging.getLogger(__name__)


class SensorVendor(str, Enum):
    """Supported sensor vendors"""
    FASAL = "fasal"
    CROPIN = "cropin"
    SOILMATIC = "soilmatic"
    MANUAL = "manual"
    UNKNOWN = "unknown"


class ConnectionStatus(str, Enum):
    """Sensor connection status"""
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    STALE = "stale"  # Connected but data is old
    ERROR = "error"
    NOT_CONFIGURED = "not_configured"


@dataclass
class SoilData:
    """Unified soil data model"""
    device_id: str
    timestamp: datetime
    nitrogen: float  # kg/ha
    phosphorus: float  # kg/ha
    potassium: float  # kg/ha
    ph: float  # 0-14 scale
    moisture: float  # percentage
    temperature: float  # Celsius
    organic_carbon: Optional[float] = None  # percentage
    electrical_conductivity: Optional[float] = None  # dS/m
    source: str = "sensor"  # sensor, manual, cached
    vendor: str = SensorVendor.UNKNOWN
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        data = asdict(self)
        data['timestamp'] = self.timestamp.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'SoilData':
        """Create from dictionary"""
        data = dict(data)
        if isinstance(data.get('timestamp'), str):
            data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)
    
    def is_valid(self) -> bool:
        """Validate soil data ranges"""
        bounds = ((self.nitrogen, 0, 500), (self.phosphorus, 0, 200),
                  (self.potassium, 0, 500), (self.ph, 0, 14),
                  (self.moisture, 0, 100), (self.temperature, -10, 60),
                  (self.organic_carbon, 0, 100),
                  (self.electrical_conductivity, 0, float('inf')))
        return all(
            (value is None and index >= 6) or
            (isinstance(value, (int, float)) and not isinstance(value, bool)
             and math.isfinite(value) and lower <= value <= upper)
            for index, (value, lower, upper) in enumerate(bounds)
        )


@dataclass
class SensorInfo:
    """Sensor device information"""
    device_id: str
    vendor: SensorVendor
    name: str
    location: Optional[str] = None
    status: ConnectionStatus = ConnectionStatus.NOT_CONFIGURED
    last_reading: Optional[datetime] = None
    battery_level: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['vendor'] = self.vendor.value
        data['status'] = self.status.value
        if self.last_reading:
            data['last_reading'] = self.last_reading.isoformat()
        return data


class SensorAdapter(ABC):
    """Abstract base class for soil sensor adapters"""
    
    vendor: SensorVendor = SensorVendor.UNKNOWN
    
    @abstractmethod
    async def get_soil_data(self, device_id: str) -> Optional[SoilData]:
        """Fetch latest soil reading from sensor"""
        pass
    
    @abstractmethod
    async def get_connection_status(self, device_id: str) -> ConnectionStatus:
        """Check sensor connection status"""
        pass
    
    @abstractmethod
    async def list_devices(self) -> List[SensorInfo]:
        """List all configured devices for this vendor"""
        pass
    
    async def get_history(
        self, 
        device_id: str, 
        start_date: datetime, 
        end_date: datetime
    ) -> List[SoilData]:
        """Get historical readings (optional implementation)"""
        return []


class FasalAdapter(SensorAdapter):
    """Adapter for Fasal IoT platform (fasal.co)"""
    
    vendor = SensorVendor.FASAL
    
    def __init__(self):
        self.api_key = os.getenv("FASAL_API_KEY", "")
        self.base_url = os.getenv("FASAL_API_URL", "https://api.fasal.co/v1")
        self.timeout = 10.0
        
    async def get_soil_data(self, device_id: str) -> Optional[SoilData]:
        if not self.api_key:
            logger.warning("Fasal API key not configured")
            return None
            
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/devices/{device_id}/soil",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                
                if response.status_code != 200:
                    logger.error(f"Fasal API error: {response.status_code}")
                    return None
                
                data = response.json()
                reading = SoilData(
                    device_id=device_id,
                    timestamp=datetime.fromisoformat(data['timestamp']),
                    nitrogen=data['nitrogen'],
                    phosphorus=data['phosphorus'],
                    potassium=data['potassium'],
                    ph=data['ph'],
                    moisture=data['moisture'],
                    temperature=data['soil_temp'],
                    organic_carbon=data.get('organic_carbon'),
                    source="sensor",
                    vendor=self.vendor.value
                )
                return reading if reading.is_valid() else None
                
        except Exception as e:
            logger.error(f"Fasal adapter error: {e}")
            return None
    
    async def get_connection_status(self, device_id: str) -> ConnectionStatus:
        if not self.api_key:
            return ConnectionStatus.NOT_CONFIGURED
            
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{self.base_url}/devices/{device_id}/status",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get('online', False):
                        return ConnectionStatus.CONNECTED
                    return ConnectionStatus.DISCONNECTED
                    
        except Exception as e:
            logger.error(f"Fasal status check error: {e}")
            
        return ConnectionStatus.ERROR
    
    async def list_devices(self) -> List[SensorInfo]:
        if not self.api_key:
            return []
            
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/devices",
                    headers={"Authorization": f"Bearer {self.api_key}"}
                )
                
                if response.status_code == 200:
                    devices = response.json().get('devices', [])
                    return [
                        SensorInfo(
                            device_id=d['id'],
                            vendor=self.vendor,
                            name=d.get('name', f"Fasal-{d['id']}"),
                            location=d.get('location'),
                            status=ConnectionStatus.CONNECTED if d.get('online') else ConnectionStatus.DISCONNECTED
                        )
                        for d in devices
                    ]
                    
        except Exception as e:
            logger.error(f"Fasal list devices error: {e}")
            
        return []


class CropInAdapter(SensorAdapter):
    """Adapter for CropIn smart farming platform"""
    
    vendor = SensorVendor.CROPIN
    
    def __init__(self):
        self.api_key = os.getenv("CROPIN_API_KEY", "")
        self.base_url = os.getenv("CROPIN_API_URL", "https://api.cropin.com/v2")
        self.timeout = 10.0
        
    async def get_soil_data(self, device_id: str) -> Optional[SoilData]:
        if not self.api_key:
            logger.warning("CropIn API key not configured")
            return None
            
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/sensors/{device_id}/readings/latest",
                    headers={"X-API-Key": self.api_key}
                )
                
                if response.status_code != 200:
                    return None
                
                data = response.json()
                reading = SoilData(
                    device_id=device_id,
                    timestamp=datetime.fromisoformat(data['recorded_at']),
                    nitrogen=data['n_value'],
                    phosphorus=data['p_value'],
                    potassium=data['k_value'],
                    ph=data['ph_level'],
                    moisture=data['soil_moisture'],
                    temperature=data['soil_temperature'],
                    electrical_conductivity=data.get('ec_value'),
                    source="sensor",
                    vendor=self.vendor.value
                )
                return reading if reading.is_valid() else None
                
        except Exception as e:
            logger.error(f"CropIn adapter error: {e}")
            return None
    
    async def get_connection_status(self, device_id: str) -> ConnectionStatus:
        if not self.api_key:
            return ConnectionStatus.NOT_CONFIGURED
        reading = await self.get_soil_data(device_id)
        if reading is None:
            return ConnectionStatus.ERROR
        observed = reading.timestamp
        if observed.tzinfo is None:
            # A vendor timestamp without an offset cannot establish freshness.
            return ConnectionStatus.STALE
        age = (datetime.now(timezone.utc) - observed).total_seconds()
        return ConnectionStatus.CONNECTED if 0 <= age <= 86400 else ConnectionStatus.STALE
    
    async def list_devices(self) -> List[SensorInfo]:
        # Simplified implementation
        return []


class ManualInputAdapter(SensorAdapter):
    """Fallback adapter for manual user input"""
    
    vendor = SensorVendor.MANUAL
    
    def __init__(self):
        self._manual_data: Dict[str, SoilData] = {}
    
    async def get_soil_data(self, device_id: str) -> Optional[SoilData]:
        return self._manual_data.get(device_id)
    
    async def get_connection_status(self, device_id: str) -> ConnectionStatus:
        if device_id in self._manual_data:
            return ConnectionStatus.CONNECTED
        return ConnectionStatus.NOT_CONFIGURED
    
    async def list_devices(self) -> List[SensorInfo]:
        return [
            SensorInfo(
                device_id=device_id,
                vendor=self.vendor,
                name=f"Manual Input - {device_id}",
                status=ConnectionStatus.CONNECTED,
                last_reading=data.timestamp
            )
            for device_id, data in self._manual_data.items()
        ]
    
    def set_manual_data(self, device_id: str, data: SoilData) -> None:
        """Store manually entered soil data"""
        data.source = "manual"
        data.vendor = self.vendor.value
        self._manual_data[device_id] = data
        logger.info(f"Manual soil data saved for device: {device_id}")


class SensorManager:
    """
    Unified manager for all sensor adapters
    Handles vendor selection, fallback logic, and caching
    """
    
    def __init__(self):
        self.adapters: Dict[SensorVendor, SensorAdapter] = {
            SensorVendor.FASAL: FasalAdapter(),
            SensorVendor.CROPIN: CropInAdapter(),
            SensorVendor.MANUAL: ManualInputAdapter(),
        }
        self.default_vendor = SensorVendor.MANUAL
        self._device_vendor_map: Dict[str, SensorVendor] = {}
    
    def register_device(self, device_id: str, vendor: SensorVendor) -> None:
        """Register a device with its vendor"""
        self._device_vendor_map[device_id] = vendor
        logger.info(f"Registered device {device_id} with vendor {vendor.value}")
    
    def get_adapter(self, vendor: SensorVendor) -> SensorAdapter:
        """Get adapter for a specific vendor"""
        return self.adapters.get(vendor, self.adapters[SensorVendor.MANUAL])
    
    async def get_soil_data(
        self, 
        device_id: str, 
        vendor: Optional[SensorVendor] = None
    ) -> Optional[SoilData]:
        """
        Get soil data with automatic fallback
        1. Try specified vendor
        2. Fall back to registered vendor
        3. Fall back to manual input
        """
        if vendor is None:
            vendor = self._device_vendor_map.get(device_id, self.default_vendor)
        
        adapter = self.get_adapter(vendor)
        data = await adapter.get_soil_data(device_id)
        
        if data is None and vendor != SensorVendor.MANUAL:
            logger.info(f"Falling back to manual input for device {device_id}")
            data = await self.adapters[SensorVendor.MANUAL].get_soil_data(device_id)
        
        return data
    
    async def get_all_device_status(self) -> List[SensorInfo]:
        """Get status of all connected devices"""
        all_devices = []
        for adapter in self.adapters.values():
            devices = await adapter.list_devices()
            all_devices.extend(devices)
        return all_devices
    
    def set_manual_data(self, device_id: str, data: SoilData) -> None:
        """Set manual input data"""
        manual_adapter = self.adapters[SensorVendor.MANUAL]
        if isinstance(manual_adapter, ManualInputAdapter):
            manual_adapter.set_manual_data(device_id, data)
            self._device_vendor_map[device_id] = SensorVendor.MANUAL


# Global sensor manager instance
sensor_manager = SensorManager()
