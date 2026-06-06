import { Mic, MonitorUp, Play, Square } from "lucide-react";

type Props = {
  isConnected: boolean;
  onStart: () => void;
  onStop: () => void;
};

export function ControlPanel({ isConnected, onStart, onStop }: Props) {
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
      <button type="button" className="primary-button" onClick={isConnected ? onStop : onStart}>
        {isConnected ? <Square size={18} /> : <Play size={18} />}
        {isConnected ? "停止" : "开始"}
      </button>
    </section>
  );
}
