import json
from functools import lru_cache

from pydantic import ValidationInfo, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    SENTINEL AI Application Configuration.
    Loads settings from environment variables and .env file with validated types.
    """

    APP_NAME: str = "SENTINEL AI"
    APP_ENV: str = "development"  # development, staging, production, testing
    DEBUG: bool = True
    VERSION: str = "0.1.0"
    API_PREFIX: str = ""

    # Server Network Bindings
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Logging
    LOG_LEVEL: str = "INFO"

    # CORS Allowed Origins
    ALLOWED_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    # WebSocket Settings
    WS_HEARTBEAT_INTERVAL_SECONDS: int = 30
    WS_MAX_CONNECTIONS: int = 100
    WS_MAX_MESSAGE_SIZE_BYTES: int = 2_097_152  # 2MB max frame size

    # Audio & Streaming Ingestion Settings
    AUDIO_MAX_FRAME_BYTES: int = 1_048_576  # 1MB
    AUDIO_MAX_QUEUE_SIZE: int = 150
    AUDIO_DEFAULT_SAMPLE_RATE: int = 16000
    AUDIO_DEFAULT_CHANNELS: int = 1
    AUDIO_SUPPORTED_CODECS: list[str] = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/wav",
        "audio/x-wav",
        "audio/pcm",
        "pcm16",
    ]

    # STT Provider Settings
    STT_PROVIDER: str = "mock"  # "mock", "deepgram", "google"
    STT_API_KEY: str | None = None
    DEEPGRAM_API_KEY: str | None = None
    STT_LANGUAGE: str = "en-US"
    STT_INTERIM_RESULTS: bool = True
    STT_TIMEOUT_SECONDS: float = 10.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_allowed_origins(cls, v: list[str] | str) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    parsed = json.loads(v_stripped)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return []

    @field_validator("ALLOWED_ORIGINS")
    @classmethod
    def validate_production_cors(cls, v: list[str], info: ValidationInfo) -> list[str]:
        # Disallow wildcard in production
        if info.data and info.data.get("APP_ENV", "development") == "production" and "*" in v:
            raise ValueError("Wildcard '*' in ALLOWED_ORIGINS is prohibited in production mode.")
        return v

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def is_testing(self) -> bool:
        return self.APP_ENV.lower() == "testing"


@lru_cache
def get_settings() -> Settings:
    """Return cached singleton instance of Settings."""
    return Settings()


settings = get_settings()
