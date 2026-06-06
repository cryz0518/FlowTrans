import { ControlPanel } from "./components/ControlPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";

export function App() {
  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar />
      <div className="workbench">
        <ControlPanel />
        <SubtitlePanel />
      </div>
    </main>
  );
}
