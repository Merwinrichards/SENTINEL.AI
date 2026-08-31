import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Radio, Play, Square, Mic, MicOff, FastForward, Clock } from 'lucide-react';
import { CallState, ScenarioMeta } from '../../types/sentinel';
import { api } from '../../services/api';

interface LiveCallPanelProps {
  callState: CallState;
  isStreaming: boolean;
  activeScenarioId: string | null;
  activeCallerId: string | null;
  durationSeconds: number;
  audioActivityLevel: number;
  onStartScenario: (scenarioId: string, speed: number) => void;
  onStopScenario: () => void;
}

export const LiveCallPanel: React.FC<LiveCallPanelProps> = ({
  callState,
  isStreaming,
  activeScenarioId,
  activeCallerId,
  durationSeconds,
  audioActivityLevel,
  onStartScenario,
  onStopScenario,
}) => {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('tech_support_remote_access');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1.0);
  const [isMicActive, setIsMicActive] = useState<boolean>(false);

  useEffect(() => {
    api.getScenarios().then(data => {
      setScenarios(data);
      if (data.length > 0 && !activeScenarioId) {
        setSelectedScenario(data[0].id);
      }
    }).catch(err => console.error('Failed to load scenarios:', err));
  }, [activeScenarioId]);

  const formatDuration = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCallBadge = () => {
    switch (callState) {
      case 'CALL_TERMINATED':
      case 'KILL_SWITCH_ACTIVE':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/80 border border-red-500/60 rounded text-red-400 font-mono text-xs font-bold animate-pulse">
            <PhoneOff className="w-3.5 h-3.5" />
            <span>KILL SWITCH ACTIVE</span>
          </div>
        );
      case 'THREAT_DETECTED':
      case 'INTERVENTION_PENDING':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-950/80 border border-orange-500/60 rounded text-orange-400 font-mono text-xs font-bold animate-pulse">
            <Phone className="w-3.5 h-3.5" />
            <span>THREAT DETECTED</span>
          </div>
        );
      case 'CALL_ACTIVE':
      case 'MONITORING':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/60 rounded text-emerald-400 font-mono text-xs font-bold">
            <Phone className="w-3.5 h-3.5 animate-bounce" />
            <span>CALL ACTIVE</span>
          </div>
        );
      case 'COMPLETED':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-slate-300 font-mono text-xs font-bold">
            <span>CALL ENDED</span>
          </div>
        );
      case 'RECOVERY':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-cyan-950/80 border border-cyan-500/60 rounded text-cyan-400 font-mono text-xs font-bold">
            <span>RECOVERY / READY</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-500 font-mono text-xs font-medium">
            <span>IDLE / READY</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
      {/* Header with Call Status & Inbound ID */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Radio className={`w-4 h-4 ${isStreaming ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-300">LIVE CALL MONITOR</span>
        </div>
        {getCallBadge()}
      </div>

      {/* Telemetry Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        <div className="bg-slate-950/70 border border-slate-800/60 p-2.5 rounded-lg">
          <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            Duration
          </div>
          <div className="text-base font-bold text-slate-200 mt-0.5">{formatDuration(durationSeconds)}</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/60 p-2.5 rounded-lg">
          <div className="text-[10px] text-slate-500 uppercase">Inbound Caller</div>
          <div className="text-xs font-bold text-cyan-300 mt-1 truncate" title={activeCallerId || 'No active call'}>
            {activeCallerId || (callState === 'CALL_TERMINATED' || callState === 'KILL_SWITCH_ACTIVE' ? 'SEVERED LINE' : 'STANDBY')}
          </div>
        </div>
      </div>

      {/* Audio Waveform Activity Visualizer */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
          <span>AUDIO ACTIVITY</span>
          <span>{isStreaming ? `${Math.round(audioActivityLevel * 100)}%` : 'OFFLINE'}</span>
        </div>
        <div className="flex items-end justify-between h-10 gap-1 px-1">
          {Array.from({ length: 24 }).map((_, i) => {
            const barHeight = isStreaming
              ? Math.max(12, Math.min(100, Math.sin(i * 0.4 + Date.now() * 0.005) * 35 + (audioActivityLevel * 55) + Math.random() * 20))
              : 8;
            const isRed = callState === 'CALL_TERMINATED' || callState === 'KILL_SWITCH_ACTIVE';
            return (
              <div
                key={i}
                style={{ height: `${barHeight}%` }}
                className={`flex-1 rounded-sm transition-all duration-100 ${
                  !isStreaming
                    ? 'bg-slate-800'
                    : isRed
                    ? 'bg-red-500'
                    : audioActivityLevel > 0.6
                    ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                    : 'bg-cyan-600/70'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Scenario Selection & Execution Controls */}
      <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
        <label className="text-[10px] font-mono text-slate-400 uppercase">Target Scenario</label>
        <select
          value={selectedScenario}
          onChange={(e) => setSelectedScenario(e.target.value)}
          disabled={isStreaming}
          className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        >
          {scenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.category})
            </option>
          ))}
        </select>

        <div className="flex items-center justify-between gap-2 mt-1">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs font-mono text-slate-400">
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
            <span>Speed:</span>
            <select
              value={speedMultiplier}
              onChange={(e) => setSpeedMultiplier(parseFloat(e.target.value))}
              disabled={isStreaming}
              className="bg-transparent text-cyan-300 font-bold focus:outline-none"
            >
              <option value="1.0" className="bg-slate-950">1.0x</option>
              <option value="1.5" className="bg-slate-950">1.5x</option>
              <option value="2.0" className="bg-slate-950">2.0x</option>
            </select>
          </div>

          <button
            onClick={() => setIsMicActive(!isMicActive)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
              isMicActive
                ? 'bg-rose-950/60 border-rose-500/60 text-rose-300 animate-pulse'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {isMicActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
            {isMicActive ? 'MIC ON' : 'MIC OFF'}
          </button>
        </div>

        {/* Start / Stop Primary Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            onClick={() => onStartScenario(selectedScenario, speedMultiplier)}
            disabled={isStreaming || callState === 'CALL_TERMINATED'}
            className="py-2.5 px-3 rounded-lg font-mono text-xs font-bold tracking-wider transition-all border border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            START
          </button>

          <button
            onClick={onStopScenario}
            disabled={!isStreaming}
            className="py-2.5 px-3 rounded-lg font-mono text-xs font-bold tracking-wider transition-all border border-slate-700 bg-slate-800/60 text-slate-300 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            STOP
          </button>
        </div>
      </div>
    </div>
  );
};

