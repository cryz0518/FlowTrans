import { useState } from "react";

import type { SubtitleEvent } from "../types/events";

type Props = {
  subtitles: SubtitleEvent[];
};

type SubtitleColumn = "source" | "translation";

type SelectionState = {
  eventId: string;
  column: SubtitleColumn;
} | null;

function segmentClassName(item: SubtitleEvent, column: SubtitleColumn, selection: SelectionState) {
  const classes = ["subtitle-segment", item.event_type];
  if (selection?.eventId === item.event_id) {
    classes.push(selection.column === column ? "selected-primary" : "selected-linked");
  }
  return classes.join(" ");
}

function translationText(item: SubtitleEvent) {
  if (item.translated_text.trim()) {
    return item.translated_text;
  }
  return "翻译中...";
}

export function SubtitlePanel({ subtitles }: Props) {
  const [selection, setSelection] = useState<SelectionState>(null);

  return (
    <section className="panel subtitle-panel" aria-label="双语字幕">
      <div className="subtitle-columns">
        <div className="subtitle-column" aria-label="英文列表">
          <h2>英文</h2>
          <div className="subtitle-list">
            {subtitles.length === 0 ? <p className="subtitle-empty">英文将在这里实时显示</p> : null}
            {subtitles.map((item) => (
              <button
                key={`${item.event_id}-source`}
                type="button"
                className={segmentClassName(item, "source", selection)}
                aria-label={`英文：${item.source_text}`}
                onClick={() => setSelection({ eventId: item.event_id, column: "source" })}
              >
                <span>{item.source_text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="subtitle-column" aria-label="中文列表">
          <h2>中文</h2>
          <div className="subtitle-list">
            {subtitles.length === 0 ? <p className="subtitle-empty">中文将在这里实时显示</p> : null}
            {subtitles.map((item) => (
              <button
                key={`${item.event_id}-translation`}
                type="button"
                className={segmentClassName(item, "translation", selection)}
                aria-label={`中文：${translationText(item)}`}
                onClick={() => setSelection({ eventId: item.event_id, column: "translation" })}
              >
                <span>{translationText(item)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
