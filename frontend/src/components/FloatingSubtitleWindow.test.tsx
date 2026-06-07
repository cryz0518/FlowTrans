import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FloatingSubtitleWindow, getFloatingSegmentDurationMs } from "./FloatingSubtitleWindow";
import type { FloatingSubtitleSnapshot } from "../types/desktop";

describe("FloatingSubtitleWindow", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("renders the current bilingual subtitle", () => {
    const snapshot: FloatingSubtitleSnapshot = {
      current: { eventId: "event-1", displayKey: "event-1", sourceText: "Good morning", translatedText: "早上好" },
    };

    render(<FloatingSubtitleWindow initialSnapshot={snapshot} />);

    expect(screen.getByText("Good morning")).toBeInTheDocument();
    expect(screen.getByText("早上好")).toBeInTheDocument();
  });

  it("can switch to Chinese-only mode", () => {
    const snapshot: FloatingSubtitleSnapshot = {
      current: { eventId: "event-1", displayKey: "event-1", sourceText: "Good morning", translatedText: "早上好" },
    };

    render(<FloatingSubtitleWindow initialSnapshot={snapshot} />);
    fireEvent.click(screen.getByRole("button", { name: "只中文" }));

    expect(screen.queryByText("Good morning")).not.toBeInTheDocument();
    expect(screen.getByText("早上好")).toBeInTheDocument();
  });

  it("breaks source text and the active translation segment into lyric-style lines", () => {
    const snapshot: FloatingSubtitleSnapshot = {
      current: {
        eventId: "event-1",
        displayKey: "event-1",
        sourceText: "This is a long English subtitle that should wrap softly",
        translatedText: "这是一段很长的中文字幕内容，需要像桌面歌词一样分成几行显示。",
      },
    };

    render(<FloatingSubtitleWindow initialSnapshot={snapshot} />);

    expect(screen.getByText("This is a long English subtitle")).toBeInTheDocument();
    expect(screen.getByText("that should wrap softly")).toBeInTheDocument();
    expect(screen.getByText("这是一段很长的中文字幕内容，")).toBeInTheDocument();
    expect(screen.queryByText("需要像桌面歌词一样分成几")).not.toBeInTheDocument();
  });

  it("advances long translated text quickly enough for realtime subtitles", () => {
    vi.useFakeTimers();
    const snapshot: FloatingSubtitleSnapshot = {
      current: {
        eventId: "event-1",
        displayKey: "event-1",
        sourceText: "",
        translatedText: "今天非常高兴，我们一起去游乐园，吃了棒棒糖，冰淇淋，过山车。",
      },
    };

    render(<FloatingSubtitleWindow initialSnapshot={snapshot} />);

    expect(screen.getByText("今天非常高兴，我们一起去游乐园，")).toBeInTheDocument();
    expect(screen.queryByText("吃了棒棒糖，冰淇淋，过山车。")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(900);
    });

    expect(screen.queryByText("今天非常高兴，我们一起去游乐园，")).not.toBeInTheDocument();
    expect(screen.getByText("吃了棒棒糖，冰淇淋，过山车。")).toBeInTheDocument();
  });

  it("does not jump back to the first segment when the same subtitle receives a translation revision", () => {
    vi.useFakeTimers();
    let subtitleListener: ((snapshot: FloatingSubtitleSnapshot) => void) | undefined;
    window.flowtransDesktop = {
      openFloatingWindow: vi.fn(),
      closeFloatingWindow: vi.fn(),
      sendFloatingControlState: vi.fn(),
      sendFloatingSubtitles: vi.fn(),
      onFloatingControlState: vi.fn(() => () => undefined),
      sendFloatingControlCommand: vi.fn(),
      onFloatingControlCommand: vi.fn(() => () => undefined),
      onFloatingSubtitles: vi.fn((listener) => {
        subtitleListener = listener;
        return vi.fn();
      }),
    };
    const snapshot: FloatingSubtitleSnapshot = {
      current: {
        eventId: "event-1",
        displayKey: "same-sentence",
        sourceText: "",
        translatedText: "今天非常高兴，我们一起去游乐园，吃了棒棒糖，冰淇淋，过山车。",
      },
    };

    render(<FloatingSubtitleWindow initialSnapshot={snapshot} />);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(screen.getByText("吃了棒棒糖，冰淇淋，过山车。")).toBeInTheDocument();

    act(() => {
      subtitleListener?.({
        current: {
          eventId: "event-2",
          displayKey: "same-sentence",
          sourceText: "",
          translatedText: "今天非常高兴，我们一起去游乐园，吃了棒棒糖，冰淇淋，还坐了过山车。",
        },
      });
    });

    expect(screen.queryByText("今天非常高兴，我们一起去游乐园，")).not.toBeInTheDocument();
    expect(screen.getByText("吃了棒棒糖，冰淇淋，还坐了过山车。")).toBeInTheDocument();
  });

  it("shows the shared start state and sends start and stop commands", () => {
    let stateListener: ((state: { isRunning: boolean }) => void) | undefined;
    const sendFloatingControlCommand = vi.fn(async () => undefined);
    window.flowtransDesktop = {
      openFloatingWindow: vi.fn(),
      closeFloatingWindow: vi.fn(),
      sendFloatingControlState: vi.fn(),
      sendFloatingSubtitles: vi.fn(),
      onFloatingSubtitles: vi.fn(() => () => undefined),
      sendFloatingControlCommand,
      onFloatingControlCommand: vi.fn(() => () => undefined),
      onFloatingControlState: vi.fn((listener) => {
        stateListener = listener;
        return vi.fn();
      }),
    };

    render(<FloatingSubtitleWindow />);
    fireEvent.click(screen.getByRole("button", { name: "开始" }));
    expect(sendFloatingControlCommand).toHaveBeenLastCalledWith("start");

    act(() => {
      stateListener?.({ isRunning: true });
    });

    fireEvent.click(screen.getByRole("button", { name: "停止" }));
    expect(sendFloatingControlCommand).toHaveBeenLastCalledWith("stop");
  });
});

describe("getFloatingSegmentDurationMs", () => {
  it("keeps staged subtitle timing below realtime-hostile waits", () => {
    expect(getFloatingSegmentDurationMs("今天非常高兴，我们一起去游乐园，")).toBeLessThanOrEqual(1200);
    expect(getFloatingSegmentDurationMs("好")).toBeGreaterThanOrEqual(650);
  });
});
