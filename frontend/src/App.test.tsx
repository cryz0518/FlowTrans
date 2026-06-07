import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { generateMeetingMinutes } from "./services/meetingMinutesClient";
import type { FlowTransDesktopApi } from "./types/desktop";

vi.mock("./services/meetingMinutesClient", () => ({
  generateMeetingMinutes: vi.fn(async () => "# 会议纪要\n\n## 要点摘要\n- 已生成"),
}));

function createDesktopApiMock(overrides: Partial<FlowTransDesktopApi> = {}): FlowTransDesktopApi {
  return {
    openFloatingWindow: vi.fn(async () => undefined),
    closeFloatingWindow: vi.fn(async () => undefined),
    sendFloatingSubtitles: vi.fn(async () => undefined),
    sendFloatingControlState: vi.fn(async () => undefined),
    sendFloatingControlCommand: vi.fn(async () => undefined),
    onFloatingSubtitles: vi.fn(() => () => undefined),
    onFloatingControlState: vi.fn(() => () => undefined),
    onFloatingControlCommand: vi.fn(() => () => undefined),
    ...overrides,
  };
}

function installAudioMocks() {
  const processor = { connect: vi.fn(), disconnect: vi.fn(), onaudioprocess: null };
  const source = { connect: vi.fn(), disconnect: vi.fn() };
  const stream = {
    getTracks: () => [{ stop: vi.fn() }],
    getAudioTracks: () => [{ stop: vi.fn() }],
  };

  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 16000;
      createMediaStreamSource = vi.fn(() => source);
      createScriptProcessor = vi.fn(() => processor);
      destination = {};
      close = vi.fn();
    },
  );
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      getDisplayMedia: vi.fn().mockResolvedValue(stream),
    },
  });
}

describe("App", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
    delete window.flowtransDesktop;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders the interpretation workbench", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "FlowTrans" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  });

  it("opens and closes the desktop floating subtitle window", () => {
    const openFloatingWindow = vi.fn(async () => undefined);
    const closeFloatingWindow = vi.fn(async () => undefined);
    window.flowtransDesktop = createDesktopApiMock({
      openFloatingWindow,
      closeFloatingWindow,
    });
    render(<App />);

    const floatingToggle = screen.getByRole("checkbox", { name: "desktop-floating-translation" });
    fireEvent.click(floatingToggle);
    fireEvent.click(floatingToggle);

    expect(openFloatingWindow).toHaveBeenCalledOnce();
    expect(closeFloatingWindow).toHaveBeenCalledOnce();
  });

  it("syncs realtime control state and handles floating window start and stop commands", async () => {
    installAudioMocks();
    let commandListener: ((command: "start" | "stop") => void) | undefined;
    const sendFloatingControlState = vi.fn(async () => undefined);
    window.flowtransDesktop = createDesktopApiMock({
      sendFloatingControlState,
      onFloatingControlCommand: vi.fn((listener) => {
        commandListener = listener;
        return vi.fn();
      }),
    });

    render(<App />);

    expect(sendFloatingControlState).toHaveBeenLastCalledWith({ isRunning: false, ttsEnabled: false });
    await act(async () => {
      commandListener?.("start");
    });
    expect(sendFloatingControlState).toHaveBeenLastCalledWith({ isRunning: true, ttsEnabled: false });

    act(() => {
      commandListener?.("stop");
    });
    expect(sendFloatingControlState).toHaveBeenLastCalledWith({ isRunning: false, ttsEnabled: false });
  });

  it("syncs Chinese voice state and handles floating window voice commands", () => {
    let commandListener: ((command: "start" | "stop" | { type: "tts"; enabled: boolean }) => void) | undefined;
    const sendFloatingControlState = vi.fn(async () => undefined);
    window.flowtransDesktop = createDesktopApiMock({
      sendFloatingControlState,
      onFloatingControlCommand: vi.fn((listener) => {
        commandListener = listener;
        return vi.fn();
      }),
    });

    render(<App />);

    expect(sendFloatingControlState).toHaveBeenLastCalledWith({ isRunning: false, ttsEnabled: false });
    act(() => {
      commandListener?.({ type: "tts", enabled: true });
    });
    expect(sendFloatingControlState).toHaveBeenLastCalledWith({ isRunning: false, ttsEnabled: true });
  });

  it("opens the meeting minutes view from the left controls", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "会议纪要" }));

    expect(screen.getByRole("heading", { name: "会议纪要" })).toBeInTheDocument();
  });

  it("returns to the translation view from the meeting minutes view", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "会议纪要" }));
    fireEvent.click(screen.getByRole("button", { name: "实时翻译" }));

    expect(screen.getByText("中文将在这里实时显示")).toBeInTheDocument();
  });

  it("asks to generate meeting minutes after stopping and switches to the minutes view", async () => {
    installAudioMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "停止" }));
    });

    expect(window.confirm).toHaveBeenCalledWith("是否要生成会议纪要？");
    expect(screen.getByRole("heading", { name: "会议纪要" })).toBeInTheDocument();
  });

  it("renders AI generated meeting minutes after generation finishes", async () => {
    vi.useFakeTimers();
    installAudioMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "开始" }));
    });
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "停止" }));
    });
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
    });

    expect(generateMeetingMinutes).toHaveBeenCalled();
    expect(screen.getByText(/已生成/)).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "历史会议纪要" })).toHaveTextContent("会议纪要");
  });

  it("loads local meeting minutes history with bilingual transcript pairs", () => {
    localStorage.setItem(
      "flowtrans.meetingMinutesHistory.v1",
      JSON.stringify([
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
      ]),
    );
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "会议纪要" }));

    expect(screen.getByRole("button", { name: /^发布计划/ })).toBeInTheDocument();
    expect(screen.getByText("We confirmed the next plan.")).toBeInTheDocument();
    expect(screen.getByText("我们确认了下一步计划。")).toBeInTheDocument();
  });
});
