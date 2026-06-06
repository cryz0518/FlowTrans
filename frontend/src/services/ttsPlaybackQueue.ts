import { synthesizeTts as defaultSynthesizeTts } from "./ttsClient";
import type { TtsAudioResult } from "./ttsClient";

type TtsPlaybackQueueItem = {
  eventId: string;
  text: string;
};

type TtsPlaybackQueueOptions = {
  synthesizeTts?: (text: string) => Promise<TtsAudioResult>;
  playAudio?: (audio: Blob) => Promise<void>;
};

export class TtsPlaybackQueue {
  private readonly synthesizeTts: (text: string) => Promise<TtsAudioResult>;
  private readonly playAudio: (audio: Blob) => Promise<void>;
  private readonly queuedEventIds = new Set<string>();
  private queue: TtsPlaybackQueueItem[] = [];
  private processing: Promise<void> | null = null;

  constructor(options: TtsPlaybackQueueOptions = {}) {
    this.synthesizeTts = options.synthesizeTts ?? defaultSynthesizeTts;
    this.playAudio = options.playAudio ?? playBlobAudio;
  }

  enqueue(eventId: string, text: string) {
    if (!text.trim() || this.queuedEventIds.has(eventId)) {
      return;
    }

    this.queuedEventIds.add(eventId);
    this.queue.push({ eventId, text });
    this.processing ??= this.processQueue();
  }

  clear() {
    this.queue = [];
    this.queuedEventIds.clear();
  }

  async drainForTest() {
    await this.processing;
  }

  private async processQueue() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) {
        continue;
      }

      try {
        const result = await this.synthesizeTts(item.text);
        await this.playAudio(result.audio);
      } catch (error) {
        console.warn("TTS playback skipped", error);
        continue;
      }
    }
    this.processing = null;
  }
}

async function playBlobAudio(audio: Blob): Promise<void> {
  const url = URL.createObjectURL(audio);
  const element = new Audio(url);
  try {
    await new Promise<void>((resolve, reject) => {
      element.onended = () => resolve();
      element.onerror = () => reject(new Error("TTS audio playback failed"));
      const playResult = element.play();
      playResult.catch(reject);
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
