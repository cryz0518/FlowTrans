import inspect

from app.models.events import AudioChunkIn, SubtitleEvent


class SubtitlePipeline:
    def __init__(self, provider) -> None:
        self._provider = provider

    async def process_chunk(self, chunk: AudioChunkIn, audio: bytes) -> list[SubtitleEvent]:
        result = self._provider.transcribe_and_translate(
            chunk_index=chunk.chunk_index,
            audio=audio,
            mime_type=chunk.mime_type,
        )
        if inspect.isawaitable(result):
            result = await result
        if result is None:
            return []

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
        if inspect.isawaitable(revised_text):
            revised_text = await revised_text
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
