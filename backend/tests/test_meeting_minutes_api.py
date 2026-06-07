from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import create_app
from app.providers.dashscope_provider import ProviderRuntimeError


def test_meeting_minutes_generate_returns_markdown(monkeypatch) -> None:
    class MeetingMinutesProvider:
        def generate_meeting_minutes(self, subtitles: list[dict[str, str]]) -> str:
            assert subtitles == [
                {
                    "source_text": "We confirmed the next plan.",
                    "translated_text": "我们确认了下一步计划。",
                }
            ]
            return "# 会议纪要\n\n## 要点摘要\n- 已确认下一步计划"

    monkeypatch.setenv("PROVIDER_MODE", "fake")
    monkeypatch.setattr("app.api.meeting_minutes.create_provider", lambda settings: MeetingMinutesProvider())
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post(
        "/api/meeting-minutes/generate",
        json={
            "subtitles": [
                {
                    "event_id": "session-1",
                    "event_type": "final",
                    "source_text": "We confirmed the next plan.",
                    "translated_text": "我们确认了下一步计划。",
                },
                {
                    "event_id": "session-2",
                    "event_type": "partial",
                    "source_text": "Ignore partial",
                    "translated_text": "忽略临时字幕",
                },
            ]
        },
    )

    assert response.status_code == 200
    assert response.json() == {"markdown": "# 会议纪要\n\n## 要点摘要\n- 已确认下一步计划"}
    get_settings.cache_clear()


def test_meeting_minutes_generate_rejects_empty_final_subtitles(monkeypatch) -> None:
    monkeypatch.setenv("PROVIDER_MODE", "fake")
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post(
        "/api/meeting-minutes/generate",
        json={
            "subtitles": [
                {
                    "event_id": "session-2",
                    "event_type": "partial",
                    "source_text": "Ignore partial",
                    "translated_text": "忽略临时字幕",
                }
            ]
        },
    )

    assert response.status_code == 422
    get_settings.cache_clear()


def test_meeting_minutes_generate_returns_bad_gateway_for_provider_error(monkeypatch) -> None:
    class FailingMeetingMinutesProvider:
        def generate_meeting_minutes(self, subtitles: list[dict[str, str]]) -> str:
            raise ProviderRuntimeError("DashScope meeting minutes request failed")

    monkeypatch.setenv("PROVIDER_MODE", "fake")
    monkeypatch.setattr("app.api.meeting_minutes.create_provider", lambda settings: FailingMeetingMinutesProvider())
    get_settings.cache_clear()
    client = TestClient(create_app())

    response = client.post(
        "/api/meeting-minutes/generate",
        json={
            "subtitles": [
                {
                    "event_id": "session-1",
                    "event_type": "final",
                    "source_text": "We confirmed the next plan.",
                    "translated_text": "我们确认了下一步计划。",
                }
            ]
        },
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "DashScope meeting minutes request failed"}
    get_settings.cache_clear()
