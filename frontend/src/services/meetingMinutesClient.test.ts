import { afterEach, describe, expect, it, vi } from "vitest";

import { generateMeetingMinutes } from "./meetingMinutesClient";
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

describe("generateMeetingMinutes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts subtitles to the backend meeting minutes API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ markdown: "# 会议纪要" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateMeetingMinutes([subtitle()], { apiBaseUrl: "http://127.0.0.1:8000" });

    expect(result).toBe("# 会议纪要");
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/meeting-minutes/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subtitles: [
          {
            event_id: "event-1",
            event_type: "final",
            source_text: "We confirmed the next plan.",
            translated_text: "我们确认了下一步计划。",
          },
        ],
      }),
    });
  });

  it("uses backend base URL for file protocol desktop pages", async () => {
    vi.stubGlobal("location", { protocol: "file:" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ markdown: "# 会议纪要" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await generateMeetingMinutes([subtitle()]);

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/meeting-minutes/generate", expect.any(Object));
  });

  it("rejects empty final subtitles", async () => {
    await expect(generateMeetingMinutes([subtitle({ event_type: "partial" })])).rejects.toThrow(
      "Meeting minutes require at least one final subtitle",
    );
  });

  it("includes backend error detail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "DashScope meeting minutes request failed" }), { status: 502 }),
      ),
    );

    await expect(generateMeetingMinutes([subtitle()])).rejects.toThrow(
      "Meeting minutes generation failed: DashScope meeting minutes request failed",
    );
  });
});
