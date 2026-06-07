import React from "react";
import ReactDOM from "react-dom/client";
import { X } from "lucide-react";

import "./floating.css";
import "./types/desktop";

function FloatingApp() {
  const close = () => {
    void window.flowtransDesktop?.closeFloatingWindow();
  };

  return (
    <main className="floating-shell" aria-label="桌面悬浮翻译">
      <header className="floating-toolbar">
        <span className="floating-title">FlowTrans 悬浮翻译</span>
        <button type="button" className="floating-close" aria-label="关闭悬浮翻译" onClick={close}>
          <X size={16} />
        </button>
      </header>
      <section className="floating-content" aria-label="悬浮字幕">
        <p className="floating-source">English subtitles will appear here.</p>
        <p className="floating-translation">中文字幕将在这里实时显示</p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("floating-root") as HTMLElement).render(
  <React.StrictMode>
    <FloatingApp />
  </React.StrictMode>,
);
