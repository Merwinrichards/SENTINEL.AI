import React from 'react';
import { X, Terminal, Radio, Mic, Activity, Volume2, ShieldCheck, AlertCircle } from 'lucide-react';
import { useSentinelAudio } from '../hooks/useSentinelAudio';

interface AudioLabConsoleProps {
  onClose?: () => void;
}

export const AudioLabConsole: React.FC<AudioLabConsoleProps> = ({ onClose }) => {
  const {
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
  } = useSentinelAudio();

  const isCallActive = sessionStatus === 'CALL_ACTIVE' || sessionStatus === 'AUDIO_STREAMING' || sessionStatus === 'AUDIO_STOPPED';

  return (
    <div className="w-full text-slate-100 font-mono select-none">
      <div className="w-full space-y-5">
        {/* Header HUD */}
        <header className="border border-cyan-500/30 bg-slate-900/90 p-4 sm:p-5 rounded-xl shadow-xl backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Terminal className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
                <h1 className="text-sm font-bold tracking-wider text-cyan-300 uppercase">
                  SENTINEL AUDIO LAB & DIAGNOSTICS
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Real-Time Streaming Voice Ingestion & STT Verification Console
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/80 text-[10px]">
              <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-rose-500'}`}></span>
              <span className={isConnected ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>
            
            <div className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/80 text-slate-300 text-[10px]">
              Session: <span className="text-cyan-300 font-bold">{sessionId || 'NO_SESSION'}</span>
            </div>

            {onClose && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-all ml-1"
                title="Close Diagnostic Console (ESC)"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* Permission Error Banner */}
        {permissionError && (
          <div className="border border-rose-500/50 bg-rose-950/40 text-rose-300 p-4 rounded-xl text-xs flex items-center gap-3 animate-bounce">
            <span className="text-lg">⚠️</span>
            <div>
              <span className="font-bold">Microphone Error:</span> {permissionError}
            </div>
          </div>
        )}

        {/* Main Controls Matrix */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Call & Audio Controls */}
          <div className="border border-slate-800 bg-slate-900/60 p-6 rounded-xl space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Call & Media Pipeline</h2>
            
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={startCall}
                disabled={!isConnected || isCallActive}
                className={`py-3 px-4 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 border ${
                  !isConnected || isCallActive
                    ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed'
                    : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                }`}
              >
                [ START CALL ]
              </button>

              <button
                onClick={endCall}
                disabled={!isCallActive}
                className={`py-3 px-4 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 border ${
                  !isCallActive
                    ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed'
                    : 'border-rose-500/50 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 shadow-[0_0_15px_rgba(244,63,94,0.2)]'
                }`}
              >
                [ END CALL ]
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
              <button
                onClick={startAudio}
                disabled={!isCallActive || isRecording}
                className={`py-3 px-4 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 border flex items-center justify-center gap-2 ${
                  !isCallActive || isRecording
                    ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed'
                    : 'border-cyan-500/50 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/60 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-cyan-400'}`}></span>
                START MIC
              </button>

              <button
                onClick={stopAudio}
                disabled={!isRecording}
                className={`py-3 px-4 rounded-lg font-bold text-xs tracking-wider transition-all duration-200 border ${
                  !isRecording
                    ? 'border-slate-800 bg-slate-900/40 text-slate-600 cursor-not-allowed'
                    : 'border-amber-500/50 bg-amber-950/40 text-amber-300 hover:bg-amber-900/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                }`}
              >
                STOP MIC
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 text-slate-400">
              <span>Status:</span>
              <span className="font-bold text-cyan-400">{sessionStatus}</span>
            </div>
          </div>

          {/* Transport HUD */}
          <div className="border border-slate-800 bg-slate-900/60 p-6 rounded-xl space-y-4">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Transport Telemetry</h2>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
                <div className="text-slate-500">Frames Sent</div>
                <div className="text-lg font-bold text-slate-200 mt-1">{metrics.framesSent}</div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
                <div className="text-slate-500">Bytes Streamed</div>
                <div className="text-lg font-bold text-slate-200 mt-1">{(metrics.bytesSent / 1024).toFixed(1)} KB</div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
                <div className="text-slate-500">Dropped Frames</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">{metrics.droppedFrames}</div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/60">
                <div className="text-slate-500">WS Latency</div>
                <div className="text-lg font-bold text-cyan-400 mt-1">{metrics.latencyMs} ms</div>
              </div>
            </div>
          </div>

        </div>

        {/* Live Rolling Transcript Stream */}
        <div className="border border-slate-800 bg-slate-900/60 p-6 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Live Streaming Transcription</h2>
            <span className="text-[10px] text-slate-500 uppercase">Speaker / Confidence Tagged</span>
          </div>

          <div className="min-h-[220px] max-h-[360px] overflow-y-auto p-4 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-3">
            {transcripts.length === 0 && !interimText && (
              <div className="h-full flex items-center justify-center text-slate-600 text-xs py-16">
                Awaiting active call stream and speech input...
              </div>
            )}

            {transcripts.map((seg) => (
              <div key={seg.segment_id} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                  {seg.speaker}
                </span>
                <div className="flex-1">
                  <p className="text-sm text-slate-200 leading-relaxed">{seg.text}</p>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-3">
                    <span>Conf: {(seg.confidence * 100).toFixed(0)}%</span>
                    <span>Time: {seg.start_time.toFixed(1)}s - {seg.end_time.toFixed(1)}s</span>
                  </div>
                </div>
              </div>
            ))}

            {interimText && (
              <div className="p-3 rounded-lg bg-slate-900/40 border border-cyan-500/20 flex items-start gap-3 animate-pulse">
                <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-950/40 border border-amber-500/30 text-amber-400">
                  INTERIM
                </span>
                <p className="text-sm text-cyan-300 italic leading-relaxed">{interimText}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

