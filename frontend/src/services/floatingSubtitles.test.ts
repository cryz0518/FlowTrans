import { describe, expect, it } from "vitest";

import { getFloatingSubtitleDisplayKey, toFloatingSubtitleSnapshot } from "./floatingSubtitles";
import type { SubtitleEvent } from "../types/events";

function event(overrides: Partial<SubtitleEvent>): SubtitleEvent {
  return {
    event_id: "event-1",
    session_id: "session",
    event_type: "final",
    source_text: "Hello",
    translated_text: "你好",
    replaces_event_id: null,
    reason: null,
    ...overrides,
  };
}

describe("toFloatingSubtitleSnapshot", () => {
  it("keeps only the latest subtitle for the floating window", () => {
    const snapshot = toFloatingSubtitleSnapshot([
      event({ event_id: "older", source_text: "Hello", translated_text: "你好" }),
      event({ event_id: "latest", source_text: "How are you?", translated_text: "你好吗？" }),
    ]);

    expect(snapshot.current).toEqual({
      eventId: "latest",
      displayKey: "session:how are you",
      sourceText: "How are you?",
      translatedText: "你好吗？",
    });
  });

  it("uses null when no subtitle is available", () => {
    expect(toFloatingSubtitleSnapshot([]).current).toBeNull();
  });

  it("keeps the same display key for realtime growth of the same sentence", () => {
    expect(
      getFloatingSubtitleDisplayKey(
        event({
          event_id: "session-asr-1",
          source_text: "Today we are very happy,",
        }),
      ),
    ).toBe(
      getFloatingSubtitleDisplayKey(
        event({
          event_id: "session-asr-2",
          source_text: "Today we are very happy, and we are going to the amusement park,",
        }),
      ),
    );
  });
});
