import { describe, expect, it } from "vitest";

import { bytesToBase64, downsampleToMono, encodePcm16 } from "./pcm";

describe("pcm utilities", () => {
  it("downsamples mono float samples to the target sample rate", () => {
    const input = new Float32Array([0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25]);

    const output = downsampleToMono([input], 8000, 4000);

    expect(Array.from(output)).toEqual([0.125, 0.625, 0.875, 0.375]);
  });

  it("mixes stereo channels to mono while downsampling", () => {
    const left = new Float32Array([1, 1, 0, 0]);
    const right = new Float32Array([0, 0, 1, 1]);

    const output = downsampleToMono([left, right], 4000, 2000);

    expect(Array.from(output)).toEqual([0.5, 0.5]);
  });

  it("encodes float samples as little-endian pcm16 with clamping", () => {
    const bytes = encodePcm16(new Float32Array([-2, -1, 0, 0.5, 1, 2]));

    expect(Array.from(bytes)).toEqual([0, 128, 0, 128, 0, 0, 255, 63, 255, 127, 255, 127]);
  });

  it("encodes bytes to base64", () => {
    expect(bytesToBase64(new Uint8Array([97, 98, 99]))).toBe("YWJj");
  });
});
