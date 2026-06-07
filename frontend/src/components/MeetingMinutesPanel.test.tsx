import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MeetingMinutesPanel } from "./MeetingMinutesPanel";
import type { MeetingMinutesHistoryRecord } from "../services/meetingMinutesHistory";

const history: MeetingMinutesHistoryRecord[] = [
  {
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
  },
];

describe("MeetingMinutesPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders generated meeting minutes and saves them locally", () => {
    const onSave = vi.fn();

    render(
      <MeetingMinutesPanel
        status="ready"
        progress={100}
        content="# 会议纪要\n\n## 要点摘要\n- 已完成"
        historyRecords={[]}
        selectedHistoryId={null}
        onGenerate={vi.fn()}
        onSave={onSave}
        onHistorySelect={vi.fn()}
        onHistoryDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "会议纪要" })).toBeInTheDocument();
    expect(screen.getByText(/已完成/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存到本地" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows generation progress", () => {
    render(
      <MeetingMinutesPanel
        status="generating"
        progress={45}
        content=""
        historyRecords={[]}
        selectedHistoryId={null}
        onGenerate={vi.fn()}
        onSave={vi.fn()}
        onHistorySelect={vi.fn()}
        onHistoryDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("progressbar", { name: "会议纪要生成进度" })).toHaveAttribute("aria-valuenow", "45");
    expect(screen.getByText("正在生成会议纪要...")).toBeInTheDocument();
  });

  it("renders local history and bilingual transcript pairs", () => {
    render(
      <MeetingMinutesPanel
        status="ready"
        progress={100}
        content="# 会议纪要\n\n## 会议主题\n发布计划"
        historyRecords={history}
        selectedHistoryId="history-1"
        onGenerate={vi.fn()}
        onSave={vi.fn()}
        onHistorySelect={vi.fn()}
        onHistoryDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /^发布计划/ })).toBeInTheDocument();
    expect(screen.getByText("We confirmed the next plan.")).toBeInTheDocument();
    expect(screen.getByText("我们确认了下一步计划。")).toBeInTheDocument();
  });

  it("selects and deletes history records", () => {
    const onHistorySelect = vi.fn();
    const onHistoryDelete = vi.fn();
    render(
      <MeetingMinutesPanel
        status="ready"
        progress={100}
        content="# 会议纪要"
        historyRecords={history}
        selectedHistoryId="history-1"
        onGenerate={vi.fn()}
        onSave={vi.fn()}
        onHistorySelect={onHistorySelect}
        onHistoryDelete={onHistoryDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^发布计划/ }));
    fireEvent.click(screen.getByRole("button", { name: "删除 发布计划" }));

    expect(onHistorySelect).toHaveBeenCalledWith("history-1");
    expect(onHistoryDelete).toHaveBeenCalledWith("history-1");
  });
});
