import { describe, expect, it, vi } from "vitest";

import { TtsPlaybackQueue } from "./ttsPlaybackQueue";
import type { TtsAudioResult } from "./ttsClient";

function makeAudioResult(label: string): TtsAudioResult {
  return {
    audio: new Blob([label], { type: "audio/mpeg" }),
    mimeType: "audio/mpeg",
    format: "mp3",
    sampleRate: 24000,
  };
}

describe("TtsPlaybackQueue", () => {
  it("plays final subtitles in enqueue order", async () => {
    const played: string[] = [];
    const synthesizeTts = vi.fn(async (text: string) => makeAudioResult(text));
    const playAudio = vi.fn(async (audio: Blob) => {
      played.push(audio.type);
    });
    const queue = new TtsPlaybackQueue({ synthesizeTts, playAudio });

    queue.enqueue("event-1", "first subtitle");
    queue.enqueue("event-2", "second subtitle");
    await queue.drainForTest();

    expect(synthesizeTts).toHaveBeenNthCalledWith(1, "first subtitle");
    expect(synthesizeTts).toHaveBeenNthCalledWith(2, "second subtitle");
    expect(playAudio).toHaveBeenCalledTimes(2);
    expect(played).toEqual(["audio/mpeg", "audio/mpeg"]);
  });

  it("does not enqueue the same event twice", async () => {
    const synthesizeTts = vi.fn(async (text: string) => makeAudioResult(text));
    const queue = new TtsPlaybackQueue({
      synthesizeTts,
      playAudio: vi.fn(async () => undefined),
    });

    queue.enqueue("event-1", "first subtitle");
    queue.enqueue("event-1", "first subtitle");
    await queue.drainForTest();

    expect(synthesizeTts).toHaveBeenCalledOnce();
  });

  it("continues playback after synthesis fails", async () => {
    const synthesizeTts = vi
      .fn()
      .mockRejectedValueOnce(new Error("TTS failed"))
      .mockResolvedValueOnce(makeAudioResult("second subtitle"));
    const playAudio = vi.fn(async () => undefined);
    const queue = new TtsPlaybackQueue({ synthesizeTts, playAudio });

    queue.enqueue("event-1", "first subtitle");
    queue.enqueue("event-2", "second subtitle");
    await queue.drainForTest();

    expect(synthesizeTts).toHaveBeenCalledTimes(2);
    expect(playAudio).toHaveBeenCalledTimes(1);
  });

  it("clears pending subtitles", async () => {
    const playbackControl: { release: (() => void) | null } = { release: null };
    const synthesizeTts = vi.fn(async (text: string) => makeAudioResult(text));
    const playAudio = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          playbackControl.release = resolve;
        }),
    );
    const queue = new TtsPlaybackQueue({ synthesizeTts, playAudio });

    queue.enqueue("event-1", "first subtitle");
    queue.enqueue("event-2", "second subtitle");
    await vi.waitFor(() => expect(playAudio).toHaveBeenCalledOnce());
    queue.clear();
    const release = playbackControl.release;
    if (release === null) {
      throw new Error("Playback did not start");
    }
    release();
    await queue.drainForTest();

    expect(synthesizeTts).toHaveBeenCalledTimes(1);
  });
});
