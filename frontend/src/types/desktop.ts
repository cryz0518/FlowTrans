export type FloatingSubtitleItem = {
  eventId: string;
  displayKey: string;
  sourceText: string;
  translatedText: string;
};

export type FloatingSubtitleSnapshot = {
  current: FloatingSubtitleItem | null;
};

export type FloatingControlState = {
  isRunning: boolean;
  ttsEnabled: boolean;
};

export type FloatingControlCommand = "start" | "stop" | { type: "tts"; enabled: boolean };

export type FlowTransDesktopApi = {
  openFloatingWindow: () => Promise<void>;
  closeFloatingWindow: () => Promise<void>;
  sendFloatingSubtitles: (snapshot: FloatingSubtitleSnapshot) => Promise<void>;
  sendFloatingControlState: (state: FloatingControlState) => Promise<void>;
  sendFloatingControlCommand: (command: FloatingControlCommand) => Promise<void>;
  onFloatingSubtitles: (listener: (snapshot: FloatingSubtitleSnapshot) => void) => () => void;
  onFloatingControlState: (listener: (state: FloatingControlState) => void) => () => void;
  onFloatingControlCommand: (listener: (command: FloatingControlCommand) => void) => () => void;
};

declare global {
  interface Window {
    flowtransDesktop?: FlowTransDesktopApi;
  }
}

export {};
