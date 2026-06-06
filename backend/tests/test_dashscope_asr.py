import base64
import asyncio

import pytest

from app.providers.dashscope_asr import (
    AsrTranscript,
    DashScopeAsrSession,
    DashScopeAsrSessionError,
    default_connect,
)


class FakeAsrWebSocket:
    def __init__(
        self,
        messages: list[dict] | None = None,
        fail_audio_append_once: bool = False,
    ) -> None:
        self.messages = messages or []
        self.fail_audio_append_once = fail_audio_append_once
        self.sent: list[dict] = []
        self.closed = False

    async def send_json(self, payload: dict) -> None:
        if self.fail_audio_append_once and payload.get("type") == "input_audio_buffer.append":
            self.fail_audio_append_once = False
            raise RuntimeError("connection closed")
        self.sent.append(payload)

    async def receive_json(self) -> dict:
        if not self.messages:
            return {"type": "response.audio_transcript.delta", "delta": ""}
        return self.messages.pop(0)

    async def close(self) -> None:
        self.closed = True


class FakeConnector:
    def __init__(self, websocket: FakeAsrWebSocket | list[FakeAsrWebSocket]) -> None:
        self.websockets = websocket if isinstance(websocket, list) else [websocket]
        self.calls: list[dict] = []

    async def __call__(self, url: str, headers: dict[str, str]) -> FakeAsrWebSocket:
        self.calls.append({"url": url, "headers": headers})
        return self.websockets[min(len(self.calls) - 1, len(self.websockets) - 1)]


@pytest.mark.asyncio
async def test_default_connect_passes_headers_to_websockets(monkeypatch) -> None:
    calls = []
    websocket = FakeAsrWebSocket()

    async def fake_connect(url: str, **kwargs):
        calls.append({"url": url, "kwargs": kwargs})
        return websocket

    monkeypatch.setattr("app.providers.dashscope_asr.websockets.connect", fake_connect)

    await default_connect("wss://example.test/realtime", {"Authorization": "Bearer test-key"})

    assert calls == [
        {
            "url": "wss://example.test/realtime",
            "kwargs": {"additional_headers": {"Authorization": "Bearer test-key"}},
        }
    ]


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
    assert connector.calls[0]["headers"]["OpenAI-Beta"] == "realtime=v1"
    assert websocket.sent[0]["type"] == "session.update"
    assert websocket.sent[0]["session"]["modalities"] == ["text"]
    assert websocket.sent[0]["session"]["input_audio_format"] == "pcm"
    assert websocket.sent[0]["session"]["sample_rate"] == 16000
    assert websocket.sent[0]["session"]["input_audio_transcription"] == {}
    assert websocket.sent[0]["session"]["turn_detection"] == {
        "type": "server_vad",
        "threshold": 0.0,
        "silence_duration_ms": 400,
    }


@pytest.mark.asyncio
async def test_asr_session_appends_audio_chunk_and_parses_partial() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "input_audio_buffer.speech_started"},
            {"type": "input_audio_buffer.committed"},
            {
                "type": "conversation.item.input_audio_transcription.text",
                "text": "Welcome",
                "stash": " to",
            },
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    transcript = await session.send_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert websocket.sent[-1] == {
        "type": "input_audio_buffer.append",
        "audio": base64.b64encode(b"abc").decode("ascii"),
    }
    assert transcript == AsrTranscript(text="Welcome to", is_final=False)


@pytest.mark.asyncio
async def test_asr_session_appends_audio_without_waiting_for_transcript() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {
                "type": "conversation.item.input_audio_transcription.text",
                "text": "Welcome",
                "stash": "",
            },
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    transcript = await session.append_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert transcript is None
    assert websocket.messages == [
        {
            "type": "conversation.item.input_audio_transcription.text",
            "text": "Welcome",
            "stash": "",
        }
    ]
    assert websocket.sent[-1] == {
        "type": "input_audio_buffer.append",
        "audio": base64.b64encode(b"abc").decode("ascii"),
    }


@pytest.mark.asyncio
async def test_asr_session_reconnects_and_retries_when_append_send_fails() -> None:
    failed_websocket = FakeAsrWebSocket(fail_audio_append_once=True)
    recovered_websocket = FakeAsrWebSocket()
    connector = FakeConnector([failed_websocket, recovered_websocket])
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=connector,
    )

    await session.append_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert len(connector.calls) == 2
    assert failed_websocket.closed is True
    assert recovered_websocket.sent[0]["type"] == "session.update"
    assert recovered_websocket.sent[-1] == {
        "type": "input_audio_buffer.append",
        "audio": base64.b64encode(b"abc").decode("ascii"),
    }


@pytest.mark.asyncio
async def test_asr_session_reports_connection_lost_when_append_retry_fails() -> None:
    failed_websocket = FakeAsrWebSocket(fail_audio_append_once=True)
    retry_websocket = FakeAsrWebSocket(fail_audio_append_once=True)
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector([failed_websocket, retry_websocket]),
    )

    with pytest.raises(DashScopeAsrSessionError, match="ASR realtime connection lost while sending audio"):
        await session.append_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert failed_websocket.closed is True
    assert retry_websocket.closed is True


@pytest.mark.asyncio
async def test_asr_session_receives_transcript_separately() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "input_audio_buffer.speech_started"},
            {
                "type": "conversation.item.input_audio_transcription.text",
                "text": "Welcome",
                "stash": "",
            },
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )
    await session.connect()

    transcript = await session.receive_transcript()

    assert transcript == AsrTranscript(text="Welcome", is_final=False)


@pytest.mark.asyncio
async def test_asr_session_returns_none_when_no_transcript_event_arrives(monkeypatch) -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "input_audio_buffer.speech_started"},
            {"type": "conversation.item.created"},
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    async def immediate_wait_for(awaitable, timeout: float):
        assert timeout == 0.25
        return await awaitable

    monkeypatch.setattr(asyncio, "wait_for", immediate_wait_for)

    transcript = await session.send_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert transcript is None


@pytest.mark.asyncio
async def test_asr_session_limits_low_latency_receive_attempts(monkeypatch) -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "input_audio_buffer.speech_started"},
            {"type": "input_audio_buffer.committed"},
            {"type": "conversation.item.created"},
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )
    timeouts: list[float] = []

    async def immediate_wait_for(awaitable, timeout: float):
        timeouts.append(timeout)
        return await awaitable

    monkeypatch.setattr(asyncio, "wait_for", immediate_wait_for)

    transcript = await session.send_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert transcript is None
    assert timeouts == [0.25, 0.25, 0.25]


@pytest.mark.asyncio
async def test_asr_session_parses_final_transcript() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {
                "type": "conversation.item.input_audio_transcription.completed",
                "transcript": "Welcome to FlowTrans.",
            },
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    transcript = await session.send_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert transcript == AsrTranscript(text="Welcome to FlowTrans.", is_final=True)


@pytest.mark.asyncio
async def test_asr_session_returns_none_for_empty_transcript() -> None:
    websocket = FakeAsrWebSocket(
        messages=[
            {"type": "conversation.item.input_audio_transcription.text", "text": "", "stash": ""},
        ]
    )
    session = DashScopeAsrSession(
        api_key="test-key",
        model="qwen3-asr-flash-realtime",
        connect=FakeConnector(websocket),
    )

    transcript = await session.send_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

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
