import { useState, useRef, useEffect, useCallback } from 'react';

export function useAudioStreamer(
  onTranscriptSegment?: (speaker: 'CALLER' | 'CALLEE', text: string) => void,
  isCallStreaming?: boolean
) {
  const [isMicActive, setIsMicActive] = useState(false);
  const [speakerRole, setSpeakerRole] = useState<'CALLER' | 'CALLEE'>('CALLER');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [speechSupported, setSpeechSupported] = useState<boolean>(true);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Web Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const lastResult = event.results[event.results.length - 1];
        if (lastResult.isFinal) {
          const text = lastResult[0].transcript.trim();
          if (text && onTranscriptSegment) {
            onTranscriptSegment(speakerRole, text);
          }
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition notice:', event.error);
      };

      recognitionRef.current = recognition;
      setSpeechSupported(true);
    } else {
      setSpeechSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onTranscriptSegment, speakerRole]);

  // Audio level analyzer loop
  const updateAudioLevels = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const avg = sum / dataArray.length;
      setAudioLevel(avg / 255);
    } else if (isCallStreaming) {
      // Simulate active call waveform jitter
      const simulatedLevel = 0.2 + Math.random() * 0.55;
      setAudioLevel(simulatedLevel);
    } else {
      setAudioLevel(0.02);
    }

    animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
  }, [isCallStreaming]);

  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(updateAudioLevels);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [updateAudioLevels]);

  const startMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {}
      }

      setIsMicActive(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check browser permissions.');
    }
  };

  const stopMicrophone = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    setIsMicActive(false);
  };

  const toggleMicrophone = () => {
    if (isMicActive) {
      stopMicrophone();
    } else {
      startMicrophone();
    }
  };

  return {
    isMicActive,
    toggleMicrophone,
    speakerRole,
    setSpeakerRole,
    audioLevel,
    speechSupported,
    analyserNode: analyserRef.current
  };
}

