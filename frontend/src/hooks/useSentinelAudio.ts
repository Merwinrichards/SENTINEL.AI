import { useCallback, useEffect, useRef, useState } from 'react';
import { SentinelWebSocketClient } from '../services/websocket';
import { SessionStatus, TranscriptSegment, TransportMetrics, WebSocketMessage } from '../types/audio';
import { useMediaRecorder } from './useMediaRecorder';

export function useSentinelAudio() {
  const [isConnected, setIsConnected] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('DISCONNECTED');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcripts, setTranscripts] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState<string>('');
  const [metrics, setMetrics] = useState<TransportMetrics>({
    framesSent: 0,
    bytesSent: 0,
    droppedFrames: 0,
    latencyMs: 0,
    lastPingTime: Date.now(),
  });

  const wsClientRef = useRef<SentinelWebSocketClient | null>(null);
  const sequenceRef = useRef(0);

  // Initialize WebSocket client singleton
  if (!wsClientRef.current) {
    wsClientRef.current = new SentinelWebSocketClient();
  }

  // Handle recorded audio chunk from MediaRecorder
  const handleAudioChunk = useCallback((blob: Blob) => {
    if (!wsClientRef.current || !isConnected) return;

    blob.arrayBuffer().then((buffer) => {
      const sent = wsClientRef.current?.sendBinary(buffer);
      if (sent) {
        sequenceRef.current += 1;
        setMetrics((prev) => ({
          ...prev,
          framesSent: prev.framesSent + 1,
          bytesSent: prev.bytesSent + buffer.byteLength,
          latencyMs: wsClientRef.current?.latencyMs || prev.latencyMs,
        }));
      }
    });
  }, [isConnected]);

  const {
    isRecording,
    permissionError,
    startRecording,
    stopRecording,
  } = useMediaRecorder({
    timesliceMs: 250,
    onAudioChunk: handleAudioChunk,
  });

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((msg: WebSocketMessage) => {
    switch (msg.type) {
      case 'CONNECTED':
        setIsConnected(true);
        setSessionStatus('CONNECTED');
        break;

      case 'CALL_STARTED':
        setSessionId(msg.payload?.session_id || null);
        setSessionStatus('CALL_ACTIVE');
        sequenceRef.current = 0;
        break;

      case 'AUDIO_ACK':
        if (msg.payload?.status === 'streaming') {
          setSessionStatus('AUDIO_STREAMING');
        } else if (msg.payload?.status === 'stopped') {
          setSessionStatus('AUDIO_STOPPED');
        }
        break;

      case 'TRANSCRIPT_PARTIAL':
        if (msg.payload?.segment) {
          const seg: TranscriptSegment = msg.payload.segment;
          setInterimText(seg.text);
        }
        break;

      case 'TRANSCRIPT_FINAL':
        if (msg.payload?.segment) {
          const seg: TranscriptSegment = msg.payload.segment;
          setTranscripts((prev) => [...prev, seg]);
          setInterimText('');
        }
        break;

      case 'CALL_ENDED':
        setSessionStatus('CALL_ENDED');
        setInterimText('');
        if (msg.payload?.dropped_frames) {
          setMetrics((prev) => ({
            ...prev,
            droppedFrames: msg.payload?.dropped_frames || prev.droppedFrames,
          }));
        }
        break;

      case 'ERROR':
        console.error('Server error message:', msg.payload);
        break;

      default:
        break;
    }
  }, []);

  useEffect(() => {
    const ws = wsClientRef.current;
    if (!ws) return;

    const unsubMsg = ws.onMessage(handleMessage);
    const unsubStatus = ws.onStatusChange((connected) => {
      setIsConnected(connected);
      if (!connected) {
        setSessionStatus('DISCONNECTED');
      }
    });

    ws.connect();

    return () => {
      unsubMsg();
      unsubStatus();
      ws.disconnect();
    };
  }, [handleMessage]);

  const startCall = useCallback(() => {
    if (!wsClientRef.current || !isConnected) return;
    setTranscripts([]);
    setInterimText('');
    setMetrics({
      framesSent: 0,
      bytesSent: 0,
      droppedFrames: 0,
      latencyMs: wsClientRef.current.latencyMs,
      lastPingTime: Date.now(),
    });
    setSessionStatus('CALL_STARTING');
    wsClientRef.current.sendJSON({
      type: 'CALL_START',
      payload: {
        audio_format: 'audio/webm;codecs=opus',
        sample_rate: 16000,
        channels: 1,
      },
    });
  }, [isConnected]);

  const startAudio = useCallback(async () => {
    if (!sessionId || !wsClientRef.current) return;
    const ok = await startRecording();
    if (ok) {
      wsClientRef.current.sendJSON({
        type: 'AUDIO_START',
        payload: { session_id: sessionId },
      });
    }
  }, [sessionId, startRecording]);

  const stopAudio = useCallback(() => {
    stopRecording();
    if (sessionId && wsClientRef.current) {
      wsClientRef.current.sendJSON({
        type: 'AUDIO_STOP',
        payload: { session_id: sessionId },
      });
    }
  }, [sessionId, stopRecording]);

  const endCall = useCallback(() => {
    stopRecording();
    if (sessionId && wsClientRef.current) {
      wsClientRef.current.sendJSON({
        type: 'CALL_END',
        payload: { session_id: sessionId },
      });
    }
  }, [sessionId, stopRecording]);

  return {
    isConnected,
    sessionStatus,
    sessionId,
    transcripts,
    interimText,
    metrics,
    isRecording,
    permissionError,
    startCall,
    endCall,
    startAudio,
    stopAudio,
  };
}

