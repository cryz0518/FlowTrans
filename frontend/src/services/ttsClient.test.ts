import { afterEach, describe, expect, it, vi } from "vitest";

import { synthesizeTts } from "./ttsClient";

describe("synthesizeTts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts text to the TTS endpoint and returns audio metadata", async () => {
    const audio = new Blob(["audio-bytes"], { type: "audio/mpeg" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(audio, {
        status: 200,
        headers: {
          "Content-Type": "audio/mpeg",
          "X-Audio-Format": "mp3",
          "X-Sample-Rate": "24000",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeTts("欢迎使用 FlowTrans。", {
      apiBaseUrl: "http://127.0.0.1:8000",
    });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8000/api/tts/synthesize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text: "欢迎使用 FlowTrans。" }),
    });
    expect(result.audio.type).toBe("audio/mpeg");
    expect(result.audio.size).toBeGreaterThan(0);
    expect(result.mimeType).toBe("audio/mpeg");
    expect(result.format).toBe("mp3");
    expect(result.sampleRate).toBe(24000);
  });

  it("rejects blank text without sending a request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(synthesizeTts(" ")).rejects.toThrow("TTS text must not be empty");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws a readable error when synthesis fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "DashScope TTS request failed" }), {
          status: 502,
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    await expect(synthesizeTts("欢迎使用 FlowTrans。")).rejects.toThrow(
      "TTS synthesis failed: DashScope TTS request failed",
    );
  });
});
