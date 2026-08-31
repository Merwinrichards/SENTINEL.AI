import React, { useState, useEffect } from 'react';
import { Play, Square, FastForward, Shield, AlertTriangle, ShieldCheck, CornerDownLeft, Sparkles } from 'lucide-react';
import { ScenarioMeta } from '../types/sentinel';

interface ScenarioSelectorProps {
  isStreaming: boolean;
  activeScenarioId: string | null;
  onStartScenario: (id: string, speed: number) => void;
  onStopScenario: () => void;
  onSendLiveTurn: (speaker: 'CALLER' | 'CALLEE', text: string) => void;
}

export const ScenarioSelector: React.FC<ScenarioSelectorProps> = ({
  isStreaming,
  activeScenarioId,
  onStartScenario,
  onStopScenario,
  onSendLiveTurn
}) => {
  const [scenarios, setScenarios] = useState<ScenarioMeta[]>([]);
  const [speed, setSpeed] = useState<number>(1.2);
  const [customText, setCustomText] = useState('');
  const [customSpeaker, setCustomSpeaker] = useState<'CALLER' | 'CALLEE'>('CALLER');

  useEffect(() => {
    fetch('/api/scenarios')
      .then(res => res.json())
      .then(data => setScenarios(data))
      .catch(err => console.error('Error fetching scenarios:', err));
  }, []);

  const handleCustomSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    onSendLiveTurn(customSpeaker, customText.trim());
    setCustomText('');
  };

  const getRiskIcon = (level: string) => {
    if (level === 'CRITICAL') {
      return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
    }
    return <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <div className="cyber-card p-4 flex flex-col gap-4">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Scam Defense Test Lab & Realistic Replay Scenarios
          </span>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">SPEED:</span>
          {[1.0, 1.5, 2.0].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                speed === s
                  ? 'bg-cyan-500 text-slate-950 shadow-sm shadow-cyan-500/30'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {s}x
            </button>
          ))}
          {isStreaming && (
            <button
              onClick={onStopScenario}
              className="flex items-center gap-1 px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-mono text-xs font-bold rounded transition ml-2 shadow-md shadow-red-600/30"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>STOP STREAM</span>
            </button>
          )}
        </div>
      </div>

      {/* Scenario Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {scenarios.map((s) => {
          const isActive = isStreaming && activeScenarioId === s.id;
          return (
            <div
              key={s.id}
              className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                isActive
                  ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-500/20 ring-1 ring-cyan-500'
                  : s.target_risk_level === 'CRITICAL'
                  ? 'bg-slate-950/80 border-slate-800 hover:border-red-500/50'
                  : 'bg-slate-950/80 border-slate-800 hover:border-emerald-500/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-cyan-400 font-semibold uppercase truncate">
                    {s.category}
                  </span>
                  <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400">
                    {getRiskIcon(s.target_risk_level)}
                    <span>{s.target_risk_level}</span>
                  </div>
                </div>

                <h4 className="font-bold text-xs text-slate-100 line-clamp-2 mb-1">
                  {s.title}
                </h4>
                <p className="text-[11px] text-slate-400 line-clamp-3 mb-2 font-sans">
                  {s.description}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-900 flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-500">
                  {s.turn_count} TURNS
                </span>
                <button
                  onClick={() => onStartScenario(s.id, speed)}
                  disabled={isStreaming}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : isStreaming
                      ? 'bg-slate-900 text-slate-600 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700'
                  }`}
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isActive ? 'PLAYING' : 'LAUNCH'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manual Phrase Injection Bar */}
      <form onSubmit={handleCustomSend} className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800 shrink-0">
          <button
            type="button"
            onClick={() => setCustomSpeaker('CALLER')}
            className={`px-2 py-1 rounded text-xs font-mono font-bold ${
              customSpeaker === 'CALLER' ? 'bg-red-500/30 text-red-300 border border-red-500/50' : 'text-slate-400'
            }`}
          >
            CALLER (SCAMMER)
          </button>
          <button
            type="button"
            onClick={() => setCustomSpeaker('CALLEE')}
            className={`px-2 py-1 rounded text-xs font-mono font-bold ${
              customSpeaker === 'CALLEE' ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50' : 'text-slate-400'
            }`}
          >
            CALLEE (VICTIM)
          </button>
        </div>

        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="Inject manual speech test turn (e.g. 'I am sending you a 6-digit OTP code, read it to me')..."
          className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
        />

        <button
          type="submit"
          disabled={!customText.trim()}
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-mono text-xs font-bold rounded flex items-center gap-1.5 transition shadow-sm shadow-cyan-600/30"
        >
          <span>INJECT TURN</span>
          <CornerDownLeft className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
};

