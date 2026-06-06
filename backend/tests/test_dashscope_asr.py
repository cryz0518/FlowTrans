import base64

import pytest

from app.providers.dashscope_asr import (
    AsrTranscript,
    DashScopeAsrSession,
    DashScopeAsrSessionError,
)


class FakeAsrWebSocket:
    def __init__(self, messages: list[dict] | None = None) -> None:
        self.messages = messages or []
        self.sent: list[dict] = []
        self.closed = False

    async def send_json(self, payload: dict) -> None:
        self.sent.append(payload)

    async def receive_json(self) -> dict:
        if not self.messages:
            return {"type": "response.audio_transcript.delta", "delta": ""}
        return self.messages.pop(0)

    async def close(self) -> None:
        self.closed = True


class FakeConnector:
    def __init__(self, websocket: FakeAsrWebSocket) -> None:
        self.websocket = websocket
        self.calls: list[dict] = []

    async def __call__(self, url: str, headers: dict[str, str]) -> FakeAsrWebSocket:
        self.calls.append({"url": url, "headers": headers})
        return self.websocket


@pytest.mark.asyncio
async def test_asr_session_connects_with_model_and_api_key() -> None:
    websocket = FakeAsrWebSocket()
    connector = FakeConnector(websocket)
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=connector,
    )

    await session.connect()

    assert connector.calls[0]["url"].endswith("?model=qwen3-asr-flash-realtime")
    assert connector.calls[0]["headers"]["Authorization"] == "Bearer test-key"
    assert websocket.sent[0]["type"] == "session.update"


@pytest.mark.asyncio
async def test_asr_session_appends_audio_chunk_and_parses_partial() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "response.audio_transcript.delta", "delta": "Welcome"},
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    transcript = await session.send_audio(b"abc", mime_type="audio/webm")

    assert websocket.sent[-1] == {
        "type": "input_audio_buffer.append",
        "audio": base64.b64encode(b"abc").decode("ascii"),
    }
    assert transcript == AsrTranscript(text="Welcome", is_final=False)


@pytest.mark.asyncio
async def test_asr_session_parses_final_transcript() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "response.audio_transcript.done", "transcript": "Welcome to FlowTrans."},
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    transcript = await session.send_audio(b"abc", mime_type="audio/webm")

    assert transcript == AsrTranscript(text="Welcome to FlowTrans.", is_final=True)


@pytest.mark.asyncio
async def test_asr_session_returns_none_for_empty_transcript() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "response.audio_transcript.delta", "delta": ""},
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    transcript = await session.send_audio(b"abc", mime_type="audio/webm")

    assert transcript is None


@pytest.mark.asyncio
async def test_asr_session_close_is_idempotent() -> None:
    websocket = FakeAsrWebSocket()
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    await session.connect()
    await session.close()
    await session.close()

    assert websocket.closed is True


@pytest.mark.asyncio
async def test_asr_session_wraps_connection_failures() -> None:
    async def failing_connector(url: str, headers: dict[str, str]):
        raise RuntimeError("network down")

    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=failing_connector,
    )

    with pytest.raises(DashScopeAsrSessionError, match="ASR realtime connection failed"):
        await session.connect()
