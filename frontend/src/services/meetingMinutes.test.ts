import { describe, expect, it } from "vitest";

import { createMeetingMinutesMarkdown } from "./meetingMinutes";
import type { SubtitleEvent } from "../types/events";

function event(overrides: Partial<SubtitleEvent>): SubtitleEvent {
  return {
    event_id: "event-1",
    session_id: "session",
    event_type: "final",
    source_text: "We decided to ship the desktop subtitle window.",
    translated_text: "我们决定发布桌面悬浮字幕窗口。",
    replaces_event_id: null,
    reason: null,
    ...overrides,
  };
}

describe("createMeetingMinutesMarkdown", () => {
  it("creates structured meeting minutes from final subtitle events", () => {
    const markdown = createMeetingMinutesMarkdown([
      event({ event_id: "event-1" }),
      event({
        event_id: "event-2",
        source_text: "Alice will verify the release tomorrow.",
        translated_text: "Alice 明天验证发布。",
      }),
      event({
        event_id: "partial-1",
        event_type: "partial",
        source_text: "draft",
        translated_text: "草稿",
      }),
    ]);

    expect(markdown).toContain("# 会议纪要");
    expect(markdown).toContain("## 要点摘要");
    expect(markdown).toContain("我们决定发布桌面悬浮字幕窗口。");
    expect(markdown).toContain("Alice 明天验证发布。");
    expect(markdown).not.toContain("草稿");
  });

  it("returns an empty-state summary when there are no final subtitles", () => {
    expect(createMeetingMinutesMarkdown([])).toContain("暂无可生成会议纪要的完整字幕。");
  });
});
