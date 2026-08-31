import React from 'react';
import {
  Radio,
  Search,
  BrainCircuit,
  Scale,
  ShieldAlert,
  FileCheck2,
  Check,
  Sparkles
} from 'lucide-react';
import { ThreatLevel, CallState, ScamIndicator } from '../../types/sentinel';

interface DemoPipelineTrackerProps {
  threatState: ThreatLevel;
  threatScore: number;
  decisionDirective: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
  callState: CallState;
  isStreaming: boolean;
  transcriptLength: number;
  indicators: ScamIndicator[];
  evidenceCount: number;
  killswitchActive: boolean;
  onOpenAuditCertificate?: () => void;
}

export const DemoPipelineTracker: React.FC<DemoPipelineTrackerProps> = ({
  threatState,
  threatScore,
  decisionDirective,
  callState,
  isStreaming,
  transcriptLength,
  indicators,
  evidenceCount,
  killswitchActive,
  onOpenAuditCertificate,
}) => {
  // Determine progression stages dynamically
  const isDetectActive = callState === 'CALL_ACTIVE' || isStreaming || transcriptLength > 0;
  const isDetectComplete = transcriptLength > 0;

  const isAnalyzeActive = isDetectComplete && indicators.length === 0;
  const isAnalyzeComplete = indicators.length > 0;

  const isCorrelateActive = isAnalyzeComplete && threatScore < 35 && threatState === 'GREEN';
  const isCorrelateComplete = threatScore >= 35 || threatState !== 'GREEN' || indicators.length >= 2;

  const isDecideActive = isCorrelateComplete && decisionDirective === 'ALLOW';
  const isDecideComplete = decisionDirective === 'WARN' || decisionDirective === 'INTERVENE' || threatState === 'RED' || threatState === 'ORANGE';

  const isInterveneActive = isDecideComplete && !killswitchActive && threatState !== 'RED';
  const isInterveneComplete = killswitchActive || threatState === 'RED' || callState === 'CALL_TERMINATED' || callState === 'KILL_SWITCH_ACTIVE';

  const isVerifyActive = isInterveneComplete && evidenceCount === 0;
  const isVerifyComplete = isInterveneComplete && evidenceCount > 0;

  const stages = [
    {
      id: 1,
      name: 'DETECT',
      desc: 'Inbound Speech Ingestion',
      icon: Radio,
      status: isDetectComplete ? 'COMPLETE' : isDetectActive ? 'ACTIVE' : 'IDLE',
      tag: isDetectComplete ? `${transcriptLength} Turns` : isDetectActive ? 'Streaming' : 'Waiting',
    },
    {
      id: 2,
      name: 'ANALYZE',
      desc: 'Semantic Indicator Extraction',
      icon: Search,
      status: isAnalyzeComplete ? 'COMPLETE' : isAnalyzeActive ? 'ACTIVE' : 'IDLE',
      tag: isAnalyzeComplete ? `${indicators.length} Signals` : isAnalyzeActive ? 'Inspecting' : 'Standby',
    },
    {
      id: 3,
      name: 'CORRELATE',
      desc: 'Multi-Vector Synergy Boost',
      icon: BrainCircuit,
      status: isCorrelateComplete ? 'COMPLETE' : isCorrelateActive ? 'ACTIVE' : 'IDLE',
      tag: isCorrelateComplete ? `${threatScore}/100 Risk` : isCorrelateActive ? 'Evaluating' : 'Standby',
    },
    {
      id: 4,
      name: 'DECIDE',
      desc: 'Autonomous Policy Evaluation',
      icon: Scale,
      status: isDecideComplete ? 'COMPLETE' : isDecideActive ? 'ACTIVE' : 'IDLE',
      tag: isDecideComplete ? decisionDirective : isDecideActive ? 'Evaluating' : 'Standby',
    },
    {
      id: 5,
      name: 'INTERVENE',
      desc: 'Voice Warning & Line Severance',
      icon: ShieldAlert,
      status: isInterveneComplete ? 'COMPLETE' : isInterveneActive ? 'ARMED' : 'IDLE',
      tag: isInterveneComplete ? 'Line Severed' : isInterveneActive ? 'Armed' : 'Standby',
    },
    {
      id: 6,
      name: 'VERIFY',
      desc: 'SHA-256 Ledger Forensic Seal',
      icon: FileCheck2,
      status: isVerifyComplete ? 'COMPLETE' : isVerifyActive ? 'SEALING' : 'IDLE',
      tag: isVerifyComplete ? `#${evidenceCount} Sealed` : isVerifyActive ? 'Hashing' : 'Standby',
    },
  ];

  return (
    <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-2xl select-none font-mono">
      {/* Header Pipeline Title */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
            Autonomous Incident Defense Pipeline
          </span>
          <span className="text-[10px] text-slate-500 hidden sm:inline">•</span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Real-Time Defense Lifecycle
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isVerifyComplete && onOpenAuditCertificate && (
            <button
              onClick={onOpenAuditCertificate}
              className="px-2.5 py-1 rounded-lg bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-900 text-[10px] font-bold shadow-md shadow-cyan-950 flex items-center gap-1.5 transition-all hover:scale-105"
            >
              <FileCheck2 className="w-3 h-3 text-cyan-400" />
              <span>CERTIFICATE READY</span>
            </button>
          )}

          <span
            className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
              isInterveneComplete
                ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                : isCorrelateComplete
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                : isDetectActive
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {isInterveneComplete
              ? 'THREAT NEUTRALIZED'
              : isCorrelateComplete
              ? 'ACTIVE ESCALATION'
              : isDetectActive
              ? 'STREAMING CALL'
              : 'SYSTEM READY'}
          </span>
        </div>
      </div>

      {/* 6-Stage Progression Flow */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {stages.map((st) => {
          const Icon = st.icon;
          const isComplete = st.status === 'COMPLETE';
          const isActive = st.status === 'ACTIVE' || st.status === 'ARMED' || st.status === 'SEALING';

          return (
            <div
              key={st.id}
              className={`p-2.5 rounded-lg border transition-all duration-300 flex flex-col justify-between ${
                isComplete
                  ? st.name === 'INTERVENE'
                    ? 'bg-red-950/40 border-red-500/70 shadow-md shadow-red-950'
                    : 'bg-emerald-950/30 border-emerald-500/60 shadow-sm'
                  : isActive
                  ? 'bg-cyan-950/30 border-cyan-500/60 shadow-md shadow-cyan-950/40 animate-pulse ring-1 ring-cyan-500/40'
                  : 'bg-slate-950/60 border-slate-850 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                      isComplete
                        ? st.name === 'INTERVENE'
                          ? 'bg-red-900 text-red-100'
                          : 'bg-emerald-900 text-emerald-100'
                        : isActive
                        ? 'bg-cyan-900 text-cyan-100'
                        : 'bg-slate-900 text-slate-500'
                    }`}
                  >
                    {isComplete ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : st.id}
                  </div>
                  <span
                    className={`text-[11px] font-bold tracking-tight ${
                      isComplete
                        ? st.name === 'INTERVENE'
                          ? 'text-red-300'
                          : 'text-emerald-300'
                        : isActive
                        ? 'text-cyan-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {st.name}
                  </span>
                </div>

                <Icon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isComplete
                      ? st.name === 'INTERVENE'
                        ? 'text-red-400'
                        : 'text-emerald-400'
                      : isActive
                      ? 'text-cyan-400 animate-spin'
                      : 'text-slate-600'
                  }`}
                />
              </div>

              <div className="mt-1 pt-1 border-t border-slate-850 flex items-center justify-between text-[9px]">
                <span className="text-slate-500 truncate">{st.desc}</span>
                <span
                  className={`font-bold shrink-0 ml-1 ${
                    isComplete
                      ? st.name === 'INTERVENE'
                        ? 'text-red-300'
                        : 'text-emerald-400'
                      : isActive
                      ? 'text-cyan-300'
                      : 'text-slate-600'
                  }`}
                >
                  {st.tag}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

