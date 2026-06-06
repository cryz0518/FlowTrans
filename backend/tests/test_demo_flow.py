import base64

from fastapi.testclient import TestClient

from app.main import create_app


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
