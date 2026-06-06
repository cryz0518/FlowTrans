import pytest

from app.core.config import Settings
from app.providers.dashscope_provider import DashScopeProvider, MissingDashScopeApiKey
from app.providers.factory import create_provider
from app.providers.fake_provider import FakeProvider


def test_provider_factory_returns_fake_provider() -> None:
    settings = Settings(provider_mode="fake")

    provider = create_provider(settings)

    assert isinstance(provider, FakeProvider)


def test_provider_factory_requires_api_key_for_dashscope() -> None:
    settings = Settings(provider_mode="dashscope", dashscope_api_key=None)

    with pytest.raises(MissingDashScopeApiKey):
        create_provider(settings)


def test_provider_factory_returns_dashscope_provider() -> None:
    settings = Settings(
        provider_mode="dashscope",
        dashscope_api_key="test-key",
        dashscope_asr_endpoint="wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        dashscope_realtime_text_model="qwen-turbo",
        dashscope_tts_voice="longxiaochun_v2",
    )

    provider = create_provider(settings)

    assert isinstance(provider, DashScopeProvider)
    assert provider.model_names()["asr_endpoint"] == "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
    assert provider.model_names()["realtime_text_model"] == "qwen-turbo"
    assert provider.model_names()["tts_voice"] == "longxiaochun_v2"
