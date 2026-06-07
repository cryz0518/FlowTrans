export type TtsAudioResult = {
  audio: Blob;
  mimeType: string;
  format: string | null;
  sampleRate: number | null;
};

type SynthesizeTtsOptions = {
  apiBaseUrl?: string;
};

export async function synthesizeTts(
  text: string,
  options: SynthesizeTtsOptions = {},
): Promise<TtsAudioResult> {
  if (!text.trim()) {
    throw new Error("TTS text must not be empty");
  }

  const endpoint = buildTtsEndpoint(options.apiBaseUrl);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS synthesis failed: ${await readErrorMessage(response)}`);
  }

  const mimeType = response.headers.get("Content-Type") ?? "application/octet-stream";
  const audio = await response.blob();
  return {
    audio,
    mimeType,
    format: response.headers.get("X-Audio-Format"),
    sampleRate: parseSampleRate(response.headers.get("X-Sample-Rate")),
  };
}

function buildTtsEndpoint(apiBaseUrl?: string): string {
  const baseUrl = (apiBaseUrl ?? defaultApiBaseUrl()).replace(/\/$/, "");
  return `${baseUrl}/api/tts/synthesize`;
}

function defaultApiBaseUrl(): string {
  if (globalThis.location?.protocol === "file:") {
    return "http://127.0.0.1:8000";
  }
  return "";
}

function parseSampleRate(value: string | null): number | null {
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    return response.statusText || String(response.status);
  }
  return response.statusText || String(response.status);
}
