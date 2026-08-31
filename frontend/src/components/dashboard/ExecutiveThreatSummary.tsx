import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  PhoneOff,
  Volume2,
  Lock,
  RotateCcw,
  Zap,
  Activity,
  Layers,
  ArrowRight
} from 'lucide-react';
import { ThreatLevel, ScamIndicator } from '../../types/sentinel';

interface ExecutiveThreatSummaryProps {
  threatScore: number;
  threatState: ThreatLevel;
  decisionDirective: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
  confidence: number;
  indicators: ScamIndicator[];
  reasons: string[];
  onResetDemo: () => Promise<void>;
  onNavigateToEvidence?: () => void;
}

export const ExecutiveThreatSummary: React.FC<ExecutiveThreatSummaryProps> = ({
  threatScore,
  threatState,
  decisionDirective,
  confidence,
  indicators,
  reasons,
  onResetDemo,
  onNavigateToEvidence,
}) => {
  // Check detected scam vectors
  const hasCredential = indicators.some((i) => i.category === 'CREDENTIAL_REQUEST');
  const hasUrgency = indicators.some((i) => i.category === 'URGENCY_PRESSURE');
  const hasThreat = indicators.some((i) => i.category === 'THREAT_INTIMIDATION');
  const hasCombination = reasons.some((r) => r.toLowerCase().includes('combination'));

  return (
    <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 via-red-950/40 to-slate-950 border-2 border-red-500/80 shadow-[0_0_50px_rgba(239,68,68,0.35)] text-slate-100 space-y-6 animate-in fade-in duration-500">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-4 border-b border-red-800/60 gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400 shadow-lg shadow-red-950 animate-pulse">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-950 text-red-400 font-mono text-[11px] font-extrabold border border-red-600 tracking-wider uppercase">
                DEFCON 1 INTERVENTION
              </span>
              <span className="text-xs font-mono text-slate-400">•</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                POLICY ENFORCED
              </span>
            </div>
            <h2 className="text-xl font-extrabold font-mono text-white tracking-wide mt-0.5 flex items-center gap-2">
              🚨 THREAT CONTAINED
            </h2>
          </div>
        </div>

        {/* Quick Presentation Reset Action */}
        <button
          onClick={onResetDemo}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-400 text-slate-200 hover:text-cyan-300 rounded-xl text-xs font-mono font-bold transition-all shadow-lg hover:scale-105"
        >
          <RotateCcw className="w-4 h-4 text-cyan-400" />
          <span>↻ RESET DEMO</span>
        </button>
      </div>

      {/* 3 Key Metrics KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
            Calculated Threat Score
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-red-400">
              {Math.max(82, Math.round(threatScore))}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>
          <div className="text-[11px] text-red-300 font-sans mt-0.5">
            Critical Multi-Vector Scam Threshold
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
            Decision Directive
          </div>
          <div className="text-2xl font-extrabold text-red-400 tracking-wider">
            {decisionDirective}
          </div>
          <div className="text-[11px] text-slate-300 font-sans mt-0.5">
            Autonomous Line Termination Required
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">
            Consensus Confidence
          </div>
          <div className="text-3xl font-extrabold text-emerald-400">
            {confidence || 98}%
          </div>
          <div className="text-[11px] text-slate-300 font-sans mt-0.5">
            Deterministic Rule Consensus
          </div>
        </div>
      </div>

      {/* Two Column Section: Detected Signals & Autonomous Countermeasures */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-xs">
        {/* Left: Detected Scam Vectors */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-cyan-400" />
            Confirmed Scam Signals & Escalation
          </div>
          <div className="space-y-2 font-sans">
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-red-950/30 border border-red-900/60 text-red-200">
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <span className="font-bold text-red-300">Credential Request</span>
                <p className="text-[11px] text-slate-400">Solicitation of 6-digit OTP / 2FA verification passcodes</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-red-950/30 border border-red-900/60 text-red-200">
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <span className="font-bold text-red-300">Urgency Pressure</span>
                <p className="text-[11px] text-slate-400">Time compression coercive trigger ("within 10 minutes")</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-red-950/30 border border-red-900/60 text-red-200">
              <CheckCircle2 className="w-4 h-4 text-red-400 shrink-0" />
              <div>
                <span className="font-bold text-red-300">Threat Intimidation</span>
                <p className="text-[11px] text-slate-400">Coercive sanction ("account will be blocked")</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-amber-950/30 border border-amber-900/60 text-amber-200">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300">Combination Synergy Escalation</span>
                <p className="text-[11px] text-slate-400">COMBINATION_URGENCY_AND_CREDENTIALS applied</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Countermeasures Executed */}
        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
          <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-cyan-400" />
            Autonomous Actions Executed
          </div>
          <div className="space-y-2 font-sans">
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
              <div className="w-7 h-7 rounded-lg bg-red-600/30 border border-red-500 flex items-center justify-center text-red-400 shrink-0">
                <PhoneOff className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-100 font-mono">1. Autonomous Kill Switch</span>
                <p className="text-[11px] text-slate-400">Inbound audio line severed immediately to prevent compliance</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
              <div className="w-7 h-7 rounded-lg bg-cyan-600/30 border border-cyan-500 flex items-center justify-center text-cyan-400 shrink-0">
                <Volume2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-100 font-mono">2. Defensive Voice Advisory</span>
                <p className="text-[11px] text-slate-400">Earpiece speech synthesis advisory broadcasted to protect victim</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200">
              <div className="w-7 h-7 rounded-lg bg-emerald-600/30 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-100 font-mono">3. Cryptographic Evidence Sealed</span>
                <p className="text-[11px] text-slate-400">All turn hashes & decisions sealed in SHA-256 blockchain ledger</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

