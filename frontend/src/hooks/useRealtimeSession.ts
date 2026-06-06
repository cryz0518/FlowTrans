import { useEffect, useMemo, useRef, useState } from "react";

import { RealtimeClient } from "../services/realtimeClient";
import { TtsPlaybackQueue } from "../services/ttsPlaybackQueue";
import type { AudioChunkOut, SubtitleEvent } from "../types/events";

type ConnectionStatus = "idle" | "connected" | "disconnected" | "error";

type RealtimeSessionOptions = {
  ttsEnabled?: boolean;
};

export function useRealtimeSession(
  url = "ws://127.0.0.1:8000/ws/realtime",
  options: RealtimeSessionOptions = {},
) {
  const { ttsEnabled = false } = options;
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [subtitles, setSubtitles] = useState<SubtitleEvent[]>([]);
  const clientRef = useRef<RealtimeClient | null>(null);
  const playbackQueueRef = useRef(new TtsPlaybackQueue());
  const ttsEnabledRef = useRef(ttsEnabled);

  useEffect(() => {
    ttsEnabledRef.current = ttsEnabled;
    if (!ttsEnabled) {
      playbackQueueRef.current.clear();
    }
  }, [ttsEnabled]);

  const applyEvents = (events: SubtitleEvent[]) => {
    if (ttsEnabledRef.current) {
      for (const event of events) {
        if (event.event_type === "final") {
          playbackQueueRef.current.enqueue(event.event_id, event.translated_text);
        }
      }
    }

    setSubtitles((current) => {
      let next = [...current];
      for (const event of events) {
        if (event.event_type === "revision" && event.replaces_event_id) {
          next = next.map((item) =>
            item.event_id === event.replaces_event_id
              ? { ...item, translated_text: event.translated_text, reason: event.reason }
              : item,
          );
        } else if (event.event_type === "final") {
          next = [...next.filter((item) => item.event_type !== "partial" && item.event_id !== event.event_id), event];
        } else {
          next = [...next.filter((item) => item.event_type !== "partial" && item.event_id !== event.event_id), event];
        }
      }
      return next;
    });
  };

  const client = useMemo(
    () =>
      new RealtimeClient(url, {
        onOpen: () => setConnectionStatus("connected"),
        onClose: () => setConnectionStatus("disconnected"),
        onMessage: (message) => {
          if (message.type === "subtitle_events") {
            applyEvents(message.events);
          } else {
            setConnectionStatus("error");
          }
        },
      }),
    [url],
  );

  const connect = () => {
    clientRef.current = client;
    client.connect();
  };

  const disconnect = () => {
    clientRef.current?.close();
    playbackQueueRef.current.clear();
    setConnectionStatus("idle");
  };

  const sendChunk = (chunk: AudioChunkOut) => {
    clientRef.current?.sendChunk(chunk);
  };

  return {
    connectionStatus,
    subtitles,
    connect,
    disconnect,
    sendChunk,
  };
}
