import {
  AuditReportPackage,
  DecisionResult,
  EvidenceBlock,
  InspectorEvaluation,
  InterventionStatus,
  ScenarioMeta
} from '../types/sentinel';

const rawApiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:8000` : 'http://127.0.0.1:8000');
export const API_BASE = rawApiUrl.replace(/\/+$/, '').endsWith('/api') ? rawApiUrl.replace(/\/+$/, '') : `${rawApiUrl.replace(/\/+$/, '')}/api`;

class SentinelApiClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${API_BASE}${cleanEndpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      return await response.json();
    } catch (err: any) {
      console.error(`API Error [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  }

  // System Health
  async getHealth() {
    return this.request<{
      status: string;
      system: string;
      version: string;
      active_scenario: string | null;
      is_streaming: boolean;
      threat_state: string;
      highest_score: number;
      killswitch_active: boolean;
      call_state?: string;
      active_incident_id?: string | null;
      evidence_blocks: number;
      chain_cryptographically_valid: boolean;
      connected_dashboards: number;
    }>('/health');
  }

  // Scenarios
  async getScenarios(): Promise<ScenarioMeta[]> {
    return this.request<ScenarioMeta[]>('/scenarios');
  }

  async startScenario(scenarioId: string, speedMultiplier: number = 1.0) {
    return this.request<{ status: string; scenario_id: string }>('/scenarios/start', {
      method: 'POST',
      body: JSON.stringify({ scenario_id: scenarioId, speed_multiplier: speedMultiplier }),
    });
  }

  async stopScenario() {
    return this.request<{ status: string }>('/scenarios/stop', {
      method: 'POST',
    });
  }

  // Live Turn Ingestion
  async ingestLiveTurn(text: string, speaker: string = 'CALLER', confidence: number = 0.95, sessionId?: string, turnIndex?: number) {
    return this.request<{ status: string; segment: any }>('/live/turn', {
      method: 'POST',
      body: JSON.stringify({
        text,
        speaker,
        confidence,
        session_id: sessionId,
        turn_index: turnIndex,
      }),
    });
  }

  // Standalone Inspection & Decision
  async inspectText(text: string, speaker: string = 'CALLER', sessionId?: string, turnIndex: number = 1): Promise<InspectorEvaluation> {
    return this.request<InspectorEvaluation>('/inspect', {
      method: 'POST',
      body: JSON.stringify({ text, speaker, session_id: sessionId, turn_index: turnIndex }),
    });
  }

  async evaluateDecision(indicators: any[], isBenignAdvice: boolean = false, speaker: string = 'CALLER'): Promise<DecisionResult> {
    return this.request<DecisionResult>('/decision', {
      method: 'POST',
      body: JSON.stringify({ indicators, is_benign_advice: isBenignAdvice, speaker }),
    });
  }

  // End-to-End Orchestrator Pipeline
  async analyzeTurn(text: string, speaker: string = 'CALLER', sessionId?: string, turnIndex: number = 1, autoIntervene: boolean = true) {
    return this.request<{
      agent: string;
      session_id: string | null;
      turn_index: number;
      original_text: string;
      inspection: {
        indicators: any[];
        normalized_text: string;
        is_benign_advice: boolean;
        severity: string;
      };
      decision: {
        score: number;
        threat_state: string;
        decision: string;
        requires_intervention: boolean;
        confidence: number;
        triggered_rules: string[];
        combination_rules_triggered: string[];
        critical_triggers_active: boolean;
        reasons: string[];
      };
      actions: any[];
      intervention_executed: boolean;
      intervention_details: any;
    }>('/analyze', {
      method: 'POST',
      body: JSON.stringify({
        text,
        speaker,
        session_id: sessionId,
        turn_index: turnIndex,
        auto_intervene: autoIntervene,
      }),
    });
  }

  // Kill Switch & Intervention
  async getKillSwitchStatus(): Promise<InterventionStatus> {
    return this.request<InterventionStatus>('/killswitch/status');
  }

  async triggerKillSwitch(reason: string = 'MANUAL_OPERATOR_INTERVENTION') {
    return this.request<{ status: string; details: InterventionStatus }>('/killswitch/trigger', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async resetKillSwitch() {
    return this.request<{ status: string; details: InterventionStatus }>('/killswitch/reset', {
      method: 'POST',
    });
  }

  // Cryptographic Evidence Chain
  async getEvidenceChain() {
    return this.request<{
      is_valid: boolean;
      failing_block_index: number | null;
      failure_reason: string | null;
      block_count: number;
      total_blocks: number;
      chain: EvidenceBlock[];
    }>('/evidence/chain');
  }

  async verifyEvidenceIntegrity() {
    return this.request<{
      status: string;
      is_valid: boolean;
      block_count: number;
      failing_block_index: number | null;
      failure_reason: string | null;
      chain_seal_root_hash: string;
    }>('/evidence/verify', {
      method: 'POST',
    });
  }

  async simulateTamper(blockIndex: number = 0, field: string = 'title', maliciousValue: string = 'MALICIOUS_ADVERSARY_MODIFICATION') {
    return this.request<{
      status: string;
      is_valid: boolean;
      tampered_block_index: number;
      failure_reason: string;
    }>('/evidence/tamper-test', {
      method: 'POST',
      body: JSON.stringify({ block_index: blockIndex, field, malicious_value: maliciousValue }),
    });
  }

  async repairChain() {
    return this.request<{
      status: string;
      is_valid: boolean;
      repaired_blocks: number;
      chain_seal_root_hash: string;
    }>('/evidence/repair', {
      method: 'POST',
    });
  }

  async exportAuditPackage(): Promise<AuditReportPackage> {
    return this.request<AuditReportPackage>('/evidence/export-audit');
  }

  // A2A History
  async getA2AHistory(params?: { limit?: number; sender?: string; receiver?: string; correlation_id?: string }) {
    const query = new URLSearchParams();
    if (params?.limit) query.set('limit', params.limit.toString());
    if (params?.sender) query.set('sender', params.sender);
    if (params?.receiver) query.set('receiver', params.receiver);
    if (params?.correlation_id) query.set('correlation_id', params.correlation_id);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/a2a/history${queryString}`);
  }
}

export const api = new SentinelApiClient();

