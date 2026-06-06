import { useMemo, useRef, useState } from "react";

import { RealtimeClient } from "../services/realtimeClient";
import type { AudioChunkOut, SubtitleEvent } from "../types/events";

type ConnectionStatus = "idle" | "connected" | "disconnected" | "error";

export function useRealtimeSession(url = "ws://127.0.0.1:8000/ws/realtime") {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("idle");
  const [subtitles, setSubtitles] = useState<SubtitleEvent[]>([]);
  const clientRef = useRef<RealtimeClient | null>(null);

  const applyEvents = (events: SubtitleEvent[]) => {
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
          next = [...next.filter((item) => item.event_type !== "partial"), event];
        } else {
          next = [...next.filter((item) => item.event_type !== "partial"), event];
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
