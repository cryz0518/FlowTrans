type Props = {
  status: string;
  detail?: string;
};

export function StatusBar({ status, detail }: Props) {
  const label = status === "connected" ? "实时连接中" : status === "error" ? "连接或采集失败" : "等待音频输入";

  return (
    <section className="status-bar" aria-label="状态">
      <span className="status-dot" />
      <span>{label}</span>
      {detail ? <span className="status-detail">{detail}</span> : null}
    </section>
  );
}
