import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MeetingMinutesPanel } from "./MeetingMinutesPanel";

describe("MeetingMinutesPanel", () => {
  it("renders generated meeting minutes and saves them locally", () => {
    const onSave = vi.fn();

    render(
      <MeetingMinutesPanel
        status="ready"
        progress={100}
        content="# 会议纪要\n\n## 要点摘要\n- 已完成"
        onGenerate={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("heading", { name: "会议纪要" })).toBeInTheDocument();
    expect(screen.getByText(/已完成/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "保存到本地" }));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("shows generation progress", () => {
    render(<MeetingMinutesPanel status="generating" progress={45} content="" onGenerate={vi.fn()} onSave={vi.fn()} />);

    expect(screen.getByRole("progressbar", { name: "会议纪要生成进度" })).toHaveAttribute("aria-valuenow", "45");
    expect(screen.getByText("正在生成会议纪要...")).toBeInTheDocument();
  });
});
