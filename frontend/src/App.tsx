import React, { useState } from 'react';
import { useSession } from './context/SessionContext';
import { NavigationTab } from './types/sentinel';
import { Sidebar } from './components/layout/Sidebar';
import { TopHeader } from './components/layout/TopHeader';
import { DashboardView } from './components/views/DashboardView';
import { LiveCallView } from './components/views/LiveCallView';
import { ThreatIntelligenceView } from './components/views/ThreatIntelligenceView';
import { EvidenceView } from './components/views/EvidenceView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ForensicReportModal } from './components/ForensicReportModal';
import { AudioLabConsole } from './components/AudioLabConsole';
import { Terminal } from 'lucide-react';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('DASHBOARD');
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const [showAudioLab, setShowAudioLab] = useState<boolean>(false);

  // Centralized session state & dispatchers (Single Source of Truth)
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
    evidenceChain,
    isChainValid,
    a2aHistory,
    agentSwarm,
    activeMessageLink,
    killswitchStatus,
    isVoiceWarningEnabled,
    toggleVoiceWarning,
    startScenario,
    stopScenario,
    triggerKillSwitch,
    resetSession,
    tamperChain,
    repairChain,
  } = useSession();

  const handleStartScenario = async (scenarioId: string, speedMultiplier?: number) => {
    await startScenario(scenarioId, speedMultiplier);
  };

  const handleStopScenario = async () => {
    await stopScenario();
  };

  const handleTriggerKillSwitch = async (reason?: string) => {
    await triggerKillSwitch(reason);
  };

  const handleResetKillSwitch = async () => {
    await resetSession();
  };

  const handleSimulateTamper = async () => {
    await tamperChain(0);
  };

  const handleRepairChain = async () => {
    await repairChain();
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Left Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        threatScore={threatScore}
        threatState={threatState}
        activeIncidentId={activeIncidentId}
        callState={callState}
        isStreaming={isStreaming}
        evidenceCount={evidenceChain.length}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Global Header */}
        <TopHeader
          currentTab={currentTab}
          threatLevel={threatState}
          threatScore={threatScore}
          activeSessionId={activeIncidentId}
          isVoiceWarningEnabled={isVoiceWarningEnabled}
          onToggleVoiceWarning={toggleVoiceWarning}
          onOpenAuditExport={() => setIsAuditModalOpen(true)}
          connectionStatus={connectionStatus}
          callState={callState}
          isStreaming={isStreaming}
        />

        {/* Scrollable View Area */}
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900/50">
          {currentTab === 'DASHBOARD' && (
            <DashboardView
              threatState={threatState}
              threatScore={threatScore}
              threatVelocity={threatVelocity}
              confidence={confidence}
              decisionDirective={decisionDirective}
              decisionReasons={decisionReasons}
              detectedIndicators={detectedIndicators}
              transcript={transcript}
              evidenceChain={evidenceChain}
              isChainValid={isChainValid}
              agentSwarm={agentSwarm}
              activeMessageLink={activeMessageLink}
              killswitchStatus={killswitchStatus}
              riskHistory={riskHistory}
              callState={callState}
              isStreaming={isStreaming}
              callDurationSeconds={callDurationSeconds}
              audioActivityLevel={audioActivityLevel}
              activeScenarioId={activeScenarioId}
              activeCallerId={activeCallerId}
              onStartScenario={handleStartScenario}
              onStopScenario={handleStopScenario}
              onTriggerKillSwitch={handleTriggerKillSwitch}
              onResetKillSwitch={handleResetKillSwitch}
              onOpenAuditCertificate={() => setIsAuditModalOpen(true)}
            />
          )}

          {currentTab === 'LIVE_CALL' && (
            <LiveCallView
              callState={callState}
              threatState={threatState}
              threatScore={threatScore}
              callDurationSeconds={callDurationSeconds}
              audioActivityLevel={audioActivityLevel}
              transcript={transcript}
              activeScenarioId={activeScenarioId}
              activeCallerId={activeCallerId}
              activeSessionId={activeIncidentId}
              isVoiceWarningEnabled={isVoiceWarningEnabled}
              onToggleVoiceWarning={toggleVoiceWarning}
              onStartScenario={handleStartScenario}
              onStopScenario={handleStopScenario}
              onTriggerKillSwitch={handleTriggerKillSwitch}
              onResetKillSwitch={handleResetKillSwitch}
              indicators={detectedIndicators}
              decisionDirective={decisionDirective}
              decisionReasons={decisionReasons}
              confidence={confidence}
              evidenceCount={evidenceChain.length}
              onOpenAuditCertificate={() => setIsAuditModalOpen(true)}
            />
          )}

          {currentTab === 'THREAT_INTEL' && (
            <ThreatIntelligenceView
              threatState={threatState}
              threatScore={threatScore}
              indicators={detectedIndicators}
              confidence={confidence}
              decisionDirective={decisionDirective}
              activeIncidentId={activeIncidentId}
              evidenceChain={evidenceChain}
            />
          )}

          {currentTab === 'EVIDENCE' && (
            <EvidenceView
              evidenceChain={evidenceChain}
              isChainValid={isChainValid}
              onSimulateTamper={handleSimulateTamper}
              onRepairChain={handleRepairChain}
              onOpenAuditExport={() => setIsAuditModalOpen(true)}
              activeIncidentId={activeIncidentId}
              threatState={threatState}
              threatScore={threatScore}
            />
          )}

          {currentTab === 'ANALYTICS' && (
            <AnalyticsView
              threatState={threatState}
              threatScore={threatScore}
              threatVelocity={threatVelocity}
              riskHistory={riskHistory}
              indicators={detectedIndicators}
              a2aHistory={a2aHistory}
              currentCorrelationId={activeCorrelationId}
              transcript={transcript}
              activeIncidentId={activeIncidentId}
              evidenceChain={evidenceChain}
            />
          )}
        </main>
      </div>

      {/* Visually Secondary Floating Diagnostic Console Trigger */}
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setShowAudioLab(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/60 text-slate-400 hover:text-cyan-300 text-[11px] font-mono shadow-xl backdrop-blur-md transition-all hover:scale-105 group"
          title="Open SENTINEL Diagnostic & Audio Verification Console"
        >
          <Terminal className="w-3.5 h-3.5 text-cyan-400/80 group-hover:text-cyan-300 group-hover:animate-pulse" />
          <span className="font-semibold tracking-wider">DIAGNOSTICS</span>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/50 group-hover:bg-cyan-400 shrink-0" />
        </button>
      </div>

      {/* Diagnostic Console Overlay Modal */}
      {showAudioLab && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAudioLab(false);
            }
          }}
        >
          <div className="max-w-4xl w-full max-h-[90vh] bg-slate-900/95 border border-slate-800 shadow-2xl rounded-2xl overflow-y-auto p-4 sm:p-6 relative">
            <AudioLabConsole onClose={() => setShowAudioLab(false)} />
          </div>
        </div>
      )}

      {/* Forensic Audit Report Package Modal */}
      <ForensicReportModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
      />
    </div>
  );
}

export default App;
