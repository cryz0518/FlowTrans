import { useRef, useState } from "react";

import type { InputSource } from "../types/events";

type CaptureStatus = "idle" | "recording" | "error";

export function useAudioCapture() {
  const [captureStatus, setCaptureStatus] = useState<CaptureStatus>("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = async (source: InputSource, onBlob: (blob: Blob) => void) => {
    try {
      const stream =
        source === "system"
          ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
          : await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onBlob(event.data);
        }
      };
      recorder.start(500);
      recorderRef.current = recorder;
      setCaptureStatus("recording");
    } catch {
      setCaptureStatus("error");
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    recorderRef.current = null;
    streamRef.current = null;
    setCaptureStatus("idle");
  };

  return {
    captureStatus,
    start,
    stop,
  };
}
