import asyncio
import time

import pytest

from app.providers.dashscope_asr import AsrTranscript
from app.providers.dashscope_provider import (
    DashScopeProvider,
    MissingDashScopeApiKey,
    ProviderRuntimeError,
)


class FakeResponse:
    def __init__(self, status_code: int, payload: dict, content: bytes = b"") -> None:
        self.status_code = status_code
        self._payload = payload
        self.content = content
        self.text = str(payload)

    def json(self) -> dict:
        return self._payload


class FakeHttpClient:
    def __init__(self, response: FakeResponse | Exception) -> None:
        self.response = response
        self.requests: list[dict] = []

    def post(self, url: str, headers: dict, json: dict, timeout: float) -> FakeResponse:
        self.requests.append(
            {
                "url": url,
                "headers": headers,
                "json": json,
                "timeout": timeout,
            }
        )
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


class SlowFakeHttpClient(FakeHttpClient):
    def __init__(self, response: FakeResponse, delay_seconds: float) -> None:
        super().__init__(response)
        self.delay_seconds = delay_seconds

    def post(self, url: str, headers: dict, json: dict, timeout: float) -> FakeResponse:
        time.sleep(self.delay_seconds)
        return super().post(url, headers, json, timeout)


class FakeAsrSession:
    def __init__(self, transcript: AsrTranscript | None | list[AsrTranscript | None]) -> None:
        self.transcripts = transcript if isinstance(transcript, list) else [transcript]
        self.sent: list[dict] = []
        self.closed = False

    async def send_audio(self, audio: bytes, mime_type: str) -> AsrTranscript | None:
        self.sent.append({"audio": audio, "mime_type": mime_type})
        return self._next_transcript()

    async def append_audio(self, audio: bytes, mime_type: str) -> None:
        self.sent.append({"audio": audio, "mime_type": mime_type})

    async def receive_transcript(self) -> AsrTranscript | None:
        return self._next_transcript()

    async def close(self) -> None:
        self.closed = True

    def _next_transcript(self) -> AsrTranscript | None:
        if len(self.transcripts) > 1:
            return self.transcripts.pop(0)
        return self.transcripts[0]


class FakeTtsSynthesizer:
    def __init__(self, audio: bytes | Exception) -> None:
        self.audio = audio
        self.calls: list[dict] = []

    def synthesize(
        self,
        *,
        api_key: str,
        model: str,
        voice: str,
        audio_format: str,
        sample_rate: int,
        text: str,
    ) -> bytes:
        self.calls.append(
            {
                "api_key": api_key,
                "model": model,
                "voice": voice,
                "audio_format": audio_format,
                "sample_rate": sample_rate,
                "text": text,
            }
        )
        if isinstance(self.audio, Exception):
            raise self.audio
        return self.audio


def test_dashscope_provider_requires_api_key() -> None:
    with pytest.raises(MissingDashScopeApiKey):
        DashScopeProvider(api_key=None)


def test_dashscope_provider_exposes_configured_model_names() -> None:
    provider = DashScopeProvider(
        api_key="test-key",
        asr_model="qwen3-asr-flash-realtime",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        tts_model="cosyvoice-v3-flash",
        tts_voice="longxiaochun_v2",
        tts_format="mp3",
        tts_sample_rate=24000,
    )

    assert provider.model_names() == {
        "asr_endpoint": "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        "asr_model": "qwen3-asr-flash-realtime",
        "realtime_text_model": "qwen-turbo",
        "text_model": "qwen-plus",
        "tts_model": "cosyvoice-v3-flash",
        "tts_voice": "longxiaochun_v2",
    }


@pytest.mark.asyncio
async def test_dashscope_provider_translates_text_with_qwen_without_audio() -> None:
    http_client = FakeHttpClient(
        FakeResponse(
            200,
            {
                "output": {
                    "text": "欢迎使用 FlowTrans。",
                }
            },
        )
    )
    provider = DashScopeProvider(api_key="test-key", http_client=http_client)

    result = await provider.transcribe_and_translate(0)

    assert result is not None
    assert result.source_text == "Welcome to FlowTrans."
    assert result.translated_text == "欢迎使用 FlowTrans。"
    assert result.is_final is False
    request = http_client.requests[0]
    assert request["headers"]["Authorization"] == "Bearer test-key"
    assert request["json"]["model"] == "qwen-plus"
    assert "Only output the Chinese translation" in request["json"]["messages"][1]["content"]


@pytest.mark.asyncio
async def test_dashscope_provider_uses_asr_transcript_for_translation() -> None:
    http_client = FakeHttpClient(
        FakeResponse(
            200,
            {"output": {"text": "partial translation"}},
        )
    )
    asr_session = FakeAsrSession(AsrTranscript(text="Welcome to FlowTrans.", is_final=False))
    provider = DashScopeProvider(
        api_key="test-key",
        http_client=http_client,
        asr_session=asr_session,
    )

    result = await provider.transcribe_and_translate(
        chunk_index=0,
        audio=b"abc",
        mime_type="audio/webm",
    )

    assert asr_session.sent == [{"audio": b"abc", "mime_type": "audio/webm"}]
    assert result is not None
    assert result.source_text == "Welcome to FlowTrans."
    assert result.translated_text == "partial translation"
    assert result.is_final is False
    assert result.reason is None
    assert http_client.requests[0]["json"]["model"] == "qwen-turbo"


@pytest.mark.asyncio
async def test_dashscope_provider_appends_audio_without_translation() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "unused"}}))
    asr_session = FakeAsrSession(AsrTranscript(text="Welcome to FlowTrans.", is_final=False))
    provider = DashScopeProvider(
        api_key="test-key",
        http_client=http_client,
        asr_session=asr_session,
    )

    await provider.append_audio(b"abc", mime_type="audio/pcm;rate=16000;channels=1")

    assert asr_session.sent == [{"audio": b"abc", "mime_type": "audio/pcm;rate=16000;channels=1"}]
    assert http_client.requests == []


@pytest.mark.asyncio
async def test_dashscope_provider_receives_transcript_translation() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "partial translation"}}))
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(AsrTranscript(text="Welcome to FlowTrans.", is_final=False)),
    )

    result = await provider.receive_transcript_translation()

    assert result is not None
    assert result.source_text == "Welcome to FlowTrans."
    assert result.translated_text == "partial translation"
    assert result.is_final is False
    assert result.reason is None
    assert http_client.requests[0]["json"]["model"] == "qwen-turbo"


@pytest.mark.asyncio
async def test_dashscope_provider_does_not_block_event_loop_while_translating_partial() -> None:
    http_client = SlowFakeHttpClient(FakeResponse(200, {"output": {"text": "partial translation"}}), 0.05)
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(AsrTranscript(text="Welcome to FlowTrans.", is_final=False)),
    )
    translation_task = asyncio.create_task(provider.receive_transcript_translation())
    await asyncio.sleep(0.01)

    assert translation_task.done() is False
    result = await translation_task
    assert result is not None


@pytest.mark.asyncio
async def test_dashscope_provider_reuses_recent_partial_translation_for_small_text_changes() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "两个男人"}}))
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(
            [
                AsrTranscript(text="Two men", is_final=False),
                AsrTranscript(text="Two men.", is_final=False),
            ]
        ),
    )

    first = await provider.receive_transcript_translation()
    second = await provider.receive_transcript_translation()

    assert first is not None
    assert first.translated_text == "两个男人"
    assert second is not None
    assert second.source_text == "Two men."
    assert second.translated_text == "两个男人"
    assert len(http_client.requests) == 1


@pytest.mark.asyncio
async def test_dashscope_provider_skips_too_short_partial_translation_until_text_is_useful() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "两个男人"}}))
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(
            [
                AsrTranscript(text="Two", is_final=False),
                AsrTranscript(text="Two men", is_final=False),
            ]
        ),
    )

    first = await provider.receive_transcript_translation()
    second = await provider.receive_transcript_translation()

    assert first is not None
    assert first.translated_text == ""
    assert second is not None
    assert second.translated_text == "两个男人"
    assert len(http_client.requests) == 1


@pytest.mark.asyncio
async def test_dashscope_provider_translates_partial_when_text_grows_enough() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "partial translation"}}))
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(
            [
                AsrTranscript(text="Two men", is_final=False),
                AsrTranscript(text="Two men who have been best friends", is_final=False),
            ]
        ),
    )

    await provider.receive_transcript_translation()
    result = await provider.receive_transcript_translation()

    assert result is not None
    assert result.translated_text == "partial translation"
    assert len(http_client.requests) == 2


@pytest.mark.asyncio
async def test_dashscope_provider_receives_final_transcript_translation_with_stable_model() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "translated"}}))
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(AsrTranscript(text="Welcome to FlowTrans.", is_final=True)),
    )

    result = await provider.receive_transcript_translation()

    assert result is not None
    assert result.is_final is True
    assert result.reason == "根据完整语句修正翻译"
    assert http_client.requests[0]["json"]["model"] == "qwen-plus"


@pytest.mark.asyncio
async def test_dashscope_provider_returns_none_for_empty_asr_transcript() -> None:
    provider = DashScopeProvider(
        api_key="test-key",
        http_client=FakeHttpClient(FakeResponse(200, {"output": {"text": "unused"}})),
        asr_session=FakeAsrSession(None),
    )

    result = await provider.transcribe_and_translate(
        chunk_index=0,
        audio=b"abc",
        mime_type="audio/webm",
    )

    assert result is None


@pytest.mark.asyncio
async def test_dashscope_provider_uses_realtime_model_for_partial_transcript() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "partial translation"}}))
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(AsrTranscript(text="Welcome everyone", is_final=False)),
    )

    result = await provider.transcribe_and_translate(
        chunk_index=0,
        audio=b"abc",
        mime_type="audio/webm",
    )

    assert result is not None
    assert result.translated_text == "partial translation"
    assert result.reason is None
    assert http_client.requests[0]["json"]["model"] == "qwen-turbo"


@pytest.mark.asyncio
async def test_dashscope_provider_uses_stable_model_for_final_transcript() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "final translation"}}))
    provider = DashScopeProvider(
        api_key="test-key",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        http_client=http_client,
        asr_session=FakeAsrSession(AsrTranscript(text="Welcome to FlowTrans.", is_final=True)),
    )

    result = await provider.transcribe_and_translate(
        chunk_index=0,
        audio=b"abc",
        mime_type="audio/webm",
    )

    assert result is not None
    assert result.translated_text == "final translation"
    assert result.reason == "根据完整语句修正翻译"
    assert http_client.requests[0]["json"]["model"] == "qwen-plus"


def test_dashscope_provider_synthesizes_speech_with_cosyvoice() -> None:
    tts_synthesizer = FakeTtsSynthesizer(b"audio-bytes")
    provider = DashScopeProvider(
        api_key="test-key",
        tts_model="cosyvoice-v3-flash",
        tts_voice="longanyang",
        tts_format="mp3",
        tts_sample_rate=24000,
        http_client=FakeHttpClient(FakeResponse(200, {"output": {"text": "unused"}})),
        tts_synthesizer=tts_synthesizer,
    )

    result = provider.synthesize_speech("欢迎使用 FlowTrans。")

    assert result.audio == b"audio-bytes"
    assert result.mime_type == "audio/mpeg"
    assert result.format == "mp3"
    assert result.sample_rate == 24000
    assert tts_synthesizer.calls == [
        {
            "api_key": "test-key",
            "model": "cosyvoice-v3-flash",
            "voice": "longanyang",
            "audio_format": "mp3",
            "sample_rate": 24000,
            "text": "欢迎使用 FlowTrans。",
        }
    ]


def test_dashscope_provider_includes_tts_response_error_detail() -> None:
    tts_synthesizer = FakeTtsSynthesizer(ProviderRuntimeError("voice not found"))
    provider = DashScopeProvider(
        api_key="test-key",
        http_client=FakeHttpClient(FakeResponse(200, {"output": {"text": "unused"}})),
        tts_synthesizer=tts_synthesizer,
    )

    with pytest.raises(ProviderRuntimeError, match="voice not found"):
        provider.synthesize_speech("欢迎使用 FlowTrans。")


def test_dashscope_provider_includes_sdk_tts_error_detail() -> None:
    tts_synthesizer = FakeTtsSynthesizer(RuntimeError("format is invalid"))
    provider = DashScopeProvider(
        api_key="test-key",
        http_client=FakeHttpClient(FakeResponse(200, {"output": {"text": "unused"}})),
        tts_synthesizer=tts_synthesizer,
    )

    with pytest.raises(ProviderRuntimeError, match="format is invalid"):
        provider.synthesize_speech("欢迎使用 FlowTrans。")


def test_dashscope_provider_rejects_empty_tts_text() -> None:
    provider = DashScopeProvider(
        api_key="test-key",
        http_client=FakeHttpClient(FakeResponse(200, {}, content=b"unused")),
    )

    with pytest.raises(ProviderRuntimeError, match="TTS text must not be empty"):
        provider.synthesize_speech(" ")


@pytest.mark.asyncio
async def test_dashscope_provider_closes_asr_session() -> None:
    asr_session = FakeAsrSession(None)
    provider = DashScopeProvider(
        api_key="test-key",
        http_client=FakeHttpClient(FakeResponse(200, {"output": {"text": "unused"}})),
        asr_session=asr_session,
    )

    await provider.close()

    assert asr_session.closed is True


def test_dashscope_provider_wraps_http_failures() -> None:
    http_client = FakeHttpClient(FakeResponse(500, {"message": "server error"}))
    provider = DashScopeProvider(api_key="test-key", http_client=http_client)

    with pytest.raises(ProviderRuntimeError, match="DashScope text model request failed"):
        provider._call_qwen("Translate this text.")
