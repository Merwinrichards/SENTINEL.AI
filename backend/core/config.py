from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "SENTINEL AI"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = True

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ]

    # Threat scoring thresholds (0 - 100)
    THRESHOLD_YELLOW: float = 35.0  # Suspicious / Guarded
    THRESHOLD_ORANGE: float = 65.0  # Elevated Threat / Active Warning
    THRESHOLD_RED: float = 85.0  # Critical / Kill-Switch Armed

    # Risk weights for different scam vectors
    WEIGHT_URGENCY: float = 1.2
    WEIGHT_REMOTE_ACCESS: float = 2.0
    WEIGHT_FINANCIAL_DEMAND: float = 1.8
    WEIGHT_OTP_CREDENTIALS: float = 2.2
    WEIGHT_AUTHORITY_IMPERSONATION: float = 1.5

    # Cryptographic Chain Settings
    GENESIS_PREV_HASH: str = "0000000000000000000000000000000000000000000000000000000000000000"
    PROOF_DIFFICULTY: int = 1
    CRYPTO_SALT: str = "SENTINEL-CHAIN-SECURE-FORENSIC-SALT-2026"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
