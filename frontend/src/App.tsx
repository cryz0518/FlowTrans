import { useCallback, useEffect, useRef, useState } from "react";

import { ControlPanel } from "./components/ControlPanel";
import { MeetingMinutesPanel } from "./components/MeetingMinutesPanel";
import { StatusBar } from "./components/StatusBar";
import { SubtitlePanel } from "./components/SubtitlePanel";
import { useAudioCapture } from "./hooks/useAudioCapture";
import { useRealtimeSession } from "./hooks/useRealtimeSession";
import { shouldSendCapturedAudio } from "./services/audioSendGate";
import { toFloatingSubtitleSnapshot } from "./services/floatingSubtitles";
import { downloadMeetingMinutes } from "./services/meetingMinutes";
import { generateMeetingMinutes as generateMeetingMinutesWithAi } from "./services/meetingMinutesClient";
import "./types/desktop";
import type { InputSource } from "./types/events";

type ActiveView = "subtitles" | "minutes";
type MeetingMinutesStatus = "idle" | "generating" | "ready";

export function App() {
  const [inputSource, setInputSource] = useState<InputSource>("microphone");
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [floatingEnabled, setFloatingEnabled] = useState(false);
  const [runningRequested, setRunningRequested] = useState(false);
  const [activeView, setActiveView] = useState<ActiveView>("subtitles");
  const [meetingMinutesStatus, setMeetingMinutesStatus] = useState<MeetingMinutesStatus>("idle");
  const [meetingMinutesProgress, setMeetingMinutesProgress] = useState(0);
  const [meetingMinutesContent, setMeetingMinutesContent] = useState("");
  const chunkIndexRef = useRef(0);
  const ttsPlaybackActiveRef = useRef(false);
  const session = useRealtimeSession("ws://127.0.0.1:8000/ws/realtime", { ttsEnabled });
  const capture = useAudioCapture();
  const isConnected = session.connectionStatus === "connected";
  const isRunning = runningRequested || isConnected || capture.captureStatus === "recording";
  ttsPlaybackActiveRef.current = session.ttsPlaybackActive;
  const desktopControlsAvailable = window.flowtransDesktop !== undefined;

  const setFloatingWindowEnabled = async (enabled: boolean) => {
    setFloatingEnabled(enabled);
    if (enabled) {
      await window.flowtransDesktop?.openFloatingWindow();
    } else {
      await window.flowtransDesktop?.closeFloatingWindow();
    }
  };

  useEffect(() => {
    if (desktopControlsAvailable) {
      void window.flowtransDesktop?.sendFloatingSubtitles(toFloatingSubtitleSnapshot(session.subtitles));
    }
  }, [desktopControlsAvailable, session.subtitles]);

  useEffect(() => {
    if (desktopControlsAvailable) {
      void window.flowtransDesktop?.sendFloatingControlState({ isRunning, ttsEnabled });
    }
  }, [desktopControlsAvailable, isRunning, ttsEnabled]);

  useEffect(() => {
    if (capture.captureStatus === "error") {
      setRunningRequested(false);
    }
  }, [capture.captureStatus]);

  const start = useCallback(async () => {
    setRunningRequested(true);
    session.connect();
    await capture.start(inputSource, (audio) => {
      if (!shouldSendCapturedAudio(inputSource, ttsPlaybackActiveRef.current)) {
        return;
      }

      session.sendChunk({
        session_id: "browser-session",
        chunk_index: chunkIndexRef.current,
        captured_at_ms: Date.now(),
        input_source: inputSource,
        mime_type: audio.mimeType,
        payload_b64: audio.payloadB64,
      });
      chunkIndexRef.current += 1;
    });
  }, [capture, inputSource, session]);

  const generateMeetingMinutes = useCallback(() => {
    setActiveView("minutes");
    setMeetingMinutesStatus("generating");
    setMeetingMinutesProgress(35);

    window.setTimeout(async () => {
      try {
        const markdown = await generateMeetingMinutesWithAi(session.subtitles);
        setMeetingMinutesContent(markdown);
      } catch (error) {
        setMeetingMinutesContent(
          [
            "# 会议纪要生成失败",
            "",
            error instanceof Error ? error.message : "Meeting minutes generation failed",
          ].join("\n"),
        );
      }
      setMeetingMinutesProgress(100);
      setMeetingMinutesStatus("ready");
    }, 200);
  }, [session.subtitles]);

  const saveMeetingMinutes = useCallback(() => {
    if (meetingMinutesContent) {
      downloadMeetingMinutes(meetingMinutesContent);
    }
  }, [meetingMinutesContent]);

  const stop = useCallback((options: { askMeetingMinutes?: boolean } = {}) => {
    setRunningRequested(false);
    capture.stop();
    session.disconnect();
    chunkIndexRef.current = 0;

    if (options.askMeetingMinutes !== false && window.confirm("是否要生成会议纪要？")) {
      generateMeetingMinutes();
    }
  }, [capture, generateMeetingMinutes, session]);

  useEffect(() => {
    if (!desktopControlsAvailable) {
      return undefined;
    }

    return window.flowtransDesktop?.onFloatingControlCommand((command) => {
      if (command === "start") {
        void start();
      } else if (command === "stop") {
        stop({ askMeetingMinutes: false });
      } else if (command.type === "tts") {
        setTtsEnabled(command.enabled);
      }
    });
  }, [desktopControlsAvailable, start, stop]);

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>FlowTrans</h1>
          <p>AI 实时同声传译助手</p>
        </div>
      </header>
      <StatusBar
        status={capture.captureStatus === "recording" ? "connected" : session.connectionStatus}
        detail={capture.captureError ?? undefined}
      />
      <div className="workbench">
        <ControlPanel
          inputSource={inputSource}
          isConnected={isRunning}
          ttsEnabled={ttsEnabled}
          floatingEnabled={floatingEnabled}
          desktopControlsAvailable={desktopControlsAvailable}
          onSourceChange={setInputSource}
          onTtsChange={setTtsEnabled}
          onFloatingChange={setFloatingWindowEnabled}
          onTranslationOpen={() => setActiveView("subtitles")}
          onMeetingMinutesOpen={() => setActiveView("minutes")}
          onStart={start}
          onStop={stop}
        />
        {activeView === "minutes" ? (
          <MeetingMinutesPanel
            status={meetingMinutesStatus}
            progress={meetingMinutesProgress}
            content={meetingMinutesContent}
            onGenerate={generateMeetingMinutes}
            onSave={saveMeetingMinutes}
          />
        ) : (
          <SubtitlePanel subtitles={session.subtitles} />
        )}
      </div>
    </main>
  );
}
