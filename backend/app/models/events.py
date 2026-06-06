from typing import Literal

from pydantic import BaseModel, Field, field_validator

InputSource = Literal["microphone", "system"]


class AudioChunkIn(BaseModel):
    session_id: str = Field(min_length=1)
    chunk_index: int = Field(ge=0)
    captured_at_ms: int = Field(ge=0)
    input_source: InputSource
    mime_type: str = Field(min_length=1)
    payload_b64: str = Field(min_length=1)

    @field_validator("payload_b64")
    @classmethod
    def payload_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("payload_b64 must not be blank")
        return value


class AcceptedAudioChunk(BaseModel):
    session_id: str
    chunk_index: int
    byte_length: int
