import base64
import binascii

from app.models.events import AcceptedAudioChunk, AudioChunkIn
from app.services.session_store import SessionStore


class AudioIngestService:
    def __init__(self, store: SessionStore) -> None:
        self._store = store

    def accept_chunk(self, chunk: AudioChunkIn) -> AcceptedAudioChunk:
        try:
            payload = base64.b64decode(chunk.payload_b64, validate=True)
        except binascii.Error as exc:
            raise ValueError("payload_b64 must be valid base64") from exc

        if not payload:
            raise ValueError("decoded payload must not be empty")

        self._store.append_audio(
            session_id=chunk.session_id,
            input_source=chunk.input_source,
            chunk_index=chunk.chunk_index,
            payload=payload,
        )
        return AcceptedAudioChunk(
            session_id=chunk.session_id,
            chunk_index=chunk.chunk_index,
            byte_length=len(payload),
        )
