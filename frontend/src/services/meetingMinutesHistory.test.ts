import { afterEach, describe, expect, it } from "vitest";

import {
  createMeetingMinutesHistoryRecord,
  deleteMeetingMinutesHistoryRecord,
  loadMeetingMinutesHistory,
  saveMeetingMinutesHistoryRecord,
} from "./meetingMinutesHistory";
import type { SubtitleEvent } from "../types/events";

function subtitle(overrides: Partial<SubtitleEvent> = {}): SubtitleEvent {
  return {
    event_id: "event-1",
    session_id: "session",
    event_type: "final",
    source_text: "We confirmed the next plan.",
    translated_text: "我们确认了下一步计划。",
    replaces_event_id: null,
    reason: null,
    ...overrides,
  };
}

describe("meetingMinutesHistory", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("creates a history record with markdown and final subtitle pairs", () => {
    const record = createMeetingMinutesHistoryRecord({
      markdown: "# 会议纪要\n\n## 会议主题\n发布计划",
      subtitles: [
        subtitle(),
        subtitle({
          event_id: "partial-1",
          event_type: "partial",
          source_text: "draft",
          translated_text: "草稿",
        }),
      ],
      now: new Date("2026-06-07T09:00:00.000Z"),
      id: "history-1",
    });

    expect(record).toEqual({
      id: "history-1",
      title: "发布计划",
      createdAt: "2026-06-07T09:00:00.000Z",
      minutesMarkdown: "# 会议纪要\n\n## 会议主题\n发布计划",
      subtitles: [
        {
          eventId: "event-1",
          sourceText: "We confirmed the next plan.",
          translatedText: "我们确认了下一步计划。",
        },
      ],
    });
  });

  it("saves newest history record first", () => {
    const older = createMeetingMinutesHistoryRecord({
      markdown: "# 会议纪要\n\n## 会议主题\n旧会议",
      subtitles: [subtitle({ event_id: "old" })],
      now: new Date("2026-06-07T08:00:00.000Z"),
      id: "old",
    });
    const newer = createMeetingMinutesHistoryRecord({
      markdown: "# 会议纪要\n\n## 会议主题\n新会议",
      subtitles: [subtitle({ event_id: "new" })],
      now: new Date("2026-06-07T09:00:00.000Z"),
      id: "new",
    });

    saveMeetingMinutesHistoryRecord(older);
    saveMeetingMinutesHistoryRecord(newer);

    expect(loadMeetingMinutesHistory().map((item) => item.id)).toEqual(["new", "old"]);
  });

  it("deletes a history record by id", () => {
    const record = createMeetingMinutesHistoryRecord({
      markdown: "# 会议纪要\n\n## 会议主题\n发布计划",
      subtitles: [subtitle()],
      now: new Date("2026-06-07T09:00:00.000Z"),
      id: "history-1",
    });
    saveMeetingMinutesHistoryRecord(record);

    deleteMeetingMinutesHistoryRecord("history-1");

    expect(loadMeetingMinutesHistory()).toEqual([]);
  });
});
