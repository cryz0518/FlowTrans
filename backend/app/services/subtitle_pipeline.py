from app.models.events import AudioChunkIn, SubtitleEvent
from app.providers.fake_provider import FakeProvider


class SubtitlePipeline:
    def __init__(self, provider: FakeProvider) -> None:
        self._provider = provider

    def process_chunk(self, chunk: AudioChunkIn) -> list[SubtitleEvent]:
        result = self._provider.transcribe_and_translate(chunk.chunk_index)
        event_type = "final" if result.is_final else "partial"
        events = [
            SubtitleEvent(
                event_id=f"{chunk.session_id}-{chunk.chunk_index}",
                session_id=chunk.session_id,
                event_type=event_type,
                source_text=result.source_text,
                translated_text=result.translated_text,
            )
        ]

        revised_text = self._provider.revise_previous(chunk.chunk_index)
        if revised_text is not None:
            events.append(
                SubtitleEvent(
                    event_id=f"{chunk.session_id}-{chunk.chunk_index}-revision",
                    session_id=chunk.session_id,
                    event_type="revision",
                    translated_text=revised_text,
                    replaces_event_id=f"{chunk.session_id}-0",
                    reason="上下文补全后修正欢迎语。",
                )
            )
        return events
