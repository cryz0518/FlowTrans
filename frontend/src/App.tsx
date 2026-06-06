import { useRef, useState } from "react";

import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import type { InputSource } from "./types/events";

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = Array.from(new Uint8Array(buffer));
  return btoa(String.fromCharCode(...bytes));
}

export function App() {
  const [inputSource, setInputSource] = useState<InputSource>("microphone");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const chunkIndexRef = useRef(0);
  const session = useRealtimeSession();
  const capture = useAudioCapture();
  const isConnected = session.connectionStatus === "connected";

  const start = async () => {
    session.connect();
    await capture.start(inputSource, async (blob) => {
      session.sendChunk({
        session_id: "browser-session",
        chunk_index: chunkIndexRef.current,
        captured_at_ms: Date.now(),
        input_source: inputSource,
        mime_type: blob.type || "audio/webm",
        payload_b64: await blobToBase64(blob),
      });
      chunkIndexRef.current += 1;
    });
  };

  const stop = () => {
    capture.stop();
    session.disconnect();
    chunkIndexRef.current = 0;
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar status={capture.captureStatus === "recording" ? "connected" : session.connectionStatus} />
      <div className="workbench">
        <ControlPanel
          inputSource={inputSource}
          isConnected={isConnected || capture.captureStatus === "recording"}
          ttsEnabled={ttsEnabled}
          onSourceChange={setInputSource}
          onTtsChange={setTtsEnabled}
          onStart={start}
          onStop={stop}
        />
        <SubtitlePanel subtitles={session.subtitles} />
      </div>
    </main>
  );
}
