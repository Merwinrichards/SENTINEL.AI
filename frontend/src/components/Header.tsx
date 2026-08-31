import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity, Lock, Download, Volume2, VolumeX, Radio } from 'lucide-react';
import { ThreatLevel } from '../types/sentinel';
import { soundEffects } from '../utils/soundEffects';

interface HeaderProps {
  isConnected: boolean;
  threatState: ThreatLevel;
  isChainValid: boolean;
  isStreaming: boolean;
  activeCallerId: string | null;
  onOpenReportModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isConnected,
  threatState,
  isChainValid,
  isStreaming,
  activeCallerId,
  onOpenReportModal
}) => {
  const [isMuted, setIsMuted] = React.useState(false);

  const handleToggleSound = () => {
    const muted = soundEffects.toggleMute();
    setIsMuted(muted);
  };

  const getThreatBadge = () => {
    switch (threatState) {
      case 'RED':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-950/80 border border-red-500/60 rounded-full text-red-400 font-mono text-xs font-semibold animate-pulse">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>DEFCON 1 // CRITICAL INTERVENTION</span>
          </div>
        );
      case 'ORANGE':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-orange-950/80 border border-orange-500/60 rounded-full text-orange-400 font-mono text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <span>ELEVATED THREAT DETECTED</span>
          </div>
        );
      case 'YELLOW':
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-950/80 border border-amber-500/60 rounded-full text-amber-400 font-mono text-xs font-semibold">
            <Activity className="w-4 h-4 text-amber-400" />
            <span>GUARDED // ANOMALIES FLAGGED</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/80 border border-emerald-500/60 rounded-full text-emerald-400 font-mono text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>ALL CHANNELS CLEAR // SECURE</span>
          </div>
        );
    }
  };

  return (
    <header className="border-b border-sentinel-border bg-sentinel-card/90 backdrop-blur-md px-6 py-3.5 sticky top-0 z-40">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Brand / Title */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Shield className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            {isStreaming && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold tracking-wider text-white font-mono">
                SENTINEL<span className="text-cyan-400 font-normal">.AI</span>
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 bg-cyan-950 border border-cyan-500/40 text-cyan-400 rounded font-mono font-bold">
                SOC v2.4
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Autonomous Real-Time Scam-Call Defense & Cryptographic Evidence Platform
            </p>
          </div>
        </div>

        {/* Middle: Live Call & Threat Badge */}
        <div className="flex items-center gap-3">
          {activeCallerId && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-700 rounded-md text-xs font-mono text-slate-300">
              <Radio className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="text-slate-400">INBOUND:</span>
              <span className="text-cyan-300 font-semibold">{activeCallerId}</span>
            </div>
          )}
          {getThreatBadge()}
        </div>

        {/* Right: Telemetry & Forensic Actions */}
        <div className="flex items-center gap-2.5">
          {/* Blockchain Seal Status */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-mono ${
            isChainValid 
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' 
              : 'bg-red-950/80 border-red-500/80 text-red-300 animate-pulse'
          }`}>
            <Lock className="w-3.5 h-3.5" />
            <span>SHA-256 CHAIN: {isChainValid ? 'VERIFIED' : 'COMPROMISED'}</span>
          </div>

          {/* WS Status */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-900/80 border border-slate-800 rounded text-xs font-mono text-slate-400">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-red-400'}`} />
            <span>{isConnected ? 'LIVE FEED' : 'OFFLINE'}</span>
          </div>

          {/* Sound Mute Toggle */}
          <button
            onClick={handleToggleSound}
            className="p-1.5 rounded bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition"
            title={isMuted ? 'Unmute alerts' : 'Mute alerts'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Export Forensic Report */}
          <button
            onClick={onOpenReportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold text-xs rounded transition shadow-md shadow-cyan-600/20"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>AUDIT CERTIFICATE</span>
          </button>
        </div>
      </div>
    </header>
  );
};

