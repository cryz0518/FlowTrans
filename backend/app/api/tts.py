from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, field_validator

from app.core.config import get_settings
from app.providers.dashscope_provider import MissingDashScopeApiKey, ProviderRuntimeError
from app.providers.factory import create_provider

router = APIRouter(prefix="/api/tts")


class TtsSynthesizeRequest(BaseModel):
    text: str = Field(min_length=1)

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text must not be blank")
        return value


@router.post("/synthesize")
def synthesize_tts(request: TtsSynthesizeRequest) -> Response:
    try:
        provider = create_provider(get_settings())
        synthesize_speech = getattr(provider, "synthesize_speech")
        result = synthesize_speech(request.text)
    except AttributeError as exc:
        raise HTTPException(status_code=501, detail="Current provider does not support TTS") from exc
    except MissingDashScopeApiKey as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ProviderRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return Response(
        content=result.audio,
        media_type=result.mime_type,
        headers={
            "X-Audio-Format": result.format,
            "X-Sample-Rate": str(result.sample_rate),
        },
    )
