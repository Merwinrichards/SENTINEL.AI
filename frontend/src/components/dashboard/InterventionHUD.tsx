import React from 'react';
import { ShieldAlert, PhoneOff, RotateCcw, Volume2, BellRing, Lock, ShieldCheck, Zap, AlertTriangle } from 'lucide-react';
import { CallState, InterventionStatus, ThreatLevel } from '../../types/sentinel';

interface InterventionHUDProps {
  status: InterventionStatus;
  callState: CallState;
  threatState?: ThreatLevel;
  threatScore?: number;
  onTriggerKillSwitch: () => void;
  onResetKillSwitch: () => void;
}

export const InterventionHUD: React.FC<InterventionHUDProps> = ({
  status,
  callState,
  threatState = 'GREEN',
  threatScore = 0,
  onTriggerKillSwitch,
  onResetKillSwitch,
}) => {
  const isInterventionActive =
    status.is_active ||
    callState === 'CALL_TERMINATED' ||
    callState === 'KILL_SWITCH_ACTIVE' ||
    threatState === 'RED';

  const isArmed = !isInterventionActive && (threatState === 'ORANGE' || threatState === 'YELLOW' || threatScore >= 35);
  const isResolved = !isInterventionActive && callState === 'COMPLETED';
  const isStandby = !isInterventionActive && !isArmed && !isResolved;

  const mode = isInterventionActive
    ? 'ACTIVE'
    : isArmed
    ? 'ARMED'
    : isResolved
    ? 'RESOLVED'
    : 'STANDBY';

  return (
    <div
      className={`rounded-xl p-3.5 flex flex-col gap-2.5 shadow-2xl transition-all duration-500 border ${
        mode === 'ACTIVE'
          ? 'bg-red-950/40 border-red-500/80 shadow-[0_0_25px_rgba(239,68,68,0.25)] ring-1 ring-red-500/50'
          : mode === 'ARMED'
          ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
          : mode === 'RESOLVED'
          ? 'bg-emerald-950/30 border-emerald-500/50'
          : 'bg-slate-900/90 border-slate-800/90'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          {mode === 'ACTIVE' ? (
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-red-400 animate-pulse" />
          ) : mode === 'ARMED' ? (
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-pulse" />
          ) : mode === 'RESOLVED' ? (
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
          ) : (
            <Zap className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
          )}
          <span className="font-mono text-[11px] font-bold tracking-tight text-slate-200 truncate">
            AUTONOMOUS INTERVENTION & KILL-SWITCH
          </span>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full border text-[8.5px] font-mono font-bold whitespace-nowrap shrink-0 ${
            mode === 'ACTIVE'
              ? 'bg-red-900/90 border-red-400 text-red-200 animate-pulse'
              : mode === 'ARMED'
              ? 'bg-amber-950 border-amber-500 text-amber-300 animate-pulse'
              : mode === 'RESOLVED'
              ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
              : 'bg-slate-950 border-slate-800 text-slate-400'
          }`}
        >
          {mode === 'ACTIVE'
            ? 'ACTIVE // KILL-SWITCH ENGAGED'
            : mode === 'ARMED'
            ? 'ARMED // THREAT STANDBY'
            : mode === 'RESOLVED'
            ? 'RESOLVED // CONTAINED'
            : 'STANDBY // SYSTEM SECURE'}
        </span>
      </div>

      {/* Main Status Display Body */}
      {mode === 'ACTIVE' && (
        <div className="bg-red-950/70 border border-red-500/50 rounded-lg p-2.5 flex flex-col gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-red-900/80 rounded-lg border border-red-400 text-red-200 shrink-0">
              <PhoneOff className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-mono text-[11px] font-bold text-red-200 tracking-tight leading-tight truncate">
                CALL SEVERED — THREAT NEUTRALIZED
              </h3>
              <p className="font-mono text-[9px] text-red-300/80 leading-tight">
                Trigger: <strong className="text-red-200">{status.trigger_source || 'AUTONOMOUS_DEFENSE'}</strong>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 text-[8.5px] font-mono">
            <div className="flex flex-col items-center justify-center text-center bg-slate-950/70 py-1 px-1 rounded border border-red-500/30 text-red-200 min-w-0">
              <Volume2 className="w-3 h-3 text-red-400 mb-0.5 shrink-0" />
              <span className="leading-tight font-medium">Voice Warning Broadcasted</span>
            </div>

            <div className="flex flex-col items-center justify-center text-center bg-slate-950/70 py-1 px-1 rounded border border-red-500/30 text-red-200 min-w-0">
              <BellRing className="w-3 h-3 text-red-400 mb-0.5 shrink-0" />
              <span className="leading-tight font-medium">Fraud Desk Notified</span>
            </div>

            <div className="flex flex-col items-center justify-center text-center bg-slate-950/70 py-1 px-1 rounded border border-red-500/30 text-red-200 min-w-0">
              <Lock className="w-3 h-3 text-red-400 mb-0.5 shrink-0" />
              <span className="leading-tight font-medium">SHA-256 Block Sealed</span>
            </div>
          </div>

          {status.reason && (
            <div className="text-[9.5px] font-mono text-slate-300 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80 leading-snug">
              <span className="text-red-400 font-bold">Reason:</span> {status.reason}
            </div>
          )}
        </div>
      )}

      {mode === 'ARMED' && (
        <div className="bg-amber-950/40 border border-amber-500/40 rounded-lg p-2.5 flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h4 className="font-mono text-[11px] font-bold text-amber-300 leading-tight">
              Countermeasures Armed & Primed
            </h4>
            <p className="font-mono text-[9.5px] text-slate-400 mt-0.5 leading-snug">
              Suspicious indicators detected. Synthetic voice injection ready, audio kill-switch standing by.
            </p>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-ping shadow-[0_0_10px_#f59e0b] shrink-0" />
        </div>
      )}

      {mode === 'RESOLVED' && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-lg p-2.5 flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h4 className="font-mono text-[11px] font-bold text-emerald-300 leading-tight">
              Incident Resolved & Preserved
            </h4>
            <p className="font-mono text-[9.5px] text-slate-400 mt-0.5 leading-snug">
              Session completed. All cryptographic forensic blocks sealed in blockchain ledger.
            </p>
          </div>
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
        </div>
      )}

      {mode === 'STANDBY' && (
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h4 className="font-mono text-[11px] font-bold text-slate-300 leading-tight">
              Continuous Call Protection Active
            </h4>
            <p className="font-mono text-[9.5px] text-slate-500 mt-0.5 leading-snug">
              Multi-agent swarm automatically severs audio line when threat confidence exceeds policy thresholds.
            </p>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] shrink-0" />
        </div>
      )}

      {/* Manual Emergency Controls */}
      <div className="grid grid-cols-2 gap-2 pt-0.5 border-t border-slate-800/60 min-w-0">
        <button
          onClick={onTriggerKillSwitch}
          disabled={mode === 'ACTIVE'}
          className={`py-1.5 px-2 rounded-lg font-mono text-[9.5px] font-bold tracking-wider transition-all border flex items-center justify-center gap-1.5 min-w-0 truncate ${
            mode === 'ACTIVE'
              ? 'border-slate-800 bg-slate-950/80 text-slate-600 cursor-not-allowed'
              : 'border-red-500/60 bg-red-950/60 text-red-300 hover:bg-red-900/80 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
          }`}
        >
          <PhoneOff className="w-3 h-3 shrink-0" />
          <span className="truncate">MANUAL KILL SWITCH</span>
        </button>

        <button
          onClick={onResetKillSwitch}
          className="py-1.5 px-2 rounded-lg font-mono text-[9.5px] font-bold tracking-wider transition-all border border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700 flex items-center justify-center gap-1.5 min-w-0 truncate"
        >
          <RotateCcw className="w-3 h-3 text-cyan-400 shrink-0" />
          <span className="truncate">RESET INCIDENT</span>
        </button>
      </div>
    </div>
  );
};


