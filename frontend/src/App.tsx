import { useRef, useState } from "react";

import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import type { InputSource } from "./types/events";

export function App() {
  const [inputSource, setInputSource] = useState<InputSource>("microphone");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const chunkIndexRef = useRef(0);
  const session = useRealtimeSession("ws://127.0.0.1:8000/ws/realtime", { ttsEnabled });
  const capture = useAudioCapture();
  const isConnected = session.connectionStatus === "connected";

  const start = async () => {
    session.connect();
    await capture.start(inputSource, (audio) => {
      session.sendChunk({
        session_id: "browser-session",
        chunk_index: chunkIndexRef.current,
        captured_at_ms: Date.now(),
        input_source: inputSource,
        mime_type: audio.mimeType,
        payload_b64: audio.payloadB64,
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
      <StatusBar
        status={capture.captureStatus === "recording" ? "connected" : session.connectionStatus}
        detail={capture.captureError ?? undefined}
      />
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
