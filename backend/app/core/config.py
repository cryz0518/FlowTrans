from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    service_name: str = "flowtrans-backend"
    provider_mode: Literal["fake", "dashscope"] = "dashscope"
    target_language: str = "zh-CN"
    dashscope_api_key: str | None = None
    dashscope_asr_endpoint: str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
    dashscope_asr_model: str = "qwen3-asr-flash-realtime"
    dashscope_text_model: str = "qwen-plus"
    dashscope_tts_model: str = "CosyVoice-v3.5-flash"


@lru_cache
def get_settings() -> Settings:
    return Settings()
