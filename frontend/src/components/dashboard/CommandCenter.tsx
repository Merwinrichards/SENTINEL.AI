import React, { useState } from 'react';
import { Shield, ShieldAlert, ShieldCheck, Activity, Lock, Download, Volume2, VolumeX, Radio, Cpu, CheckCircle } from 'lucide-react';
import { useSentinelWebSocket } from '../../hooks/useSentinelWebSocket';
import { LiveCallPanel } from './LiveCallPanel';
import { ThreatAnalysisPanel } from './ThreatAnalysisPanel';
import { DetectionIndicators } from './DetectionIndicators';
import { RiskHistoryChart } from './RiskHistoryChart';
import { AgentSwarmView } from './AgentSwarmView';
import { A2ALiveFeed } from './A2ALiveFeed';
import { EvidenceBlockchainView } from './EvidenceBlockchainView';
import { InterventionHUD } from './InterventionHUD';
import { TranscriptStream } from '../TranscriptStream';
import { ForensicReportModal } from '../ForensicReportModal';
import { soundEffects } from '../../utils/soundEffects';

export const CommandCenter: React.FC = () => {
  const {
    connectionStatus,
    activeIncidentId,
    activeCorrelationId,
    callState,
    isStreaming,
    activeScenarioId,
    activeCallerId,
    callDurationSeconds,
    audioActivityLevel,
    threatState,
    threatScore,
    threatVelocity,
    confidence,
    decisionDirective,
    decisionReasons,
    detectedIndicators,
    riskHistory,
    transcript,
    agentSwarm,
    a2aHistory,
    evidenceChain,
    isChainValid,
    chainFailureReason,
    activeMessageLink,
    killswitchStatus,
    startScenario,
    stopScenario,
    triggerKillSwitch,
    resetKillSwitch,
    verifyChain,
    tamperChain,
    repairChain,
  } = useSentinelWebSocket();

  const [isMuted, setIsMuted] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleToggleSound = () => {
    const muted = soundEffects.toggleMute();
    setIsMuted(muted);
  };

  const getThreatBadge = () => {
    switch (threatState) {
      case 'RED':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/90 border border-red-500 rounded-full text-red-400 font-mono text-xs font-bold animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <span>DEFCON 1 // INTERVENTION MANDATED</span>
          </div>
        );
      case 'ORANGE':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-950/80 border border-orange-500/80 rounded-full text-orange-400 font-mono text-xs font-bold shadow-[0_0_10px_rgba(249,115,22,0.2)]">
            <ShieldAlert className="w-4 h-4 text-orange-400" />
            <span>ELEVATED SCAM THREAT</span>
          </div>
        );
      case 'YELLOW':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-950/80 border border-amber-500/80 rounded-full text-amber-400 font-mono text-xs font-bold">
            <Activity className="w-4 h-4 text-amber-400" />
            <span>GUARDED // ANOMALIES FLAGGED</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/80 rounded-full text-emerald-400 font-mono text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>CHANNELS CLEAR // SECURE</span>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Operations Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-3 sticky top-0 z-40 shadow-xl">
        <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Shield className="w-6 h-6 text-slate-950 stroke-[2.5]" />
              </div>
              {isStreaming && (
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-500" />
                </span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-extrabold tracking-wider text-white font-mono">
                  SENTINEL<span className="text-cyan-400 font-normal">.AI</span>
                </h1>
                <span className="text-[10px] px-2 py-0.5 bg-cyan-950 border border-cyan-500/40 text-cyan-300 rounded font-mono font-bold">
                  SOC v3.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Autonomous Real-Time Scam-Call Defense & Cryptographic Evidence Platform
              </p>
            </div>
          </div>

          {/* Center: Threat DEFCON Badge */}
          <div className="flex items-center gap-3">
            {getThreatBadge()}
          </div>

          {/* Right: Telemetry Indicators & Quick Actions */}
          <div className="flex items-center gap-3 font-mono text-xs">
            {/* WebSocket Connection Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-950/80">
              <span className={`h-2.5 w-2.5 rounded-full ${
                connectionStatus === 'CONNECTED'
                  ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  : connectionStatus === 'CONNECTING' || connectionStatus === 'RECONNECTING'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-rose-500'
              }`} />
              <span className={connectionStatus === 'CONNECTED' ? 'text-emerald-400 font-bold' : 'text-slate-400'}>
                {connectionStatus}
              </span>
            </div>

            {/* Active Incident Tag */}
            <div className="px-3 py-1.5 rounded-full border border-slate-800 bg-slate-950/80 text-slate-300">
              Incident: <span className="text-cyan-300 font-bold">{activeIncidentId}</span>
            </div>

            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              className={`p-2 rounded-lg border transition ${
                isMuted
                  ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  : 'bg-cyan-950/60 border-cyan-500/40 text-cyan-400 hover:bg-cyan-900/60'
              }`}
              title={isMuted ? 'Unmute Audio Advisories' : 'Mute Audio Advisories'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Export Audit Certificate */}
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold rounded-lg shadow-lg shadow-cyan-500/20 transition"
            >
              <Download className="w-4 h-4" />
              <span>EXPORT AUDIT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Demo Status & Sub-banner */}
      <div className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-1.5 text-[11px] font-mono text-slate-400 flex items-center justify-between">
        <div className="max-w-[1720px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            <span>LIVE MONITORING // SIMULATED CALL SESSION // AUTONOMOUS MULTI-AGENT FRAUD DEFENSE</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span>STT: Streaming WebSocket</span>
            <span>Security: SHA-256 Chained Hashes</span>
            <span>Kill Switch: Active Simulated Termination</span>
          </div>
        </div>
      </div>

      {/* Main 3-Column Operations Grid */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Live Call & Transcript (3.5 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <LiveCallPanel
            callState={callState}
            isStreaming={isStreaming}
            activeScenarioId={activeScenarioId}
            activeCallerId={activeCallerId}
            durationSeconds={callDurationSeconds}
            audioActivityLevel={audioActivityLevel}
            onStartScenario={startScenario}
            onStopScenario={stopScenario}
          />

          <TranscriptStream
            transcript={transcript}
            highlightedPhrases={detectedIndicators.map(i => i.matched_signal)}
          />
        </div>

        {/* CENTER COLUMN: Threat Radar, Risk History, Indicators & Intervention HUD (4.5 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ThreatAnalysisPanel
            score={threatScore}
            threatState={threatState}
            decision={decisionDirective}
            confidence={confidence}
            velocity={threatVelocity}
            reasons={decisionReasons}
          />

          <RiskHistoryChart history={riskHistory} />

          <DetectionIndicators indicators={detectedIndicators} />

          <InterventionHUD
            status={killswitchStatus}
            callState={callState}
            onTriggerKillSwitch={() => triggerKillSwitch('Security Analyst Emergency Override')}
            onResetKillSwitch={resetKillSwitch}
          />
        </div>

        {/* RIGHT COLUMN: Autonomous Agent Swarm, A2A Feed & Cryptographic Ledger (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <AgentSwarmView
            swarm={agentSwarm}
            activeMessageLink={activeMessageLink}
          />

          <A2ALiveFeed
            messages={a2aHistory}
            currentCorrelationId={activeCorrelationId}
          />

          <EvidenceBlockchainView
            chain={evidenceChain}
            isChainValid={isChainValid}
            failureReason={chainFailureReason}
            onVerify={verifyChain}
            onTamper={() => tamperChain(0)}
            onRepair={repairChain}
            onOpenReportModal={() => setIsReportModalOpen(true)}
          />
        </div>

      </main>

      {/* Forensic Report Modal */}
      <ForensicReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
      />
    </div>
  );
};

