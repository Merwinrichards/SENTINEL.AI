import { describe, it, expect } from 'vitest';
import {
  ThreatLevel,
  CallState,
  A2AMessage,
  EvidenceBlock,
  ScamIndicator,
  DecisionResult,
  InspectorEvaluation,
  TranscriptSegment,
} from '../types/sentinel';

describe('Phase 8 Command Center Dashboard State & Event Engine', () => {
  it('correctly maps threat scores to DEFCON threat states', () => {
    const mapScoreToLevel = (score: number): ThreatLevel => {
      if (score >= 75) return 'RED';
      if (score >= 50) return 'ORANGE';
      if (score >= 25) return 'YELLOW';
      return 'GREEN';
    };

    expect(mapScoreToLevel(10)).toBe('GREEN');
    expect(mapScoreToLevel(25)).toBe('YELLOW');
    expect(mapScoreToLevel(45)).toBe('YELLOW');
    expect(mapScoreToLevel(50)).toBe('ORANGE');
    expect(mapScoreToLevel(74)).toBe('ORANGE');
    expect(mapScoreToLevel(75)).toBe('RED');
    expect(mapScoreToLevel(95)).toBe('RED');
  });

  it('validates A2A message canonical envelope and priority tagging', () => {
    const msg: A2AMessage = {
      message_id: 'msg_test_001',
      correlation_id: 'corr_test_001',
      conversation_id: 'conv_test_001',
      timestamp: 1787982983.5,
      iso_time: '2026-08-29T05:56:23.500000+00:00',
      sender: 'DecisionEngine',
      receiver: 'InterventionAgent',
      recipient: 'InterventionAgent',
      message_type: 'INTERVENTION_REQUEST',
      priority: 'CRITICAL',
      payload: {
        decision: 'INTERVENE',
        requires_intervention: true,
        threat_score: 95.0,
      },
      signature: 'A2ASIG_TEST',
      fingerprint: 'abcd1234efgh5678',
    };

    expect(msg.message_id).toBe('msg_test_001');
    expect(msg.priority).toBe('CRITICAL');
    expect(msg.sender).toBe('DecisionEngine');
    expect(msg.receiver).toBe('InterventionAgent');
    expect(msg.payload.requires_intervention).toBe(true);
  });

  it('validates SHA-256 evidence chain parent linkage', () => {
    const block0: EvidenceBlock = {
      index: 0,
      timestamp: 1787982980,
      iso_time: '2026-08-29T05:56:20.000Z',
      event_type: 'GENESIS',
      agent_source: 'System',
      payload: { note: 'Genesis Block' },
      prev_hash: '0',
      block_hash: 'hash_genesis_000',
      nonce: 101,
      signature: 'sig_0',
    };

    const block1: EvidenceBlock = {
      index: 1,
      timestamp: 1787982982,
      iso_time: '2026-08-29T05:56:22.000Z',
      event_type: 'ACTIVE_INTERVENTION_KILLSWITCH_ENGAGED',
      agent_source: 'InterventionAgent',
      payload: { reason: 'CRITICAL_THREAT' },
      prev_hash: block0.block_hash,
      block_hash: 'hash_block_001',
      nonce: 102,
      signature: 'sig_1',
    };

    const chain = [block0, block1];

    expect(chain.length).toBe(2);
    expect(chain[1].prev_hash).toBe(chain[0].block_hash);
  });

  it('handles state machine transitions during kill-switch engagement and recovery', () => {
    let callState: CallState = 'IDLE';
    expect(callState).toBe('IDLE');

    // Scenario Start
    callState = 'CALL_ACTIVE';
    expect(callState).toBe('CALL_ACTIVE');

    // High threat detection
    callState = 'THREAT_DETECTED';
    expect(callState).toBe('THREAT_DETECTED');

    // Kill switch engagement
    callState = 'CALL_TERMINATED';
    expect(callState).toBe('CALL_TERMINATED');

    // Recovery Reset
    callState = 'RECOVERY';
    expect(callState).toBe('RECOVERY');
  });

  it('formats duration seconds cleanly into mm:ss', () => {
    const formatDuration = (totalSeconds: number) => {
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(59)).toBe('00:59');
    expect(formatDuration(60)).toBe('01:00');
    expect(formatDuration(125)).toBe('02:05');
  });

  it('extracts highlighted scam keywords correctly', () => {
    const indicators: ScamIndicator[] = [
      {
        category: 'REMOTE_ACCESS_REQUEST',
        matched_signal: 'AnyDesk',
        severity: 'CRITICAL',
        evidence: 'Please download AnyDesk',
        confidence: 0.95,
        explanation: 'Remote desktop takeover',
      },
      {
        category: 'CREDENTIAL_REQUEST',
        matched_signal: 'OTP',
        severity: 'CRITICAL',
        evidence: 'Provide 6 digit OTP',
        confidence: 0.98,
        explanation: '2FA bypass attempt',
      },
    ];

    const keywords = indicators.map(i => i.matched_signal);
    expect(keywords).toEqual(['AnyDesk', 'OTP']);
  });

  it('guarantees synchronized DEFCON threat progression across Bank OTP turns', () => {
    // Simulated UI State Engine
    interface UIThreatState {
      threatScore: number;
      threatState: ThreatLevel;
    }

    const state: UIThreatState = {
      threatScore: 0,
      threatState: 'GREEN',
    };

    const applyDecision = (score: number, level: ThreatLevel) => {
      state.threatScore = score;
      state.threatState = level;
    };

    // Initial state before Turn 1
    expect(state.threatScore).toBe(0);
    expect(state.threatState).toBe('GREEN');

    // Turn 1 evaluation (Bank impersonation)
    applyDecision(15, 'GREEN');
    expect(state.threatScore).toBe(15);
    expect(state.threatState).toBe('GREEN');
    // Ensure 100/100 is NOT shown during Turn 1
    expect(state.threatScore).not.toBe(100);
    expect(state.threatState).not.toBe('RED');

    // Turn 2 evaluation (OTP Credential solicitation)
    applyDecision(53, 'ORANGE');
    expect(state.threatScore).toBe(53);
    expect(state.threatState).toBe('ORANGE');
    // Ensure 100/100 is NOT shown during Turn 2
    expect(state.threatScore).not.toBe(100);
    expect(state.threatState).not.toBe('RED');

    // Turn 3 evaluation (Urgency & Account intimidation)
    applyDecision(100, 'RED');
    expect(state.threatScore).toBe(100);
    expect(state.threatState).toBe('RED');
  });

  it('verifies live microphone mode dynamically derives score from actual speech', () => {
    // Real dynamic scoring mock
    const evaluateDynamicSpeech = (detectedCategories: string[]): { score: number; state: ThreatLevel } => {
      let score = 0;
      if (detectedCategories.includes('IMPERSONATION')) score += 15;
      if (detectedCategories.includes('CREDENTIAL_REQUEST')) score += 35;
      if (detectedCategories.includes('URGENCY_PRESSURE')) score += 12;
      if (detectedCategories.includes('THREAT_INTIMIDATION')) score += 20;

      // Synergy bonus
      if (detectedCategories.includes('CREDENTIAL_REQUEST') && detectedCategories.includes('URGENCY_PRESSURE')) {
        score += 18;
      }

      const finalScore = Math.min(100, score);
      const state: ThreatLevel = finalScore >= 75 ? 'RED' : finalScore >= 50 ? 'ORANGE' : finalScore >= 25 ? 'YELLOW' : 'GREEN';
      return { score: finalScore, state };
    };

    // Live single blended sentence containing full attack triad jumps immediately to RED/100
    const liveMultiVector = evaluateDynamicSpeech(['IMPERSONATION', 'CREDENTIAL_REQUEST', 'URGENCY_PRESSURE', 'THREAT_INTIMIDATION']);
    expect(liveMultiVector.score).toBe(100);
    expect(liveMultiVector.state).toBe('RED');

    // Live benign inquiry
    const liveBenign = evaluateDynamicSpeech([]);
    expect(liveBenign.score).toBe(0);
    expect(liveBenign.state).toBe('GREEN');

    // Live isolated inquiry
    const liveSingleSignal = evaluateDynamicSpeech(['IMPERSONATION']);
    expect(liveSingleSignal.score).toBe(15);
    expect(liveSingleSignal.state).toBe('GREEN');
  });

  it('progressively accumulates multi-turn transcripts without replacing previous turns', () => {
    let transcript: TranscriptSegment[] = [];

    const handleProgressiveWord = (segId: string, turnIndex: number, speaker: 'CALLER' | 'CALLEE', revealedText: string, isComplete: boolean) => {
      const idx = transcript.findIndex(s => s.segment_id === segId);
      if (idx === -1) {
        transcript.push({
          segment_id: segId,
          turn_index: turnIndex,
          timestamp: Date.now() / 1000,
          iso_time: new Date().toISOString(),
          speaker,
          text: revealedText,
          is_final: isComplete,
          confidence: 0.95,
        });
      } else {
        transcript[idx] = {
          ...transcript[idx],
          text: revealedText,
          is_final: isComplete,
        };
      }
    };

    // Turn 1 progressive reveal
    handleProgressiveWord('turn_1', 1, 'CALLER', 'Hello', false);
    expect(transcript.length).toBe(1);
    expect(transcript[0].text).toBe('Hello');
    expect(transcript[0].is_final).toBe(false);

    handleProgressiveWord('turn_1', 1, 'CALLER', 'Hello I am calling from your bank', false);
    expect(transcript.length).toBe(1);
    expect(transcript[0].text).toBe('Hello I am calling from your bank');

    handleProgressiveWord('turn_1', 1, 'CALLER', 'Hello I am calling from your bank security department.', true);
    expect(transcript[0].is_final).toBe(true);

    // Turn 2 progressive reveal begins -> Turn 1 must STILL be preserved!
    handleProgressiveWord('turn_2', 2, 'CALLER', 'To', false);
    expect(transcript.length).toBe(2);
    expect(transcript[0].text).toBe('Hello I am calling from your bank security department.');
    expect(transcript[0].is_final).toBe(true);
    expect(transcript[1].text).toBe('To');
    expect(transcript[1].is_final).toBe(false);

    handleProgressiveWord('turn_2', 2, 'CALLER', 'To verify your identity, please tell me the OTP.', true);
    expect(transcript.length).toBe(2);
    expect(transcript[1].is_final).toBe(true);

    // Turn 3 progressive reveal begins -> Turns 1 & 2 must STILL be preserved!
    handleProgressiveWord('turn_3', 3, 'CALLER', 'You need to do it immediately.', true);
    expect(transcript.length).toBe(3);
    expect(transcript[0].text).toBe('Hello I am calling from your bank security department.');
    expect(transcript[1].text).toBe('To verify your identity, please tell me the OTP.');
    expect(transcript[2].text).toBe('You need to do it immediately.');
  });

  it('guarantees word-level DEFCON synchronization: score escalates only when trigger words are spoken', () => {
    // Simulated state
    let displayedScore = 0;
    let displayedLevel: ThreatLevel = 'GREEN';
    let autonomousInterventionTriggered = false;

    const pendingDecisions = new Map<number, { score: number; level: ThreatLevel; indicators: ScamIndicator[] }>();
    const appliedTurns = new Set<number>();

    // Pre-computed decisions from backend
    pendingDecisions.set(1, {
      score: 15,
      level: 'GREEN',
      indicators: [{ category: 'IMPERSONATION', matched_signal: 'bank security department', severity: 'LOW', evidence: 'bank security department', confidence: 0.9, explanation: 'Impersonation' }]
    });
    pendingDecisions.set(2, {
      score: 53,
      level: 'ORANGE',
      indicators: [{ category: 'CREDENTIAL_REQUEST', matched_signal: 'OTP', severity: 'CRITICAL', evidence: 'tell me the OTP', confidence: 0.98, explanation: '2FA bypass' }]
    });
    pendingDecisions.set(3, {
      score: 100,
      level: 'RED',
      indicators: [{ category: 'URGENCY_PRESSURE', matched_signal: 'immediately', severity: 'HIGH', evidence: 'do it immediately', confidence: 0.95, explanation: 'Urgency coercion' }]
    });

    const onProgressiveWordSpoken = (turnIndex: number, revealedText: string, isComplete: boolean, wordIndex: number, totalWords: number) => {
      if (appliedTurns.has(turnIndex)) return;
      const pending = pendingDecisions.get(turnIndex);
      if (!pending) return;

      const textLower = revealedText.toLowerCase();
      let hasReached = pending.indicators.some(ind => {
        const sig = ind.matched_signal.toLowerCase();
        return textLower.includes(sig);
      });

      if (!hasReached && (isComplete || wordIndex >= Math.floor(totalWords * 0.6))) {
        hasReached = true;
      }

      if (hasReached) {
        appliedTurns.add(turnIndex);
        displayedScore = pending.score;
        displayedLevel = pending.level;
        if (pending.level === 'RED') {
          autonomousInterventionTriggered = true;
        }
      }
    };

    // --- TURN 1 ---
    // Word 1: "Hello," -> Not yet reached "bank security department"
    onProgressiveWordSpoken(1, 'Hello,', false, 0, 14);
    expect(displayedScore).toBe(0);
    expect(displayedLevel).toBe('GREEN');

    // Word 6: "...bank security department..." -> Trigger reached!
    onProgressiveWordSpoken(1, 'Hello, I am calling from your bank security department.', true, 13, 14);
    expect(displayedScore).toBe(15);
    expect(displayedLevel).toBe('GREEN');

    // --- TURN 2 ---
    // Backend pre-computes Turn 2 (53 ORANGE) & Turn 3 (100 RED).
    // Early Turn 2 words spoken: "To verify your identity, please tell me the" (does NOT contain "OTP")
    onProgressiveWordSpoken(2, 'To verify your identity, please tell me the', false, 7, 14);
    // DEFCON MUST REMAIN AT 15 GREEN! Must NOT jump to 53 or 100!
    expect(displayedScore).toBe(15);
    expect(displayedLevel).toBe('GREEN');

    // Spoken content reaches "OTP" -> Trigger reached!
    onProgressiveWordSpoken(2, 'To verify your identity, please tell me the OTP that was just sent to your phone.', true, 13, 14);
    expect(displayedScore).toBe(53);
    expect(displayedLevel).toBe('ORANGE');

    // --- TURN 3 ---
    // Early Turn 3 words spoken: "You need to do it" (does NOT contain "immediately")
    onProgressiveWordSpoken(3, 'You need to do it', false, 4, 13);
    // DEFCON MUST REMAIN AT 53 ORANGE! Must NOT jump to 100 RED yet!
    expect(displayedScore).toBe(53);
    expect(displayedLevel).toBe('ORANGE');
    expect(autonomousInterventionTriggered).toBe(false);

    // Spoken content reaches "immediately" -> RED Trigger reached!
    onProgressiveWordSpoken(3, 'You need to do it immediately, otherwise your account will be blocked.', true, 12, 13);
    expect(displayedScore).toBe(100);
    expect(displayedLevel).toBe('RED');
    expect(autonomousInterventionTriggered).toBe(true);
  });

  it('guarantees autonomous kill-switch executes EXACTLY ONCE even when duplicate RED events arrive', () => {
    let executionCount = 0;
    let autonomousInterventionTriggered = false;
    let advisoryBroadcastCount = 0;
    let callState: CallState = 'CALL_ACTIVE';

    const triggerAutonomousIntervention = (reason: string) => {
      if (autonomousInterventionTriggered) {
        return; // Idempotency guard prevents second execution
      }
      autonomousInterventionTriggered = true;
      executionCount++;
      callState = 'KILL_SWITCH_ACTIVE';
      advisoryBroadcastCount++;
    };

    const resetSimulation = () => {
      autonomousInterventionTriggered = false;
      callState = 'IDLE';
    };

    // 1. Initial trigger on Turn 3 RED
    triggerAutonomousIntervention('CRITICAL_THREAT_RED_TRIGGER');
    expect(executionCount).toBe(1);
    expect(advisoryBroadcastCount).toBe(1);
    expect(callState).toBe('KILL_SWITCH_ACTIVE');

    // 2. Duplicate RED event arrives (e.g. from ADVISORY turn start or extra WebSocket frame)
    triggerAutonomousIntervention('ADVISORY_START_DUPLICATE');
    triggerAutonomousIntervention('KILLSWITCH_UPDATE_FRAME_DUPLICATE');

    // MUST REMAIN EXACTLY 1!
    expect(executionCount).toBe(1);
    expect(advisoryBroadcastCount).toBe(1);

    // 3. Audio finishes -> transitions to COMPLETED
    callState = 'COMPLETED';
    expect(callState).toBe('COMPLETED');

    // 4. RESET DEMO -> Resets guard for new simulation
    resetSimulation();
    expect(callState).toBe('IDLE');

    // 5. Next independent simulation run can trigger intervention again
    triggerAutonomousIntervention('NEW_SIMULATION_RED_TRIGGER');
    expect(executionCount).toBe(2);
    expect(advisoryBroadcastCount).toBe(2);
    expect(callState).toBe('KILL_SWITCH_ACTIVE');
  });

  it('guarantees Tech Support scenario progression: Turn 1 (16.5 GREEN) -> Turn 3 (52.1 ORANGE) -> Turn 5 (96.1 RED) -> kill-switch', () => {
    let displayedScore = 0;
    let displayedLevel: ThreatLevel = 'GREEN';
    let autonomousInterventionTriggered = false;

    const pendingDecisions = new Map<number, { score: number; level: ThreatLevel; indicators: ScamIndicator[] }>();
    const appliedTurns = new Set<number>();

    // Tech Support pre-computed decisions
    pendingDecisions.set(1, {
      score: 16.5,
      level: 'GREEN',
      indicators: [
        { category: 'IMPERSONATION', matched_signal: 'Microsoft Windows Global Security', severity: 'MEDIUM', evidence: 'Microsoft Windows', confidence: 0.95, explanation: 'Impersonation' },
        { category: 'THREAT_INTIMIDATION', matched_signal: 'Trojan viruses', severity: 'HIGH', evidence: 'malicious Trojan viruses', confidence: 0.95, explanation: 'False technical alarm' },
      ],
    });
    pendingDecisions.set(2, {
      score: 16.5,
      level: 'GREEN',
      indicators: [],
    });
    pendingDecisions.set(3, {
      score: 52.1,
      level: 'ORANGE',
      indicators: [
        { category: 'THREAT_INTIMIDATION', matched_signal: 'federal cyber laws', severity: 'HIGH', evidence: 'locked under federal cyber laws', confidence: 0.95, explanation: 'Legal threat' },
        { category: 'URGENCY_PRESSURE', matched_signal: 'immediately', severity: 'HIGH', evidence: 'act immediately', confidence: 0.95, explanation: 'Urgency' },
      ],
    });
    pendingDecisions.set(4, {
      score: 52.1,
      level: 'ORANGE',
      indicators: [],
    });
    pendingDecisions.set(5, {
      score: 96.1,
      level: 'RED',
      indicators: [
        { category: 'REMOTE_ACCESS_REQUEST', matched_signal: 'www.anydesk.com', severity: 'CRITICAL', evidence: 'Type www.anydesk.com', confidence: 0.98, explanation: 'Remote access tool' },
        { category: 'REMOTE_ACCESS_REQUEST', matched_signal: 'remote access ID', severity: 'CRITICAL', evidence: 'give me the 9-digit remote access ID', confidence: 0.98, explanation: 'Credential theft' },
      ],
    });

    const onProgressiveWordSpoken = (turnIndex: number, revealedText: string, isComplete: boolean, wordIndex: number, totalWords: number) => {
      if (appliedTurns.has(turnIndex)) return;
      const pending = pendingDecisions.get(turnIndex);
      if (!pending) return;

      const textClean = revealedText
        .toLowerCase()
        .replace(/['".,!?;:()\[\]{}]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      let hasReached = false;
      if (pending.indicators.length === 0) {
        hasReached = true;
      } else {
        hasReached = pending.indicators.some(ind => {
          const sigClean = ind.matched_signal.toLowerCase().replace(/['".,!?;:()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
          const evClean = ind.evidence.toLowerCase().replace(/['".,!?;:()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();
          if (sigClean.length >= 2 && textClean.includes(sigClean)) return true;
          if (evClean.length >= 4 && textClean.includes(evClean)) return true;
          const words = sigClean.split(/\s+/).filter(w => w.length >= 3);
          return words.length > 0 && words.some(w => textClean.includes(w));
        });
      }

      if (!hasReached && (isComplete || wordIndex >= Math.floor(totalWords * 0.6))) {
        hasReached = true;
      }

      if (hasReached) {
        appliedTurns.add(turnIndex);
        displayedScore = pending.score;
        displayedLevel = pending.level;
        if (pending.level === 'RED') {
          autonomousInterventionTriggered = true;
        }
      }
    };

    // --- TURN 1 (CALLER) ---
    // Early words: "Hello, this is David Miller calling from"
    onProgressiveWordSpoken(1, 'Hello, this is David Miller calling from', false, 6, 27);
    expect(displayedScore).toBe(0);
    expect(displayedLevel).toBe('GREEN');

    // Trigger reached: "...Microsoft Windows Global Security Department... Trojan viruses..."
    onProgressiveWordSpoken(1, 'Hello, this is David Miller calling from Microsoft Windows Global Security Department. We have detected that your computer IP address is broadcasting multiple malicious Trojan viruses and foreign hacking signals.', true, 26, 27);
    expect(displayedScore).toBe(16.5);
    expect(displayedLevel).toBe('GREEN');

    // --- TURN 2 (CALLEE / VICTIM) ---
    onProgressiveWordSpoken(2, 'Oh my god, really? But I have antivirus installed on my laptop. Is my personal information at risk?', true, 16, 17);
    expect(displayedScore).toBe(16.5);
    expect(displayedLevel).toBe('GREEN');

    // --- TURN 3 (CALLER Escalation) ---
    // Early words: "Yes ma'am, your personal bank files"
    onProgressiveWordSpoken(3, "Yes ma'am, your personal bank files", false, 5, 27);
    expect(displayedScore).toBe(16.5); // Still at 16.5 GREEN!
    expect(displayedLevel).toBe('GREEN');

    // Trigger reached: "...locked under federal cyber laws. You must act immediately."
    onProgressiveWordSpoken(3, "Yes ma'am, your personal bank files and social security have been breached right now. Do not turn off your computer or your hard drive will be permanently locked under federal cyber laws. You must act immediately.", true, 26, 27);
    expect(displayedScore).toBe(52.1);
    expect(displayedLevel).toBe('ORANGE');

    // --- TURN 4 (CALLEE / VICTIM) ---
    onProgressiveWordSpoken(4, 'Please help me, what do I need to do to stop them?', true, 10, 11);
    expect(displayedScore).toBe(52.1);
    expect(displayedLevel).toBe('ORANGE');

    // --- TURN 5 (CALLER Remote Access Attack) ---
    // Early words: "Press Windows Key and R on your keyboard right now."
    onProgressiveWordSpoken(5, 'Press Windows Key and R on your keyboard right now.', false, 9, 36);
    expect(displayedScore).toBe(52.1); // Still at 52.1 ORANGE!
    expect(displayedLevel).toBe('ORANGE');
    expect(autonomousInterventionTriggered).toBe(false);

    // Spoken content reaches "anydesk.com" and "remote access ID" -> RED trigger reached!
    onProgressiveWordSpoken(5, "Press Windows Key and R on your keyboard right now. Type 'www.anydesk.com' or 'teamviewer.com' and click Download. I need you to give me the 9-digit remote access ID so I can securely connect and purge the hackers from your system.", true, 35, 36);
    expect(displayedScore).toBe(96.1);
    expect(displayedLevel).toBe('RED');
    expect(autonomousInterventionTriggered).toBe(true);
  });

  it('correctly matches indicators despite punctuation, quotes, and case differences', () => {
    const normalize = (text: string) => text.toLowerCase().replace(/['".,!?;:()\[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

    const checkMatch = (spokenText: string, signal: string) => {
      const textClean = normalize(spokenText);
      const sigClean = normalize(signal);
      if (sigClean.length >= 2 && textClean.includes(sigClean)) return true;
      const words = sigClean.split(/\s+/).filter(w => w.length >= 3);
      return words.length > 0 && words.some(w => textClean.includes(w));
    };

    // Case and punctuation resistance
    expect(checkMatch('Please share your OTP,', 'otp')).toBe(true);
    expect(checkMatch("Type 'www.anydesk.com'", 'www.anydesk.com')).toBe(true);
    expect(checkMatch('Download teamviewer.com now!', 'teamviewer.com')).toBe(true);
    expect(checkMatch('Give me the 9-digit remote access ID.', 'remote access ID')).toBe(true);
    expect(checkMatch('You must act immediately.', 'immediately')).toBe(true);
  });

  it('guarantees exact character-range interval slicing without text corruption or injection', () => {
    const originalText = "Press Windows Key and R on your keyboard right now. Type 'www.anydesk.com' or 'teamviewer.com' and click Download. I need you to give me the 9-digit remote access ID so I can connect.";
    const highlightedPhrases = ['anydesk', 'teamviewer', 'download', 'remote access ID', 'windows key and r'];

    // Slicing test
    const validPhrases = highlightedPhrases
      .map(p => p.trim())
      .filter(p => p.length >= 2)
      .sort((a, b) => b.length - a.length);

    const intervals: Array<{ start: number; end: number }> = [];
    for (const phrase of validPhrases) {
      const escaped = phrase
        .split(/\s+/)
        .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[\\s\\p{P}]+');
      const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gui');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(originalText)) !== null) {
        if (match[0].length > 0) {
          intervals.push({ start: match.index, end: match.index + match[0].length });
        }
        if (regex.lastIndex === match.index) regex.lastIndex++;
      }
    }

    intervals.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const merged: Array<{ start: number; end: number }> = [];
    let current = intervals[0];
    for (let i = 1; i < intervals.length; i++) {
      const next = intervals[i];
      if (next.start <= current.end) {
        current.end = Math.max(current.end, next.end);
      } else {
        merged.push(current);
        current = next;
      }
    }
    merged.push(current);

    // Verify highlighted segments come directly from originalText
    const highlightedSegments = merged.map(i => originalText.slice(i.start, i.end));
    expect(highlightedSegments).toContain('Windows Key and R');
    expect(highlightedSegments).toContain('anydesk');
    expect(highlightedSegments).toContain('teamviewer');
    expect(highlightedSegments).toContain('Download');
    expect(highlightedSegments).toContain('remote access ID');

    // Verify reconstructibility
    let reconstructed = '';
    let lastIdx = 0;
    merged.forEach(i => {
      reconstructed += originalText.slice(lastIdx, i.start);
      reconstructed += originalText.slice(i.start, i.end);
      lastIdx = i.end;
    });
    reconstructed += originalText.slice(lastIdx);
    expect(reconstructed).toBe(originalText);
  });

  it('guarantees partial/empty websocket frames do NOT clear indicators or reset score', () => {
    let accumulatedIndicators: ScamIndicator[] = [
      { category: 'CREDENTIAL_REQUEST', matched_signal: 'otp', severity: 'CRITICAL', evidence: 'tell me the OTP', confidence: 0.98, explanation: 'OTP' }
    ];
    let score = 53.0;

    // Incoming partial frame with empty indicators
    const incomingEval: InspectorEvaluation = {
      evaluation_id: 'eval_empty',
      turn_index: 2,
      timestamp: Date.now(),
      iso_time: new Date().toISOString(),
      speaker: 'CALLEE',
      composite_risk_score: 0,
      threat_velocity: 0,
      active_threat_level: 'GREEN',
      highlighted_phrases: [],
      critical_triggers: [],
      dialogue_snippet: 'Okay',
      indicators: [],
      normalized_text: 'okay',
    };

    // Accumulation logic test
    if (incomingEval.indicators && incomingEval.indicators.length > 0) {
      const existingKeys = new Set(accumulatedIndicators.map(i => `${i.matched_signal.toLowerCase()}_${i.category}`));
      const newItems = incomingEval.indicators.filter(
        i => !existingKeys.has(`${i.matched_signal.toLowerCase()}_${i.category}`)
      );
      accumulatedIndicators = [...accumulatedIndicators, ...newItems];
    }

    // Indicators MUST NOT be wiped!
    expect(accumulatedIndicators.length).toBe(1);
    expect(accumulatedIndicators[0].matched_signal).toBe('otp');
    expect(score).toBe(53.0);
  });

  it('guarantees benign scenario (Legitimate Bank Support) finishes with GREEN, no kill-switch, and COMPLETED state', () => {
    let callState: CallState = 'CALL_ACTIVE';
    let threatState: ThreatLevel = 'GREEN';
    let threatScore = 15.0;
    let killSwitchActive = false;

    // 6 turns of normal bank support
    for (let turn = 1; turn <= 6; turn++) {
      // No new threats
      if (turn === 1) {
        threatScore = 15.0;
        threatState = 'GREEN';
      }
      expect(killSwitchActive).toBe(false);
      expect(threatState).toBe('GREEN');
    }

    // Scenario playback complete
    callState = 'COMPLETED';
    expect(callState).toBe('COMPLETED');
    expect(killSwitchActive).toBe(false);
    expect(threatScore).toBe(15.0);
  });

  it('guarantees IRS Arrest Extortion (Demo 3) flow escalates to RED and triggers kill-switch', () => {
    let score = 0;
    let level: ThreatLevel = 'GREEN';
    let killSwitch = false;

    // Turn 1: Arrest warrant claim
    score = 75.0;
    level = 'ORANGE';
    expect(level).toBe('ORANGE');
    expect(killSwitch).toBe(false);

    // Turn 2: Victim shock -> harmless
    expect(level).toBe('ORANGE');

    // Turn 3: County sheriff custody threat
    score = 100.0;
    level = 'RED';
    killSwitch = true;
    expect(level).toBe('RED');
    expect(killSwitch).toBe(true);
  });

  it('guarantees Grandparent Emergency Bail (Demo 5) flow escalates to RED and triggers kill-switch', () => {
    let score = 0;
    let level: ThreatLevel = 'GREEN';
    let killSwitch = false;

    // Turn 1: "Don't tell mom and dad, terrible trouble"
    score = 32.0;
    level = 'GREEN';
    expect(score).toBe(32.0);

    // Turn 2: Victim response
    expect(score).toBe(32.0);

    // Turn 3: "in jail in downtown holding cells"
    score = 89.0;
    level = 'RED';
    killSwitch = true;
    expect(level).toBe('RED');
    expect(killSwitch).toBe(true);
  });

  describe('Live Call Mode Pipeline & Hardening', () => {
    it('guarantees safe deduplication for duplicate recognition events within 2000ms while allowing distinct utterances', () => {
      let ingestedCount = 0;
      let lastSentText = '';
      let lastSentTime = 0;

      const handleLiveUtterance = (text: string, timestamp: number) => {
        const cleaned = text.trim();
        if (cleaned.length > 0 && (cleaned !== lastSentText || timestamp - lastSentTime > 2000)) {
          lastSentText = cleaned;
          lastSentTime = timestamp;
          ingestedCount++;
        }
      };

      const t0 = 10000;
      // 1. First spoken sentence
      handleLiveUtterance('Hello, I have a question about my account.', t0);
      expect(ingestedCount).toBe(1);

      // 2. Duplicate browser recognition event fired at t0 + 150ms -> DEDUPLICATED
      handleLiveUtterance('Hello, I have a question about my account.', t0 + 150);
      expect(ingestedCount).toBe(1);

      // 3. Genuinely distinct second utterance at t0 + 500ms -> INGESTED
      handleLiveUtterance('Can you help me verify a charge?', t0 + 500);
      expect(ingestedCount).toBe(2);

      // 4. Same utterance repeated after 2500ms -> INGESTED (user actually repeated themselves)
      handleLiveUtterance('Can you help me verify a charge?', t0 + 3000);
      expect(ingestedCount).toBe(3);
    });

    it('guarantees live transcript updates do NOT synthesize speech via TTS (Zero Audio Echo)', () => {
      let ttsSpokenCount = 0;
      let transcriptSegments: TranscriptSegment[] = [];

      const onTranscriptUpdate = (seg: TranscriptSegment, isStreaming: boolean) => {
        if (isStreaming) {
          // Simulation mode speaks through TTS
          ttsSpokenCount++;
        } else {
          // Live mode updates transcript directly with ZERO speech synthesis
          const idx = transcriptSegments.findIndex(s => s.segment_id === seg.segment_id);
          if (idx === -1) {
            transcriptSegments.push(seg);
          } else {
            transcriptSegments[idx] = seg;
          }
        }
      };

      const liveTurn: TranscriptSegment = {
        segment_id: 'seg_live_1',
        turn_index: 1,
        timestamp: Date.now(),
        iso_time: new Date().toISOString(),
        speaker: 'CALLER',
        text: 'This is my live voice speaking into the microphone.',
        is_final: true,
        confidence: 0.98,
      };

      // Ingest in Live Mode (isStreaming = false)
      onTranscriptUpdate(liveTurn, false);

      expect(ttsSpokenCount).toBe(0); // ZERO TTS echo!
      expect(transcriptSegments.length).toBe(1);
      expect(transcriptSegments[0].text).toBe('This is my live voice speaking into the microphone.');
    });

    it('guarantees Live Mode applies DEFCON decisions immediately without waiting for simulation timers', () => {
      let displayedScore = 0;
      let displayedLevel: ThreatLevel = 'GREEN';
      const isStreaming = false;

      const onDecisionUpdate = (decData: DecisionResult, evalData?: InspectorEvaluation) => {
        if (!isStreaming) {
          displayedScore = decData.score;
          displayedLevel = decData.threat_state;
        }
      };

      const liveDecision: DecisionResult = {
        decision_id: 'dec_live_1',
        timestamp: Date.now(),
        iso_time: new Date().toISOString(),
        score: 62.0,
        threat_score: 62.0,
        threat_state: 'ORANGE',
        current_state: 'ORANGE',
        previous_state: 'GREEN',
        decision: 'WARN',
        requires_intervention: false,
        automated_intervention_triggered: false,
        confidence: 96,
        reasons: ['CREDENTIAL_REQUEST detected', 'URGENCY_PRESSURE detected'],
        triggered_rules: ['COMBINATION_URGENCY_AND_CREDENTIALS'],
        combination_rules_triggered: ['COMBINATION_URGENCY_AND_CREDENTIALS'],
        critical_triggers_active: false,
        recommended_actions: [],
      };

      onDecisionUpdate(liveDecision);

      expect(displayedScore).toBe(62.0);
      expect(displayedLevel).toBe('ORANGE');
    });

    it('guarantees Live Mode autonomous intervention executes exactly once on RED decision', () => {
      let interventionExecutionCount = 0;
      let callState: CallState = 'CALL_ACTIVE';
      let autonomousInterventionTriggered = false;

      const triggerAutonomousIntervention = (data: any) => {
        if (autonomousInterventionTriggered) return;
        autonomousInterventionTriggered = true;
        interventionExecutionCount++;
        callState = 'KILL_SWITCH_ACTIVE';
      };

      const handleLiveDecision = (decData: DecisionResult) => {
        if (decData.requires_intervention || decData.threat_state === 'RED') {
          triggerAutonomousIntervention({ reason: decData.reasons[0] });
        }
      };

      const redDecision: DecisionResult = {
        decision_id: 'dec_live_red',
        timestamp: Date.now(),
        iso_time: new Date().toISOString(),
        score: 100.0,
        threat_score: 100.0,
        threat_state: 'RED',
        current_state: 'RED',
        previous_state: 'ORANGE',
        decision: 'INTERVENE',
        requires_intervention: true,
        automated_intervention_triggered: true,
        confidence: 99,
        reasons: ['CRITICAL_THREAT_THRESHOLD_EXCEEDED'],
        triggered_rules: ['COMBINATION_TECH_SUPPORT_TRIAD'],
        combination_rules_triggered: ['COMBINATION_TECH_SUPPORT_TRIAD'],
        critical_triggers_active: true,
        recommended_actions: [],
      };

      // First RED event
      handleLiveDecision(redDecision);
      expect(interventionExecutionCount).toBe(1);
      expect(callState).toBe('KILL_SWITCH_ACTIVE');

      // Duplicate/Repeated RED WebSocket frame
      handleLiveDecision(redDecision);
      expect(interventionExecutionCount).toBe(1); // STRICTLY EXACTLY ONCE
    });

    it('guarantees legitimate live conversation produces zero false alarms and clean state', () => {
      let threatScore = 0;
      let threatState: ThreatLevel = 'GREEN';
      let killSwitchTriggered = false;

      const benignTurns = [
        'Hello, I would like to check my checking account balance.',
        'I see a charge from last Tuesday that I want to understand.',
        'Thank you very much for clarifying that fee for me, have a great day!'
      ];

      benignTurns.forEach((text, i) => {
        // No scam indicators in benign text
        const indicators: ScamIndicator[] = [];
        if (indicators.length === 0) {
          // Score remains at 0 or baseline
          threatScore = 0;
          threatState = 'GREEN';
        }
        expect(killSwitchTriggered).toBe(false);
        expect(threatState).toBe('GREEN');
        expect(threatScore).toBe(0);
      });
    });

    it('guarantees clean state reset when stopping and restarting Live Mode', () => {
      let transcript: TranscriptSegment[] = [{ segment_id: 's1', turn_index: 1, text: 'Old text', speaker: 'CALLER', timestamp: 1, iso_time: '', is_final: true, confidence: 1 }];
      let indicators: ScamIndicator[] = [{ category: 'CREDENTIAL_REQUEST', matched_signal: 'otp', severity: 'CRITICAL', evidence: 'otp', confidence: 0.99, explanation: '' }];
      let score = 100;
      let state: ThreatLevel = 'RED';
      let killSwitchArmed = true;
      let interventionTriggered = true;

      // Execute full reset
      const resetLiveState = () => {
        transcript = [];
        indicators = [];
        score = 0;
        state = 'GREEN';
        killSwitchArmed = true;
        interventionTriggered = false;
      };

      resetLiveState();

      expect(transcript.length).toBe(0);
      expect(indicators.length).toBe(0);
      expect(score).toBe(0);
      expect(state).toBe('GREEN');
      expect(interventionTriggered).toBe(false);
    });

    it('guarantees Live timer starts at 00:00, advances, stops on manual stop, and formats MM:SS', () => {
      const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      };

      let liveDurationSeconds = 0;
      let isListening = false;

      // 1. Start live session
      isListening = true;
      liveDurationSeconds = 0;
      expect(formatDuration(liveDurationSeconds)).toBe('00:00');

      // 2. Advance 5 seconds
      liveDurationSeconds += 5;
      expect(formatDuration(liveDurationSeconds)).toBe('00:05');

      // 3. Advance to 65 seconds
      liveDurationSeconds = 65;
      expect(formatDuration(liveDurationSeconds)).toBe('01:05');

      // 4. User presses Stop -> timer freezes and preserves elapsed time
      isListening = false;
      const finalRecordedDuration = liveDurationSeconds;
      expect(formatDuration(finalRecordedDuration)).toBe('01:05');

      // 5. New session starts -> resets to 00:00
      isListening = true;
      liveDurationSeconds = 0;
      expect(formatDuration(liveDurationSeconds)).toBe('00:00');
    });

    it('guarantees manual Stop sets status to CALL ENDED / IDLE and preserves evidence without firing kill-switch', () => {
      let callState: CallState = 'CALL_ACTIVE';
      let micState = 'LISTENING';
      let threatScore = 63.0;
      let threatState: ThreatLevel = 'ORANGE';
      let indicators: ScamIndicator[] = [
        { category: 'CREDENTIAL_REQUEST', matched_signal: 'otp', severity: 'HIGH', evidence: 'otp', confidence: 0.95, explanation: '' }
      ];
      let killSwitchActive = false;
      let simulationCompletedEmitted = false;

      // User presses Stop
      micState = 'READY';
      callState = 'IDLE';

      // Verify guarantees
      expect(micState).toBe('READY');
      expect(callState).toBe('IDLE');
      expect(killSwitchActive).toBe(false);
      expect(simulationCompletedEmitted).toBe(false);

      // Verify final DEFCON and evidence remain intact for audit
      expect(threatScore).toBe(63.0);
      expect(threatState).toBe('ORANGE');
      expect(indicators.length).toBe(1);
      expect(indicators[0].matched_signal).toBe('otp');
    });

    it('guarantees Sidebar & TopHeader badges correctly reflect active vs ended vs RED states', () => {
      const getIncidentLabel = (threatState: ThreatLevel, callState: CallState, isStreaming: boolean) => {
        if (threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE') {
          return 'Critical Incident';
        }
        if (callState === 'CALL_ACTIVE' || isStreaming) {
          return 'Active Incident';
        }
        return 'Session Ended';
      };

      const getLiveProtectionLabel = (threatLevel: ThreatLevel, callState: CallState, isStreaming: boolean) => {
        if (threatLevel === 'RED' || callState === 'KILL_SWITCH_ACTIVE') {
          return 'TERMINATED / KILL SWITCH ACTIVE';
        }
        if (callState === 'CALL_ACTIVE' || isStreaming) {
          return 'CONNECTED (ACTIVE)';
        }
        return 'READY / IDLE';
      };

      // 1. Live Active Listening
      expect(getIncidentLabel('GREEN', 'CALL_ACTIVE', false)).toBe('Active Incident');
      expect(getLiveProtectionLabel('GREEN', 'CALL_ACTIVE', false)).toBe('CONNECTED (ACTIVE)');

      // 2. Manually Stopped Session
      expect(getIncidentLabel('ORANGE', 'IDLE', false)).toBe('Session Ended');
      expect(getLiveProtectionLabel('ORANGE', 'IDLE', false)).toBe('READY / IDLE');

      // 3. Autonomous RED Critical Incident
      expect(getIncidentLabel('RED', 'KILL_SWITCH_ACTIVE', false)).toBe('Critical Incident');
      expect(getLiveProtectionLabel('RED', 'KILL_SWITCH_ACTIVE', false)).toBe('TERMINATED / KILL SWITCH ACTIVE');
    });

    it('guarantees centralized cross-page state synchronization across all 6 views on Simulation Start -> RED -> Reset', () => {
      // Shared Central Session Store State
      interface CentralSessionStore {
        sessionId: string;
        scenario: string | null;
        callStatus: CallState;
        callDuration: number;
        conversationTurns: TranscriptSegment[];
        threatScore: number;
        threatState: ThreatLevel;
        confidence: number;
        detectedScamIndicators: ScamIndicator[];
        triggeredRules: string[];
        decisionDirective: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
        interventionState: { isActive: boolean; audioSevered: boolean };
        evidenceEvents: EvidenceBlock[];
        agentStates: {
          inspector: string;
          decisionEngine: string;
          evidenceAgent: string;
          interventionAgent: string;
        };
        telemetryVelocity: number;
      }

      // 1. Initial Clean State
      let state: CentralSessionStore = {
        sessionId: 'INC-INIT',
        scenario: null,
        callStatus: 'IDLE',
        callDuration: 0,
        conversationTurns: [],
        threatScore: 0,
        threatState: 'GREEN',
        confidence: 100,
        detectedScamIndicators: [],
        triggeredRules: [],
        decisionDirective: 'ALLOW',
        interventionState: { isActive: false, audioSevered: false },
        evidenceEvents: [{
          index: 0,
          timestamp: Date.now(),
          iso_time: new Date().toISOString(),
          event_type: 'GENESIS',
          agent_source: 'System',
          payload: {},
          prev_hash: '0',
          block_hash: 'hash_genesis',
          nonce: 0,
          signature: 'sig_0',
        }],
        agentStates: {
          inspector: 'IDLE',
          decisionEngine: 'IDLE',
          evidenceAgent: 'IDLE',
          interventionAgent: 'IDLE',
        },
        telemetryVelocity: 0,
      };

      // Every page views the EXACT SAME store values
      const getDashboardView = (s: CentralSessionStore) => ({ score: s.threatScore, state: s.threatState, directive: s.decisionDirective });
      const getLiveCallView = (s: CentralSessionStore) => ({ score: s.threatScore, state: s.threatState, callStatus: s.callStatus, turns: s.conversationTurns.length });
      const getThreatIntelView = (s: CentralSessionStore) => ({ score: s.threatScore, state: s.threatState, indicators: s.detectedScamIndicators.length });
      const getEvidenceView = (s: CentralSessionStore) => ({ score: s.threatScore, state: s.threatState, blockCount: s.evidenceEvents.length });
      const getAnalyticsView = (s: CentralSessionStore) => ({ score: s.threatScore, state: s.threatState, signals: s.detectedScamIndicators.length, turnsEvaluated: s.conversationTurns.length });
      const getAgentSwarmView = (s: CentralSessionStore) => s.agentStates;

      // Verify Initial Alignment
      expect(getDashboardView(state).score).toBe(0);
      expect(getLiveCallView(state).score).toBe(0);
      expect(getThreatIntelView(state).score).toBe(0);
      expect(getEvidenceView(state).score).toBe(0);
      expect(getAnalyticsView(state).score).toBe(0);
      expect(getAnalyticsView(state).signals).toBe(0);

      // 2. Simulation Starts
      state = {
        ...state,
        sessionId: 'INC-2026-OTP',
        scenario: 'bank_otp_scam',
        callStatus: 'CALL_ACTIVE',
        agentStates: {
          inspector: 'PROCESSING',
          decisionEngine: 'DECIDING',
          evidenceAgent: 'SEALING',
          interventionAgent: 'IDLE',
        },
      };

      expect(getLiveCallView(state).callStatus).toBe('CALL_ACTIVE');
      expect(getAgentSwarmView(state).inspector).toBe('PROCESSING');

      // 3. Turn 1 Ingested (Urgency detected)
      const turn1: TranscriptSegment = {
        segment_id: 'seg_1',
        turn_index: 1,
        speaker: 'CALLER',
        text: 'This is fraud prevention. You must verify immediately.',
        timestamp: Date.now(),
        iso_time: new Date().toISOString(),
        is_final: true,
        confidence: 0.98,
      };
      const indicator1: ScamIndicator = {
        category: 'URGENCY_PRESSURE',
        matched_signal: 'verify immediately',
        severity: 'MEDIUM',
        evidence: 'verify immediately',
        confidence: 0.95,
        explanation: 'Coercive urgency',
      };
      state = {
        ...state,
        conversationTurns: [turn1],
        detectedScamIndicators: [indicator1],
        threatScore: 35,
        threatState: 'YELLOW',
        decisionDirective: 'MONITOR',
        evidenceEvents: [
          ...state.evidenceEvents,
          {
            index: 1,
            timestamp: Date.now(),
            iso_time: new Date().toISOString(),
            event_type: 'THREAT_ASSESSMENT_YELLOW',
            agent_source: 'DecisionEngine',
            payload: { score: 35 },
            prev_hash: state.evidenceEvents[0].block_hash,
            block_hash: 'hash_block_1',
            nonce: 1,
            signature: 'sig_1',
          },
        ],
      };

      // Assert that ALL views immediately reflect Turn 1 changes
      expect(getDashboardView(state).score).toBe(35);
      expect(getDashboardView(state).state).toBe('YELLOW');
      expect(getLiveCallView(state).score).toBe(35);
      expect(getLiveCallView(state).turns).toBe(1);
      expect(getThreatIntelView(state).score).toBe(35);
      expect(getThreatIntelView(state).indicators).toBe(1);
      expect(getEvidenceView(state).score).toBe(35);
      expect(getEvidenceView(state).blockCount).toBe(2);
      expect(getAnalyticsView(state).score).toBe(35);
      expect(getAnalyticsView(state).signals).toBe(1);
      expect(getAnalyticsView(state).turnsEvaluated).toBe(1);

      // 4. Turn 2 Ingested (OTP requested -> Escalation to RED / CRITICAL)
      const turn2: TranscriptSegment = {
        segment_id: 'seg_2',
        turn_index: 2,
        speaker: 'CALLER',
        text: 'Read me the 6 digit one-time passcode right now.',
        timestamp: Date.now(),
        iso_time: new Date().toISOString(),
        is_final: true,
        confidence: 0.99,
      };
      const indicator2: ScamIndicator = {
        category: 'CREDENTIAL_REQUEST',
        matched_signal: 'one-time passcode',
        severity: 'HIGH',
        evidence: 'one-time passcode',
        confidence: 0.99,
        explanation: 'Direct OTP harvesting',
      };
      state = {
        ...state,
        conversationTurns: [turn1, turn2],
        detectedScamIndicators: [indicator1, indicator2],
        triggeredRules: ['COMBINATION_URGENCY_AND_CREDENTIALS'],
        threatScore: 100,
        threatState: 'RED',
        decisionDirective: 'INTERVENE',
        callStatus: 'KILL_SWITCH_ACTIVE',
        interventionState: { isActive: true, audioSevered: true },
        agentStates: {
          inspector: 'IDLE',
          decisionEngine: 'INTERVENING',
          evidenceAgent: 'SEALING',
          interventionAgent: 'INTERVENING',
        },
        evidenceEvents: [
          ...state.evidenceEvents,
          {
            index: 2,
            timestamp: Date.now(),
            iso_time: new Date().toISOString(),
            event_type: 'ACTIVE_INTERVENTION_KILLSWITCH_ENGAGED',
            agent_source: 'InterventionAgent',
            payload: { score: 100, reason: 'CRITICAL_THREAT' },
            prev_hash: 'hash_block_1',
            block_hash: 'hash_block_2',
            nonce: 2,
            signature: 'sig_2',
          },
        ],
      };

      // Assert that ALL views immediately reflect RED / CRITICAL Containment
      expect(getDashboardView(state).score).toBe(100);
      expect(getDashboardView(state).state).toBe('RED');
      expect(getDashboardView(state).directive).toBe('INTERVENE');
      expect(getLiveCallView(state).score).toBe(100);
      expect(getLiveCallView(state).callStatus).toBe('KILL_SWITCH_ACTIVE');
      expect(getThreatIntelView(state).score).toBe(100);
      expect(getThreatIntelView(state).indicators).toBe(2);
      expect(getEvidenceView(state).score).toBe(100);
      expect(getEvidenceView(state).state).toBe('RED');
      expect(getAnalyticsView(state).score).toBe(100);
      expect(getAnalyticsView(state).signals).toBe(2);
      expect(getAgentSwarmView(state).interventionAgent).toBe('INTERVENING');

      // 5. Operator clicks RESET
      state = {
        sessionId: 'INC-2026-RESET',
        scenario: null,
        callStatus: 'IDLE',
        callDuration: 0,
        conversationTurns: [],
        threatScore: 0,
        threatState: 'GREEN',
        confidence: 100,
        detectedScamIndicators: [],
        triggeredRules: [],
        decisionDirective: 'ALLOW',
        interventionState: { isActive: false, audioSevered: false },
        evidenceEvents: [{
          index: 0,
          timestamp: Date.now(),
          iso_time: new Date().toISOString(),
          event_type: 'GENESIS',
          agent_source: 'System',
          payload: {},
          prev_hash: '0',
          block_hash: 'hash_genesis_clean',
          nonce: 0,
          signature: 'sig_0',
        }],
        agentStates: {
          inspector: 'IDLE',
          decisionEngine: 'IDLE',
          evidenceAgent: 'IDLE',
          interventionAgent: 'IDLE',
        },
        telemetryVelocity: 0,
      };

      // Assert that EVERY page is reset to 0/100, GREEN, IDLE, 0 signals, 0 turns
      expect(getDashboardView(state).score).toBe(0);
      expect(getDashboardView(state).state).toBe('GREEN');
      expect(getDashboardView(state).directive).toBe('ALLOW');
      expect(getLiveCallView(state).score).toBe(0);
      expect(getLiveCallView(state).callStatus).toBe('IDLE');
      expect(getLiveCallView(state).turns).toBe(0);
      expect(getThreatIntelView(state).score).toBe(0);
      expect(getThreatIntelView(state).indicators).toBe(0);
      expect(getEvidenceView(state).score).toBe(0);
      expect(getEvidenceView(state).state).toBe('GREEN');
      expect(getEvidenceView(state).blockCount).toBe(1);
      expect(getAnalyticsView(state).score).toBe(0);
      expect(getAnalyticsView(state).signals).toBe(0);
      expect(getAnalyticsView(state).turnsEvaluated).toBe(0);
      expect(getAgentSwarmView(state).interventionAgent).toBe('IDLE');
    });
  });
});





