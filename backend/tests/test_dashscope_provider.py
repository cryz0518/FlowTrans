import pytest

from app.providers.dashscope_provider import DashScopeProvider, MissingDashScopeApiKey


def test_dashscope_provider_requires_api_key() -> None:
    with pytest.raises(MissingDashScopeApiKey):
        DashScopeProvider(api_key=None)


def test_dashscope_provider_exposes_configured_model_names() -> None:
    provider = DashScopeProvider(
        api_key="test-key",
        asr_model="qwen3-asr-flash-realtime",
        text_model="qwen-plus",
        tts_model="CosyVoice-v3.5-flash",
    )

    assert provider.model_names() == {
        "asr_model": "qwen3-asr-flash-realtime",
        "text_model": "qwen-plus",
        "tts_model": "CosyVoice-v3.5-flash",
    }
