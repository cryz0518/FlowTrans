import type { SubtitleEvent } from "../types/events";

export function createMeetingMinutesMarkdown(subtitles: SubtitleEvent[]): string {
  const finalSubtitles = subtitles.filter((item) => item.event_type === "final" && item.translated_text.trim());
  const generatedAt = new Date().toLocaleString();

  if (finalSubtitles.length === 0) {
    return [
      "# 会议纪要",
      "",
      `生成时间：${generatedAt}`,
      "",
      "暂无可生成会议纪要的完整字幕。",
    ].join("\n");
  }

  const summaryItems = finalSubtitles.map((item) => `- ${item.translated_text.trim()}`);
  const evidenceItems = finalSubtitles.map((item, index) =>
    `${index + 1}. ${item.source_text.trim()}\n   ${item.translated_text.trim()}`,
  );

  return [
    "# 会议纪要",
    "",
    `生成时间：${generatedAt}`,
    "",
    "## 会议主题",
    finalSubtitles[0]?.translated_text.trim() ?? "实时同传会议",
    "",
    "## 要点摘要",
    ...summaryItems,
    "",
    "## 行动项",
    "- 请根据会议内容确认后续负责人和截止时间。",
    "",
    "## 原文依据",
    ...evidenceItems,
  ].join("\n");
}

export function downloadMeetingMinutes(markdown: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `flowtrans-meeting-minutes-${new Date().toISOString().slice(0, 10)}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}
