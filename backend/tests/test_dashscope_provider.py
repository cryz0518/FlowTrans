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


class FakeAsrSession:
    def __init__(self, transcript: AsrTranscript | None) -> None:
        self.transcript = transcript
        self.sent: list[dict] = []
        self.closed = False

    async def send_audio(self, audio: bytes, mime_type: str) -> AsrTranscript | None:
        self.sent.append({"audio": audio, "mime_type": mime_type})
        return self.transcript

    async def append_audio(self, audio: bytes, mime_type: str) -> None:
        self.sent.append({"audio": audio, "mime_type": mime_type})

    async def receive_transcript(self) -> AsrTranscript | None:
        return self.transcript

    async def close(self) -> None:
        self.closed = True


def test_dashscope_provider_requires_api_key() -> None:
    with pytest.raises(MissingDashScopeApiKey):
        DashScopeProvider(api_key=None)


def test_dashscope_provider_exposes_configured_model_names() -> None:
    provider = DashScopeProvider(
        api_key="test-key",
        asr_model="qwen3-asr-flash-realtime",
        realtime_text_model="qwen-turbo",
        text_model="qwen-plus",
        tts_model="CosyVoice-v3.5-flash",
        tts_voice="longxiaochun_v2",
        tts_format="mp3",
        tts_sample_rate=24000,
    )

    assert provider.model_names() == {
        "asr_endpoint": "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        "asr_model": "qwen3-asr-flash-realtime",
        "realtime_text_model": "qwen-turbo",
        "text_model": "qwen-plus",
        "tts_model": "CosyVoice-v3.5-flash",
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
    assert "翻译成中文" in request["json"]["messages"][1]["content"]


@pytest.mark.asyncio
async def test_dashscope_provider_uses_asr_transcript_for_translation() -> None:
    http_client = FakeHttpClient(
        FakeResponse(
            200,
            {"output": {"text": "欢迎使用 FlowTrans。"}},
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
    assert result.translated_text == "欢迎使用 FlowTrans。"
    assert result.is_final is False


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
    http_client = FakeHttpClient(FakeResponse(200, {"output": {"text": "translated"}}))
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
    assert result.translated_text == "translated"
    assert result.is_final is False
    assert http_client.requests[0]["json"]["model"] == "qwen-turbo"


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
        asr_session=FakeAsrSession(AsrTranscript(text="Welcome", is_final=False)),
    )

    result = await provider.transcribe_and_translate(
        chunk_index=0,
        audio=b"abc",
        mime_type="audio/webm",
    )

    assert result is not None
    assert result.translated_text == "partial translation"
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
    assert http_client.requests[0]["json"]["model"] == "qwen-plus"


def test_dashscope_provider_synthesizes_speech_with_cosyvoice() -> None:
    http_client = FakeHttpClient(FakeResponse(200, {}, content=b"audio-bytes"))
    provider = DashScopeProvider(
        api_key="test-key",
        tts_model="cosyvoice-v3-flash",
        tts_voice="longanyang",
        tts_format="mp3",
        tts_sample_rate=24000,
        http_client=http_client,
    )

    result = provider.synthesize_speech("欢迎使用 FlowTrans。")

    assert result.audio == b"audio-bytes"
    assert result.mime_type == "audio/mpeg"
    assert result.format == "mp3"
    assert result.sample_rate == 24000
    request = http_client.requests[0]
    assert request["url"] == "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer"
    assert request["headers"]["Authorization"] == "Bearer test-key"
    assert request["json"] == {
        "model": "cosyvoice-v3-flash",
        "input": {
            "text": "欢迎使用 FlowTrans。",
            "voice": "longanyang",
            "format": "mp3",
            "sample_rate": 24000,
        },
    }


def test_dashscope_provider_includes_tts_response_error_detail() -> None:
    http_client = FakeHttpClient(FakeResponse(400, {"message": "voice not found"}))
    provider = DashScopeProvider(api_key="test-key", http_client=http_client)

    with pytest.raises(ProviderRuntimeError, match="voice not found"):
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
