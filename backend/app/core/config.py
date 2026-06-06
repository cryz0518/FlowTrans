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
    dashscope_realtime_text_model: str = "qwen-turbo"
    dashscope_text_model: str = "qwen-plus"
    dashscope_tts_endpoint: str = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
    dashscope_tts_model: str = "cosyvoice-v3-flash"
    dashscope_tts_voice: str = "longanyang"
    dashscope_tts_format: str = "mp3"
    dashscope_tts_sample_rate: int = 24000


@lru_cache
def get_settings() -> Settings:
    return Settings()
