from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.core.config import get_settings
from app.providers.dashscope_provider import MissingDashScopeApiKey, ProviderRuntimeError
from app.providers.factory import create_provider

router = APIRouter(prefix="/api/meeting-minutes")


class MeetingMinutesSubtitle(BaseModel):
    event_id: str = Field(min_length=1)
    event_type: Literal["partial", "final", "revision"]
    source_text: str = ""
    translated_text: str = ""


class MeetingMinutesGenerateRequest(BaseModel):
    subtitles: list[MeetingMinutesSubtitle] = Field(min_length=1)

    @model_validator(mode="after")
    def must_include_final_translated_subtitle(self) -> "MeetingMinutesGenerateRequest":
        has_final = any(
            item.event_type == "final" and (item.source_text.strip() or item.translated_text.strip())
            for item in self.subtitles
        )
        if not has_final:
            raise ValueError("subtitles must include at least one final subtitle")
        return self


class MeetingMinutesGenerateResponse(BaseModel):
    markdown: str


@router.post("/generate")
def generate_meeting_minutes(request: MeetingMinutesGenerateRequest) -> MeetingMinutesGenerateResponse:
    final_subtitles = [
        {
            "source_text": item.source_text,
            "translated_text": item.translated_text,
        }
        for item in request.subtitles
        if item.event_type == "final"
    ]

    try:
        provider = create_provider(get_settings())
        generate = getattr(provider, "generate_meeting_minutes")
        markdown = generate(final_subtitles)
    except AttributeError as exc:
        raise HTTPException(status_code=501, detail="Current provider does not support meeting minutes") from exc
    except MissingDashScopeApiKey as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ProviderRuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return MeetingMinutesGenerateResponse(markdown=markdown)
