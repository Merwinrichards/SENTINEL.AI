import React from 'react';
import { ShieldAlert, AlertTriangle, Flame, Zap, CheckCircle2, Lock } from 'lucide-react';
import { ThreatLevel, InspectorEvaluation, DecisionResult } from '../types/sentinel';

interface ThreatRadarProps {
  threatState: ThreatLevel;
  threatScore: number;
  threatVelocity: number;
  latestEvaluation: InspectorEvaluation | null;
  latestDecision: DecisionResult | null;
}

export const ThreatRadar: React.FC<ThreatRadarProps> = ({
  threatState,
  threatScore,
  threatVelocity,
  latestEvaluation,
  latestDecision
}) => {
  const getThemeColors = () => {
    switch (threatState) {
      case 'RED':
        return {
          border: 'border-red-500/50',
          bg: 'bg-red-950/40',
          glow: 'text-glow-red',
          text: 'text-red-400',
          bar: 'bg-gradient-to-r from-orange-500 to-red-500',
          badge: 'bg-red-900/60 border-red-500/80 text-red-300'
        };
      case 'ORANGE':
        return {
          border: 'border-orange-500/50',
          bg: 'bg-orange-950/40',
          glow: 'text-glow-orange',
          text: 'text-orange-400',
          bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
          badge: 'bg-orange-900/60 border-orange-500/80 text-orange-300'
        };
      case 'YELLOW':
        return {
          border: 'border-amber-500/50',
          bg: 'bg-amber-950/40',
          glow: 'text-glow-yellow',
          text: 'text-amber-400',
          bar: 'bg-gradient-to-r from-yellow-400 to-amber-500',
          badge: 'bg-amber-900/60 border-amber-500/80 text-amber-300'
        };
      default:
        return {
          border: 'border-emerald-500/40',
          bg: 'bg-emerald-950/20',
          glow: 'text-glow-green',
          text: 'text-emerald-400',
          bar: 'bg-gradient-to-r from-teal-500 to-emerald-500',
          badge: 'bg-emerald-900/60 border-emerald-500/80 text-emerald-300'
        };
    }
  };

  const theme = getThemeColors();
  const vectors = latestEvaluation?.vectors || {};

  return (
    <div className={`cyber-card p-4 flex flex-col gap-4 border ${theme.border} transition-all duration-500`}>
      {/* Title / State Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className={`w-4 h-4 ${theme.text}`} />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Real-Time Threat Radar & Vector Matrix
          </span>
        </div>
        <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${theme.badge}`}>
          STATE: {threatState}
        </span>
      </div>

      {/* Main Score & Gauge Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950/70 p-3 rounded-lg border border-slate-800">
        {/* Risk Score */}
        <div className="flex flex-col justify-center items-center p-2 border-r border-slate-800/80">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Composite Risk Score</span>
          <div className="flex items-baseline gap-1 my-1">
            <span className={`text-4xl font-extrabold font-mono ${theme.text} ${theme.glow}`}>
              {threatScore.toFixed(0)}
            </span>
            <span className="text-sm font-mono text-slate-500">/100</span>
          </div>
          {/* Progress bar */}
          <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800 mt-1">
            <div
              className={`h-full ${theme.bar} transition-all duration-500`}
              style={{ width: `${Math.min(100, threatScore)}%` }}
            />
          </div>
        </div>

        {/* Threat Velocity */}
        <div className="flex flex-col justify-center items-center p-2 border-r border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 uppercase">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>Escalation Velocity</span>
          </div>
          <div className="flex items-baseline gap-1 my-1">
            <span className={`text-3xl font-extrabold font-mono ${threatVelocity > 0 ? 'text-orange-400' : 'text-slate-400'}`}>
              {threatVelocity > 0 ? `+${threatVelocity}` : `${threatVelocity}`}
            </span>
            <span className="text-xs font-mono text-slate-500">pts/turn</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {threatVelocity > 15 ? 'RAPID COERCION DETECTED' : threatVelocity > 0 ? 'MOMENTUM INCREASING' : 'STABLE BASELINE'}
          </span>
        </div>

        {/* Decision Engine Directive */}
        <div className="flex flex-col justify-center p-2">
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 uppercase mb-1">
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Decision Directive</span>
          </div>
          {latestDecision?.recommended_actions?.[0] ? (
            <div className="text-xs font-mono text-slate-300">
              <div className="font-bold text-cyan-300 flex items-center gap-1">
                <span>{latestDecision.recommended_actions[0].action_type}</span>
              </div>
              <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                {latestDecision.recommended_actions[0].reasoning}
              </p>
            </div>
          ) : (
            <div className="text-xs font-mono text-slate-500 italic">
              Awaiting conversational turns...
            </div>
          )}
        </div>
      </div>

      {/* 5 Core Scam Vector Breakdown Bars */}
      <div className="flex flex-col gap-2.5">
        <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
          Scam Vector Analysis
        </span>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* Vector 1: Remote Access */}
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300">Remote Access / AnyDesk</span>
              <span className={`font-bold ${vectors.remote_access?.score ? (vectors.remote_access.score > 50 ? 'text-red-400' : 'text-amber-400') : 'text-slate-500'}`}>
                {vectors.remote_access?.score.toFixed(0) || 0}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all duration-300"
                style={{ width: `${vectors.remote_access?.score || 0}%` }}
              />
            </div>
          </div>

          {/* Vector 2: OTP / 2FA Theft */}
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300">OTP & Credential Interception</span>
              <span className={`font-bold ${vectors.otp_credentials?.score ? (vectors.otp_credentials.score > 50 ? 'text-red-400' : 'text-amber-400') : 'text-slate-500'}`}>
                {vectors.otp_credentials?.score.toFixed(0) || 0}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${vectors.otp_credentials?.score || 0}%` }}
              />
            </div>
          </div>

          {/* Vector 3: Financial Demand / Gift Cards */}
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300">Financial & Gift Card Demands</span>
              <span className={`font-bold ${vectors.financial_demand?.score ? (vectors.financial_demand.score > 50 ? 'text-red-400' : 'text-amber-400') : 'text-slate-500'}`}>
                {vectors.financial_demand?.score.toFixed(0) || 0}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${vectors.financial_demand?.score || 0}%` }}
              />
            </div>
          </div>

          {/* Vector 4: Urgency & Coercion */}
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300">Psychological Urgency & Fear</span>
              <span className={`font-bold ${vectors.urgency_coercion?.score ? (vectors.urgency_coercion.score > 50 ? 'text-red-400' : 'text-amber-400') : 'text-slate-500'}`}>
                {vectors.urgency_coercion?.score.toFixed(0) || 0}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-500 transition-all duration-300"
                style={{ width: `${vectors.urgency_coercion?.score || 0}%` }}
              />
            </div>
          </div>

          {/* Vector 5: Authority Impersonation */}
          <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/80 md:col-span-2 flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs font-mono">
              <span className="text-slate-300">Authority / Institutional Impersonation (IRS/Bank/MSFT)</span>
              <span className={`font-bold ${vectors.authority_impersonation?.score ? (vectors.authority_impersonation.score > 50 ? 'text-red-400' : 'text-cyan-400') : 'text-slate-500'}`}>
                {vectors.authority_impersonation?.score.toFixed(0) || 0}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-300"
                style={{ width: `${vectors.authority_impersonation?.score || 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Critical Triggers Banner if triggered */}
      {latestEvaluation?.critical_triggers && latestEvaluation.critical_triggers.length > 0 && (
        <div className="bg-red-950/90 border border-red-500/80 p-3 rounded-lg flex items-start gap-2.5 animate-glow-red">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-mono text-xs font-bold text-red-200 uppercase tracking-wide block">
              CRITICAL THREAT TRIGGERS ENGAGED
            </span>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {latestEvaluation.critical_triggers.map((trigger, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-red-900/80 border border-red-400/50 text-red-100 rounded text-[11px] font-mono font-bold">
                  {trigger}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

