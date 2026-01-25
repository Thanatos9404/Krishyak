"""
Pest Data Store Module
Handles persistent storage for:
1. Farmer-submitted pest reports
2. Aggregated outbreak history
3. Local cache for offline access
"""

import os
import json
import hashlib
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict


# ============================================================================
# CONFIGURATION
# ============================================================================

PEST_DATA_DIR = Path(os.getenv("PEST_DATA_DIR", "./pest_data"))
REPORTS_FILE = PEST_DATA_DIR / "farmer_reports.json"
HISTORY_FILE = PEST_DATA_DIR / "outbreak_history.json"

# Ensure directory exists
PEST_DATA_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class FarmerPestReport:
    """Farmer-submitted pest report"""
    id: str
    farmer_id: str  # Anonymous identifier
    pest_type: str
    pest_name: str
    crop: str
    severity: str  # low, medium, high
    description: str
    location: Dict[str, float]  # lat, lng
    district: str
    state: str
    photo_url: Optional[str] = None
    timestamp: str = ""  # ISO format
    verified: bool = False
    verification_notes: str = ""
    
    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now().isoformat()
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> "FarmerPestReport":
        return cls(**data)


# ============================================================================
# PEST DATA STORE
# ============================================================================

class PestDataStore:
    """
    File-based persistent storage for pest reports and history.
    Thread-safe with file locking.
    """
    
    def __init__(self):
        self._lock = threading.Lock()
        self._ensure_files_exist()
    
    def _ensure_files_exist(self):
        """Create data files if they don't exist"""
        if not REPORTS_FILE.exists():
            self._write_json(REPORTS_FILE, {"reports": []})
        if not HISTORY_FILE.exists():
            self._write_json(HISTORY_FILE, {"outbreaks": []})
    
    def _read_json(self, filepath: Path) -> dict:
        """Read JSON file with error handling"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}
    
    def _write_json(self, filepath: Path, data: dict):
        """Write JSON file atomically"""
        temp_file = filepath.with_suffix('.tmp')
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        temp_file.replace(filepath)
    
    # ========================================================================
    # FARMER REPORTS
    # ========================================================================
    
    def save_farmer_report(self, report: FarmerPestReport) -> str:
        """
        Save a farmer pest report.
        Returns the report ID.
        """
        with self._lock:
            data = self._read_json(REPORTS_FILE)
            if "reports" not in data:
                data["reports"] = []
            
            # Generate unique ID if not present
            if not report.id:
                report.id = hashlib.md5(
                    f"{report.farmer_id}_{report.timestamp}_{report.pest_type}".encode()
                ).hexdigest()[:12]
            
            # Add report
            data["reports"].append(report.to_dict())
            
            # Keep only last 1000 reports
            if len(data["reports"]) > 1000:
                data["reports"] = data["reports"][-1000:]
            
            self._write_json(REPORTS_FILE, data)
            return report.id
    
    def get_reports_by_region(self, state: str, district: str = None, 
                               days: int = 7) -> List[FarmerPestReport]:
        """
        Get pest reports for a specific region.
        """
        with self._lock:
            data = self._read_json(REPORTS_FILE)
            reports = data.get("reports", [])
            
            cutoff = datetime.now() - timedelta(days=days)
            
            filtered = []
            for r in reports:
                # Filter by state
                if r.get("state", "").lower() != state.lower():
                    continue
                
                # Filter by district if specified
                if district and r.get("district", "").lower() != district.lower():
                    continue
                
                # Filter by date
                try:
                    report_time = datetime.fromisoformat(r.get("timestamp", ""))
                    if report_time < cutoff:
                        continue
                except ValueError:
                    continue
                
                filtered.append(FarmerPestReport.from_dict(r))
            
            return filtered
    
    def get_reports_by_crop(self, crop: str, days: int = 30) -> List[FarmerPestReport]:
        """Get all reports for a specific crop"""
        with self._lock:
            data = self._read_json(REPORTS_FILE)
            reports = data.get("reports", [])
            
            cutoff = datetime.now() - timedelta(days=days)
            
            filtered = []
            for r in reports:
                if r.get("crop", "").lower() != crop.lower():
                    continue
                
                try:
                    report_time = datetime.fromisoformat(r.get("timestamp", ""))
                    if report_time < cutoff:
                        continue
                except ValueError:
                    continue
                
                filtered.append(FarmerPestReport.from_dict(r))
            
            return filtered
    
    def get_report_by_id(self, report_id: str) -> Optional[FarmerPestReport]:
        """Get a specific report by ID"""
        with self._lock:
            data = self._read_json(REPORTS_FILE)
            for r in data.get("reports", []):
                if r.get("id") == report_id:
                    return FarmerPestReport.from_dict(r)
            return None
    
    def get_recent_reports(self, limit: int = 20) -> List[FarmerPestReport]:
        """Get most recent reports across all regions"""
        with self._lock:
            data = self._read_json(REPORTS_FILE)
            reports = data.get("reports", [])
            
            # Sort by timestamp descending
            reports.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
            
            return [FarmerPestReport.from_dict(r) for r in reports[:limit]]
    
    def get_report_statistics(self, days: int = 30) -> Dict[str, Any]:
        """Get aggregated statistics from reports"""
        with self._lock:
            data = self._read_json(REPORTS_FILE)
            reports = data.get("reports", [])
            
            cutoff = datetime.now() - timedelta(days=days)
            
            stats = {
                "total_reports": 0,
                "by_severity": {"low": 0, "medium": 0, "high": 0},
                "by_crop": {},
                "by_pest": {},
                "by_state": {},
                "period_days": days
            }
            
            for r in reports:
                try:
                    report_time = datetime.fromisoformat(r.get("timestamp", ""))
                    if report_time < cutoff:
                        continue
                except ValueError:
                    continue
                
                stats["total_reports"] += 1
                
                severity = r.get("severity", "low")
                stats["by_severity"][severity] = stats["by_severity"].get(severity, 0) + 1
                
                crop = r.get("crop", "Unknown")
                stats["by_crop"][crop] = stats["by_crop"].get(crop, 0) + 1
                
                pest = r.get("pest_name", r.get("pest_type", "Unknown"))
                stats["by_pest"][pest] = stats["by_pest"].get(pest, 0) + 1
                
                state = r.get("state", "Unknown")
                stats["by_state"][state] = stats["by_state"].get(state, 0) + 1
            
            return stats
    
    def verify_report(self, report_id: str, verified: bool, notes: str = "") -> bool:
        """Mark a report as verified/unverified"""
        with self._lock:
            data = self._read_json(REPORTS_FILE)
            
            for i, r in enumerate(data.get("reports", [])):
                if r.get("id") == report_id:
                    data["reports"][i]["verified"] = verified
                    data["reports"][i]["verification_notes"] = notes
                    self._write_json(REPORTS_FILE, data)
                    return True
            
            return False
    
    # ========================================================================
    # OUTBREAK HISTORY
    # ========================================================================
    
    def record_outbreak(self, outbreak: Dict) -> str:
        """
        Record an outbreak event.
        Used for building historical patterns.
        """
        with self._lock:
            data = self._read_json(HISTORY_FILE)
            if "outbreaks" not in data:
                data["outbreaks"] = []
            
            # Generate ID
            outbreak_id = hashlib.md5(
                f"{outbreak.get('pest')}_{outbreak.get('crop')}_{outbreak.get('date')}".encode()
            ).hexdigest()[:12]
            
            outbreak["id"] = outbreak_id
            outbreak["recorded_at"] = datetime.now().isoformat()
            
            data["outbreaks"].append(outbreak)
            
            # Keep only last 500 outbreak records
            if len(data["outbreaks"]) > 500:
                data["outbreaks"] = data["outbreaks"][-500:]
            
            self._write_json(HISTORY_FILE, data)
            return outbreak_id
    
    def get_outbreak_history(self, crop: str = None, pest: str = None, 
                              years: int = 3) -> List[Dict]:
        """Get historical outbreak data"""
        with self._lock:
            data = self._read_json(HISTORY_FILE)
            outbreaks = data.get("outbreaks", [])
            
            cutoff_year = datetime.now().year - years
            
            filtered = []
            for o in outbreaks:
                # Filter by crop
                if crop and o.get("crop", "").lower() != crop.lower():
                    continue
                
                # Filter by pest
                if pest and pest.lower() not in o.get("pest", "").lower():
                    continue
                
                # Filter by year
                try:
                    outbreak_year = int(o.get("year", 0))
                    if outbreak_year < cutoff_year:
                        continue
                except ValueError:
                    continue
                
                filtered.append(o)
            
            return filtered
    
    def get_outbreak_trends(self, crop: str, years: int = 5) -> Dict[str, Any]:
        """
        Analyze outbreak trends for a crop.
        Returns year-over-year comparison.
        """
        history = self.get_outbreak_history(crop=crop, years=years)
        
        if not history:
            return {"crop": crop, "trend": "insufficient_data", "data_points": 0}
        
        # Group by year
        by_year = {}
        for o in history:
            year = o.get("year")
            if year not in by_year:
                by_year[year] = {"count": 0, "severity_sum": 0}
            
            by_year[year]["count"] += 1
            severity_val = {"low": 1, "medium": 2, "high": 3}.get(o.get("severity", "low"), 1)
            by_year[year]["severity_sum"] += severity_val
        
        # Calculate trend
        years_list = sorted(by_year.keys())
        if len(years_list) < 2:
            trend = "stable"
        else:
            recent = by_year[years_list[-1]]["count"]
            previous = by_year[years_list[-2]]["count"]
            
            if recent > previous * 1.2:
                trend = "increasing"
            elif recent < previous * 0.8:
                trend = "decreasing"
            else:
                trend = "stable"
        
        return {
            "crop": crop,
            "trend": trend,
            "by_year": by_year,
            "data_points": len(history)
        }


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

pest_store = PestDataStore()
