import React, { createContext, useContext, ReactNode } from 'react';
import { useSentinelWebSocket, AgentSwarmState } from '../hooks/useSentinelWebSocket';
import {
  ThreatLevel,
  CallState,
  TranscriptSegment,
  EvidenceBlock,
  InterventionStatus,
  RiskPoint,
  ScamIndicator,
  A2AMessage,
} from '../types/sentinel';
import { ttsService } from '../services/ttsService';

export interface SessionContextType {
  // Session Identity & Telemetry
  sessionId: string;
  activeIncidentId: string;
  activeCorrelationId: string;
  scenarioId: string | null;
  activeScenarioId: string | null;
  callerId: string | null;
  activeCallerId: string | null;

  // Call & Audio State
  callStatus: CallState;
  callState: CallState;
  isStreaming: boolean;
  callDuration: number;
  callDurationSeconds: number;
  audioActivityLevel: number;

  // Threat & Risk Assessment
  threatScore: number;
  threatState: ThreatLevel;
  threatVelocity: number;
  confidence: number;
  decisionDirective: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
  decisionReasons: string[];
  triggeredRules: string[];
  detectedScamIndicators: ScamIndicator[];
  detectedIndicators: ScamIndicator[];
  riskHistory: RiskPoint[];

  // Conversation Dialogue
  conversationTurns: TranscriptSegment[];
  transcript: TranscriptSegment[];

  // Multi-Agent Swarm States & A2A Bus
  agentStates: AgentSwarmState;
  agentSwarm: AgentSwarmState;
  activeMessageLink: { from: string; to: string; type: string } | null;
  telemetryEvents: A2AMessage[];
  a2aHistory: A2AMessage[];

  // Autonomous Intervention & Kill-Switch
  interventionState: InterventionStatus;
  killswitchStatus: InterventionStatus;

  // Cryptographic Evidence Ledger
  evidenceEvents: EvidenceBlock[];
  evidenceChain: EvidenceBlock[];
  isChainValid: boolean;
  chainFailureReason: string | null;

  // Voice Settings & Connection
  connectionStatus: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
  isVoiceWarningEnabled: boolean;
  toggleVoiceWarning: () => void;
  setVoiceWarningEnabled: (enabled: boolean) => void;

  // Central Operations
  startScenario: (scenarioId: string, speedMultiplier?: number) => Promise<void>;
  stopScenario: () => Promise<void>;
  triggerKillSwitch: (reason?: string) => Promise<void>;
  resetSession: () => Promise<void>;
  resetKillSwitch: () => Promise<void>;
  tamperChain: (blockIndex?: number) => Promise<any>;
  repairChain: () => Promise<any>;
  verifyChain: () => Promise<any>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const [isVoiceWarningEnabled, setIsVoiceWarningEnabled] = React.useState<boolean>(true);

  const toggleVoiceWarning = React.useCallback(() => {
    setIsVoiceWarningEnabled((prev) => {
      const next = !prev;
      ttsService.setEnabled(next);
      return next;
    });
  }, []);

  const setVoiceWarningEnabled = React.useCallback((enabled: boolean) => {
    setIsVoiceWarningEnabled(enabled);
    ttsService.setEnabled(enabled);
  }, []);

  const ws = useSentinelWebSocket();

  const resetSession = React.useCallback(async () => {
    await ws.resetKillSwitch();
  }, [ws]);

  const value: SessionContextType = {
    // Session Identity
    sessionId: ws.activeIncidentId,
    activeIncidentId: ws.activeIncidentId,
    activeCorrelationId: ws.activeCorrelationId,
    scenarioId: ws.activeScenarioId,
    activeScenarioId: ws.activeScenarioId,
    callerId: ws.activeCallerId,
    activeCallerId: ws.activeCallerId,

    // Call & Audio State
    callStatus: ws.callState,
    callState: ws.callState,
    isStreaming: ws.isStreaming,
    callDuration: ws.callDurationSeconds,
    callDurationSeconds: ws.callDurationSeconds,
    audioActivityLevel: ws.audioActivityLevel,

    // Threat & Risk Assessment
    threatScore: ws.threatScore,
    threatState: ws.threatState,
    threatVelocity: ws.threatVelocity,
    confidence: ws.confidence,
    decisionDirective: ws.decisionDirective,
    decisionReasons: ws.decisionReasons,
    triggeredRules: ws.decisionReasons,
    detectedScamIndicators: ws.detectedIndicators,
    detectedIndicators: ws.detectedIndicators,
    riskHistory: ws.riskHistory,

    // Conversation Dialogue
    conversationTurns: ws.transcript,
    transcript: ws.transcript,

    // Multi-Agent Swarm States & A2A Bus
    agentStates: ws.agentSwarm,
    agentSwarm: ws.agentSwarm,
    activeMessageLink: ws.activeMessageLink,
    telemetryEvents: ws.a2aHistory,
    a2aHistory: ws.a2aHistory,

    // Autonomous Intervention & Kill-Switch
    interventionState: ws.killswitchStatus,
    killswitchStatus: ws.killswitchStatus,

    // Cryptographic Evidence Ledger
    evidenceEvents: ws.evidenceChain,
    evidenceChain: ws.evidenceChain,
    isChainValid: ws.isChainValid,
    chainFailureReason: ws.chainFailureReason,

    // Voice Settings & Connection
    connectionStatus: ws.connectionStatus,
    isVoiceWarningEnabled,
    toggleVoiceWarning,
    setVoiceWarningEnabled,

    // Central Operations
    startScenario: ws.startScenario,
    stopScenario: ws.stopScenario,
    triggerKillSwitch: ws.triggerKillSwitch,
    resetSession,
    resetKillSwitch: ws.resetKillSwitch,
    tamperChain: ws.tamperChain,
    repairChain: ws.repairChain,
    verifyChain: ws.verifyChain,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
};

export function useSession(): SessionContextType {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

