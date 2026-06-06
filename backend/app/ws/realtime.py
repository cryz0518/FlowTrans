import inspect
import logging
import asyncio

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


def _subtitle_event_from_result(session_id: str, sequence: int, result) -> dict:
    event_type = "final" if result.is_final else "partial"
    return {
        "event_id": f"{session_id}-asr-{sequence}",
        "session_id": session_id,
        "event_type": event_type,
        "source_text": result.source_text,
        "translated_text": result.translated_text,
        "replaces_event_id": None,
        "reason": None,
    }


async def _stream_transcripts(websocket: WebSocket, provider, session_id: str) -> None:
    sequence = 0
    while True:
        result = await provider.receive_transcript_translation()
        if result is None:
            await asyncio.sleep(0.05)
            continue
        await websocket.send_json(
            {
                "type": "subtitle_events",
                "events": [_subtitle_event_from_result(session_id, sequence, result)],
            }
        )
        sequence += 1


@router.websocket("/ws/realtime")
async def realtime(websocket: WebSocket) -> None:
    await websocket.accept()
    store = SessionStore()
    ingest = AudioIngestService(store)
    provider = None
    stream_task = None
    stream_session_id = None
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
                if hasattr(provider, "append_audio") and hasattr(provider, "receive_transcript_translation"):
                    await provider.append_audio(accepted.payload, chunk.mime_type)
                    if stream_task is None:
                        stream_session_id = chunk.session_id
                        stream_task = asyncio.create_task(_stream_transcripts(websocket, provider, stream_session_id))
                    await websocket.send_json(
                        {
                            "type": "audio_chunk_accepted",
                            "session_id": chunk.session_id,
                            "chunk_index": chunk.chunk_index,
                        }
                    )
                    continue
                else:
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
        if stream_task is not None:
            stream_task.cancel()
            try:
                await stream_task
            except asyncio.CancelledError:
                pass
        if provider is not None and hasattr(provider, "close"):
            close_result = provider.close()
            if inspect.isawaitable(close_result):
                await close_result
