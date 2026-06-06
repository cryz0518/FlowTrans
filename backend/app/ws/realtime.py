import inspect
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.core.config import get_settings
from app.models.events import AudioChunkIn
from app.providers.dashscope_asr import DashScopeAsrSessionError
from app.providers.dashscope_provider import MissingDashScopeApiKey, ProviderRuntimeError
from app.providers.factory import create_provider
from app.services.audio_ingest import AudioIngestService
from app.services.session_store import SessionStore
from app.services.subtitle_pipeline import SubtitlePipeline

router = APIRouter()
logger = logging.getLogger(__name__)


@router.websocket("/ws/realtime")
async def realtime(websocket: WebSocket) -> None:
    await websocket.accept()
    store = SessionStore()
    ingest = AudioIngestService(store)
    provider = None
    try:
        provider = create_provider(get_settings())
        pipeline = SubtitlePipeline(provider)
    except MissingDashScopeApiKey as exc:
        await websocket.send_json({"type": "error", "message": str(exc)})
        return

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                chunk = AudioChunkIn.model_validate(raw)
                accepted = ingest.accept_chunk(chunk)
                logger.info(
                    "Realtime audio chunk accepted: session_id=%s chunk_index=%s mime_type=%s bytes=%s",
                    chunk.session_id,
                    chunk.chunk_index,
                    chunk.mime_type,
                    accepted.byte_length,
                )
                events = await pipeline.process_chunk(chunk, audio=accepted.payload)
                logger.info(
                    "Realtime subtitle events produced: session_id=%s chunk_index=%s count=%s",
                    chunk.session_id,
                    chunk.chunk_index,
                    len(events),
                )
            except (ValidationError, ValueError, ProviderRuntimeError, DashScopeAsrSessionError) as exc:
                logger.exception("Realtime chunk processing failed")
                await websocket.send_json({"type": "error", "message": str(exc)})
                continue

            await websocket.send_json(
                {
                    "type": "subtitle_events",
                    "events": [event.model_dump() for event in events],
                }
            )
    except WebSocketDisconnect:
        return
    finally:
        if provider is not None and hasattr(provider, "close"):
            close_result = provider.close()
            if inspect.isawaitable(close_result):
                await close_result
