import React from "react";
import ReactDOM from "react-dom/client";

import { FloatingSubtitleWindow } from "./components/FloatingSubtitleWindow";
import "./floating.css";
import "./types/desktop";

ReactDOM.createRoot(document.getElementById("floating-root") as HTMLElement).render(
  <React.StrictMode>
    <FloatingSubtitleWindow />
  </React.StrictMode>,
);
