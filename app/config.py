"""Application settings loaded from environment (12-factor).

Secrets live only in the environment / .env — never in code.
"""
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "stanley-fitness-audience-crm"
    app_env: str = "development"
    debug: bool = True
    secret_key: str = "change-me-to-a-long-random-string-min-32-chars"
    cors_origins: str = "*"

    # Admin auth
    admin_username: str = "admin"
    admin_password: str = "admin12345"
    admin_password_hash: str = ""

    # Database
    database_url: str = "sqlite+pysqlite:///./dev.sqlite3"

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # Meta
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_access_token: str = ""
    meta_ad_account_id: str = ""
    meta_page_id: str = ""
    meta_pixel_id: str = ""
    meta_api_version: str = "v21.0"
    verify_token: str = "choose-a-random-verify-token"

    # Telegram
    telegram_bot_token: str = ""
    telegram_manager_chat_id: str = ""

    # Rate limiting
    rate_limit_default: str = "120/minute"

    @property
    def cors_origin_list(self) -> List[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def meta_configured(self) -> bool:
        return bool(self.meta_access_token and self.meta_ad_account_id)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
