import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAudioCapture } from "./useAudioCapture";

describe("useAudioCapture", () => {
  it("starts microphone capture and reports recording status", async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const trackStop = vi.fn();

    vi.stubGlobal(
      "MediaRecorder",
      class {
        ondataavailable: ((event: BlobEvent) => void) | null = null;
        start = start;
        stop = stop;
        constructor() {}
      },
    );
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: trackStop }] }),
      },
    });

    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("microphone", vi.fn());
    });

    expect(result.current.captureStatus).toBe("recording");
    expect(start).toHaveBeenCalledWith(500);
    vi.unstubAllGlobals();
  });
});
