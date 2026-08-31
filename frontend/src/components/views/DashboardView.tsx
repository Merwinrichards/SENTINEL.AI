import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Radio,
  Zap,
  Lock,
  MessageSquare,
} from 'lucide-react';
import {
  ThreatLevel,
  CallState,
  TranscriptSegment,
  EvidenceBlock,
  InterventionStatus,
  RiskPoint,
  ScamIndicator,
} from '../../types/sentinel';
import { LiveCallPanel } from '../dashboard/LiveCallPanel';
import { ThreatAnalysisPanel } from '../dashboard/ThreatAnalysisPanel';
import { DetectionIndicators } from '../dashboard/DetectionIndicators';
import { RiskHistoryChart } from '../dashboard/RiskHistoryChart';
import { AgentSwarmView } from '../dashboard/AgentSwarmView';
import { InterventionHUD } from '../dashboard/InterventionHUD';
import { TranscriptStream } from '../TranscriptStream';
import { DemoPipelineTracker } from '../dashboard/DemoPipelineTracker';
import { AgentSwarmState } from '../../hooks/useSentinelWebSocket';

import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

interface DashboardViewProps {
  threatState: ThreatLevel;
  threatScore: number;
  threatVelocity: number;
  confidence: number;
  decisionDirective: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
  decisionReasons: string[];
  detectedIndicators: ScamIndicator[];
  transcript: TranscriptSegment[];
  evidenceChain: EvidenceBlock[];
  isChainValid: boolean;
  agentSwarm: AgentSwarmState;
  activeMessageLink: { from: string; to: string; type: string } | null;
  killswitchStatus: InterventionStatus;
  riskHistory: RiskPoint[];
  callState: CallState;
  isStreaming: boolean;
  callDurationSeconds: number;
  audioActivityLevel: number;
  activeScenarioId: string | null;
  activeCallerId: string | null;
  onStartScenario: (scenarioId: string, speedMultiplier?: number) => Promise<void>;
  onStopScenario: () => Promise<void>;
  onTriggerKillSwitch: (reason?: string) => Promise<void>;
  onResetKillSwitch: () => Promise<void>;
  onOpenAuditCertificate?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  threatState,
  threatScore,
  threatVelocity,
  confidence,
  decisionDirective,
  decisionReasons,
  detectedIndicators,
  transcript,
  evidenceChain,
  isChainValid,
  agentSwarm,
  activeMessageLink,
  killswitchStatus,
  riskHistory,
  callState,
  isStreaming,
  callDurationSeconds,
  audioActivityLevel,
  activeScenarioId,
  activeCallerId,
  onStartScenario,
  onStopScenario,
  onTriggerKillSwitch,
  onResetKillSwitch,
  onOpenAuditCertificate,
}) => {
  // Guarantee effective threat state & score synchronization with evidence
  const isEvidenceCritical = evidenceChain.some(
    (b) => b.event_type.includes('INTERVENTION') || b.event_type.includes('KILLSWITCH') || (b.payload?.score === 100)
  );
  const effectiveThreatScore = threatScore === 0 && isEvidenceCritical ? 100 : threatScore;
  const effectiveThreatState: ThreatLevel = threatState === 'GREEN' && isEvidenceCritical ? 'RED' : threatState;
  const effectiveDecision = effectiveThreatState === 'RED' ? 'INTERVENE' : decisionDirective;

  const animatedScore = useAnimatedNumber(Math.round(effectiveThreatScore), 400);
  const animatedConfidence = useAnimatedNumber(confidence || 98, 300);

  // Format seconds to mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Collect highlighted phrases from indicators
  const highlightedPhrases = detectedIndicators.map((i) => i.matched_signal).filter(Boolean);

  // Severity-based styling helper
  const getSeverityStyle = (state: ThreatLevel) => {
    switch (state) {
      case 'RED':
        return {
          text: 'text-red-400',
          bg: 'bg-red-950/40',
          border: 'border-red-500/60',
          badge: 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse',
          bar: 'bg-red-500 shadow-sm shadow-red-500',
          label: 'CRITICAL THREAT (DEFCON 1)',
        };
      case 'ORANGE':
        return {
          text: 'text-orange-400',
          bg: 'bg-orange-950/30',
          border: 'border-orange-500/50',
          badge: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
          bar: 'bg-orange-500',
          label: 'HIGH THREAT (DEFCON 2)',
        };
      case 'YELLOW':
        return {
          text: 'text-amber-400',
          bg: 'bg-amber-950/30',
          border: 'border-amber-500/50',
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500/50',
          bar: 'bg-amber-500',
          label: 'GUARDED (DEFCON 3)',
        };
      default:
        return {
          text: 'text-emerald-400',
          bg: 'bg-slate-900/80',
          border: 'border-slate-800',
          badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          bar: 'bg-emerald-400',
          label: 'SAFE BASELINE (DEFCON 4)',
        };
    }
  };

  const sevStyle = getSeverityStyle(effectiveThreatState);

  return (
    <div className="p-6 space-y-5 max-w-[1920px] mx-auto select-none">
      {/* 6-Stage Autonomous Incident Defense Pipeline Tracker (DETECT → ANALYZE → CORRELATE → DECIDE → INTERVENE → VERIFY) */}
      <DemoPipelineTracker
        threatState={effectiveThreatState}
        threatScore={effectiveThreatScore}
        decisionDirective={effectiveDecision}
        callState={callState}
        isStreaming={isStreaming}
        transcriptLength={transcript.length}
        indicators={detectedIndicators}
        evidenceCount={evidenceChain.length}
        killswitchActive={killswitchStatus.is_active || effectiveThreatState === 'RED'}
        onOpenAuditCertificate={onOpenAuditCertificate}
      />

      {/* 4 Hero Metric KPI Cards: Immediate 3-Second Threat Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Metric 1: Threat Score Gauge */}
        <div className={`p-4 rounded-xl border shadow-lg relative overflow-hidden transition-all ${sevStyle.bg} ${sevStyle.border}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              Calculated Threat Score
            </span>
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${sevStyle.badge}`}>
              {sevStyle.label}
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-extrabold font-mono tracking-tight ${sevStyle.text}`}>
                {animatedScore}
              </span>
              <span className="text-xs font-mono text-slate-500">/ 100</span>
            </div>
            {threatVelocity !== 0 && (
              <span
                className={`text-xs font-mono font-semibold flex items-center gap-0.5 ${
                  threatVelocity > 0 ? 'text-red-400' : 'text-emerald-400'
                }`}
              >
                {threatVelocity > 0 ? `+${threatVelocity}` : threatVelocity} pts/turn
              </span>
            )}
          </div>
          <div className="mt-2.5 w-full bg-slate-800/80 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${sevStyle.bar}`}
              style={{ width: `${Math.min(100, effectiveThreatScore)}%` }}
            />
          </div>
        </div>

        {/* Metric 2: Threat State & Decision Directive */}
        <div className={`p-4 rounded-xl border shadow-lg relative overflow-hidden transition-all ${sevStyle.bg} ${sevStyle.border}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
              Threat State & Decision
            </span>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
              DIRECTIVE: {effectiveDecision}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className={`text-2xl font-extrabold font-mono tracking-wider ${sevStyle.text}`}>
                DEFCON {effectiveThreatState}
              </span>
              <p className="text-[11px] text-slate-300 font-sans mt-0.5 font-medium">
                {effectiveDecision === 'INTERVENE'
                  ? 'Autonomous line severance engaged'
                  : effectiveDecision === 'WARN'
                  ? 'Synthetic voice advisory armed'
                  : effectiveDecision === 'MONITOR'
                  ? 'Surveillance of suspicious signals'
                  : 'Normal conversational baseline'}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center border ${sevStyle.badge}`}
            >
              {effectiveThreatState === 'RED' ? (
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              ) : effectiveThreatState === 'ORANGE' || effectiveThreatState === 'YELLOW' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
          </div>
        </div>

        {/* Metric 3: Active Session Telemetry */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              Session Telemetry
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                callState === 'KILL_SWITCH_ACTIVE' || callState === 'CALL_TERMINATED'
                  ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                  : callState === 'CALL_ACTIVE' || callState === 'MONITORING'
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              {callState}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold font-mono text-slate-100">
                {formatDuration(callDurationSeconds)}
              </span>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                {transcript.length} dialogue turns captured
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Caller ID</div>
              <div className="text-xs font-mono font-bold text-cyan-400 truncate max-w-[200px]" title={activeCallerId || '+1 (800) 555-0199 [DEMO SPOOF]'}>
                {activeCallerId || '+1 (800) 555-0199 [DEMO SPOOF]'}
              </div>
            </div>
          </div>
        </div>

        {/* Metric 4: Confidence & Blockchain Proof */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-lg relative overflow-hidden hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              Evidence & Verification
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                isChainValid
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
              }`}
            >
              {isChainValid ? 'CHAIN SEALED' : 'TAMPER DETECTED'}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold font-mono text-slate-100">
                {animatedConfidence}%
              </span>
              <p className="text-[11px] text-slate-400 font-sans mt-0.5">
                Multi-agent consensus confidence
              </p>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-mono uppercase font-bold">Forensic Ledger</div>
              <div className="text-xs font-mono font-bold text-cyan-400">
                #{evidenceChain.length} Blocks
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main 3-Column Command Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Live Call Controls & Real-Time Transcript Stream (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <LiveCallPanel
            callState={callState}
            isStreaming={isStreaming}
            activeScenarioId={activeScenarioId}
            activeCallerId={activeCallerId}
            durationSeconds={callDurationSeconds}
            audioActivityLevel={audioActivityLevel}
            onStartScenario={(scId: string, speed: number) => onStartScenario(scId, speed)}
            onStopScenario={onStopScenario}
          />

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold font-mono text-slate-200 tracking-wider uppercase">
                  Live Conversation Timeline
                </h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                {transcript.length} turns
              </span>
            </div>
            <div className="max-h-[380px] overflow-y-auto pr-1">
              <TranscriptStream
                transcript={transcript}
                highlightedPhrases={highlightedPhrases}
              />
            </div>
          </div>
        </div>

        {/* Center Column: Threat Analysis & Decision Engine & Scam Indicators (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <ThreatAnalysisPanel
            score={effectiveThreatScore}
            threatState={effectiveThreatState}
            decision={effectiveDecision}
            confidence={confidence}
            velocity={threatVelocity}
            reasons={decisionReasons}
          />

          <DetectionIndicators indicators={detectedIndicators} />
        </div>

        {/* Right Column: Automated Intervention HUD, Risk Curve & Agent Swarm (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <InterventionHUD
            status={killswitchStatus}
            callState={callState}
            threatState={effectiveThreatState}
            threatScore={effectiveThreatScore}
            onTriggerKillSwitch={() => onTriggerKillSwitch('MANUAL_OPERATOR_ENGAGEMENT')}
            onResetKillSwitch={onResetKillSwitch}
          />

          <RiskHistoryChart history={riskHistory} />

          <AgentSwarmView
            swarm={agentSwarm}
            activeMessageLink={activeMessageLink}
          />
        </div>
      </div>
    </div>
  );
};


