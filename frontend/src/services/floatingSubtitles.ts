import type { FloatingSubtitleSnapshot } from "../types/desktop";
import type { SubtitleEvent } from "../types/events";

export function toFloatingSubtitleSnapshot(subtitles: SubtitleEvent[]): FloatingSubtitleSnapshot {
  const latest = subtitles[subtitles.length - 1];
  if (!latest) {
    return { current: null };
  }

  return {
    current: {
      eventId: latest.event_id,
      displayKey: getFloatingSubtitleDisplayKey(latest),
      sourceText: latest.source_text,
      translatedText: latest.translated_text,
    },
  };
}

export function getFloatingSubtitleDisplayKey(event: SubtitleEvent): string {
  const normalizedSource = event.source_text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const leadingWords = normalizedSource.split(" ").filter(Boolean).slice(0, 5).join(" ");

  return `${event.session_id}:${leadingWords || event.event_id}`;
}
