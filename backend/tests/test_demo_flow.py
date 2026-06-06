import base64

from fastapi.testclient import TestClient

from app.main import create_app
from app.providers.dashscope_provider import ProviderRuntimeError


def test_demo_flow_emits_partial_final_and_revision() -> None:
    client = TestClient(create_app())
    chunks = [
        {
            "session_id": "demo",
            "chunk_index": 0,
            "captured_at_ms": 0,
            "input_source": "microphone",
            "mime_type": "audio/webm",
            "payload_b64": base64.b64encode(b"first").decode("ascii"),
        },
        {
            "session_id": "demo",
            "chunk_index": 1,
            "captured_at_ms": 500,
            "input_source": "microphone",
            "mime_type": "audio/webm",
            "payload_b64": base64.b64encode(b"second").decode("ascii"),
        },
    ]

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(chunks[0])
        first = websocket.receive_json()
        websocket.send_json(chunks[1])
        second = websocket.receive_json()

    assert first["events"][0]["event_type"] == "partial"
    assert [event["event_type"] for event in second["events"]] == ["final", "revision"]


def test_realtime_returns_provider_error_and_keeps_connection(monkeypatch) -> None:
    class FailingOnceProvider:
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
                raise ProviderRuntimeError("DashScope text model request failed")
            return type(
                "ProviderResult",
                (),
                {
                    "source_text": "Welcome to FlowTrans.",
                    "translated_text": "欢迎使用 FlowTrans。",
                    "is_final": False,
                },
            )()

        def revise_previous(self, chunk_index: int) -> None:
            return None

    provider = FailingOnceProvider()
    monkeypatch.setattr("app.ws.realtime.create_provider", lambda settings: provider)
    client = TestClient(create_app())
    chunk = {
        "session_id": "demo",
        "chunk_index": 0,
        "captured_at_ms": 0,
        "input_source": "microphone",
        "mime_type": "audio/webm",
        "payload_b64": base64.b64encode(b"first").decode("ascii"),
    }

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(chunk)
        first = websocket.receive_json()
        websocket.send_json({**chunk, "chunk_index": 1})
        second = websocket.receive_json()

    assert first == {"type": "error", "message": "DashScope text model request failed"}
    assert second["type"] == "subtitle_events"
