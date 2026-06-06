import base64

import pytest
from pydantic import ValidationError

from app.models.events import AudioChunkIn
from app.services.audio_ingest import AudioIngestService
from app.services.session_store import SessionStore


def test_audio_chunk_requires_monotonic_chunk_index() -> None:
    store = SessionStore()
    service = AudioIngestService(store)
    first = AudioChunkIn(
        session_id="session-a",
        chunk_index=0,
        captured_at_ms=100,
        input_source="microphone",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(b"abc").decode("ascii"),
    )
    second = first.model_copy(update={"chunk_index": 0, "captured_at_ms": 200})

    accepted = service.accept_chunk(first)

    assert accepted.chunk_index == 0
    with pytest.raises(ValueError, match="chunk_index must increase"):
        service.accept_chunk(second)


def test_audio_chunk_rejects_empty_payload() -> None:
    with pytest.raises(ValidationError):
        AudioChunkIn(
            session_id="session-a",
            chunk_index=0,
            captured_at_ms=100,
            input_source="microphone",
            mime_type="audio/webm",
            payload_b64="",
        )


def test_session_store_tracks_chunk_count() -> None:
    store = SessionStore()
    service = AudioIngestService(store)
    chunk = AudioChunkIn(
        session_id="session-a",
        chunk_index=0,
        captured_at_ms=100,
        input_source="system",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(b"abc").decode("ascii"),
    )

    service.accept_chunk(chunk)
    session = store.get_session("session-a")

    assert session.session_id == "session-a"
    assert session.input_source == "system"
    assert session.chunk_count == 1


def test_audio_chunk_rejects_input_source_change_for_existing_session() -> None:
    store = SessionStore()
    service = AudioIngestService(store)
    first = AudioChunkIn(
        session_id="session-a",
        chunk_index=0,
        captured_at_ms=100,
        input_source="microphone",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(b"abc").decode("ascii"),
    )
    second = first.model_copy(
        update={
            "chunk_index": 1,
            "captured_at_ms": 200,
            "input_source": "system",
        }
    )

    service.accept_chunk(first)

    with pytest.raises(ValueError, match="input_source cannot change"):
        service.accept_chunk(second)


def test_audio_chunk_rejects_invalid_base64_payload() -> None:
    store = SessionStore()
    service = AudioIngestService(store)
    chunk = AudioChunkIn(
        session_id="session-a",
        chunk_index=0,
        captured_at_ms=100,
        input_source="microphone",
        mime_type="audio/webm",
        payload_b64="not-valid-base64",
    )

    with pytest.raises(ValueError, match="payload_b64 must be valid base64"):
        service.accept_chunk(chunk)


def test_audio_ingest_returns_decoded_payload_bytes() -> None:
    store = SessionStore()
    service = AudioIngestService(store)
    chunk = AudioChunkIn(
        session_id="session-a",
        chunk_index=0,
        captured_at_ms=100,
        input_source="microphone",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(b"abc").decode("ascii"),
    )

    accepted = service.accept_chunk(chunk)

    assert accepted.payload == b"abc"
