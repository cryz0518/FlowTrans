import { Mic, MonitorUp, Play, Square } from "lucide-react";

import type { InputSource } from "../types/events";

type Props = {
  inputSource: InputSource;
  isConnected: boolean;
  onSourceChange: (source: InputSource) => void;
  onStart: () => void;
  onStop: () => void;
};

export function ControlPanel({
  inputSource,
  isConnected,
  onSourceChange,
  onStart,
  onStop,
}: Props) {
  return (
    <section className="panel controls" aria-label="同传控制">
      <div className="source-row" aria-label="输入源">
        <button
          type="button"
          className={`source-button ${inputSource === "microphone" ? "active" : ""}`}
          onClick={() => onSourceChange("microphone")}
        >
          <Mic size={18} />
          麦克风
        </button>
        <button
          type="button"
          className={`source-button ${inputSource === "system" ? "active" : ""}`}
          onClick={() => onSourceChange("system")}
        >
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
