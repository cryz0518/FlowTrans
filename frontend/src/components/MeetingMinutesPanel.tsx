type MeetingMinutesStatus = "idle" | "generating" | "ready";

type Props = {
  status: MeetingMinutesStatus;
  progress: number;
  content: string;
  onGenerate: () => void;
  onSave: () => void;
};

export function MeetingMinutesPanel({ status, progress, content, onGenerate, onSave }: Props) {
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

      {content ? (
        <pre className="meeting-minutes-content">{content}</pre>
      ) : (
        <p className="meeting-minutes-empty">会议纪要将在这里展示</p>
      )}
    </section>
  );
}
