import base64

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.main import create_app
from app.providers.dashscope_asr import DashScopeAsrSessionError
from app.ws.realtime import _stream_transcripts


def make_payload(chunk_index: int = 0) -> dict:
    return {
        "session_id": "session-a",
        "chunk_index": chunk_index,
        "captured_at_ms": chunk_index * 500,
        "input_source": "microphone",
        "mime_type": "audio/webm",
        "payload_b64": base64.b64encode(b"abc").decode("ascii"),
    }


def test_realtime_websocket_accepts_chunk_and_returns_subtitle_event(monkeypatch) -> None:
    class NonStreamingProvider:
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
                    "translated_text": "Welcome.",
                    "is_final": False,
                },
            )()

        def revise_previous(self, chunk_index: int) -> None:
            return None

    monkeypatch.setattr("app.ws.realtime.create_provider", lambda settings: NonStreamingProvider())
    client = TestClient(create_app())

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(make_payload())
        response = websocket.receive_json()

    assert response["type"] == "subtitle_events"
    assert response["events"][0]["event_type"] == "partial"


def test_realtime_acknowledges_audio_before_background_subtitle(monkeypatch) -> None:
    class StreamingProvider:
        def __init__(self) -> None:
            self.appended: list[dict] = []
            self.receive_calls = 0

        async def append_audio(self, audio: bytes, mime_type: str) -> None:
            self.appended.append({"audio": audio, "mime_type": mime_type})

        async def receive_transcript_translation(self):
            self.receive_calls += 1
            if self.receive_calls == 1:
                return type(
                    "ProviderResult",
                    (),
                    {
                        "source_text": "Welcome",
                        "translated_text": "欢迎",
                        "is_final": False,
                        "reason": None,
                    },
                )()
            return None

        def revise_previous(self, chunk_index: int) -> None:
            return None

        async def close(self) -> None:
            return None

    provider = StreamingProvider()
    monkeypatch.setattr("app.ws.realtime.create_provider", lambda settings: provider)
    client = TestClient(create_app())

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(make_payload())
        ack = websocket.receive_json()
        subtitles = websocket.receive_json()

    assert ack == {"type": "audio_chunk_accepted", "session_id": "session-a", "chunk_index": 0}
    assert provider.appended == [{"audio": b"abc", "mime_type": "audio/webm"}]
    assert subtitles["type"] == "subtitle_events"
    assert subtitles["events"][0]["translated_text"] == "欢迎"


def test_realtime_stream_includes_final_correction_reason(monkeypatch) -> None:
    class StreamingProvider:
        def __init__(self) -> None:
            self.appended: list[dict] = []
            self.receive_calls = 0

        async def append_audio(self, audio: bytes, mime_type: str) -> None:
            self.appended.append({"audio": audio, "mime_type": mime_type})

        async def receive_transcript_translation(self):
            self.receive_calls += 1
            if self.receive_calls == 1:
                return type(
                    "ProviderResult",
                    (),
                    {
                        "source_text": "Welcome to FlowTrans.",
                        "translated_text": "欢迎使用 FlowTrans。",
                        "is_final": True,
                        "reason": "根据完整语句修正翻译",
                    },
                )()
            return None

        async def close(self) -> None:
            return None

    monkeypatch.setattr("app.ws.realtime.create_provider", lambda settings: StreamingProvider())
    client = TestClient(create_app())

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(make_payload())
        websocket.receive_json()
        subtitles = websocket.receive_json()

    assert subtitles["events"][0]["event_type"] == "final"
    assert subtitles["events"][0]["reason"] == "根据完整语句修正翻译"


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


@pytest.mark.asyncio
async def test_stream_transcripts_exits_when_client_disconnects() -> None:
    class DisconnectingWebSocket:
        async def send_json(self, payload: dict) -> None:
            raise WebSocketDisconnect(code=1006)

    class StreamingProvider:
        async def receive_transcript_translation(self):
            return type(
                "ProviderResult",
                (),
                {
                    "source_text": "Welcome",
                    "translated_text": "Welcome.",
                    "is_final": True,
                },
            )()

    await _stream_transcripts(DisconnectingWebSocket(), StreamingProvider(), "session-a")
