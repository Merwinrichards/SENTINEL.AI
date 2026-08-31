import React from 'react';
import { ShieldAlert, ShieldCheck, Activity, Zap, CheckCircle2, AlertOctagon } from 'lucide-react';
import { ThreatLevel } from '../../types/sentinel';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

interface ThreatAnalysisPanelProps {
  score: number;
  threatState: ThreatLevel;
  decision: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
  confidence: number;
  velocity: number;
  reasons: string[];
}

export const ThreatAnalysisPanel: React.FC<ThreatAnalysisPanelProps> = ({
  score,
  threatState,
  decision,
  confidence,
  velocity,
  reasons,
}) => {
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  const animatedScore = useAnimatedNumber(boundedScore, 400);
  const animatedConfidence = useAnimatedNumber(confidence || 98, 300);

  const circumference = 2 * Math.PI * 46;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  const getThreatColor = () => {
    switch (threatState) {
      case 'RED':
        return {
          stroke: '#ef4444',
          text: 'text-red-400',
          badge: 'bg-red-950/80 border-red-500/60 text-red-300',
          label: 'CRITICAL DEFCON 1',
        };
      case 'ORANGE':
        return {
          stroke: '#f97316',
          text: 'text-orange-400',
          badge: 'bg-orange-950/80 border-orange-500/60 text-orange-300',
          label: 'HIGH RISK THREAT',
        };
      case 'YELLOW':
        return {
          stroke: '#f59e0b',
          text: 'text-amber-400',
          badge: 'bg-amber-950/80 border-amber-500/60 text-amber-300',
          label: 'GUARDED / ANOMALOUS',
        };
      default:
        return {
          stroke: '#10b981',
          text: 'text-emerald-400',
          badge: 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300',
          label: 'BENIGN / NORMAL',
        };
    }
  };

  const style = getThreatColor();

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 flex flex-col gap-4 shadow-xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-4 h-4 ${style.text}`} />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            Real-Time Threat Analysis
          </span>
        </div>
        <div className={`px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wide ${style.badge}`}>
          {style.label}
        </div>
      </div>

      {/* Main Gauge + Metrics */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-1">
        {/* SVG Circular Progress Gauge with Smooth Animation */}
        <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 108 108">
            <circle
              cx="54"
              cy="54"
              r="46"
              stroke="#1e293b"
              strokeWidth="8"
              fill="transparent"
            />
            <circle
              cx="54"
              cy="54"
              r="46"
              stroke={style.stroke}
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
              className="transition-all duration-300 ease-out"
            />
          </svg>

          <div className="absolute flex flex-col items-center justify-center text-center">
            <span className={`text-3xl font-extrabold font-mono tracking-tight ${style.text}`}>
              {animatedScore}
            </span>
            <span className="text-[9px] font-mono uppercase text-slate-500 font-bold">
              / 100 Risk
            </span>
          </div>
        </div>

        {/* Tactical Metrics Grid */}
        <div className="flex-1 grid grid-cols-2 gap-2.5 w-full font-mono text-xs">
          <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Directive</span>
            <div className="flex items-center gap-1.5 mt-1 font-bold">
              {decision === 'INTERVENE' ? (
                <AlertOctagon className="w-3.5 h-3.5 text-red-400 shrink-0" />
              ) : decision === 'WARN' ? (
                <Activity className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              )}
              <span className={`truncate text-xs ${decision === 'INTERVENE' ? 'text-red-400' : decision === 'WARN' ? 'text-orange-400' : 'text-emerald-400'}`}>
                {decision}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Confidence</span>
            <div className="flex items-center gap-1.5 mt-1 font-bold text-slate-200">
              <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{animatedConfidence}%</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Threat Velocity</span>
            <div className="text-xs font-bold text-cyan-300 mt-1">
              +{velocity > 0 ? velocity : 0} <span className="text-[10px] text-slate-500">pts/turn</span>
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Policy Engine</span>
            <div className="text-xs font-bold text-slate-300 mt-1 truncate">
              {decision === 'INTERVENE' ? 'KILL-SWITCH' : 'SURVEILLANCE'}
            </div>
          </div>
        </div>
      </div>

      {/* Explainable Decision Reasoning Section */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          Decision Engine Reasoning & Combinations
        </span>
        {reasons.length === 0 ? (
          <p className="text-xs font-mono text-slate-500 italic">
            Awaiting conversation data. No risk escalation rules active.
          </p>
        ) : (
          <ul className="space-y-1.5 font-mono text-xs text-slate-300">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-cyan-400 font-bold">›</span>
                <span className="leading-tight">{r}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
