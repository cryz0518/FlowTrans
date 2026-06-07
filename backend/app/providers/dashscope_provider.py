import asyncio
from dataclasses import dataclass
from typing import Any

import httpx

from app.providers.dashscope_asr import DashScopeAsrSession

PARTIAL_TRANSLATION_MIN_TEXT_GROWTH = 12
PARTIAL_TRANSLATION_MIN_CHARS = 6
PARTIAL_TRANSLATION_MIN_WORDS = 2


class MissingDashScopeApiKey(RuntimeError):
    pass


class ProviderRuntimeError(RuntimeError):
    pass


@dataclass(frozen=True)
class DashScopeProviderResult:
    source_text: str
    translated_text: str
    is_final: bool
    reason: str | None = None


@dataclass(frozen=True)
class DashScopeTtsResult:
    audio: bytes
    mime_type: str
    format: str
    sample_rate: int


class DashScopeTtsSynthesizer:
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
        try:
            import dashscope
            from dashscope.audio.tts_v2 import AudioFormat, SpeechSynthesizer
        except ImportError as exc:
            raise ProviderRuntimeError("dashscope package is required for CosyVoice TTS") from exc

        dashscope.api_key = api_key
        audio_format_value = self._audio_format_value(AudioFormat, audio_format, sample_rate)
        synthesizer = SpeechSynthesizer(
            model=model,
            voice=voice,
            format=audio_format_value,
        )
        audio = synthesizer.call(text)
        if not isinstance(audio, bytes):
            raise ProviderRuntimeError("DashScope TTS response is invalid")
        return audio

    def _audio_format_value(self, audio_format_class: Any, audio_format: str, sample_rate: int) -> Any:
        if audio_format == "mp3" and sample_rate == 24000:
            return audio_format_class.MP3_24000HZ_MONO_256KBPS
        if audio_format == "wav" and sample_rate == 24000:
            return audio_format_class.WAV_24000HZ_MONO_16BIT
        raise ProviderRuntimeError(f"Unsupported TTS audio format: {audio_format}/{sample_rate}")


class DashScopeProvider:
    _endpoint = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    _script = [
        ("Welcome to FlowTrans.", False),
        ("We are testing real-time captions.", True),
        ("The system can revise earlier mistakes.", True),
    ]

    def __init__(
        self,
        api_key: str | None,
        asr_endpoint: str = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime",
        asr_model: str = "qwen3-asr-flash-realtime",
        realtime_text_model: str = "qwen-turbo",
        text_model: str = "qwen-plus",
        tts_endpoint: str = "https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer",
        tts_model: str = "cosyvoice-v3-flash",
        tts_voice: str = "longanyang",
        tts_format: str = "mp3",
        tts_sample_rate: int = 24000,
        http_client: Any | None = None,
        asr_session: DashScopeAsrSession | None = None,
        tts_synthesizer: Any | None = None,
    ) -> None:
        if not api_key:
            raise MissingDashScopeApiKey("DASHSCOPE_API_KEY is required when provider_mode is dashscope")
        self._api_key = api_key
        self._asr_endpoint = asr_endpoint
        self._asr_model = asr_model
        self._realtime_text_model = realtime_text_model
        self._text_model = text_model
        self._next_text_model = text_model
        self._tts_endpoint = tts_endpoint
        self._tts_model = tts_model
        self._tts_voice = tts_voice
        self._tts_format = tts_format
        self._tts_sample_rate = tts_sample_rate
        self._http_client = http_client or httpx.Client()
        self._tts_synthesizer = tts_synthesizer or DashScopeTtsSynthesizer()
        self._last_partial_source = ""
        self._last_partial_translation = ""
        self._asr_session = asr_session or DashScopeAsrSession(
            api_key=api_key,
            model=asr_model,
            endpoint=asr_endpoint,
        )

    def model_names(self) -> dict[str, str]:
        return {
            "asr_endpoint": self._asr_endpoint,
            "asr_model": self._asr_model,
            "realtime_text_model": self._realtime_text_model,
            "text_model": self._text_model,
            "tts_model": self._tts_model,
            "tts_voice": self._tts_voice,
        }

    async def transcribe_and_translate(
        self,
        chunk_index: int,
        audio: bytes | None = None,
        mime_type: str | None = None,
    ) -> DashScopeProviderResult | None:
        if audio is None:
            source_text, is_final = self._source_text_for_chunk(chunk_index)
            is_asr_partial = False
        else:
            transcript = await self._asr_session.send_audio(audio, mime_type or "application/octet-stream")
            if transcript is None:
                return None
            source_text = transcript.text
            is_final = transcript.is_final
            is_asr_partial = not is_final

        translated_text = self._translate_speech_text(source_text, is_final=not is_asr_partial)
        return DashScopeProviderResult(
            source_text=source_text,
            translated_text=translated_text,
            is_final=is_final,
            reason="根据完整语句修正翻译" if is_final and audio is not None else None,
        )

    async def append_audio(self, audio: bytes, mime_type: str) -> None:
        await self._asr_session.append_audio(audio, mime_type)

    async def receive_transcript_translation(self) -> DashScopeProviderResult | None:
        transcript = await self._asr_session.receive_transcript()
        if transcript is None:
            return None

        translated_text = await self._translate_speech_text_async(transcript.text, is_final=transcript.is_final)
        return DashScopeProviderResult(
            source_text=transcript.text,
            translated_text=translated_text,
            is_final=transcript.is_final,
            reason="根据完整语句修正翻译" if transcript.is_final else None,
        )

    def revise_previous(self, chunk_index: int) -> str | None:
        if chunk_index != 1:
            return None
        return self._call_qwen(
            "请根据上下文修正第一句中文字幕，只输出修正后的译文：\n"
            "英文：Welcome to FlowTrans.\n"
            "上下文：We are testing real-time captions."
        )

    def synthesize_speech(self, text: str) -> DashScopeTtsResult:
        if not text.strip():
            raise ProviderRuntimeError("TTS text must not be empty")

        if self._tts_synthesizer is not None:
            try:
                audio = self._tts_synthesizer.synthesize(
                    api_key=self._api_key,
                    model=self._tts_model,
                    voice=self._tts_voice,
                    audio_format=self._tts_format,
                    sample_rate=self._tts_sample_rate,
                    text=text,
                )
            except ProviderRuntimeError:
                raise
            except Exception as exc:
                raise ProviderRuntimeError(f"DashScope TTS request failed: {exc}") from exc

            if not audio:
                raise ProviderRuntimeError("DashScope TTS response is empty")
            return DashScopeTtsResult(
                audio=audio,
                mime_type=self._mime_type_for_tts_format(self._tts_format),
                format=self._tts_format,
                sample_rate=self._tts_sample_rate,
            )

        try:
            response = self._http_client.post(
                self._tts_endpoint,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._tts_model,
                    "input": {
                        "text": text,
                        "voice": self._tts_voice,
                        "format": self._tts_format,
                        "sample_rate": self._tts_sample_rate,
                    },
                },
                timeout=30.0,
            )
        except Exception as exc:
            raise ProviderRuntimeError("DashScope TTS request failed") from exc

        if response.status_code < 200 or response.status_code >= 300:
            raise ProviderRuntimeError(f"DashScope TTS request failed: {self._response_error_detail(response)}")
        if not response.content:
            raise ProviderRuntimeError("DashScope TTS response is empty")

        return DashScopeTtsResult(
            audio=response.content,
            mime_type=self._mime_type_for_tts_format(self._tts_format),
            format=self._tts_format,
            sample_rate=self._tts_sample_rate,
        )

    def generate_meeting_minutes(self, subtitles: list[dict[str, str]]) -> str:
        usable_subtitles = [
            {
                "source_text": item.get("source_text", "").strip(),
                "translated_text": item.get("translated_text", "").strip(),
            }
            for item in subtitles
            if item.get("source_text", "").strip() or item.get("translated_text", "").strip()
        ]
        if not usable_subtitles:
            raise ProviderRuntimeError("Meeting minutes subtitles must not be empty")

        transcript_lines = []
        for index, item in enumerate(usable_subtitles, start=1):
            transcript_lines.append(
                f"{index}. 英文：{item['source_text']}\n   中文：{item['translated_text']}"
            )
        prompt = "\n".join(
            [
                "请基于以下实时同传字幕生成中文会议纪要。",
                "要求：",
                "1. 使用 Markdown。",
                "2. 必须包含：# 会议纪要、## 会议主题、## 要点摘要、## 行动项、## 原文依据。",
                "3. 要点摘要要合并重复信息，不要逐句机械复述。",
                "4. 行动项如果没有明确负责人或截止时间，请写“暂无明确行动项”。",
                "5. 原文依据保留关键中英文依据，便于用户核对。",
                "",
                "字幕：",
                *transcript_lines,
            ]
        )
        try:
            return self._call_qwen(prompt)
        except ProviderRuntimeError as exc:
            raise ProviderRuntimeError(f"DashScope meeting minutes request failed: {exc}") from exc

    async def close(self) -> None:
        await self._asr_session.close()

    def _source_text_for_chunk(self, chunk_index: int) -> tuple[str, bool]:
        position = min(chunk_index, len(self._script) - 1)
        return self._script[position]

    def _mime_type_for_tts_format(self, audio_format: str) -> str:
        if audio_format == "mp3":
            return "audio/mpeg"
        if audio_format == "wav":
            return "audio/wav"
        return "application/octet-stream"

    def _response_error_detail(self, response: Any) -> str:
        try:
            payload = response.json()
        except Exception:
            return getattr(response, "text", "")

        if isinstance(payload, dict):
            message = payload.get("message") or payload.get("error") or payload.get("code")
            if message:
                return str(message)
        return getattr(response, "text", str(payload))

    def _translate_speech_text(self, source_text: str, *, is_final: bool) -> str:
        if not is_final and not self._should_translate_partial(source_text):
            return self._last_partial_translation
        self._next_text_model = self._text_model if is_final else self._realtime_text_model
        if is_final:
            instruction = (
                "Please translate the following complete English speech subtitle into natural concise Chinese. "
                "Correct any earlier temporary translation if the full sentence changes the meaning. "
                "Only output the Chinese translation:"
            )
        else:
            instruction = (
                "Please translate the following partial English speech subtitle into concise Chinese in real time. "
                "It may be incomplete, so keep the translation natural but easy to revise later. "
                "Only output the Chinese translation:"
            )
        translation = self._call_qwen(f"{instruction}\n{source_text}")
        if is_final:
            self._last_partial_source = ""
            self._last_partial_translation = ""
        else:
            self._last_partial_source = source_text
            self._last_partial_translation = translation
        return translation

    async def _translate_speech_text_async(self, source_text: str, *, is_final: bool) -> str:
        return await asyncio.to_thread(self._translate_speech_text, source_text, is_final=is_final)

    def _should_translate_partial(self, source_text: str) -> bool:
        current = self._normalize_partial_source(source_text)
        if self._is_partial_too_short(current):
            return False
        if not self._last_partial_translation:
            return True
        previous = self._normalize_partial_source(self._last_partial_source)
        if current == previous:
            return False
        return len(current) - len(previous) >= PARTIAL_TRANSLATION_MIN_TEXT_GROWTH

    def _normalize_partial_source(self, source_text: str) -> str:
        return source_text.strip().rstrip(".,!?;:").strip().lower()

    def _is_partial_too_short(self, source_text: str) -> bool:
        if len(source_text) < PARTIAL_TRANSLATION_MIN_CHARS:
            return True
        return len(source_text.split()) < PARTIAL_TRANSLATION_MIN_WORDS

    def _call_qwen(self, prompt: str) -> str:
        model = self._next_text_model
        self._next_text_model = self._text_model
        try:
            response = self._http_client.post(
                self._endpoint,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "你是专业的同声传译字幕翻译助手。",
                        },
                        {
                            "role": "user",
                            "content": prompt,
                        },
                    ],
                },
                timeout=20.0,
            )
        except Exception as exc:
            raise ProviderRuntimeError("DashScope text model request failed") from exc

        if response.status_code < 200 or response.status_code >= 300:
            raise ProviderRuntimeError("DashScope text model request failed")

        try:
            payload = response.json()
            choices = payload["choices"]
            content = choices[0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            try:
                content = payload["output"]["text"]
            except (KeyError, TypeError) as fallback_exc:
                raise ProviderRuntimeError("DashScope text model response is invalid") from fallback_exc

        if not isinstance(content, str) or not content.strip():
            raise ProviderRuntimeError("DashScope text model response is invalid")
        return content.strip()
