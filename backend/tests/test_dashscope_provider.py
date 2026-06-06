import pytest

from app.providers.dashscope_provider import (
    DashScopeProvider,
    MissingDashScopeApiKey,
    ProviderRuntimeError,
)


class FakeResponse:
    def __init__(self, status_code: int, payload: dict) -> None:
        self.status_code = status_code
        self._payload = payload

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


def test_dashscope_provider_requires_api_key() -> None:
    with pytest.raises(MissingDashScopeApiKey):
        DashScopeProvider(api_key=None)


def test_dashscope_provider_exposes_configured_model_names() -> None:
    provider = DashScopeProvider(
        api_key="test-key",
        asr_model="qwen3-asr-flash-realtime",
        text_model="qwen-plus",
        tts_model="CosyVoice-v3.5-flash",
    )

    assert provider.model_names() == {
        "asr_model": "qwen3-asr-flash-realtime",
        "text_model": "qwen-plus",
        "tts_model": "CosyVoice-v3.5-flash",
    }


def test_dashscope_provider_translates_text_with_qwen() -> None:
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

    result = provider.transcribe_and_translate(0)

    assert result.source_text == "Welcome to FlowTrans."
    assert result.translated_text == "欢迎使用 FlowTrans。"
    assert result.is_final is False
    request = http_client.requests[0]
    assert request["headers"]["Authorization"] == "Bearer test-key"
    assert request["json"]["model"] == "qwen-plus"
    assert "翻译成中文" in request["json"]["messages"][1]["content"]


def test_dashscope_provider_wraps_http_failures() -> None:
    http_client = FakeHttpClient(FakeResponse(500, {"message": "server error"}))
    provider = DashScopeProvider(api_key="test-key", http_client=http_client)

    with pytest.raises(ProviderRuntimeError, match="DashScope text model request failed"):
        provider.transcribe_and_translate(0)
