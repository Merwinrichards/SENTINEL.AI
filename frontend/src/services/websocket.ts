import { WebSocketMessage } from '../types/audio';

export type MessageHandler = (message: WebSocketMessage) => void;
export type BinaryHandler = (data: ArrayBuffer) => void;
export type StatusHandler = (connected: boolean) => void;

export class SentinelWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new StatusHandlerSet();
  private isExplicitlyClosed = false;
  private reconnectTimeout: number | null = null;
  private heartbeatInterval: number | null = null;
  private pingStartTime = 0;
  public latencyMs = 0;

  constructor(url?: string) {
    if (url) {
      this.url = url;
    } else {
      const loc = window.location;
      const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' ? '127.0.0.1:8000' : loc.host;
      this.url = `${protocol}//${host}/ws`;
    }
  }

  public connect(): void {
    this.isExplicitlyClosed = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        this.notifyStatus(true);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        if (typeof event.data === 'string') {
          try {
            const msg: WebSocketMessage = JSON.parse(event.data);
            if (msg.type === 'PONG') {
              this.latencyMs = Math.max(1, Math.round(performance.now() - this.pingStartTime));
            }
            this.messageHandlers.forEach(h => h(msg));
          } catch (err) {
            console.error('Failed to parse WebSocket JSON:', err);
          }
        }
      };

      this.ws.onclose = () => {
        this.notifyStatus(false);
        this.stopHeartbeat();
        if (!this.isExplicitlyClosed) {
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket encountered an error:', err);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus(false);
  }

  public sendJSON(message: WebSocketMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify(message));
    return true;
  }

  public sendBinary(data: ArrayBuffer | Blob): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(data);
    return true;
  }

  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    if (this.ws) {
      handler(this.ws.readyState === WebSocket.OPEN);
    }
    return () => this.statusHandlers.delete(handler);
  }

  private notifyStatus(connected: boolean): void {
    this.statusHandlers.forEach(h => h(connected));
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.pingStartTime = performance.now();
        this.sendJSON({ type: 'PING', payload: {} });
      }
    }, 10000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      if (!this.isExplicitlyClosed) {
        this.connect();
      }
    }, 3000);
  }
}

class StatusHandlerSet extends Set<StatusHandler> {}

