from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter()


@router.get("/health")
def read_health() -> dict[str, str]:
    settings = get_settings()
    return {
        "service": settings.service_name,
        "status": "ok",
        "provider_mode": settings.provider_mode,
    }


@router.get("/config")
def read_config() -> dict[str, str]:
    settings = get_settings()
    return {
        "service": settings.service_name,
        "provider_mode": settings.provider_mode,
        "target_language": settings.target_language,
    }
