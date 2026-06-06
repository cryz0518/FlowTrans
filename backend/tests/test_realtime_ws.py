import base64

from fastapi.testclient import TestClient

from app.main import create_app


def test_realtime_websocket_accepts_chunk_and_returns_subtitle_event() -> None:
    client = TestClient(create_app())
    payload = {
        "session_id": "session-a",
        "chunk_index": 0,
        "captured_at_ms": 0,
        "input_source": "microphone",
        "mime_type": "audio/webm",
        "payload_b64": base64.b64encode(b"abc").decode("ascii"),
    }

    with client.websocket_connect("/ws/realtime") as websocket:
        websocket.send_json(payload)
        response = websocket.receive_json()

    assert response["type"] == "subtitle_events"
    assert response["events"][0]["event_type"] == "partial"
    assert response["events"][0]["translated_text"] == "欢迎使用 FlowTrans。"
