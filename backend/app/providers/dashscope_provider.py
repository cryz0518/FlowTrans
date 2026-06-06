from dataclasses import dataclass
from typing import Any

import httpx

from app.providers.dashscope_asr import DashScopeAsrSession


class MissingDashScopeApiKey(RuntimeError):
    pass


class ProviderRuntimeError(RuntimeError):
    pass


@dataclass(frozen=True)
class DashScopeProviderResult:
    source_text: str
    translated_text: str
    is_final: bool


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
        text_model: str = "qwen-plus",
        tts_model: str = "CosyVoice-v3.5-flash",
        http_client: Any | None = None,
        asr_session: DashScopeAsrSession | None = None,
    ) -> None:
        if not api_key:
            raise MissingDashScopeApiKey("DASHSCOPE_API_KEY is required when provider_mode is dashscope")
        self._api_key = api_key
        self._asr_endpoint = asr_endpoint
        self._asr_model = asr_model
        self._text_model = text_model
        self._tts_model = tts_model
        self._http_client = http_client or httpx.Client()
        self._asr_session = asr_session or DashScopeAsrSession(
            api_key=api_key,
            model=asr_model,
            endpoint=asr_endpoint,
        )

    def model_names(self) -> dict[str, str]:
        return {
            "asr_endpoint": self._asr_endpoint,
            "asr_model": self._asr_model,
            "text_model": self._text_model,
            "tts_model": self._tts_model,
        }

    async def transcribe_and_translate(
        self,
        chunk_index: int,
        audio: bytes | None = None,
        mime_type: str | None = None,
    ) -> DashScopeProviderResult | None:
        if audio is None:
            source_text, is_final = self._source_text_for_chunk(chunk_index)
        else:
            transcript = await self._asr_session.send_audio(audio, mime_type or "application/octet-stream")
            if transcript is None:
                return None
            source_text = transcript.text
            is_final = transcript.is_final

        translated_text = self._call_qwen(
            f"请将下面的英文演讲字幕翻译成中文，要求自然、简洁，只输出译文：\n{source_text}"
        )
        return DashScopeProviderResult(
            source_text=source_text,
            translated_text=translated_text,
            is_final=is_final,
        )

    async def append_audio(self, audio: bytes, mime_type: str) -> None:
        await self._asr_session.append_audio(audio, mime_type)

    async def receive_transcript_translation(self) -> DashScopeProviderResult | None:
        transcript = await self._asr_session.receive_transcript()
        if transcript is None:
            return None

        translated_text = self._call_qwen(
            f"Please translate the following English speech subtitle into natural concise Chinese. Only output the translation:\n{transcript.text}"
        )
        return DashScopeProviderResult(
            source_text=transcript.text,
            translated_text=translated_text,
            is_final=transcript.is_final,
        )

    def revise_previous(self, chunk_index: int) -> str | None:
        if chunk_index != 1:
            return None
        return self._call_qwen(
            "请根据上下文修正第一句中文字幕，只输出修正后的译文：\n"
            "英文：Welcome to FlowTrans.\n"
            "上下文：We are testing real-time captions."
        )

    async def close(self) -> None:
        await self._asr_session.close()

    def _source_text_for_chunk(self, chunk_index: int) -> tuple[str, bool]:
        position = min(chunk_index, len(self._script) - 1)
        return self._script[position]

    def _call_qwen(self, prompt: str) -> str:
        try:
            response = self._http_client.post(
                self._endpoint,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._text_model,
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
