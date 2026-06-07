import { useEffect, useState } from "react";
import { Play, Square, X } from "lucide-react";

import { splitSubtitleLines, splitSubtitleSegments } from "../services/subtitleLineBreaks";
import type { FloatingControlState, FloatingSubtitleSnapshot } from "../types/desktop";

type DisplayMode = "bilingual" | "translation";

type Props = {
  initialSnapshot?: FloatingSubtitleSnapshot;
};

const emptySnapshot: FloatingSubtitleSnapshot = { current: null };
const idleControlState: FloatingControlState = { isRunning: false };
const minSegmentDurationMs = 650;
const maxSegmentDurationMs = 1200;

export function getFloatingSegmentDurationMs(segment: string) {
  return Math.min(maxSegmentDurationMs, Math.max(minSegmentDurationMs, 360 + segment.length * 24));
}

export function FloatingSubtitleWindow({ initialSnapshot = emptySnapshot }: Props) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [controlState, setControlState] = useState(idleControlState);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("bilingual");
  const [segmentIndex, setSegmentIndex] = useState(0);

  useEffect(() => {
    return window.flowtransDesktop?.onFloatingSubtitles((nextSnapshot) => {
      setSnapshot(nextSnapshot);
    });
  }, []);

  useEffect(() => {
    return window.flowtransDesktop?.onFloatingControlState((nextState) => {
      setControlState(nextState);
    });
  }, []);

  useEffect(() => {
    setSegmentIndex(0);
  }, [snapshot.current?.displayKey]);

  const close = () => {
    void window.flowtransDesktop?.closeFloatingWindow();
  };

  const toggleRunning = () => {
    void window.flowtransDesktop?.sendFloatingControlCommand(controlState.isRunning ? "stop" : "start");
  };

  const current = snapshot.current;
  const sourceLines = current ? splitSubtitleLines(current.sourceText, 31) : [];
  const translationSegments = current ? splitSubtitleSegments(current.translatedText || "翻译中...", 18) : [];
  const activeTranslationSegment = translationSegments[Math.min(segmentIndex, translationSegments.length - 1)] ?? "";
  const translationLines = activeTranslationSegment ? splitSubtitleLines(activeTranslationSegment, 18) : [];

  useEffect(() => {
    if (translationSegments.length <= 1 || segmentIndex >= translationSegments.length - 1) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setSegmentIndex((currentIndex) => Math.min(currentIndex + 1, translationSegments.length - 1));
    }, getFloatingSegmentDurationMs(activeTranslationSegment));

    return () => window.clearTimeout(timeout);
  }, [activeTranslationSegment, segmentIndex, translationSegments.length]);

  return (
    <main className="floating-shell" aria-label="桌面悬浮翻译">
      <header className="floating-toolbar">
        <div className="floating-title-group">
          <span className="floating-title">FlowTrans 悬浮翻译</span>
          <button type="button" className="floating-run" onClick={toggleRunning}>
            {controlState.isRunning ? <Square size={14} /> : <Play size={14} />}
            {controlState.isRunning ? "停止" : "开始"}
          </button>
        </div>
        <div className="floating-actions">
          <button
            type="button"
            className={displayMode === "bilingual" ? "floating-mode active" : "floating-mode"}
            onClick={() => setDisplayMode("bilingual")}
          >
            对照
          </button>
          <button
            type="button"
            className={displayMode === "translation" ? "floating-mode active" : "floating-mode"}
            onClick={() => setDisplayMode("translation")}
          >
            只中文
          </button>
          <button type="button" className="floating-close" aria-label="关闭悬浮翻译" onClick={close}>
            <X size={16} />
          </button>
        </div>
      </header>
      <section className="floating-content" aria-label="悬浮字幕">
        {current === null ? (
          <p className="floating-empty">等待字幕同步</p>
        ) : (
          <article className="floating-current-subtitle">
            {displayMode === "bilingual" ? (
              <p className="floating-source">
                {sourceLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </p>
            ) : null}
            <p className="floating-translation">
              {translationLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          </article>
        )}
      </section>
    </main>
  );
}
