import { useRef, useState } from "react";

import type { InputSource } from "../types/events";
import { PCM_MIME_TYPE, PCM_SAMPLE_RATE, bytesToBase64, downsampleToMono, encodePcm16 } from "../utils/pcm";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type CaptureStatus = "idle" | "recording" | "error";

export type PcmAudioChunk = {
  mimeType: string;
  payloadB64: string;
};

const CHUNK_DURATION_MS = 160;
const SCRIPT_PROCESSOR_SIZE = 4096;

export function useAudioCapture() {
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingSamplesRef = useRef<number[]>([]);

  const flushPcm = (onChunk: (chunk: PcmAudioChunk) => void) => {
    const samples = pendingSamplesRef.current;
    if (samples.length === 0) {
      return;
    }

    pendingSamplesRef.current = [];
    const bytes = encodePcm16(Float32Array.from(samples));
    onChunk({
      mimeType: PCM_MIME_TYPE,
      payloadB64: bytesToBase64(bytes),
    });
  };

  const start = async (source: InputSource, onChunk: (chunk: PcmAudioChunk) => void) => {
    try {
      const stream =
        source === "system"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextCtor) {
        throw new Error("AudioContext is not supported");
      }
      const audioContext = new AudioContextCtor();
      const mediaSource = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(SCRIPT_PROCESSOR_SIZE, 1, 1);
      const samplesPerChunk = Math.floor((PCM_SAMPLE_RATE * CHUNK_DURATION_MS) / 1000);

      processor.onaudioprocess = (event) => {
        const channels = Array.from({ length: event.inputBuffer.numberOfChannels }, (_, index) =>
          event.inputBuffer.getChannelData(index),
        );
        const pcmSamples = downsampleToMono(channels, audioContext.sampleRate, PCM_SAMPLE_RATE);
        pendingSamplesRef.current.push(...pcmSamples);

        while (pendingSamplesRef.current.length >= samplesPerChunk) {
          const chunkSamples = pendingSamplesRef.current.splice(0, samplesPerChunk);
          const bytes = encodePcm16(Float32Array.from(chunkSamples));
          onChunk({
            mimeType: PCM_MIME_TYPE,
            payloadB64: bytesToBase64(bytes),
          });
        }
      };

      mediaSource.connect(processor);
      processor.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      sourceRef.current = mediaSource;
      processorRef.current = processor;
      setCaptureStatus("recording");
    } catch {
      setCaptureStatus("error");
    }
  };

  const stop = () => {
    const processor = processorRef.current;
    const audioContext = audioContextRef.current;

    processorRef.current = null;
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    processor?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    pendingSamplesRef.current = [];
    void audioContext?.close();
    audioContextRef.current = null;
    setCaptureStatus("idle");
  };

  return {
    captureStatus,
    flushPcm,
    start,
    stop,
  };
}
