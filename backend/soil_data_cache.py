"""
Soil Data Cache - Offline-First Caching Layer
Stores sensor readings locally for offline access and performance

Features:
- JSON file-based storage (portable, no DB dependency)
- Automatic cache expiry
- History retention
- Thread-safe operations
"""

import os
import json
import hashlib
import tempfile
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pathlib import Path
from threading import Lock
from dataclasses import asdict

from sensor_adapter import SoilData

logger = logging.getLogger(__name__)


class SoilDataCache:
    """
    File-based cache for soil sensor data
    Supports offline operation and data history
    """
    
    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = Path(cache_dir or os.getenv("SOIL_CACHE_DIR", str(Path(__file__).parent / 'soil_cache')))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.max_history_days = 30
        self.stale_threshold_hours = 24
        self._lock = Lock()
        logger.info(f"Soil data cache initialized at: {self.cache_dir}")
    
    def _get_device_file(self, device_id: str) -> Path:
        """Get cache file path for a device"""
        return self.cache_dir / ('device-' + hashlib.sha256(device_id.encode('utf-8')).hexdigest() + '.json')
    
    def _load_device_data(self, device_id: str) -> Dict[str, Any]:
        """Load all cached data for a device"""
        file_path = self._get_device_file(device_id)
        if not file_path.exists():
            legacy_id = ''.join(c if c.isalnum() else '_' for c in device_id)
            file_path = self.cache_dir / f'{legacy_id}.json'
            if not file_path.exists():
                return {"device_id": device_id, "readings": []}
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if data.get('device_id') != device_id:
                    return {"device_id": device_id, "readings": []}
                return data
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"Error loading cache for {device_id}: {e}")
            raise ValueError('Saved soil data could not be read; it has not been replaced.') from e
    
    def _save_device_data(self, device_id: str, data: Dict[str, Any]) -> None:
        """Save device data to cache file"""
        file_path = self._get_device_file(device_id)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=self.cache_dir, suffix='.tmp', delete=False) as f:
                temporary = Path(f.name)
                json.dump(data, f, indent=2, default=str)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temporary, file_path)
        finally:
            if temporary is not None and temporary.exists():
                temporary.unlink()
    
    def save(self, device_id: str, soil_data: SoilData) -> None:
        """
        Save a new soil reading to cache
        Maintains history while respecting max_history_days
        """
        if soil_data.device_id != device_id or not soil_data.is_valid():
            raise ValueError("Soil reading must be valid and match the device identifier")
        with self._lock:
            data = self._load_device_data(device_id)
            reading = soil_data.to_dict()
            stamp = soil_data.timestamp.timestamp()
            readings = data['readings']
            match = next((i for i, item in enumerate(readings)
                          if datetime.fromisoformat(item['timestamp']).timestamp() == stamp), None)
            if match is not None:
                if readings[match] == reading:
                    return
                readings[match] = reading
            else:
                readings.append(reading)
            # A delayed observation must not replace a more recent measurement.
            candidates = readings + ([data['latest']] if data.get('latest') else [])
            data['latest'] = max(candidates, key=lambda item: datetime.fromisoformat(item['timestamp']).timestamp())
            data["updated_at"] = datetime.now().isoformat()
            
            # Prune old readings
            data["readings"] = [
                r for r in data["readings"]
                if self._within_days(r['timestamp'], self.max_history_days)
            ]
            
            self._save_device_data(device_id, data)
            logger.debug(f"Cached soil data for device {device_id}")
    
    def get_latest(self, device_id: str) -> Optional[SoilData]:
        """
        Get the most recent soil reading for a device
        Returns None if no data cached
        """
        with self._lock:
            data = self._load_device_data(device_id)
            latest = data.get("latest")
            
            if latest:
                try:
                    soil_data = SoilData.from_dict(latest)
                    soil_data.source = "cached"
                    return soil_data
                except Exception as e:
                    logger.error(f"Error parsing cached data: {e}")
            
            return None
    
    def get_history(
        self, 
        device_id: str, 
        days: int = 7
    ) -> List[SoilData]:
        """
        Get historical readings for a device
        """
        with self._lock:
            data = self._load_device_data(device_id)
            readings = data.get("readings", [])
            
            result = []
            
            for reading in readings:
                try:
                    timestamp = datetime.fromisoformat(reading["timestamp"])
                    if self._within_days(reading['timestamp'], days):
                        soil_data = SoilData.from_dict(reading)
                        result.append(soil_data)
                except Exception as e:
                    logger.error(f"Error parsing history entry: {e}")
                    continue
            
            # Sort by timestamp descending
            result.sort(key=lambda x: x.timestamp.timestamp(), reverse=True)
            return result
    
    def is_stale(
        self, 
        device_id: str, 
        max_age_hours: Optional[float] = None
    ) -> bool:
        """
        Check if cached data is stale (older than threshold)
        """
        max_age = self.stale_threshold_hours if max_age_hours is None else max_age_hours
        
        with self._lock:
            data = self._load_device_data(device_id)
            updated_at = data.get('latest', {}).get('timestamp') or data.get("updated_at")
            
            if not updated_at:
                return True
            
            try:
                last_update = datetime.fromisoformat(updated_at)
                age = datetime.now(last_update.tzinfo) - last_update
                return age > timedelta(hours=max_age)
            except Exception:
                return True

    @staticmethod
    def _within_days(timestamp, days):
        observed = datetime.fromisoformat(timestamp)
        return observed > datetime.now(observed.tzinfo) - timedelta(days=days)
    
    def get_last_update_time(self, device_id: str) -> Optional[datetime]:
        """Get the timestamp of the last cached reading"""
        with self._lock:
            data = self._load_device_data(device_id)
            updated_at = data.get("updated_at")
            
            if updated_at:
                try:
                    return datetime.fromisoformat(updated_at)
                except Exception:
                    pass
            
            return None
    
    def clear_device(self, device_id: str) -> None:
        """Clear all cached data for a device"""
        with self._lock:
            file_path = self._get_device_file(device_id)
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Cleared cache for device {device_id}")
            legacy_id = ''.join(c if c.isalnum() else '_' for c in device_id)
            legacy_path = self.cache_dir / f'{legacy_id}.json'
            if legacy_path.exists():
                with legacy_path.open(encoding='utf-8') as f:
                    matches = json.load(f).get('device_id') == device_id
                if matches:
                    legacy_path.unlink()
    
    def list_cached_devices(self) -> List[str]:
        """List all devices with cached data"""
        devices = []
        for file_path in self.cache_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    device_id = data.get("device_id")
                    if device_id:
                        devices.append(device_id)
            except Exception:
                continue
        return sorted(set(devices))
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        devices = self.list_cached_devices()
        total_readings = 0
        oldest_reading = None
        newest_reading = None
        
        for device_id in devices:
            data = self._load_device_data(device_id)
            readings = data.get("readings", [])
            total_readings += len(readings)
            
            for reading in readings:
                try:
                    timestamp = datetime.fromisoformat(reading["timestamp"])
                    if oldest_reading is None or timestamp.timestamp() < oldest_reading.timestamp():
                        oldest_reading = timestamp
                    if newest_reading is None or timestamp.timestamp() > newest_reading.timestamp():
                        newest_reading = timestamp
                except Exception:
                    continue
        
        return {
            "device_count": len(devices),
            "total_readings": total_readings,
            "oldest_reading": oldest_reading.isoformat() if oldest_reading else None,
            "newest_reading": newest_reading.isoformat() if newest_reading else None,
            "cache_directory": str(self.cache_dir),
            "max_history_days": self.max_history_days,
            "stale_threshold_hours": self.stale_threshold_hours
        }


# Global cache instance
soil_cache = SoilDataCache()
