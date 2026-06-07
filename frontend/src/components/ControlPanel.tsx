import { Captions, FileText, Languages, Mic, MonitorUp, Play, Square, Volume2 } from "lucide-react";

import type { InputSource } from "../types/events";

type Props = {
  inputSource: InputSource;
  isConnected: boolean;
  ttsEnabled: boolean;
  floatingEnabled?: boolean;
  desktopControlsAvailable?: boolean;
  onSourceChange: (source: InputSource) => void;
  onTtsChange: (enabled: boolean) => void;
  onFloatingChange?: (enabled: boolean) => void;
  onTranslationOpen: () => void;
  onMeetingMinutesOpen: () => void;
  onStart: () => void;
  onStop: () => void;
};

export function ControlPanel({
  inputSource,
  isConnected,
  ttsEnabled,
  floatingEnabled = false,
  desktopControlsAvailable = false,
  onSourceChange,
  onTtsChange,
  onFloatingChange,
  onTranslationOpen,
  onMeetingMinutesOpen,
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
      <label className="toggle-row">
        <Volume2 size={18} />
        <span>中文语音</span>
        <input
          type="checkbox"
          checked={ttsEnabled}
          onChange={(event) => onTtsChange(event.target.checked)}
        />
      </label>
      {desktopControlsAvailable ? (
        <label className="toggle-row">
          <Captions size={18} />
          <span>桌面悬浮翻译</span>
          <input
            type="checkbox"
            aria-label="desktop-floating-translation"
            checked={floatingEnabled}
            onChange={(event) => onFloatingChange?.(event.target.checked)}
          />
        </label>
      ) : null}
      <button type="button" className="source-button" onClick={onTranslationOpen}>
        <Languages size={18} />
        实时翻译
      </button>
      <button type="button" className="source-button" onClick={onMeetingMinutesOpen}>
        <FileText size={18} />
        会议纪要
      </button>
      <button type="button" className="primary-button" onClick={isConnected ? onStop : onStart}>
        {isConnected ? <Square size={18} /> : <Play size={18} />}
        {isConnected ? "停止" : "开始"}
      </button>
    </section>
  );
}
