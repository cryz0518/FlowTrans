import type { MeetingMinutesHistoryRecord } from "../services/meetingMinutesHistory";

type MeetingMinutesStatus = "idle" | "generating" | "ready";

type Props = {
  status: MeetingMinutesStatus;
  progress: number;
  content: string;
  historyRecords: MeetingMinutesHistoryRecord[];
  selectedHistoryId: string | null;
  onGenerate: () => void;
  onSave: () => void;
  onHistorySelect: (id: string) => void;
  onHistoryDelete: (id: string) => void;
};

export function MeetingMinutesPanel({
  status,
  progress,
  content,
  historyRecords,
  selectedHistoryId,
  onGenerate,
  onSave,
  onHistorySelect,
  onHistoryDelete,
}: Props) {
  const selectedHistory = historyRecords.find((item) => item.id === selectedHistoryId) ?? null;

  return (
    <section className="panel meeting-minutes-panel" aria-label="会议纪要">
      <div className="meeting-minutes-header">
        <div>
          <h2>会议纪要</h2>
          <p>根据本次实时字幕生成会议摘要</p>
        </div>
        <div className="meeting-minutes-actions">
          <button type="button" className="source-button" onClick={onGenerate} disabled={status === "generating"}>
            生成会议纪要
          </button>
          <button type="button" className="primary-button" onClick={onSave} disabled={!content || status === "generating"}>
            保存到本地
          </button>
        </div>
      </div>

      {status === "generating" ? (
        <div className="meeting-minutes-progress">
          <span>正在生成会议纪要...</span>
          <progress aria-label="会议纪要生成进度" aria-valuenow={progress} value={progress} max={100} />
        </div>
      ) : null}

      <div className="meeting-minutes-workspace">
        <aside className="meeting-minutes-history" aria-label="历史会议纪要">
          <h3>历史会议纪要</h3>
          {historyRecords.length === 0 ? <p className="meeting-minutes-empty">暂无历史会议纪要</p> : null}
          {historyRecords.map((item) => (
            <div className="meeting-minutes-history-item" key={item.id}>
              <button
                type="button"
                className={`history-item-button ${item.id === selectedHistoryId ? "active" : ""}`}
                onClick={() => onHistorySelect(item.id)}
              >
                <span>{item.title}</span>
                <time dateTime={item.createdAt}>{formatHistoryTime(item.createdAt)}</time>
              </button>
              <button
                type="button"
                className="history-delete-button"
                aria-label={`删除 ${item.title}`}
                onClick={() => onHistoryDelete(item.id)}
              >
                删除
              </button>
            </div>
          ))}
        </aside>

        <div className="meeting-minutes-detail">
          {content ? (
            <pre className="meeting-minutes-content">{content}</pre>
          ) : (
            <p className="meeting-minutes-empty">会议纪要将在这里展示</p>
          )}

          {selectedHistory ? (
            <section className="meeting-minutes-transcript" aria-label="历史翻译对照">
              <h3>历史翻译对照</h3>
              {selectedHistory.subtitles.length === 0 ? (
                <p className="meeting-minutes-empty">暂无历史翻译对照</p>
              ) : (
                <div className="history-transcript-list">
                  {selectedHistory.subtitles.map((item) => (
                    <div className="history-transcript-row" key={item.eventId}>
                      <p>{item.sourceText}</p>
                      <p>{item.translatedText}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function formatHistoryTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}
