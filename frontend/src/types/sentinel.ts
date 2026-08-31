export type ThreatLevel = 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';

export type CallState =
  | 'IDLE'
  | 'CALL_ACTIVE'
  | 'MONITORING'
  | 'THREAT_DETECTED'
  | 'INTERVENTION_PENDING'
  | 'KILL_SWITCH_ACTIVE'
  | 'CALL_TERMINATED'
  | 'COMPLETED'
  | 'RECOVERY';

export type AgentStatus = 'IDLE' | 'PROCESSING' | 'DECIDING' | 'SEALING' | 'INTERVENING' | 'ERROR';

export interface ScamIndicator {
  category: string;
  matched_signal: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: string;
  confidence: number;
  explanation: string;
}

export interface ScamVectorScore {
  vector_name: string;
  score: number;
  detected_keywords: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  reasoning: string;
}

export interface InspectorEvaluation {
  evaluation_id: string;
  turn_index: number;
  timestamp: number;
  iso_time: string;
  speaker: string;
  composite_risk_score: number;
  threat_velocity: number;
  active_threat_level: ThreatLevel;
  indicators?: ScamIndicator[];
  vectors?: Record<string, any>;
  highlighted_phrases: string[];
  critical_triggers: string[];
  dialogue_snippet: string;
  normalized_text?: string;
  is_benign_advice?: boolean;
}

export interface DecisionAction {
  action_type: string;
  recommended: boolean;
  urgency: string;
  reasoning: string;
}

export interface DecisionResult {
  decision_id: string;
  timestamp: number;
  iso_time: string;
  score: number;
  threat_score: number;
  threat_state: ThreatLevel;
  current_state: ThreatLevel;
  previous_state: ThreatLevel;
  decision: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
  requires_intervention: boolean;
  automated_intervention_triggered: boolean;
  confidence: number;
  reasons: string[];
  triggered_rules: string[];
  combination_rules_triggered: string[];
  critical_triggers_active: boolean;
  recommended_actions: DecisionAction[];
}

export interface TranscriptSegment {
  segment_id: string;
  turn_index: number;
  timestamp: number;
  iso_time: string;
  speaker: 'CALLER' | 'CALLEE';
  text: string;
  is_final: boolean;
  confidence: number;
  highlighted?: boolean;
}

export interface EvidenceBlock {
  index: number;
  timestamp: number;
  iso_time: string;
  event_type: string;
  agent_source: string;
  payload: Record<string, any>;
  prev_hash: string;
  block_hash: string;
  nonce: number;
  signature: string;
}

export interface A2AMessage {
  message_id: string;
  id?: string;
  correlation_id: string;
  conversation_id: string;
  timestamp: number;
  iso_time: string;
  sender: string;
  receiver: string;
  recipient: string;
  message_type: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  payload: Record<string, any>;
  signature: string;
  fingerprint: string;
  hops?: number;
}

export interface ScenarioMeta {
  id: string;
  title: string;
  category: string;
  description: string;
  target_risk_level: string;
  caller_id_spoof: string;
  turn_count: number;
}

export interface InterventionStatus {
  is_active: boolean;
  call_state?: string;
  engaged_at: number | null;
  iso_time: string | null;
  trigger_source: string;
  reason: string;
  audio_stream_severed: boolean;
  warning_voice_broadcasted: boolean;
  fraud_desk_notified: boolean;
  defense_summary: string;
  correlation_id?: string | null;
  incident_id?: string | null;
  outcome?: string;
}

export interface AuditReportPackage {
  metadata: {
    system: string;
    export_timestamp: string;
    total_blocks: number;
    is_cryptographically_valid: boolean;
    chain_seal_root_hash: string;
    integrity_status: string;
    integrity_error: string | null;
  };
  chain: EvidenceBlock[];
}

export interface RiskPoint {
  turn: number;
  score: number;
  timestamp: string;
  threatLevel: ThreatLevel;
}

export type NavigationTab = 'DASHBOARD' | 'LIVE_CALL' | 'THREAT_INTEL' | 'EVIDENCE' | 'ANALYTICS';

export type LiveCallMode = 'VOICE' | 'SIMULATION';

export type MicState = 'READY' | 'LISTENING' | 'PROCESSING' | 'THREAT_DETECTED' | 'INTERVENING';

export type SystemHealthStatus = 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';

export interface TimelineEvent {
  id: string;
  timestamp: string;
  time: string;
  eventType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INFO';
  description: string;
  source: string;
  details?: Record<string, any>;
}

