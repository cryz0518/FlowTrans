export type FlowTransDesktopApi = {
  openFloatingWindow: () => Promise<void>;
  closeFloatingWindow: () => Promise<void>;
};

declare global {
  interface Window {
    flowtransDesktop?: FlowTransDesktopApi;
  }
}

export {};
