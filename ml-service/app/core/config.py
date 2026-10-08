import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PYTHON_ENV: str = "development"
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    LOG_LEVEL: str = "INFO"
    APP_NAME: str = "SmartFinAI-ML-Service"
    SERVICE_AUTH_TOKEN: str = "dev_ml_service_shared_secret_token_12345"
    ALLOWED_CALLER_IPS: str = "127.0.0.1,172.17.0.1"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5000,http://127.0.0.1:5173,http://127.0.0.1:5000"

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
