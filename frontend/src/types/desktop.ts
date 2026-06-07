export type FloatingSubtitleItem = {
  eventId: string;
  displayKey: string;
  sourceText: string;
  translatedText: string;
};

export type FloatingSubtitleSnapshot = {
  current: FloatingSubtitleItem | null;
};

export type FlowTransDesktopApi = {
  openFloatingWindow: () => Promise<void>;
  closeFloatingWindow: () => Promise<void>;
  sendFloatingSubtitles: (snapshot: FloatingSubtitleSnapshot) => Promise<void>;
  onFloatingSubtitles: (listener: (snapshot: FloatingSubtitleSnapshot) => void) => () => void;
};

declare global {
  interface Window {
    flowtransDesktop?: FlowTransDesktopApi;
  }
}

export {};
