import { Mic, MonitorUp, Play } from "lucide-react";

export function ControlPanel() {
  return (
    <section className="panel controls" aria-label="同传控制">
      <div className="source-row" aria-label="输入源">
        <button type="button" className="source-button active">
          <Mic size={18} />
          麦克风
        </button>
        <button type="button" className="source-button">
          <MonitorUp size={18} />
          系统音频
        </button>
      </div>
      <button type="button" className="primary-button">
        <Play size={18} />
        开始
      </button>
    </section>
  );
}
