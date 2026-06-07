import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAudioCapture } from "./useAudioCapture";

class FakeProcessor {
  onaudioprocess: ((event: AudioProcessingEvent) => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
}

class FakeSource {
  connect = vi.fn();
  disconnect = vi.fn();
}

function installAudioMocks(sampleRate = 48000) {
  const processor = new FakeProcessor();
  const source = new FakeSource();
  const close = vi.fn().mockResolvedValue(undefined);
  const trackStop = vi.fn();

  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = sampleRate;
      createMediaStreamSource = vi.fn(() => source);
      createScriptProcessor = vi.fn(() => processor);
      destination = {};
      close = close;
    },
  );
  const stream = {
    getTracks: () => [{ stop: trackStop }],
    getAudioTracks: () => [{ stop: trackStop }],
  };

  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      getDisplayMedia: vi.fn().mockResolvedValue(stream),
    },
  });

  return { close, processor, source, trackStop };
}

function makeAudioEvent(samples: Float32Array): AudioProcessingEvent {
  return {
    inputBuffer: {
      numberOfChannels: 1,
      getChannelData: () => samples,
    },
  } as unknown as AudioProcessingEvent;
}

describe("useAudioCapture", () => {
  it("starts microphone pcm capture and reports recording status", async () => {
    const { processor, source } = installAudioMocks();
    const onChunk = vi.fn();
    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("microphone", onChunk);
    });

    expect(result.current.captureStatus).toBe("recording");
    expect(source.connect).toHaveBeenCalledWith(processor);
    expect(processor.connect).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("emits pcm chunks with pcm mime type", async () => {
    const { processor } = installAudioMocks(16000);
    const onChunk = vi.fn();
    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("microphone", onChunk);
    });

    act(() => {
      processor.onaudioprocess?.(makeAudioEvent(new Float32Array(8192).fill(0.25)));
    });

    expect(onChunk).toHaveBeenCalledWith({
      mimeType: "audio/pcm;rate=16000;channels=1",
      payloadB64: expect.any(String),
    });
    vi.unstubAllGlobals();
  });

  it("emits low latency pcm chunks every 160ms", async () => {
    const { processor } = installAudioMocks(16000);
    const onChunk = vi.fn();
    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("microphone", onChunk);
    });

    act(() => {
      processor.onaudioprocess?.(makeAudioEvent(new Float32Array(2560).fill(0.25)));
    });

    expect(onChunk).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("stops tracks and closes audio context", async () => {
    const { close, trackStop } = installAudioMocks();
    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("microphone", vi.fn());
    });

    act(() => {
      result.current.stop();
    });

    expect(trackStop).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(result.current.captureStatus).toBe("idle");
    vi.unstubAllGlobals();
  });

  it("stores capture error details when media permission fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn().mockRejectedValue(new Error("Permission denied")),
      },
    });
    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("microphone", vi.fn());
    });

    expect(result.current.captureStatus).toBe("error");
    expect(result.current.captureError).toBe("Permission denied");
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("reports a clear error when system capture has no audio track", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue({ getTracks: () => [], getAudioTracks: () => [] }),
      },
    });
    const { result } = renderHook(() => useAudioCapture());

    await act(async () => {
      await result.current.start("system", vi.fn());
    });

    expect(result.current.captureStatus).toBe("error");
    expect(result.current.captureError).toBe("System audio capture returned no audio track");
    errorSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
