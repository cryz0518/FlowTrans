import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRealtimeSession } from "./useRealtimeSession";

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
                translated_text: "欢迎。",
                replaces_event_id: null,
                reason: null,
              },
              {
                event_id: "a-1",
                session_id: "a",
                event_type: "revision",
                source_text: "",
                translated_text: "欢迎使用 FlowTrans。",
                replaces_event_id: "a-0",
                reason: "上下文修正",
              },
            ],
          }),
        }),
      ),
    );

    expect(result.current.connectionStatus).toBe("connected");
    expect(result.current.subtitles[0].translated_text).toBe("欢迎使用 FlowTrans。");
    vi.unstubAllGlobals();
  });
});
