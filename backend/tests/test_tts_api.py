from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.providers.dashscope_provider import DashScopeTtsResult, ProviderRuntimeError


def test_tts_synthesize_returns_audio(monkeypatch) -> None:
    class TtsProvider:
        def synthesize_speech(self, text: str) -> DashScopeTtsResult:
            assert text == "欢迎使用 FlowTrans。"
            return DashScopeTtsResult(
                audio=b"audio-bytes",
                mime_type="audio/mpeg",
                format="mp3",
                sample_rate=24000,
            )

    monkeypatch.setenv("PROVIDER_MODE", "fake")
    monkeypatch.setattr("app.api.tts.create_provider", lambda settings: TtsProvider())
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post("/api/tts/synthesize", json={"text": "欢迎使用 FlowTrans。"})

    assert response.status_code == 200
    assert response.content == b"audio-bytes"
    assert response.headers["content-type"] == "audio/mpeg"
    assert response.headers["x-audio-format"] == "mp3"
    assert response.headers["x-sample-rate"] == "24000"
    get_settings.cache_clear()


def test_tts_synthesize_rejects_empty_text(monkeypatch) -> None:
    monkeypatch.setenv("PROVIDER_MODE", "fake")
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post("/api/tts/synthesize", json={"text": " "})

    assert response.status_code == 422
    get_settings.cache_clear()


def test_tts_synthesize_returns_bad_gateway_for_provider_error(monkeypatch) -> None:
    class FailingTtsProvider:
        def synthesize_speech(self, text: str) -> DashScopeTtsResult:
            raise ProviderRuntimeError("DashScope TTS request failed")

    monkeypatch.setenv("PROVIDER_MODE", "fake")
    monkeypatch.setattr("app.api.tts.create_provider", lambda settings: FailingTtsProvider())
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post("/api/tts/synthesize", json={"text": "欢迎使用 FlowTrans。"})

    assert response.status_code == 502
    assert response.json() == {"detail": "DashScope TTS request failed"}
    get_settings.cache_clear()
