import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TtsPlaybackQueue } from "../services/ttsPlaybackQueue";
import { useRealtimeSession } from "./useRealtimeSession";

vi.mock("../services/ttsPlaybackQueue", () => {
  const TtsPlaybackQueue = vi.fn(() => ({
    enqueue: vi.fn(),
    clear: vi.fn(),
  }));
  return { TtsPlaybackQueue };
});

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static OPEN = 1;

  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  readyState = MockWebSocket.OPEN;
  sent: string[] = [];

  constructor() {
    MockWebSocket.instances.push(this);
  }

  send(value: string) {
    this.sent.push(value);
  }

  close() {
    this.onclose?.();
  }
}

describe("useRealtimeSession", () => {
  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.mocked(TtsPlaybackQueue).mockClear();
  });

  it("stores final subtitles and applies revisions", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const { result } = renderHook(() => useRealtimeSession("ws://test"));

    act(() => result.current.connect());
    const socket = MockWebSocket.instances[0];
    act(() => socket.onopen?.());
    act(() =>
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "subtitle_events",
            events: [
              {
                event_id: "a-0",
                session_id: "a",
                event_type: "final",
                source_text: "Welcome",
                translated_text: "Welcome.",
                replaces_event_id: null,
                reason: null,
              },
              {
                event_id: "a-1",
                session_id: "a",
                event_type: "revision",
                source_text: "",
                translated_text: "Welcome to FlowTrans.",
                replaces_event_id: "a-0",
                reason: "context revision",
              },
            ],
          }),
        }),
      ),
    );

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.subtitles[0].translated_text).toBe("Welcome to FlowTrans.");
    vi.unstubAllGlobals();
  });

  it("does not queue final subtitles when TTS playback is disabled", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const { result } = renderHook(() => useRealtimeSession("ws://test"));

    act(() => result.current.connect());
    const socket = MockWebSocket.instances[0];
    act(() => socket.onopen?.());
    act(() =>
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "subtitle_events",
            events: [
              {
                event_id: "a-partial",
                session_id: "a",
                event_type: "partial",
                source_text: "Wel",
                translated_text: "Wel",
                replaces_event_id: null,
                reason: null,
              },
              {
                event_id: "a-final",
                session_id: "a",
                event_type: "final",
                source_text: "Welcome",
                translated_text: "Welcome.",
                replaces_event_id: null,
                reason: null,
              },
              {
                event_id: "a-revision",
                session_id: "a",
                event_type: "revision",
                source_text: "",
                translated_text: "Welcome to FlowTrans.",
                replaces_event_id: "a-final",
                reason: "context revision",
              },
            ],
          }),
        }),
      ),
    );

    const queue = vi.mocked(TtsPlaybackQueue).mock.results[0].value;
    expect(queue.enqueue).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("replaces duplicate subtitle events with the same event id", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const { result } = renderHook(() => useRealtimeSession("ws://test"));

    act(() => result.current.connect());
    const socket = MockWebSocket.instances[0];
    act(() => socket.onopen?.());
    act(() =>
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "subtitle_events",
            events: [
              {
                event_id: "browser-session-asr-28",
                session_id: "browser-session",
                event_type: "final",
                source_text: "Welcome",
                translated_text: "Welcome.",
                replaces_event_id: null,
                reason: null,
              },
            ],
          }),
        }),
      ),
    );
    act(() =>
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "subtitle_events",
            events: [
              {
                event_id: "browser-session-asr-28",
                session_id: "browser-session",
                event_type: "final",
                source_text: "Welcome again",
                translated_text: "Welcome again.",
                replaces_event_id: null,
                reason: null,
              },
            ],
          }),
        }),
      ),
    );

    expect(result.current.subtitles).toHaveLength(1);
    expect(result.current.subtitles[0].event_id).toBe("browser-session-asr-28");
    expect(result.current.subtitles[0].translated_text).toBe("Welcome again.");
    vi.unstubAllGlobals();
  });

  it("queues final subtitles when TTS playback is enabled and clears playback on disconnect", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const { result } = renderHook(() => useRealtimeSession("ws://test", { ttsEnabled: true }));

    act(() => result.current.connect());
    const socket = MockWebSocket.instances[0];
    act(() => socket.onopen?.());
    act(() =>
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "subtitle_events",
            events: [
              {
                event_id: "a-partial",
                session_id: "a",
                event_type: "partial",
                source_text: "Wel",
                translated_text: "Wel",
                replaces_event_id: null,
                reason: null,
              },
              {
                event_id: "a-final",
                session_id: "a",
                event_type: "final",
                source_text: "Welcome",
                translated_text: "Welcome.",
                replaces_event_id: null,
                reason: null,
              },
              {
                event_id: "a-revision",
                session_id: "a",
                event_type: "revision",
                source_text: "",
                translated_text: "Welcome to FlowTrans.",
                replaces_event_id: "a-final",
                reason: "context revision",
              },
            ],
          }),
        }),
      ),
    );

    const queue = vi.mocked(TtsPlaybackQueue).mock.results[0].value;
    expect(queue.enqueue).toHaveBeenCalledOnce();
    expect(queue.enqueue).toHaveBeenCalledWith("a-final", "Welcome.");

    act(() => result.current.disconnect());

    expect(queue.clear).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("queues final subtitles after TTS playback is enabled on an active connection", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    const { result, rerender } = renderHook(
      ({ ttsEnabled }) => useRealtimeSession("ws://test", { ttsEnabled }),
      { initialProps: { ttsEnabled: false } },
    );

    act(() => result.current.connect());
    const socket = MockWebSocket.instances[0];
    act(() => socket.onopen?.());

    rerender({ ttsEnabled: true });

    act(() =>
      socket.onmessage?.(
        new MessageEvent("message", {
          data: JSON.stringify({
            type: "subtitle_events",
            events: [
              {
                event_id: "a-final",
                session_id: "a",
                event_type: "final",
                source_text: "Welcome",
                translated_text: "欢迎。",
                replaces_event_id: null,
                reason: null,
              },
            ],
          }),
        }),
      ),
    );

    const queue = vi.mocked(TtsPlaybackQueue).mock.results[0].value;
    expect(queue.enqueue).toHaveBeenCalledWith("a-final", "欢迎。");
    vi.unstubAllGlobals();
  });
});
