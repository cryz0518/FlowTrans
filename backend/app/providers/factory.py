from app.core.config import Settings
from app.providers.dashscope_provider import DashScopeProvider
from app.providers.fake_provider import FakeProvider


def create_provider(settings: Settings) -> FakeProvider | DashScopeProvider:
    if settings.provider_mode == "dashscope":
        return DashScopeProvider(
            api_key=settings.dashscope_api_key,
            asr_endpoint=settings.dashscope_asr_endpoint,
            asr_model=settings.dashscope_asr_model,
            realtime_text_model=settings.dashscope_realtime_text_model,
            text_model=settings.dashscope_text_model,
            tts_endpoint=settings.dashscope_tts_endpoint,
            tts_model=settings.dashscope_tts_model,
            tts_voice=settings.dashscope_tts_voice,
            tts_format=settings.dashscope_tts_format,
            tts_sample_rate=settings.dashscope_tts_sample_rate,
        )
    return FakeProvider()
