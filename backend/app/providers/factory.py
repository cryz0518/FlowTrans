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
            tts_model=settings.dashscope_tts_model,
        )
    return FakeProvider()
