import React, { useState } from 'react';
import { Power, ShieldX, VolumeX, BellRing, PhoneOff, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { InterventionStatus } from '../types/sentinel';
import { soundEffects } from '../utils/soundEffects';

interface KillSwitchControlProps {
  killswitchStatus: InterventionStatus;
  isStreaming: boolean;
  onTriggerKillswitch: (reason?: string) => void;
  onResetKillswitch: () => void;
}

export const KillSwitchControl: React.FC<KillSwitchControlProps> = ({
  killswitchStatus,
  isStreaming,
  onTriggerKillswitch,
  onResetKillswitch
}) => {
  const [customWarning, setCustomWarning] = useState('SENTINEL DEFENSE ADVISORY: High-risk social engineering detected. Hang up immediately.');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleManualKill = () => {
    onTriggerKillswitch('MANUAL_OPERATOR_EMERGENCY_INTERVENTION');
    setShowConfirm(false);
  };

  const handleTestVoiceAdvisory = () => {
    soundEffects.speakSyntheticWarning(customWarning);
  };

  return (
    <div className={`cyber-card p-4 flex flex-col gap-3 transition-all ${
      killswitchStatus.is_active ? 'cyber-card-danger' : ''
    }`}>
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Power className={`w-4 h-4 ${killswitchStatus.is_active ? 'text-red-400 animate-pulse' : 'text-cyan-400'}`} />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Active Intervention & Kill-Switch Center
          </span>
        </div>
        <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
          killswitchStatus.is_active 
            ? 'bg-red-950 border border-red-500 text-red-300 animate-pulse' 
            : 'bg-slate-900 border border-slate-700 text-slate-400'
        }`}>
          {killswitchStatus.is_active ? 'KILL-SWITCH ENGAGED' : 'ARMED / READY'}
        </span>
      </div>

      {/* Main Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
        {/* Emergency Kill Button */}
        <div>
          {!killswitchStatus.is_active ? (
            !showConfirm ? (
              <button
                onClick={() => setShowConfirm(true)}
                className="w-full py-3 bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-mono font-black text-sm rounded-lg shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 tracking-wider transition transform hover:scale-[1.01]"
              >
                <ShieldX className="w-5 h-5 stroke-[2.5]" />
                <span>ENGAGE EMERGENCY KILL-SWITCH</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleManualKill}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-mono font-black text-xs rounded-lg shadow-lg shadow-red-600/40 animate-pulse"
                >
                  CONFIRM CALL TERMINATION
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs rounded-lg"
                >
                  CANCEL
                </button>
              </div>
            )
          ) : (
            <button
              onClick={onResetKillswitch}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-cyan-300 font-mono font-bold text-xs rounded-lg flex items-center justify-center gap-2 transition"
            >
              <RefreshCw className="w-4 h-4" />
              <span>DISARM & RESET DEFENSE PROTOCOLS</span>
            </button>
          )}
        </div>

        {/* Synthetic Voice Broadcast Injector */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={customWarning}
            onChange={(e) => setCustomWarning(e.target.value)}
            placeholder="Custom defensive voice advisory..."
            className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded font-mono text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          />
          <button
            onClick={handleTestVoiceAdvisory}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-400 font-mono text-xs font-bold rounded flex items-center gap-1.5 shrink-0"
            title="Inject defensive speech into browser earpiece"
          >
            <Send className="w-3.5 h-3.5" />
            <span>SPEAK</span>
          </button>
        </div>
      </div>

      {/* Active Countermeasure Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-800/80">
        <div className={`p-2 rounded border font-mono text-xs flex items-center gap-2 ${
          killswitchStatus.audio_stream_severed
            ? 'bg-red-950/80 border-red-500/60 text-red-300 font-bold'
            : 'bg-slate-950/60 border-slate-800 text-slate-500'
        }`}>
          <PhoneOff className="w-4 h-4 shrink-0" />
          <div className="truncate">
            <span className="block text-[10px] text-slate-400">LINE DEFENSE:</span>
            <span>{killswitchStatus.audio_stream_severed ? 'AUDIO SEVERED' : 'LINE OPEN'}</span>
          </div>
        </div>

        <div className={`p-2 rounded border font-mono text-xs flex items-center gap-2 ${
          killswitchStatus.warning_voice_broadcasted
            ? 'bg-orange-950/80 border-orange-500/60 text-orange-300 font-bold'
            : 'bg-slate-950/60 border-slate-800 text-slate-500'
        }`}>
          <VolumeX className="w-4 h-4 shrink-0" />
          <div className="truncate">
            <span className="block text-[10px] text-slate-400">DEFENSIVE AUDIO:</span>
            <span>{killswitchStatus.warning_voice_broadcasted ? 'WARNING INJECTED' : 'STANDBY'}</span>
          </div>
        </div>

        <div className={`p-2 rounded border font-mono text-xs flex items-center gap-2 ${
          killswitchStatus.fraud_desk_notified
            ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 font-bold'
            : 'bg-slate-950/60 border-slate-800 text-slate-500'
        }`}>
          <BellRing className="w-4 h-4 shrink-0" />
          <div className="truncate">
            <span className="block text-[10px] text-slate-400">SOC DISPATCH:</span>
            <span>{killswitchStatus.fraud_desk_notified ? 'INCIDENT LOGGED' : 'STANDBY'}</span>
          </div>
        </div>
      </div>

      {killswitchStatus.defense_summary && (
        <div className="p-2 bg-red-950/60 border border-red-500/50 rounded font-mono text-xs text-red-200">
          <span className="font-bold text-red-300 uppercase">Intervention Record: </span>
          {killswitchStatus.defense_summary}
        </div>
      )}
    </div>
  );
};

