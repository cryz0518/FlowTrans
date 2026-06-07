import type { SubtitleEvent } from "../types/events";

const STORAGE_KEY = "flowtrans.meetingMinutesHistory.v1";
const MAX_HISTORY_RECORDS = 20;

export type MeetingMinutesHistorySubtitle = {
  eventId: string;
  sourceText: string;
  translatedText: string;
};

export type MeetingMinutesHistoryRecord = {
  id: string;
  title: string;
  createdAt: string;
  minutesMarkdown: string;
  subtitles: MeetingMinutesHistorySubtitle[];
};

type CreateMeetingMinutesHistoryRecordInput = {
  markdown: string;
  subtitles: SubtitleEvent[];
  now?: Date;
  id?: string;
};

export function createMeetingMinutesHistoryRecord({
  markdown,
  subtitles,
  now = new Date(),
  id,
}: CreateMeetingMinutesHistoryRecordInput): MeetingMinutesHistoryRecord {
  const finalSubtitles = subtitles
    .filter((item) => item.event_type === "final" && (item.source_text.trim() || item.translated_text.trim()))
    .map((item) => ({
      eventId: item.event_id,
      sourceText: item.source_text.trim(),
      translatedText: item.translated_text.trim(),
    }));

  return {
    id: id ?? createHistoryId(now),
    title: extractMeetingTitle(markdown),
    createdAt: now.toISOString(),
    minutesMarkdown: markdown,
    subtitles: finalSubtitles,
  };
}

export function loadMeetingMinutesHistory(): MeetingMinutesHistoryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isMeetingMinutesHistoryRecord);
  } catch {
    return [];
  }
}

export function saveMeetingMinutesHistoryRecord(record: MeetingMinutesHistoryRecord): MeetingMinutesHistoryRecord[] {
  const nextRecords = [record, ...loadMeetingMinutesHistory().filter((item) => item.id !== record.id)].slice(
    0,
    MAX_HISTORY_RECORDS,
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  return nextRecords;
}

export function deleteMeetingMinutesHistoryRecord(id: string): MeetingMinutesHistoryRecord[] {
  const nextRecords = loadMeetingMinutesHistory().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  return nextRecords;
}

function createHistoryId(now: Date): string {
  return `minutes-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractMeetingTitle(markdown: string): string {
  const lines = markdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const topicIndex = lines.findIndex((line) => line === "## 会议主题");
  if (topicIndex >= 0 && lines[topicIndex + 1] && !lines[topicIndex + 1].startsWith("#")) {
    return lines[topicIndex + 1].replace(/^[-*]\s*/, "").slice(0, 40);
  }
  const heading = lines.find((line) => line.startsWith("# "));
  return heading?.replace(/^#\s*/, "").slice(0, 40) || "会议纪要";
}

function isMeetingMinutesHistoryRecord(value: unknown): value is MeetingMinutesHistoryRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as MeetingMinutesHistoryRecord;
  return (
    typeof record.id === "string" &&
    typeof record.title === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.minutesMarkdown === "string" &&
    Array.isArray(record.subtitles)
  );
}
