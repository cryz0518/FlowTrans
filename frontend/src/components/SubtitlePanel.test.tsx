import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SubtitlePanel } from "./SubtitlePanel";

describe("SubtitlePanel", () => {
  it("marks revised subtitles for visual feedback", () => {
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
            reason: "上下文修正",
          },
        ]}
      />,
    );

    expect(screen.getByText("欢迎使用 FlowTrans。").closest("article")).toHaveClass("revised");
  });
});
