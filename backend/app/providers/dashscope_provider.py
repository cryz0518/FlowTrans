class MissingDashScopeApiKey(RuntimeError):
    pass


class DashScopeProvider:
    def __init__(
        self,
        api_key: str | None,
        asr_model: str = "qwen3-asr-flash-realtime",
        text_model: str = "qwen-plus",
        tts_model: str = "CosyVoice-v3.5-flash",
    ) -> None:
        if not api_key:
            raise MissingDashScopeApiKey("DASHSCOPE_API_KEY is required when provider_mode is dashscope")
        self._api_key = api_key
        self._asr_model = asr_model
        self._text_model = text_model
        self._tts_model = tts_model

    def model_names(self) -> dict[str, str]:
        return {
            "asr_model": self._asr_model,
            "text_model": self._text_model,
            "tts_model": self._tts_model,
        }
