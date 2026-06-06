from app.core.config import Settings


def test_settings_default_provider_is_dashscope(monkeypatch) -> None:
    monkeypatch.delenv("PROVIDER_MODE", raising=False)
    settings = Settings(_env_file=None)

    assert settings.provider_mode == "dashscope"
