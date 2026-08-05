"""
Application configuration loaded from environment variables.
All secrets must be set in .env – no hardcoded values.
"""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "PatentAI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ── Paths ─────────────────────────────────────────────────────────────────
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR / "data"
    FAISS_INDEX_PATH: Path = BASE_DIR / "data" / "patents.index"
    METADATA_PATH: Path = BASE_DIR / "data" / "patents_metadata.pkl"
    PATENTS_CSV_PATH: Path = BASE_DIR / "data" / "patents.csv"

    # ── AI Models ─────────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    SUMMARIZATION_MODEL: str = "facebook/bart-large-cnn"
    TOP_K_RESULTS: int = 10
    MAX_SUMMARY_INPUT_TOKENS: int = 1024
    MAX_SUMMARY_LENGTH: int = 512
    MIN_SUMMARY_LENGTH: int = 64

    # ── Firebase ──────────────────────────────────────────────────────────────
    FIREBASE_CREDENTIALS_PATH: str = "firebase-service-account.json"
    FIREBASE_PROJECT_ID: str = ""

    # ── Security ──────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]
    RATE_LIMIT_REQUESTS: int = 30
    RATE_LIMIT_WINDOW_SECONDS: int = 60
    MAX_PDF_SIZE_MB: int = 20

    # ── Logging ───────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/patentai.log"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings singleton."""
    return Settings()
