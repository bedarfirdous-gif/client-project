"""
Configuration Management
========================
Centralized configuration with environment variable support.
"""

import os
from typing import Optional, List
from dataclasses import dataclass, field
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / '.env')


@dataclass
class DatabaseConfig:
    """Database configuration"""
    mongo_url: str = field(default_factory=lambda: os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
    db_name: str = field(default_factory=lambda: os.environ.get('DB_NAME', 'bijnisbooks'))
    
    @property
    def connection_string(self) -> str:
        return self.mongo_url


@dataclass
class AuthConfig:
    """Authentication configuration"""
    jwt_secret: str = field(default_factory=lambda: os.environ.get('JWT_SECRET', 'your-secret-key'))
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days
    refresh_token_expire_days: int = 30


@dataclass
class CORSConfig:
    """CORS configuration"""
    origins: List[str] = field(default_factory=lambda: os.environ.get('CORS_ORIGINS', '*').split(','))
    allow_credentials: bool = True
    allow_methods: List[str] = field(default_factory=lambda: ["*"])
    allow_headers: List[str] = field(default_factory=lambda: ["*"])


@dataclass
class AIConfig:
    """AI/LLM configuration"""
    emergent_key: str = field(default_factory=lambda: os.environ.get('EMERGENT_API_KEY', ''))
    openai_model: str = "gpt-5.2"
    max_tokens: int = 4096


@dataclass
class AppConfig:
    """Main application configuration"""
    app_name: str = "BijnisBooks"
    version: str = "2.0.0"
    debug: bool = field(default_factory=lambda: os.environ.get('DEBUG', 'false').lower() == 'true')
    environment: str = field(default_factory=lambda: os.environ.get('ENVIRONMENT', 'production'))
    
    # Sub-configurations
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    auth: AuthConfig = field(default_factory=AuthConfig)
    cors: CORSConfig = field(default_factory=CORSConfig)
    ai: AIConfig = field(default_factory=AIConfig)
    
    @property
    def is_production(self) -> bool:
        return self.environment == 'production'
    
    @property
    def is_development(self) -> bool:
        return self.environment == 'development'


# Singleton configuration instance
_config: Optional[AppConfig] = None


def get_config() -> AppConfig:
    """Get application configuration singleton"""
    global _config
    if _config is None:
        _config = AppConfig()
    return _config


# Convenience access
config = get_config()
