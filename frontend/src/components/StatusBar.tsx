type Props = {
  status: string;
};

export function StatusBar({ status }: Props) {
  const label = status === "connected" ? "实时连接中" : "等待音频输入";
  return (
    <section className="status-bar" aria-label="状态">
      <span className="status-dot" />
      {label}
    </section>
  );
}
