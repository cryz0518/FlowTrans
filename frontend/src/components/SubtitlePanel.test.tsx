import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SubtitlePanel } from "./SubtitlePanel";

afterEach(() => {
  cleanup();
});

describe("SubtitlePanel", () => {
  it("renders the empty state as the same English and Chinese split panel", () => {
    render(<SubtitlePanel subtitles={[]} />);

    expect(screen.getByRole("region", { name: "双语字幕" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "英文" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "中文" })).toBeInTheDocument();
    expect(screen.getByText("英文将在这里实时显示")).toBeInTheDocument();
    expect(screen.getByText("中文将在这里实时显示")).toBeInTheDocument();
    expect(screen.queryByText("中文字幕将在这里实时显示")).not.toBeInTheDocument();
  });

  it("renders English and Chinese streams inside one split panel", () => {
    render(
      <SubtitlePanel
        subtitles={[
          {
            event_id: "a-0",
            session_id: "a",
            event_type: "partial",
            source_text: "We are testing real-time captions.",
            translated_text: "我们正在测试实时字幕。",
            replaces_event_id: null,
            reason: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole("region", { name: "双语字幕" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "英文" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "中文" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "英文：We are testing real-time captions." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中文：我们正在测试实时字幕。" })).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
  });

  it("does not show correction labels in the subtitle panel", () => {
    render(
      <SubtitlePanel
        subtitles={[
          {
            event_id: "a-0",
            session_id: "a",
            event_type: "final",
            source_text: "Welcome",
            translated_text: "欢迎使用 FlowTrans。",
            replaces_event_id: null,
            reason: "根据完整语句修正翻译",
          },
        ]}
      />,
    );

    expect(screen.queryByText("已修正")).not.toBeInTheDocument();
  });

  it("links selected English and Chinese subtitle segments with different highlights", () => {
    render(
      <SubtitlePanel
        subtitles={[
          {
            event_id: "a-0",
            session_id: "a",
            event_type: "final",
            source_text: "Welcome to FlowTrans.",
            translated_text: "欢迎使用 FlowTrans。",
            replaces_event_id: null,
            reason: null,
          },
        ]}
      />,
    );

    const english = screen.getByRole("button", { name: "英文：Welcome to FlowTrans." });
    const chinese = screen.getByRole("button", { name: "中文：欢迎使用 FlowTrans。" });

    fireEvent.click(english);

    expect(english).toHaveClass("selected-primary");
    expect(chinese).toHaveClass("selected-linked");

    fireEvent.click(chinese);

    expect(chinese).toHaveClass("selected-primary");
    expect(english).toHaveClass("selected-linked");
  });
});
