export type SessionStatus = 
  | 'DISCONNECTED' 
  | 'CONNECTED' 
  | 'CALL_STARTING' 
  | 'CALL_ACTIVE' 
  | 'AUDIO_STREAMING' 
  | 'AUDIO_STOPPED' 
  | 'CALL_ENDED' 
  | 'ERROR';

export interface TranscriptSegment {
  session_id: string;
  segment_id: string;
  text: string;
  is_final: boolean;
  start_time: number;
  end_time: number;
  confidence: number;
  speaker: 'CALLER' | 'CALLEE' | 'UNKNOWN';
  timestamp: number;
  iso_time?: string;
}

export interface TransportMetrics {
  framesSent: number;
  bytesSent: number;
  droppedFrames: number;
  latencyMs: number;
  lastPingTime: number;
}

export interface WebSocketMessage {
  type: string;
  payload?: Record<string, any>;
  timestamp?: string;
  correlation_id?: string;
}

