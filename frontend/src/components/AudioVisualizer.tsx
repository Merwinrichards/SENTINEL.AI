import React, { useEffect, useRef } from 'react';
import { Activity, Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import { ThreatLevel } from '../types/sentinel';

interface AudioVisualizerProps {
  isStreaming: boolean;
  isMicActive: boolean;
  audioLevel: number;
  threatState: ThreatLevel;
  speakerRole: 'CALLER' | 'CALLEE';
  onToggleMic: () => void;
  onSetSpeakerRole: (role: 'CALLER' | 'CALLEE') => void;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isStreaming,
  isMicActive,
  audioLevel,
  threatState,
  speakerRole,
  onToggleMic,
  onSetSpeakerRole
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Cyber background grid
      ctx.strokeStyle = 'rgba(31, 41, 61, 0.4)';
      ctx.lineWidth = 1;
      const step = 20;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw baseline center line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();

      // Dynamic waveform based on audioLevel & threatState
      const isLive = isStreaming || isMicActive;
      const amplitude = isLive ? Math.max(12, audioLevel * 75) : 4;
      const numBars = 48;
      const barWidth = width / numBars;

      // Color mapping
      let waveColor = '#38bdf8'; // Cyan
      if (threatState === 'RED') waveColor = '#ef4444';
      else if (threatState === 'ORANGE') waveColor = '#f97316';
      else if (threatState === 'YELLOW') waveColor = '#f59e0b';
      else if (isLive) waveColor = '#10b981';

      // Draw frequency bars
      for (let i = 0; i < numBars; i++) {
        const x = i * barWidth;
        const normalizedI = (i - numBars / 2) / (numBars / 2);
        const gaussian = Math.exp(-normalizedI * normalizedI * 2.5);
        
        const noise = isLive ? (Math.sin(phase + i * 0.45) * 0.5 + 0.5) : 0.1;
        const barHeight = amplitude * gaussian * noise * 1.8 + (isLive ? 6 : 2);

        const gradient = ctx.createLinearGradient(0, height / 2 - barHeight, 0, height / 2 + barHeight);
        gradient.addColorStop(0, 'rgba(0, 242, 254, 0.1)');
        gradient.addColorStop(0.5, waveColor);
        gradient.addColorStop(1, 'rgba(0, 242, 254, 0.1)');

        ctx.fillStyle = gradient;
        ctx.fillRect(x + 2, height / 2 - barHeight / 2, barWidth - 4, Math.max(2, barHeight));
      }

      // Draw continuous sine overlay
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = waveColor;
      ctx.beginPath();

      for (let x = 0; x < width; x += 4) {
        const norm = x / width;
        const curve = Math.sin(phase * 1.5 + norm * 8) * Math.cos(norm * 4);
        const y = height / 2 + (isLive ? curve * amplitude * 0.6 : 0);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      phase += isLive ? 0.08 : 0.02;
      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isStreaming, isMicActive, audioLevel, threatState]);

  return (
    <div className="cyber-card p-4 flex flex-col gap-3">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Acoustic Signal Processing & Diarization
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
            <Radio className={`w-3.5 h-3.5 ${isStreaming || isMicActive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
            <span>{isMicActive ? 'MIC ACTIVE' : isStreaming ? 'STREAM PLAYING' : 'STANDBY'}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded bg-sentinel-dark/90 border border-slate-800/80 overflow-hidden h-28 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={600}
          height={112}
          className="w-full h-full block"
        />

        {/* HUD Overlay Stats */}
        <div className="absolute top-2 left-2 flex items-center gap-2 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 font-mono text-[10px] text-slate-400">
          <span>SAMPLING: 44.1kHz</span>
          <span className="text-slate-600">|</span>
          <span>LATENCY: &lt;140ms</span>
        </div>

        <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 font-mono text-[10px]">
          <span className="text-slate-400">RMS ENERGY:</span>
          <span className="text-cyan-400 font-bold">{(audioLevel * 100).toFixed(0)} dB</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800/60">
        {/* Live Mic Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMic}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs font-mono font-semibold transition ${
              isMicActive
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 animate-pulse'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isMicActive ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-cyan-400" />}
            <span>{isMicActive ? 'STOP MIC' : 'TEST LIVE MICROPHONE'}</span>
          </button>

          {isMicActive && (
            <div className="flex items-center gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400">Role:</span>
              <button
                onClick={() => onSetSpeakerRole('CALLER')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  speakerRole === 'CALLER' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'text-slate-500'
                }`}
              >
                CALLER (SCAMMER)
              </button>
              <button
                onClick={() => onSetSpeakerRole('CALLEE')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                  speakerRole === 'CALLEE' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'text-slate-500'
                }`}
              >
                CALLEE (VICTIM)
              </button>
            </div>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-500">
          DUAL-CHANNEL DIARIZATION // NEURAL NOISE REDUCTION ACTIVE
        </div>
      </div>
    </div>
  );
};

