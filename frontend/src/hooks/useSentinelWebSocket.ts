import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ThreatLevel,
  CallState,
  AgentStatus,
  InspectorEvaluation,
  DecisionResult,
  TranscriptSegment,
  EvidenceBlock,
  A2AMessage,
  InterventionStatus,
  RiskPoint,
  ScamIndicator
} from '../types/sentinel';
import { soundEffects } from '../utils/soundEffects';
import { ttsService } from '../services/ttsService';
import { api } from '../services/api';

export interface AgentSwarmState {
  inspector: { status: AgentStatus; lastAction: string; lastTurn: number; timestamp: number };
  decisionEngine: { status: AgentStatus; lastAction: string; score: number; state: ThreatLevel; timestamp: number };
  evidenceAgent: { status: AgentStatus; lastAction: string; blockCount: number; timestamp: number };
  interventionAgent: { status: AgentStatus; lastAction: string; isArmed: boolean; isTriggered: boolean; timestamp: number };
}

export function useSentinelWebSocket() {
  // Connection State
  const [connectionStatus, setConnectionStatus] = useState<'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED'>('CONNECTING');
  const [activeIncidentId, setActiveIncidentId] = useState<string>('INC-DEMO-2026-01');
  const [activeCorrelationId, setActiveCorrelationId] = useState<string>('CORR-DEMO-2026-01');

  // Call & Audio Telemetry
  const [callState, setCallState] = useState<CallState>('IDLE');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [activeCallerId, setActiveCallerId] = useState<string | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState<number>(0);
  const [audioActivityLevel, setAudioActivityLevel] = useState<number>(0); // 0.0 to 1.0 for waveform

  // Threat & Risk Telemetry
  const [threatState, setThreatState] = useState<ThreatLevel>('GREEN');
  const [threatScore, setThreatScore] = useState<number>(0);
  const [threatVelocity, setThreatVelocity] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(100);
  const [decisionDirective, setDecisionDirective] = useState<'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE'>('ALLOW');
  const [decisionReasons, setDecisionReasons] = useState<string[]>([]);
  const [detectedIndicators, setDetectedIndicators] = useState<ScamIndicator[]>([]);
  const [riskHistory, setRiskHistory] = useState<RiskPoint[]>([
    { turn: 0, score: 0, timestamp: new Date().toLocaleTimeString(), threatLevel: 'GREEN' }
  ]);

  // Transcripts
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);

  // Agent Swarm Live States
  const [agentSwarm, setAgentSwarm] = useState<AgentSwarmState>({
    inspector: { status: 'IDLE', lastAction: 'Standing by for call audio', lastTurn: 0, timestamp: Date.now() },
    decisionEngine: { status: 'IDLE', lastAction: 'Policy engine loaded', score: 0, state: 'GREEN', timestamp: Date.now() },
    evidenceAgent: { status: 'IDLE', lastAction: 'Genesis block sealed', blockCount: 1, timestamp: Date.now() },
    interventionAgent: { status: 'IDLE', lastAction: 'Kill-switch disarmed & ready', isArmed: true, isTriggered: false, timestamp: Date.now() },
  });

  // A2A Log & Evidence Blockchain
  const [a2aHistory, setA2aHistory] = useState<A2AMessage[]>([]);
  const [evidenceChain, setEvidenceChain] = useState<EvidenceBlock[]>([]);
  const [isChainValid, setIsChainValid] = useState<boolean>(true);
  const [chainFailureReason, setChainFailureReason] = useState<string | null>(null);
  const [activeMessageLink, setActiveMessageLink] = useState<{ from: string; to: string; type: string } | null>(null);

  // Kill Switch Status
  const [killswitchStatus, setKillswitchStatus] = useState<InterventionStatus>({
    is_active: false,
    call_state: 'IDLE',
    engaged_at: null,
    iso_time: null,
    trigger_source: 'SYSTEM',
    reason: '',
    audio_stream_severed: false,
    warning_voice_broadcasted: false,
    fraud_desk_notified: false,
    defense_summary: '',
    correlation_id: null,
    incident_id: null,
    outcome: 'SUCCESS',
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<any>(null);
  const durationTimerRef = useRef<any>(null);
  const scenarioFinishedRef = useRef<boolean>(false);
  const currentActiveTurnRef = useRef<number>(0);
  const pendingDecisionsRef = useRef<Map<number, { decData: DecisionResult; evalData?: InspectorEvaluation }>>(new Map());
  const pendingInterventionRef = useRef<any>(null);
  const appliedTurnsRef = useRef<Set<number>>(new Set());
  const autonomousInterventionTriggeredRef = useRef<boolean>(false);
  const isStreamingRef = useRef<boolean>(false);
  const threatScoreRef = useRef<number>(0);

  // Autonomous Kill-Switch Intervention Trigger (Idempotent: executes exactly once per simulation)
  const triggerAutonomousIntervention = useCallback((data: any) => {
    if (autonomousInterventionTriggeredRef.current) {
      return;
    }
    autonomousInterventionTriggeredRef.current = true;

    console.log(
      `[CALL TERMINATION]\n  Reason: Autonomous defense intervention (CRITICAL THREAT)\n  Terminal Event: KILLSWITCH_ENGAGED\n  Kill Switch: ACTIVE\n  Final DEFCON: RED (100/100)`
    );
    if (data.status) {
      setKillswitchStatus(data.status);
    } else {
      setKillswitchStatus(prev => ({
        ...prev,
        is_active: true,
        call_state: 'KILL_SWITCH_ACTIVE',
        reason: data.reason || 'Autonomous defense intervention engaged',
      }));
    }
    setCallState('KILL_SWITCH_ACTIVE');
    setThreatState('RED');
    setThreatScore(100);

    setAgentSwarm(prev => ({
      ...prev,
      interventionAgent: {
        status: 'INTERVENING',
        lastAction: `SEVERED AUDIO LINE: ${data.reason || 'High-Risk Scam Intercepted'}`,
        isArmed: true,
        isTriggered: true,
        timestamp: Date.now(),
      },
    }));
    soundEffects.playJammerPulse();

    // Trigger backend kill switch to ensure backend STT scenario loop is halted
    api.triggerKillSwitch('AUTONOMOUS_INTERVENTION_ENGAGED').catch(err => {
      console.warn('[AUTO-KILLSWITCH] Backend trigger notice:', err);
    });
  }, []);

  // Synchronized Decision Engine -> UI state application
  const applyDecisionToUI = useCallback((decData: DecisionResult, evalData?: InspectorEvaluation) => {
    const score = decData.score !== undefined ? decData.score : (decData.threat_score || 0);
    const state = (decData.threat_state || decData.current_state || 'GREEN') as ThreatLevel;
    const prevScore = threatScoreRef.current;
    threatScoreRef.current = score;

    console.log(
      `[DEFCON] LIVE decision received\n  Previous score: ${prevScore}\n  New score: ${score}\n  Threat level: ${state}\n  Indicators: ${evalData?.indicators?.map(i => i.matched_signal).join(', ') || 'None'}`
    );

    // Structured Debug Logging
    if (evalData?.indicators && evalData.indicators.length > 0) {
      evalData.indicators.forEach(ind => {
        console.log(
          `[INDICATOR DETECTED]\n  Turn: #${evalData.turn_index || 1} (${evalData.speaker || 'CALLER'})\n  Category: ${ind.category}\n  Signal: "${ind.matched_signal}"\n  Severity: ${ind.severity}\n  Score: ${score}/100 [${state}]\n  Kill Switch Mandated: ${decData.requires_intervention || state === 'RED'}`
        );
      });
    }

    setThreatState(state);
    setThreatScore(score);
    setConfidence(Math.round(decData.confidence || 95));
    setDecisionDirective(decData.decision || (decData.requires_intervention ? 'INTERVENE' : 'MONITOR'));
    setDecisionReasons(decData.reasons || []);

    if (evalData?.indicators && evalData.indicators.length > 0) {
      const indicatorsList = evalData.indicators;
      setDetectedIndicators(prev => {
        const existingKeys = new Set(prev.map(i => `${i.matched_signal.toLowerCase()}_${i.category}`));
        const newItems = indicatorsList.filter(
          i => !existingKeys.has(`${i.matched_signal.toLowerCase()}_${i.category}`)
        );
        return [...prev, ...newItems];
      });
    }

    const velocity = evalData?.threat_velocity !== undefined ? evalData.threat_velocity : Math.round(score - prevScore);
    setThreatVelocity(velocity);

    // Append to Risk History
    setRiskHistory(prev => {
      const turnNum = evalData?.turn_index !== undefined ? evalData.turn_index : (prev.length > 0 ? prev[prev.length - 1].turn + 1 : 1);
      const exists = prev.some(p => p.turn === turnNum && p.score === Math.round(score));
      if (exists) return prev;
      return [
        ...prev.slice(-19),
        {
          turn: turnNum,
          score: Math.round(score),
          timestamp: new Date().toLocaleTimeString(),
          threatLevel: state,
        }
      ];
    });

    // Update Decision Engine Agent in Swarm
    setAgentSwarm(prev => ({
      ...prev,
      decisionEngine: {
        status: decData.requires_intervention ? 'INTERVENING' : 'IDLE',
        lastAction: `Decision: ${decData.decision || 'EVALUATED'} (${score} pts) -> ${decData.requires_intervention ? 'MANDATE INTERVENTION' : 'STAND DOWN'}`,
        score: score,
        state: state,
        timestamp: Date.now(),
      }
    }));

    if (state === 'ORANGE') {
      soundEffects.playAlertBeep(660, 'sawtooth', 0.15);
      setCallState('THREAT_DETECTED');
    } else if (state === 'RED') {
      soundEffects.playCriticalAlarm();
      setCallState('THREAT_DETECTED');
    }
  }, []);

  // Call duration counter
  useEffect(() => {
    if (isStreaming && (callState === 'CALL_ACTIVE' || callState === 'MONITORING' || callState === 'THREAT_DETECTED')) {
      durationTimerRef.current = setInterval(() => {
        setCallDurationSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    }
    return () => {
      if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    };
  }, [isStreaming, callState]);

  // Audio activity decay for visualizer
  useEffect(() => {
    if (!isStreaming) {
      setAudioActivityLevel(0);
      return;
    }
    const interval = setInterval(() => {
      setAudioActivityLevel(prev => Math.max(0.1, prev * 0.85 + (Math.random() * 0.3)));
    }, 150);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // Connect WebSocket
  const connectWebSocket = useCallback(() => {
    // If a socket is already open or currently connecting, do not create duplicate
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Clean up any stale socket
    if (wsRef.current) {
      const oldWs = wsRef.current;
      wsRef.current = null;
      oldWs.onopen = null;
      oldWs.onmessage = null;
      oldWs.onerror = null;
      oldWs.onclose = null;
      try {
        oldWs.close();
      } catch (_) {}
    }

    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    let wsUrl = import.meta.env.VITE_WS_URL;
    if (!wsUrl) {
      const rawApi = import.meta.env.VITE_API_URL;
      if (rawApi) {
        wsUrl = rawApi.replace(/^http/, 'ws').replace(/\/+$/, '') + '/ws/call-stream';
      } else {
        const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const hostname = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1';
        wsUrl = `${protocol}//${hostname}:8000/ws/call-stream`;
      }
    }

    try {
      setConnectionStatus('CONNECTING');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (wsRef.current !== ws) return;
        setConnectionStatus('CONNECTED');
        console.log('SENTINEL Command Center WebSocket Connected');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { event: eventType, data } = message;

          if (eventType === 'INITIAL_STATE') {
            setThreatState(data.threat_state || 'GREEN');
            setThreatScore(data.highest_score || 0);
            setTranscript(data.transcript || []);
            setEvidenceChain(data.evidence_chain || []);
            setIsChainValid(data.is_chain_valid ?? true);
            setChainFailureReason(data.chain_failure_reason || null);
            setA2aHistory(data.a2a_history || []);
            const streaming = data.is_streaming || false;
            isStreamingRef.current = streaming;
            setIsStreaming(streaming);
            setActiveScenarioId(data.active_scenario_id || null);
            if (data.call_state) setCallState(data.call_state as CallState);
            if (data.active_incident_id) setActiveIncidentId(data.active_incident_id);
            if (data.killswitch_active) {
              setKillswitchStatus(prev => ({ ...prev, is_active: true, call_state: 'CALL_TERMINATED' }));
              setCallState('CALL_TERMINATED');
            }
          } else if (eventType === 'TRANSCRIPT_UPDATE') {
            if (data.segment) {
              const seg = data.segment;
              console.log(
                `[${isStreamingRef.current ? 'SIMULATION' : 'LIVE'}] Received transcript turn #${seg.turn_index}: "${seg.text.substring(0, 60)}" (Speaker: ${seg.speaker})`
              );

              if (isStreamingRef.current) {
                // SIMULATION MODE: Audibly speak & synchronize transcript rendering via generic sequential audio queue
                if (seg.text) {
                  ttsService.speakDialogueTurn(seg.text, {
                    segmentId: seg.segment_id,
                    speaker: seg.speaker || 'CALLER',
                    metadata: { segment: seg },
                  });
                }
              } else {
                // LIVE MODE: Directly append to transcript state; NEVER synthesize playback of human speech
                setTranscript((prev) => {
                  const idx = prev.findIndex((s) => s.segment_id === seg.segment_id);
                  if (idx === -1) {
                    return [...prev, seg];
                  } else {
                    const updated = [...prev];
                    updated[idx] = seg;
                    return updated;
                  }
                });
              }
            }
          } else if (eventType === 'INSPECTOR_UPDATE') {
            const evalData: InspectorEvaluation = data.evaluation || data;
            if (evalData) {
              const turnIdx = evalData.turn_index || 1;
              const existing = pendingDecisionsRef.current.get(turnIdx);
              if (existing) {
                existing.evalData = evalData;
              }
              if (turnIdx <= currentActiveTurnRef.current || currentActiveTurnRef.current === 0 || !isStreamingRef.current) {
                if (evalData.indicators && evalData.indicators.length > 0) {
                  const indicatorsList = evalData.indicators;
                  setDetectedIndicators(prev => {
                    const existingKeys = new Set(prev.map(i => `${i.matched_signal.toLowerCase()}_${i.category}`));
                    const newItems = indicatorsList.filter(
                      i => !existingKeys.has(`${i.matched_signal.toLowerCase()}_${i.category}`)
                    );
                    return [...prev, ...newItems];
                  });
                }
                if (evalData.threat_velocity !== undefined) setThreatVelocity(evalData.threat_velocity);
              }

              // Update Inspector Agent Status
              setAgentSwarm(prev => ({
                ...prev,
                inspector: {
                  status: evalData.active_threat_level === 'RED' ? 'PROCESSING' : 'IDLE',
                  lastAction: `Extracted ${evalData.indicators?.length || 0} indicators | Risk ${evalData.composite_risk_score}`,
                  lastTurn: evalData.turn_index,
                  timestamp: Date.now(),
                }
              }));
            }
          } else if (eventType === 'DECISION_UPDATE') {
            const decData: DecisionResult = data.decision || data;
            const evalData: InspectorEvaluation | undefined = data.evaluation;
            if (decData) {
              const turnIdx = evalData?.turn_index || (decData as any).turn_index || 1;
              pendingDecisionsRef.current.set(turnIdx, { decData, evalData });

              // If in direct text or live mic mode (no simulation stream active), apply immediately
              if (!isStreamingRef.current || currentActiveTurnRef.current === 0) {
                applyDecisionToUI(decData, evalData);
                if (decData.requires_intervention || decData.threat_state === 'RED') {
                  console.log('[AUTO-KILLSWITCH] RED intervention received - Scenario termination executing');
                  triggerAutonomousIntervention(pendingInterventionRef.current || { reason: decData.reasons?.[0] || 'CRITICAL_THREAT_THRESHOLD_EXCEEDED' });
                }
              }
            }
          } else if (eventType === 'EVIDENCE_UPDATE') {
            if (data.block) {
              setEvidenceChain(prev => {
                const filtered = prev.filter(b => b.index !== data.block.index);
                return [...filtered, data.block].sort((a, b) => a.index - b.index);
              });
              // Update Evidence Agent Status
              setAgentSwarm(prev => ({
                ...prev,
                evidenceAgent: {
                  status: 'SEALING',
                  lastAction: `Sealed Block #${data.block.index} (${data.block.event_type})`,
                  blockCount: (data.block.index + 1),
                  timestamp: Date.now(),
                }
              }));
              setTimeout(() => {
                setAgentSwarm(prev => ({
                  ...prev,
                  evidenceAgent: { ...prev.evidenceAgent, status: 'IDLE' }
                }));
              }, 1200);
            }
            if (typeof data.is_valid === 'boolean') {
              setIsChainValid(data.is_valid);
            }
          } else if (eventType === 'KILLSWITCH_UPDATE' || eventType === 'INTERVENTION') {
            if (isStreamingRef.current) {
              scenarioFinishedRef.current = true;
            }
            pendingInterventionRef.current = data;

            soundEffects.playJammerPulse();
            const advId = `intervention_${data.incident_id || data.correlation_id || Date.now()}`;
            soundEffects.speakSyntheticWarning(
              data.synthetic_warning_text ||
                'Warning. This conversation has been identified as potentially fraudulent. Do not share your OTP, password, or banking credentials.',
              advId
            );
          } else if (eventType === 'KILLSWITCH_RESET') {
            currentActiveTurnRef.current = 0;
            pendingDecisionsRef.current.clear();
            pendingInterventionRef.current = null;
            appliedTurnsRef.current.clear();
            autonomousInterventionTriggeredRef.current = false;
            scenarioFinishedRef.current = false;
            isStreamingRef.current = false;
            threatScoreRef.current = 0;
            setIsStreaming(false);
            setTranscript([]);
            setThreatScore(0);
            setThreatVelocity(0);
            setThreatState('GREEN');
            setConfidence(100);
            setDecisionDirective('ALLOW');
            setDecisionReasons([]);
            setDetectedIndicators([]);
            setCallDurationSeconds(0);
            setAudioActivityLevel(0);
            setCallState('IDLE');
            setActiveScenarioId(null);
            setActiveCallerId(null);
            setRiskHistory([{ turn: 0, score: 0, timestamp: new Date().toLocaleTimeString(), threatLevel: 'GREEN' }]);
            setA2aHistory([]);
            setKillswitchStatus({
              is_active: false,
              call_state: 'IDLE',
              engaged_at: null,
              iso_time: null,
              trigger_source: 'SYSTEM',
              reason: '',
              audio_stream_severed: false,
              warning_voice_broadcasted: false,
              fraud_desk_notified: false,
              defense_summary: '',
              correlation_id: null,
              incident_id: null,
              outcome: 'SUCCESS',
            });
            setAgentSwarm({
              inspector: { status: 'IDLE', lastAction: 'Surveillance armed', lastTurn: 0, timestamp: Date.now() },
              decisionEngine: { status: 'IDLE', lastAction: 'Policy armed (DEFCON 4)', score: 0, state: 'GREEN', timestamp: Date.now() },
              evidenceAgent: { status: 'IDLE', lastAction: 'Ledger synchronized', blockCount: 1, timestamp: Date.now() },
              interventionAgent: { status: 'IDLE', lastAction: 'Kill-switch disarmed. READY.', isArmed: true, isTriggered: false, timestamp: Date.now() },
            });
            api.getEvidenceChain().then(chain => {
              if (Array.isArray(chain)) setEvidenceChain(chain);
            }).catch(() => {});
          } else if (eventType === 'SCENARIO_STARTED') {
            currentActiveTurnRef.current = 0;
            pendingDecisionsRef.current.clear();
            pendingInterventionRef.current = null;
            appliedTurnsRef.current.clear();
            autonomousInterventionTriggeredRef.current = false;
            scenarioFinishedRef.current = false;
            threatScoreRef.current = 0;
            isStreamingRef.current = true;
            setIsStreaming(true);
            setCallState('CALL_ACTIVE');
            setActiveScenarioId(data.scenario?.id || data.scenario_id || null);
            setActiveCallerId(data.caller_id || data.scenario?.caller_id_spoof || '+1 (800) 555-0199');
            setTranscript([]);
            setThreatScore(0);
            setThreatVelocity(0);
            setThreatState('GREEN');
            setConfidence(100);
            setDecisionDirective('ALLOW');
            setDecisionReasons([]);
            setDetectedIndicators([]);
            setCallDurationSeconds(0);
            setAudioActivityLevel(0.3);
            const newCorr = data.correlation_id || `corr_${Date.now()}`;
            setActiveCorrelationId(newCorr);
            setActiveIncidentId(`INC-${newCorr.slice(-4).toUpperCase()}`);
            setRiskHistory([{ turn: 0, score: 0, timestamp: new Date().toLocaleTimeString(), threatLevel: 'GREEN' }]);
            setA2aHistory([]);
            setKillswitchStatus({
              is_active: false,
              call_state: 'IDLE',
              engaged_at: null,
              iso_time: null,
              trigger_source: 'SYSTEM',
              reason: '',
              audio_stream_severed: false,
              warning_voice_broadcasted: false,
              fraud_desk_notified: false,
              defense_summary: '',
              correlation_id: null,
              incident_id: null,
              outcome: 'SUCCESS',
            });
            setAgentSwarm({
              inspector: { status: 'PROCESSING', lastAction: 'Listening & extracting signals', lastTurn: 0, timestamp: Date.now() },
              decisionEngine: { status: 'DECIDING', lastAction: 'Evaluating threat vectors', score: 0, state: 'GREEN', timestamp: Date.now() },
              evidenceAgent: { status: 'SEALING', lastAction: 'Sealing genesis & dialogue', blockCount: 1, timestamp: Date.now() },
              interventionAgent: { status: 'IDLE', lastAction: 'Kill-switch armed & monitoring', isArmed: true, isTriggered: false, timestamp: Date.now() },
            });
            api.getEvidenceChain().then(chain => {
              if (Array.isArray(chain)) setEvidenceChain(chain);
            }).catch(() => {});
          } else if (eventType === 'SCENARIO_COMPLETED') {
            if (isStreamingRef.current) {
              scenarioFinishedRef.current = true;
            }
          } else if (eventType === 'A2A_MESSAGE') {
            const a2aMsg: A2AMessage = data;
            setA2aHistory(prev => [a2aMsg, ...prev.slice(0, 99)]);
            setActiveCorrelationId(a2aMsg.correlation_id);
            setActiveIncidentId(`INC-${a2aMsg.correlation_id.slice(-4).toUpperCase()}`);

            // Visual link animation trigger
            setActiveMessageLink({ from: a2aMsg.sender, to: a2aMsg.receiver, type: a2aMsg.message_type });
            setTimeout(() => setActiveMessageLink(null), 1500);
          } else if (eventType === 'CHAIN_TAMPERED') {
            setIsChainValid(false);
            setChainFailureReason(data.failure_reason || 'Hash mismatch detected');
            soundEffects.playAlertBeep(220, 'square', 0.3);
          } else if (eventType === 'CHAIN_REPAIRED') {
            setIsChainValid(true);
            setChainFailureReason(null);
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onerror = (err) => {
        if (wsRef.current !== ws) return;
        console.warn('WebSocket connection error:', err);
        setConnectionStatus('DISCONNECTED');
      };

      ws.onclose = () => {
        if (wsRef.current !== ws) return;
        setConnectionStatus('DISCONNECTED');
        console.log('WebSocket disconnected. Retrying in 3s...');
        reconnectTimerRef.current = setTimeout(connectWebSocket, 3000);
      };
    } catch (err) {
      console.error('WebSocket connection initialization error:', err);
      setConnectionStatus('DISCONNECTED');
      reconnectTimerRef.current = setTimeout(connectWebSocket, 3000);
    }
  }, [applyDecisionToUI]);

  useEffect(() => {
    connectWebSocket();

    // Synchronize progressive word-by-word transcript rendering & indicator-driven DEFCON escalation
    const unsubscribeProgressiveWord = ttsService.onProgressiveWord((event) => {
      if (event.item.metadata?.segment) {
        const segMeta: TranscriptSegment = event.item.metadata.segment;
        currentActiveTurnRef.current = segMeta.turn_index;

        // 1. Update progressive transcript UI
        setTranscript((prev) => {
          const idx = prev.findIndex((s) => s.segment_id === segMeta.segment_id);
          if (idx === -1) {
            const newSeg: TranscriptSegment = {
              ...segMeta,
              text: event.revealedText,
              is_final: event.isComplete,
            };
            return [...prev, newSeg];
          } else {
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              text: event.revealedText,
              is_final: event.isComplete,
            };
            return updated;
          }
        });

        // 2. Determine if the progressive spoken words have reached the threat trigger for this turn
        if (!appliedTurnsRef.current.has(segMeta.turn_index)) {
          const pending = pendingDecisionsRef.current.get(segMeta.turn_index);
          if (pending) {
            const { decData, evalData } = pending;
            const indList = evalData?.indicators || [];
            let hasReachedTrigger = false;

            if (indList.length === 0) {
              // Benign or no indicators -> apply early
              hasReachedTrigger = true;
            } else {
              const textClean = event.revealedText
                .toLowerCase()
                .replace(/['".,!?;:()\[\]{}]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

              hasReachedTrigger = indList.some((ind) => {
                const sigRaw = (ind.matched_signal || '').toLowerCase();
                const evRaw = (ind.evidence || '').toLowerCase();
                const sigClean = sigRaw.replace(/['".,!?;:()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
                const evClean = evRaw.replace(/['".,!?;:()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

                if (sigClean.length >= 2 && textClean.includes(sigClean)) return true;
                if (evClean.length >= 4 && textClean.includes(evClean)) return true;

                // Sub-phrase or core keyword check for multi-word or compound terms
                if (sigClean.length >= 3) {
                  const words = sigClean.split(/\s+/).filter((w) => w.length >= 3);
                  if (words.length > 0 && words.some((w) => textClean.includes(w))) {
                    return true;
                  }
                }
                return false;
              });
            }

            // Fallback: If turn is completed or reached 60% of words, guarantee decision application
            if (
              !hasReachedTrigger &&
              (event.isComplete ||
                event.wordIndex >= Math.max(1, Math.floor(event.totalWords * 0.6)))
            ) {
              hasReachedTrigger = true;
            }

            if (hasReachedTrigger) {
              appliedTurnsRef.current.add(segMeta.turn_index);
              console.log(
                `[DEFCON] Spoken content reached trigger in Turn #${segMeta.turn_index}: Applied decision ${decData.score ?? decData.threat_score} ${decData.threat_state}`
              );
              applyDecisionToUI(decData, evalData);

              // If this decision mandates intervention (e.g. RED 100), engage autonomous kill-switch
              if (decData.requires_intervention || decData.threat_state === 'RED') {
                triggerAutonomousIntervention(pendingInterventionRef.current || {});
              }
            }
          }
        }
      }
    });

    // Synchronize waveform activity and agent state with actual audio turn start
    const unsubscribeTurnStart = ttsService.onTurnStart((item) => {
      if (item.metadata?.segment) {
        const seg: TranscriptSegment = item.metadata.segment;
        currentActiveTurnRef.current = seg.turn_index;

        setAudioActivityLevel(0.9);
        soundEffects.playAlertBeep(440, 'sine', 0.06);

        // Update Inspector Agent to PROCESSING when speech actually begins
        setAgentSwarm((prev) => ({
          ...prev,
          inspector: {
            status: 'PROCESSING',
            lastAction: `Analyzing Turn #${seg.turn_index} (${seg.speaker})`,
            lastTurn: seg.turn_index,
            timestamp: Date.now(),
          },
        }));
      } else if (item.type === 'ADVISORY') {
        triggerAutonomousIntervention(pendingInterventionRef.current || {});
      }
    });

    const unsubscribeTurnEnd = ttsService.onTurnEnd(() => {
      setAudioActivityLevel(0.0);
    });

    const unsubscribePlaybackComplete = ttsService.onPlaybackComplete(() => {
      if (scenarioFinishedRef.current && isStreamingRef.current) {
        isStreamingRef.current = false;
        setIsStreaming(false);
        setCallState('COMPLETED');
        setAgentSwarm((prev) => ({
          ...prev,
          inspector: { ...prev.inspector, status: 'IDLE' },
          decisionEngine: { ...prev.decisionEngine, status: 'IDLE' },
        }));
        console.log(
          `[CALL TERMINATION]\n  Reason: Scenario audio finished\n  Terminal Event: SCENARIO_COMPLETED\n  Kill Switch: ${autonomousInterventionTriggeredRef.current ? 'ACTIVE' : 'NOT ENGAGED'}\n  Final State: COMPLETED`
        );
      }
    });

    return () => {
      unsubscribeProgressiveWord();
      unsubscribeTurnStart();
      unsubscribeTurnEnd();
      unsubscribePlaybackComplete();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        wsRef.current = null;
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        try {
          ws.close();
        } catch (_) {}
      }
    };
  }, [connectWebSocket, applyDecisionToUI, triggerAutonomousIntervention]);

  // Client Actions
  const startScenario = async (scenarioId: string, speedMultiplier: number = 1.0) => {
    try {
      console.log(`[SIMULATION] START - Scenario: ${scenarioId} (Speed: ${speedMultiplier}x)`);
      currentActiveTurnRef.current = 0;
      pendingDecisionsRef.current.clear();
      pendingInterventionRef.current = null;
      appliedTurnsRef.current.clear();
      autonomousInterventionTriggeredRef.current = false;
      scenarioFinishedRef.current = false;
      ttsService.reset();
      ttsService.unlockAudio();
      console.log('[SIMULATION] Audio unlocked');

      // Initialize clean simulation state
      setTranscript([]);
      setThreatScore(0);
      setThreatVelocity(0);
      setThreatState('GREEN');
      setDecisionDirective('ALLOW');
      setDecisionReasons([]);
      setDetectedIndicators([]);
      isStreamingRef.current = true;
      setIsStreaming(true);
      setCallState('CALL_ACTIVE');

      await api.startScenario(scenarioId, speedMultiplier);
    } catch (err) {
      console.error('[SIMULATION] Failed to start scenario:', err);
    }
  };

  const stopScenario = async () => {
    try {
      const wasStreaming = isStreamingRef.current;
      currentActiveTurnRef.current = 0;
      pendingDecisionsRef.current.clear();
      pendingInterventionRef.current = null;
      appliedTurnsRef.current.clear();
      autonomousInterventionTriggeredRef.current = false;
      scenarioFinishedRef.current = false;
      ttsService.stop();
      await api.stopScenario();
      isStreamingRef.current = false;
      setIsStreaming(false);
      setCallState('IDLE');
      if (wasStreaming) {
        console.log('[SIMULATION] Simulation stopped by operator');
      } else {
        console.log('[LIVE MODE] Live session ended by user');
      }
    } catch (err) {
      console.error('Failed to stop scenario/session:', err);
    }
  };

  const triggerKillSwitch = async (reason: string = 'Security Analyst Manual Override') => {
    try {
      await api.triggerKillSwitch(reason);
    } catch (err) {
      console.error('Failed to trigger kill switch:', err);
    }
  };

  const resetKillSwitch = async () => {
    try {
      currentActiveTurnRef.current = 0;
      pendingDecisionsRef.current.clear();
      pendingInterventionRef.current = null;
      appliedTurnsRef.current.clear();
      autonomousInterventionTriggeredRef.current = false;
      scenarioFinishedRef.current = false;
      threatScoreRef.current = 0;
      ttsService.reset();
      await api.resetKillSwitch();
    } catch (err) {
      console.error('Failed to reset kill switch:', err);
    } finally {
      currentActiveTurnRef.current = 0;
      pendingDecisionsRef.current.clear();
      pendingInterventionRef.current = null;
      appliedTurnsRef.current.clear();
      autonomousInterventionTriggeredRef.current = false;
      scenarioFinishedRef.current = false;
      isStreamingRef.current = false;
      threatScoreRef.current = 0;
      ttsService.reset();
      setTranscript([]);
      setThreatScore(0);
      setThreatVelocity(0);
      setThreatState('GREEN');
      setConfidence(100);
      setDecisionDirective('ALLOW');
      setDecisionReasons([]);
      setDetectedIndicators([]);
      setCallDurationSeconds(0);
      setAudioActivityLevel(0);
      setIsStreaming(false);
      setCallState('IDLE');
      setActiveScenarioId(null);
      setActiveCallerId(null);
      const newSession = `INC-${Date.now().toString().slice(-4)}`;
      setActiveCorrelationId(`corr_${Date.now()}`);
      setActiveIncidentId(newSession);
      setRiskHistory([{ turn: 0, score: 0, timestamp: new Date().toLocaleTimeString(), threatLevel: 'GREEN' }]);
      setA2aHistory([]);
      setKillswitchStatus({
        is_active: false,
        call_state: 'IDLE',
        engaged_at: null,
        iso_time: null,
        trigger_source: 'SYSTEM',
        reason: '',
        audio_stream_severed: false,
        warning_voice_broadcasted: false,
        fraud_desk_notified: false,
        defense_summary: '',
        correlation_id: null,
        incident_id: null,
        outcome: 'SUCCESS',
      });
      setAgentSwarm({
        inspector: { status: 'IDLE', lastAction: 'Surveillance armed', lastTurn: 0, timestamp: Date.now() },
        decisionEngine: { status: 'IDLE', lastAction: 'Policy armed (DEFCON 4)', score: 0, state: 'GREEN', timestamp: Date.now() },
        evidenceAgent: { status: 'IDLE', lastAction: 'Ledger synchronized', blockCount: 1, timestamp: Date.now() },
        interventionAgent: { status: 'IDLE', lastAction: 'Kill-switch disarmed. READY.', isArmed: true, isTriggered: false, timestamp: Date.now() },
      });
      api.getEvidenceChain().then(chain => {
        if (Array.isArray(chain)) setEvidenceChain(chain);
      }).catch(() => {});
    }
  };

  const verifyChain = async () => {
    try {
      const res = await api.verifyEvidenceIntegrity();
      setIsChainValid(res.is_valid);
      setChainFailureReason(res.failure_reason);
      return res;
    } catch (err) {
      console.error('Failed to verify chain:', err);
      throw err;
    }
  };

  const tamperChain = async (blockIndex: number = 0) => {
    try {
      const res = await api.simulateTamper(blockIndex, 'event_type', 'UNAUTHORIZED_TAMPER_MODIFICATION');
      setIsChainValid(false);
      setChainFailureReason(res.failure_reason);
      return res;
    } catch (err) {
      console.error('Failed to tamper chain:', err);
      throw err;
    }
  };

  const repairChain = async () => {
    try {
      const res = await api.repairChain();
      setIsChainValid(true);
      setChainFailureReason(null);
      return res;
    } catch (err) {
      console.error('Failed to repair chain:', err);
      throw err;
    }
  };

  return {
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
  };
}
