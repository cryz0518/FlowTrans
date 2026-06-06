from app.core.config import Settings


def test_settings_default_provider_is_dashscope(monkeypatch) -> None:
    monkeypatch.delenv("PROVIDER_MODE", raising=False)
    settings = Settings(_env_file=None)

    assert settings.provider_mode == "dashscope"


def test_settings_default_dashscope_asr_endpoint_is_mainland() -> None:
    settings = Settings(_env_file=None)

    assert settings.dashscope_asr_endpoint == "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"


def test_settings_default_realtime_text_model_is_turbo() -> None:
    settings = Settings(_env_file=None)

    assert settings.dashscope_realtime_text_model == "qwen-turbo"


def test_settings_default_cosyvoice_tts_config() -> None:
    settings = Settings(_env_file=None)

    assert settings.dashscope_tts_endpoint == "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"
    assert settings.dashscope_tts_model == "CosyVoice-v3.5-flash"
    assert settings.dashscope_tts_voice == "longxiaochun_v2"
    assert settings.dashscope_tts_format == "mp3"
    assert settings.dashscope_tts_sample_rate == 24000
