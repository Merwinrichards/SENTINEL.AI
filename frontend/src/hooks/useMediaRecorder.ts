import { useCallback, useRef, useState } from 'react';

interface UseMediaRecorderOptions {
  timesliceMs?: number;
  onAudioChunk?: (chunk: Blob) => void;
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}) {
  const { timesliceMs = 250, onAudioChunk } = options;
  const [isRecording, setIsRecording] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkCallbackRef = useRef(onAudioChunk);
  chunkCallbackRef.current = onAudioChunk;

  const startRecording = useCallback(async (): Promise<boolean> => {
    setPermissionError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Select best supported MIME type
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        if (MediaRecorder.isTypeSupported('audio/webm')) {
          mimeType = 'audio/webm';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else {
          mimeType = '';
        }
      }

      const recorderOptions: MediaRecorderOptions = mimeType ? { mimeType } : {};
      const recorder = new MediaRecorder(stream, recorderOptions);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunkCallbackRef.current?.(event.data);
        }
      };

      recorder.onerror = (err) => {
        console.error('MediaRecorder error:', err);
        setPermissionError('Microphone recording error occurred.');
        stopRecording();
      };

      recorder.start(timesliceMs);
      setIsRecording(true);
      return true;
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      const errMsg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
        ? 'Microphone permission was denied by the user.'
        : err.message || 'Could not access audio device.';
      setPermissionError(errMsg);
      setIsRecording(false);
      return false;
    }
  }, [timesliceMs]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
      }
    }
    mediaRecorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  return {
    isRecording,
    permissionError,
    startRecording,
    stopRecording,
  };
}

