import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";
import { useRealtimeSession } from "./hooks/useRealtimeSession";

export function App() {
  const session = useRealtimeSession();
  const isConnected = session.connectionStatus === "connected";

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar status={session.connectionStatus} />
      <div className="workbench">
        <ControlPanel
          isConnected={isConnected}
          onStart={session.connect}
          onStop={session.disconnect}
        />
        <SubtitlePanel subtitles={session.subtitles} />
      </div>
    </main>
  );
}
