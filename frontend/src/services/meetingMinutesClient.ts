import type { SubtitleEvent } from "../types/events";

type GenerateMeetingMinutesOptions = {
  apiBaseUrl?: string;
};

export async function generateMeetingMinutes(
  subtitles: SubtitleEvent[],
  options: GenerateMeetingMinutesOptions = {},
): Promise<string> {
  const finalSubtitles = subtitles.filter(
    (item) => item.event_type === "final" && (item.source_text.trim() || item.translated_text.trim()),
  );
  if (finalSubtitles.length === 0) {
    throw new Error("Meeting minutes require at least one final subtitle");
  }

  const response = await fetch(buildMeetingMinutesEndpoint(options.apiBaseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subtitles: finalSubtitles.map((item) => ({
        event_id: item.event_id,
        event_type: item.event_type,
        source_text: item.source_text,
        translated_text: item.translated_text,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Meeting minutes generation failed: ${await readErrorMessage(response)}`);
  }

  const payload = (await response.json()) as { markdown?: unknown };
  if (typeof payload.markdown !== "string" || !payload.markdown.trim()) {
    throw new Error("Meeting minutes generation failed: response is invalid");
  }
  return payload.markdown;
}

function buildMeetingMinutesEndpoint(apiBaseUrl?: string): string {
  const baseUrl = (apiBaseUrl ?? defaultApiBaseUrl()).replace(/\/$/, "");
  return `${baseUrl}/api/meeting-minutes/generate`;
}

function defaultApiBaseUrl(): string {
  if (globalThis.location?.protocol === "file:") {
    return "http://127.0.0.1:8000";
  }
  return "";
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    return response.statusText || String(response.status);
  }
  return response.statusText || String(response.status);
}
