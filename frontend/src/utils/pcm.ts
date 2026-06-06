export const PCM_SAMPLE_RATE = 16000;
export const PCM_CHANNELS = 1;
export const PCM_MIME_TYPE = "audio/pcm;rate=16000;channels=1";

export function downsampleToMono(
  channels: Float32Array[],
  inputSampleRate: number,
  targetSampleRate = PCM_SAMPLE_RATE,
): Float32Array {
  if (channels.length === 0) {
    return new Float32Array();
  }
  if (inputSampleRate < targetSampleRate) {
    throw new Error("inputSampleRate must be greater than or equal to targetSampleRate");
  }

  const sourceLength = channels[0].length;
  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.floor(sourceLength / ratio);
  const output = new Float32Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(Math.floor((outputIndex + 1) * ratio), sourceLength);
    let sum = 0;
    let count = 0;

    for (let index = start; index < end; index += 1) {
      for (const channel of channels) {
        sum += channel[index] ?? 0;
      }
      count += channels.length;
    }

    output[outputIndex] = count > 0 ? sum / count : 0;
  }

  return output;
}

export function encodePcm16(samples: Float32Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);

  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    const value = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(index * 2, value, true);
  });

  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
