import type { AudioChunkOut, RealtimeMessage } from "../types/events";

type Handlers = {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (message: RealtimeMessage) => void;
};

export class RealtimeClient {
  private socket: WebSocket | null = null;

  constructor(
    private readonly url: string,
    private readonly handlers: Handlers,
  ) {}

  connect() {
    this.socket = new WebSocket(this.url);
    this.socket.onopen = this.handlers.onOpen;
    this.socket.onclose = this.handlers.onClose;
    this.socket.onmessage = (event) => {
      this.handlers.onMessage(JSON.parse(event.data) as RealtimeMessage);
    };
  }

  sendChunk(chunk: AudioChunkOut) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(chunk));
    }
  }

  close() {
    this.socket?.close();
    this.socket = null;
  }
}
