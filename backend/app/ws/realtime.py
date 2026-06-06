from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from app.models.events import AudioChunkIn
from app.providers.fake_provider import FakeProvider
from app.services.audio_ingest import AudioIngestService
from app.services.session_store import SessionStore
from app.services.subtitle_pipeline import SubtitlePipeline

router = APIRouter()


@router.websocket("/ws/realtime")
async def realtime(websocket: WebSocket) -> None:
    await websocket.accept()
    store = SessionStore()
    ingest = AudioIngestService(store)
    pipeline = SubtitlePipeline(FakeProvider())

    try:
        while True:
            raw = await websocket.receive_json()
            try:
                chunk = AudioChunkIn.model_validate(raw)
                ingest.accept_chunk(chunk)
                events = pipeline.process_chunk(chunk)
            except (ValidationError, ValueError) as exc:
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
