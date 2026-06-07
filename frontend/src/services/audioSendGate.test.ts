import { describe, expect, it } from "vitest";

import { shouldSendCapturedAudio } from "./audioSendGate";

describe("shouldSendCapturedAudio", () => {
  it("drops system audio while TTS playback is active to avoid loopback feedback", () => {
    expect(shouldSendCapturedAudio("system", true)).toBe(false);
  });

  it("keeps microphone audio while TTS playback is active", () => {
    expect(shouldSendCapturedAudio("microphone", true)).toBe(true);
  });

  it("keeps system audio when TTS playback is idle", () => {
    expect(shouldSendCapturedAudio("system", false)).toBe(true);
  });
});
