import base64
import json
from dataclasses import dataclass
from typing import Awaitable, Callable, Protocol

import websockets


class JsonWebSocket(Protocol):
    async def send_json(self, payload: dict) -> None: ...
    async def receive_json(self) -> dict: ...
    async def close(self) -> None: ...


ConnectFn = Callable[[str, dict[str, str]], Awaitable[JsonWebSocket]]


class DashScopeAsrSessionError(RuntimeError):
    pass


@dataclass(frozen=True)
class AsrTranscript:
    text: str
    is_final: bool


class _WebsocketsJsonAdapter:
    def __init__(self, websocket) -> None:
        self._websocket = websocket

    async def send_json(self, payload: dict) -> None:
        await self._websocket.send(json.dumps(payload))

    async def receive_json(self) -> dict:
        message = await self._websocket.recv()
        return json.loads(message)

    async def close(self) -> None:
        await self._websocket.close()


async def default_connect(url: str, headers: dict[str, str]) -> JsonWebSocket:
    websocket = await websockets.connect(url, extra_headers=headers)
    return _WebsocketsJsonAdapter(websocket)


class DashScopeAsrSession:
    _base_url = "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime"

    def __init__(
        self,
        api_key: str,
        model: str,
        connect: ConnectFn = default_connect,
    ) -> None:
        self._api_key = api_key
        self._model = model
        self._connect = connect
        self._websocket: JsonWebSocket | None = None
        self._last_partial = ""

    async def connect(self) -> None:
        if self._websocket is not None:
            return
        try:
            self._websocket = await self._connect(
                f"{self._base_url}?model={self._model}",
                {"Authorization": f"Bearer {self._api_key}"},
            )
            await self._websocket.send_json(
                {
                    "type": "session.update",
                    "session": {
                        "input_audio_format": "webm",
                    },
                }
            )
        except Exception as exc:
            self._websocket = None
            raise DashScopeAsrSessionError("ASR realtime connection failed") from exc

    async def send_audio(self, audio: bytes, mime_type: str) -> AsrTranscript | None:
        await self.connect()
        assert self._websocket is not None
        try:
            await self._websocket.send_json(
                {
                    "type": "input_audio_buffer.append",
                    "audio": base64.b64encode(audio).decode("ascii"),
                }
            )
            return self._parse_event(await self._websocket.receive_json())
        except DashScopeAsrSessionError:
            raise
        except Exception as exc:
            self._websocket = None
            raise DashScopeAsrSessionError(
                "ASR realtime request failed; current browser audio format may not be supported"
            ) from exc

    async def close(self) -> None:
        websocket = self._websocket
        self._websocket = None
        if websocket is not None:
            try:
                await websocket.close()
            except Exception:
                return

    def _parse_event(self, event: dict) -> AsrTranscript | None:
        event_type = event.get("type")
        if event_type == "response.audio_transcript.delta":
            text = str(event.get("delta") or "").strip()
            if not text or text == self._last_partial:
                return None
            self._last_partial = text
            return AsrTranscript(text=text, is_final=False)
        if event_type == "response.audio_transcript.done":
            text = str(event.get("transcript") or "").strip()
            if not text:
                return None
            self._last_partial = ""
            return AsrTranscript(text=text, is_final=True)
        return None
