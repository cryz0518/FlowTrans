export type InputSource = "microphone" | "system";
export type SubtitleEventType = "partial" | "final" | "revision";

export type SubtitleEvent = {
  event_id: string;
  session_id: string;
  event_type: SubtitleEventType;
  source_text: string;
  translated_text: string;
  replaces_event_id: string | null;
  reason: string | null;
};

export type AudioChunkOut = {
  session_id: string;
  chunk_index: number;
  captured_at_ms: number;
  input_source: InputSource;
  mime_type: string;
  payload_b64: string;
};

export type RealtimeMessage =
  | { type: "subtitle_events"; events: SubtitleEvent[] }
  | { type: "error"; message: string };
