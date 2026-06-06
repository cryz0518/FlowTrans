import base64

from fastapi.testclient import TestClient

from app.main import create_app
from app.providers.dashscope_asr import DashScopeAsrSessionError


def make_payload(chunk_index: int = 0) -> dict:
    return {
        "session_id": "session-a",
        "chunk_index": chunk_index,
        "captured_at_ms": chunk_index * 500,
        "input_source": "microphone",
        "mime_type": "audio/webm",
        "payload_b64": base64.b64encode(b"abc").decode("ascii"),
    }


def test_realtime_websocket_accepts_chunk_and_returns_subtitle_event() -> None:
    client = TestClient(create_app())

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(make_payload())
        response = websocket.receive_json()

    assert response["type"] == "subtitle_events"
    assert response["events"][0]["event_type"] == "partial"


def test_realtime_returns_asr_error_and_keeps_connection(monkeypatch) -> None:
    class FailingAsrProvider:
        def __init__(self) -> None:
            self.calls = 0

        def transcribe_and_translate(
            self,
            chunk_index: int,
            audio: bytes | None = None,
            mime_type: str | None = None,
        ):
            self.calls += 1
            if self.calls == 1:
                raise DashScopeAsrSessionError("ASR realtime request failed")
            return type(
                "ProviderResult",
                (),
                {
                    "source_text": "Welcome",
                    "translated_text": "欢迎",
                    "is_final": False,
                },
            )()

        def revise_previous(self, chunk_index: int) -> None:
            return None

    provider = FailingAsrProvider()
    monkeypatch.setattr("app.ws.realtime.create_provider", lambda settings: provider)
    client = TestClient(create_app())

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(make_payload(0))
        first = websocket.receive_json()
        websocket.send_json(make_payload(1))
        second = websocket.receive_json()

    assert first == {"type": "error", "message": "ASR realtime request failed"}
    assert second["type"] == "subtitle_events"


def test_realtime_closes_provider_on_disconnect(monkeypatch) -> None:
    class ClosingProvider:
        def __init__(self) -> None:
            self.closed = False

        def transcribe_and_translate(
            self,
            chunk_index: int,
            audio: bytes | None = None,
            mime_type: str | None = None,
        ):
            return type(
                "ProviderResult",
                (),
                {
                    "source_text": "Welcome",
                    "translated_text": "欢迎",
                    "is_final": False,
                },
            )()

        def revise_previous(self, chunk_index: int) -> None:
            return None

        async def close(self) -> None:
            self.closed = True

    provider = ClosingProvider()
    monkeypatch.setattr("app.ws.realtime.create_provider", lambda settings: provider)
    client = TestClient(create_app())

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(make_payload())
        websocket.receive_json()

    assert provider.closed is True
