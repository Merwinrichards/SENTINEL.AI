import React from 'react';
import {
  Volume2,
  VolumeX,
  FileCheck2,
  Radio,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Lock
} from 'lucide-react';
import { ThreatLevel, NavigationTab, CallState } from '../../types/sentinel';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

interface TopHeaderProps {
  currentTab?: NavigationTab;
  threatLevel: ThreatLevel;
  threatScore: number;
  activeSessionId: string;
  isVoiceWarningEnabled: boolean;
  onToggleVoiceWarning: () => void;
  onOpenAuditExport: () => void;
  connectionStatus: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
  callState?: CallState;
  isStreaming?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  threatLevel,
  threatScore,
  activeSessionId,
  isVoiceWarningEnabled,
  onToggleVoiceWarning,
  onOpenAuditExport,
  connectionStatus,
  callState,
  isStreaming,
}) => {
  const animatedScore = useAnimatedNumber(Math.round(threatScore), 400);

  // Map DEFCON visual badge — Strongest Global Status Indicator
  const getDefconBadge = (level: ThreatLevel) => {
    switch (level) {
      case 'RED':
        return {
          label: 'DEFCON 1 // CRITICAL',
          sub: 'LINE SEVERED',
          bg: 'bg-red-500/20 border-red-500 text-red-300 shadow-md shadow-red-950/80 animate-pulse ring-1 ring-red-500/60',
          dot: 'bg-red-500 shadow-md shadow-red-500 animate-ping',
          icon: ShieldAlert,
        };
      case 'ORANGE':
        return {
          label: 'DEFCON 2 // HIGH',
          sub: 'KILLSWITCH ARMED',
          bg: 'bg-orange-500/20 border-orange-500 text-orange-300 shadow-md shadow-orange-950/50 ring-1 ring-orange-500/40',
          dot: 'bg-orange-500',
          icon: AlertTriangle,
        };
      case 'YELLOW':
        return {
          label: 'DEFCON 3 // GUARDED',
          sub: 'ANOMALIES DETECTED',
          bg: 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm ring-1 ring-amber-500/30',
          dot: 'bg-amber-500',
          icon: AlertTriangle,
        };
      case 'GREEN':
      default:
        return {
          label: 'DEFCON 4 // SAFE',
          sub: 'NORMAL BASELINE',
          bg: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300',
          dot: 'bg-emerald-400',
          icon: ShieldCheck,
        };
    }
  };

  const defcon = getDefconBadge(threatLevel);
  const DefconIcon = defcon.icon;

  return (
    <header className="h-14 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-20 select-none shrink-0 gap-3 overflow-x-auto no-scrollbar">
      {/* Left Operational Telemetry Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
        {/* Live Protection Status Chip */}
        <div className="h-8 flex items-center gap-2 px-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] font-mono shrink-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                threatLevel === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                  ? 'bg-red-400 animate-ping'
                  : callState === 'CALL_ACTIVE' || isStreaming
                  ? 'bg-emerald-400 animate-ping'
                  : 'bg-slate-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                threatLevel === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                  ? 'bg-red-500'
                  : callState === 'CALL_ACTIVE' || isStreaming
                  ? 'bg-emerald-500'
                  : 'bg-slate-500'
              }`}
            />
          </span>
          <span className="text-slate-300 font-semibold truncate hidden lg:inline">
            LIVE PROTECTION:{' '}
            <span
              className={
                threatLevel === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                  ? 'text-red-400 font-bold'
                  : callState === 'CALL_ACTIVE' || isStreaming
                  ? 'text-emerald-400 font-bold'
                  : 'text-slate-400 font-normal'
              }
            >
              {threatLevel === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                ? 'TERMINATED'
                : callState === 'CALL_ACTIVE' || isStreaming
                ? 'ACTIVE'
                : 'STANDBY'}
            </span>
          </span>
          <span
            className={`font-bold text-[11px] lg:hidden ${
              threatLevel === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                ? 'text-red-400'
                : callState === 'CALL_ACTIVE' || isStreaming
                ? 'text-emerald-400'
                : 'text-slate-400'
            }`}
          >
            {threatLevel === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
              ? 'TERMINATED'
              : callState === 'CALL_ACTIVE' || isStreaming
              ? 'ACTIVE'
              : 'IDLE'}
          </span>
        </div>

        {/* WebSocket Connection Pill */}
        <div
          className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-[10px] font-mono font-bold border shrink-0 ${
            connectionStatus === 'CONNECTED'
              ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-400'
              : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
              ? 'bg-amber-950/40 border-amber-800/60 text-amber-400 animate-pulse'
              : 'bg-rose-950/40 border-rose-800/60 text-rose-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              connectionStatus === 'CONNECTED'
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400'
                : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                ? 'bg-amber-400'
                : 'bg-rose-400'
            }`}
          />
          <span>{connectionStatus}</span>
        </div>

        {/* Visually Secondary Session ID Chip */}
        <div className="h-8 hidden md:flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[10px] font-mono text-slate-400 shrink-0">
          <Radio className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-slate-500">Session:</span>
          <span className="font-semibold text-slate-300 truncate max-w-[110px]">
            {activeSessionId || 'IDLE'}
          </span>
        </div>
      </div>

      {/* Right Operational Controls & Strong Threat Indicators */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Strongest Global Status Indicator: DEFCON Badge */}
        <div
          className={`h-8 flex items-center gap-2 px-3 rounded-lg text-xs font-mono font-bold border transition-all duration-300 shrink-0 ${defcon.bg}`}
        >
          <DefconIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap tracking-wide">{defcon.label}</span>
          <span className="px-1.5 py-0.5 rounded bg-black/50 text-[10px] font-extrabold border border-white/10">
            {animatedScore}/100
          </span>
        </div>

        {/* Clear Voice Advisory Toggle */}
        <button
          onClick={onToggleVoiceWarning}
          title={
            isVoiceWarningEnabled
              ? 'Voice advisory active: synthesizes warning speech upon threat'
              : 'Voice advisory muted'
          }
          className={`h-8 flex items-center gap-1.5 px-2.5 rounded-lg text-xs font-mono font-bold transition-all border shrink-0 ${
            isVoiceWarningEnabled
              ? 'bg-cyan-950/60 border-cyan-500/70 text-cyan-300 hover:bg-cyan-900/60 shadow-sm shadow-cyan-950'
              : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          {isVoiceWarningEnabled ? (
            <>
              <Volume2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shrink-0" />
                VOICE ON
              </span>
            </>
          ) : (
            <>
              <VolumeX className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
                VOICE OFF
              </span>
            </>
          )}
        </button>

        {/* Secondary Export Audit Button */}
        <button
          onClick={onOpenAuditExport}
          className="h-8 flex items-center gap-1.5 px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-mono font-semibold text-slate-300 hover:text-cyan-300 transition-all shrink-0"
        >
          <FileCheck2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="whitespace-nowrap hidden sm:inline">EXPORT AUDIT</span>
          <span className="whitespace-nowrap sm:hidden">EXPORT</span>
        </button>
      </div>
    </header>
  );
};


