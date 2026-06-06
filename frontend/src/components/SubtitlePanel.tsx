import type { SubtitleEvent } from "../types/events";

type Props = {
  subtitles: SubtitleEvent[];
};

export function SubtitlePanel({ subtitles }: Props) {
  return (
    <section className="panel subtitle-panel" aria-label="字幕">
      {subtitles.length === 0 ? (
        <p className="subtitle-empty">中文字幕将在这里实时显示</p>
      ) : (
        <div className="subtitle-list">
          {subtitles.map((item) => (
            <article key={item.event_id} className={`subtitle-item ${item.event_type}`}>
              <p>{item.translated_text}</p>
              {item.source_text ? <small>{item.source_text}</small> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
