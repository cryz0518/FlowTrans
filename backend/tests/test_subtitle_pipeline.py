import base64

from app.models.events import AudioChunkIn
from app.providers.fake_provider import FakeProvider
from app.services.subtitle_pipeline import SubtitlePipeline


def make_chunk(index: int) -> AudioChunkIn:
    return AudioChunkIn(
        session_id="session-a",
        chunk_index=index,
        captured_at_ms=index * 500,
        input_source="microphone",
        mime_type="audio/webm",
        payload_b64=base64.b64encode(f"chunk-{index}".encode()).decode("ascii"),
    )


def test_pipeline_emits_partial_for_first_chunk() -> None:
    pipeline = SubtitlePipeline(FakeProvider())

    events = pipeline.process_chunk(make_chunk(0))

    assert len(events) == 1
    assert events[0].event_type == "partial"
    assert events[0].source_text == "Welcome to FlowTrans."
    assert events[0].translated_text == "欢迎使用 FlowTrans。"


def test_pipeline_emits_final_and_revision_for_later_chunks() -> None:
    pipeline = SubtitlePipeline(FakeProvider())

    pipeline.process_chunk(make_chunk(0))
    events = pipeline.process_chunk(make_chunk(1))

    assert [event.event_type for event in events] == ["final", "revision"]
    assert events[0].translated_text == "我们正在测试实时字幕。"
    assert events[1].replaces_event_id == "session-a-0"
    assert events[1].translated_text == "欢迎使用 FlowTrans AI 同传助手。"
