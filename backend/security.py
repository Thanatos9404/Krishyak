"""
Security utilities and configuration for Krishyak backend
Provides secure configuration loading, input validation, and security helpers
"""
import os
import re
import secrets
import logging
from functools import wraps
from typing import Optional, List, Any
from pathlib import Path

from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)


class SecurityConfig:
    """Centralized security configuration loaded from environment variables"""
    
    def __init__(self):
        self._load_config()
        self._validate_config()
    
    def _load_config(self):
        """Load all security-related configuration from environment"""
        # Core security
        self.secret_key = os.getenv("SECRET_KEY", "")
        self.environment = os.getenv("ENVIRONMENT", "development")
        self.debug = os.getenv("DEBUG", "false").lower() == "true"
        
        # CORS configuration - include production URLs in defaults
        default_origins = "http://localhost:3000,http://127.0.0.1:3000,https://krishyak.vercel.app,https://krishisaarthi.vercel.app"
        cors_origins = os.getenv("CORS_ORIGINS", default_origins)
        self.cors_origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
        
        # Rate limiting
        self.rate_limit_per_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
        self.rate_limit_per_day = int(os.getenv("RATE_LIMIT_PER_DAY", "1000"))
        
        # API Keys
        self.plantid_api_key = os.getenv("PLANTID_API_KEY", "")
        self.openweather_api_key = os.getenv("OPENWEATHER_API_KEY", "")
        
        # Logging
        self.log_level = os.getenv("LOG_LEVEL", "INFO")
        self.log_format = os.getenv("LOG_FORMAT", "json")
    
    def _validate_config(self):
        """Validate critical configuration and log warnings"""
        warnings = []
        
        if not self.secret_key:
            if self.environment == "production":
                raise ValueError("SECRET_KEY is required in production environment!")
            else:
                # Generate temporary key for development
                self.secret_key = secrets.token_urlsafe(32)
                warnings.append("SECRET_KEY not set, using temporary key (not for production)")
        
        if "*" in self.cors_origins or not self.cors_origins:
            if self.environment == "production":
                raise ValueError("CORS_ORIGINS must be explicitly set in production!")
            warnings.append("CORS_ORIGINS is not explicitly configured")
        
        if self.debug and self.environment == "production":
            raise ValueError("DEBUG cannot be enabled in production!")
        
        for warning in warnings:
            logger.warning(f"Security configuration: {warning}")
    
    @property
    def is_production(self) -> bool:
        return self.environment == "production"
    
    @property
    def is_development(self) -> bool:
        return self.environment == "development"


# Global security config instance
security_config = SecurityConfig()


class InputSanitizer:
    """Input validation and sanitization utilities"""
    
    # Patterns for common attacks
    SQL_INJECTION_PATTERNS = [
        r"(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER)\b)",
        r"(--)|(;)",
        r"(\bOR\b\s+\d+\s*=\s*\d+)",
    ]
    
    XSS_PATTERNS = [
        r"<script[^>]*>",
        r"javascript:",
        r"on\w+\s*=",
        r"<iframe",
        r"<object",
    ]
    
    @classmethod
    def sanitize_string(cls, value: str, max_length: int = 1000) -> str:
        """Sanitize a string input"""
        if not isinstance(value, str):
            value = str(value)
        
        # Truncate to max length
        value = value[:max_length]
        
        # Remove null bytes
        value = value.replace("\x00", "")
        
        # Strip leading/trailing whitespace
        value = value.strip()
        
        return value
    
    @classmethod
    def validate_crop_name(cls, crop: str, allowed_crops: List[str]) -> str:
        """Validate crop name against allowed list"""
        crop = cls.sanitize_string(crop, max_length=100)
        
        # Case-insensitive match
        crop_lower = crop.lower()
        for allowed in allowed_crops:
            if allowed.lower() == crop_lower:
                return allowed  # Return the canonical form
        
        raise ValueError(f"Invalid crop: {crop}")
    
    @classmethod
    def validate_soil_type(cls, soil: str, allowed_soils: List[str]) -> str:
        """Validate soil type against allowed list"""
        soil = cls.sanitize_string(soil, max_length=50)
        
        soil_lower = soil.lower()
        for allowed in allowed_soils:
            if allowed.lower() == soil_lower:
                return allowed
        
        raise ValueError(f"Invalid soil type: {soil}")
    
    @classmethod
    def validate_numeric_range(
        cls, 
        value: float, 
        min_val: Optional[float] = None, 
        max_val: Optional[float] = None,
        field_name: str = "value"
    ) -> float:
        """Validate numeric value is within range"""
        if not isinstance(value, (int, float)):
            raise ValueError(f"{field_name} must be a number")
        
        if min_val is not None and value < min_val:
            raise ValueError(f"{field_name} must be at least {min_val}")
        
        if max_val is not None and value > max_val:
            raise ValueError(f"{field_name} must be at most {max_val}")
        
        return float(value)
    
    @classmethod
    def check_for_injection(cls, value: str) -> bool:
        """Check if string contains potential SQL injection patterns"""
        value_upper = value.upper()
        for pattern in cls.SQL_INJECTION_PATTERNS:
            if re.search(pattern, value_upper, re.IGNORECASE):
                logger.warning(f"Potential SQL injection detected in input")
                return True
        return False
    
    @classmethod
    def check_for_xss(cls, value: str) -> bool:
        """Check if string contains potential XSS patterns"""
        for pattern in cls.XSS_PATTERNS:
            if re.search(pattern, value, re.IGNORECASE):
                logger.warning(f"Potential XSS detected in input")
                return True
        return False
    
    @classmethod
    def is_safe_input(cls, value: str) -> bool:
        """Check if input is safe (no injection or XSS patterns)"""
        return not cls.check_for_injection(value) and not cls.check_for_xss(value)


class FileValidator:
    """File upload validation utilities"""
    
    ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
    
    @classmethod
    def validate_image_upload(cls, content: bytes, content_type: str, filename: str = "") -> None:
        """Validate uploaded image file"""
        # Check content type
        if content_type not in cls.ALLOWED_IMAGE_TYPES:
            raise ValueError(f"Invalid file type: {content_type}. Allowed: {', '.join(cls.ALLOWED_IMAGE_TYPES)}")
        
        # Check file size
        if len(content) > cls.MAX_FILE_SIZE:
            raise ValueError(f"File too large. Maximum size is {cls.MAX_FILE_SIZE // (1024*1024)}MB")
        
        # Check file signature (magic bytes) for common image formats
        magic_bytes = {
            b'\xff\xd8\xff': 'jpeg',
            b'\x89PNG': 'png',
            b'RIFF': 'webp',
        }
        
        valid_magic = False
        for magic, fmt in magic_bytes.items():
            if content[:len(magic)] == magic:
                valid_magic = True
                break
        
        if not valid_magic:
            raise ValueError("File content does not match declared type")


def generate_request_id() -> str:
    """Generate a unique request ID for logging and tracing"""
    return secrets.token_hex(8)


def mask_sensitive_data(data: dict, sensitive_keys: List[str] = None) -> dict:
    """Mask sensitive data in a dictionary for logging"""
    if sensitive_keys is None:
        sensitive_keys = ["password", "api_key", "secret", "token", "key"]
    
    masked = {}
    for key, value in data.items():
        key_lower = key.lower()
        if any(s in key_lower for s in sensitive_keys):
            masked[key] = "***MASKED***"
        elif isinstance(value, dict):
            masked[key] = mask_sensitive_data(value, sensitive_keys)
        else:
            masked[key] = value
    
    return masked
