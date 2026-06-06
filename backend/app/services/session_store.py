from dataclasses import dataclass, field

from app.models.events import InputSource


@dataclass
class SessionState:
    session_id: str
    input_source: InputSource
    last_chunk_index: int = -1
    chunk_count: int = 0
    audio_bytes: list[bytes] = field(default_factory=list)


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionState] = {}

    def get_or_create(self, session_id: str, input_source: InputSource) -> SessionState:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionState(
                session_id=session_id,
                input_source=input_source,
            )
        session = self._sessions[session_id]
        if session.input_source != input_source:
            raise ValueError("input_source cannot change for an existing session")
        return session

    def get_session(self, session_id: str) -> SessionState:
        return self._sessions[session_id]

    def append_audio(
        self,
        session_id: str,
        input_source: InputSource,
        chunk_index: int,
        payload: bytes,
    ) -> SessionState:
        session = self.get_or_create(session_id, input_source)
        if chunk_index <= session.last_chunk_index:
            raise ValueError("chunk_index must increase")
        session.last_chunk_index = chunk_index
        session.chunk_count += 1
        session.audio_bytes.append(payload)
        return session
