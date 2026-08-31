import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SENTINEL AI - TTSService Unit & Integration Tests', () => {
  let mockSpeak: any;
  let mockCancel: any;
  let mockResume: any;
  let ttsService: any;

  beforeEach(async () => {
    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    mockResume = vi.fn();

    // Ensure global window exists in test environment
    if (typeof (globalThis as any).window === 'undefined') {
      (globalThis as any).window = globalThis;
    }

    // Mock window.speechSynthesis
    (globalThis as any).window.speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      resume: mockResume,
      paused: false,
      getVoices: vi.fn().mockReturnValue([
        { name: 'Google US English', lang: 'en-US', default: true },
        { name: 'Microsoft Zira', lang: 'en-US', default: false },
      ]),
      onvoiceschanged: null,
    };

    // Mock SpeechSynthesisUtterance
    (globalThis as any).SpeechSynthesisUtterance = class {
      text: string;
      rate: number = 1.0;
      pitch: number = 1.0;
      volume: number = 1.0;
      voice: any = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: any) => void) | null = null;

      constructor(text: string) {
        this.text = text;
      }
    };

    const module = await import('../services/ttsService');
    ttsService = module.ttsService;
    ttsService.reset();
    ttsService.setEnabled(true);
  });

  it('speaks dialogue turn and calls window.speechSynthesis.speak', () => {
    const spoke = ttsService.speakDialogueTurn(
      'Hello, I am calling from your bank security department.',
      { segmentId: 'turn-1', speaker: 'CALLER' }
    );

    expect(spoke).toBe(true);
    expect(mockCancel).toHaveBeenCalled();
    expect(mockResume).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('deduplicates speech so the same segmentId is spoken exactly once', () => {
    const first = ttsService.speakDialogueTurn(
      'Please tell me the OTP that was just sent to your phone.',
      { segmentId: 'turn-otp', speaker: 'CALLER' }
    );
    expect(first).toBe(true);
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Second call with same segmentId should be skipped
    const second = ttsService.speakDialogueTurn(
      'Please tell me the OTP that was just sent to your phone.',
      { segmentId: 'turn-otp', speaker: 'CALLER' }
    );
    expect(second).toBe(false);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('respects VOICE OFF / setEnabled(false) by skipping speech', () => {
    ttsService.setEnabled(false);
    expect(ttsService.isEnabled()).toBe(false);
    expect(mockCancel).toHaveBeenCalled();

    const spoke = ttsService.speakDialogueTurn(
      'Your account will be blocked within 10 minutes.',
      { segmentId: 'turn-3', speaker: 'CALLER' }
    );

    expect(spoke).toBe(false);
    expect(mockSpeak).not.toHaveBeenCalled();
  });

  it('stops ongoing speech when stop() is called', () => {
    ttsService.stop();
    expect(mockCancel).toHaveBeenCalled();
  });

  it('clears spoken turn cache upon reset() so scenario replay works', () => {
    ttsService.speakDialogueTurn('First attempt turn 1', { segmentId: 'turn-replay' });
    expect(mockSpeak).toHaveBeenCalledTimes(1);

    // Reset simulation
    ttsService.reset();

    // Replay should now be permitted
    const spokeReplay = ttsService.speakDialogueTurn('First attempt turn 1', { segmentId: 'turn-replay' });
    expect(spokeReplay).toBe(true);
    expect(mockSpeak).toHaveBeenCalledTimes(2);
  });

  it('speaks defensive advisory warning', () => {
    const spoke = ttsService.speakDefensiveAdvisory(
      'Warning. This conversation has been identified as fraudulent.',
      'adv-1'
    );
    expect(spoke).toBe(true);
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('strictly serializes caller turns: Turn 2 cannot begin before Turn 1 onend', () => {
    const spokenUtterances: any[] = [];
    mockSpeak.mockImplementation((utt: any) => {
      spokenUtterances.push(utt);
      if (utt.onstart) utt.onstart();
    });

    // Turn 1 arrives and starts speaking
    ttsService.speakDialogueTurn('Turn 1: Bank security department.', { segmentId: 'seq-turn-1' });
    expect(spokenUtterances.length).toBe(1);
    expect(spokenUtterances[0].text).toContain('Turn 1');

    // Turn 2 arrives while Turn 1 is speaking -> must be QUEUED, not spoken immediately
    ttsService.speakDialogueTurn('Turn 2: Please tell me the OTP.', { segmentId: 'seq-turn-2' });
    expect(spokenUtterances.length).toBe(1);

    // Turn 3 arrives while Turn 1 is still speaking -> must be QUEUED
    ttsService.speakDialogueTurn('Turn 3: Immediate action required.', { segmentId: 'seq-turn-3' });
    expect(spokenUtterances.length).toBe(1);

    // Turn 1 completes
    spokenUtterances[0].onend();

    // Turn 2 now starts speaking, Turn 3 is still queued
    expect(spokenUtterances.length).toBe(2);
    expect(spokenUtterances[1].text).toContain('Turn 2');

    // Turn 2 completes
    spokenUtterances[1].onend();

    // Turn 3 now starts speaking
    expect(spokenUtterances.length).toBe(3);
    expect(spokenUtterances[2].text).toContain('Turn 3');
  });

  it('queues advisory behind all earlier queued caller turns until they all finish', () => {
    const spokenUtterances: any[] = [];
    mockSpeak.mockImplementation((utt: any) => {
      spokenUtterances.push(utt);
      if (utt.onstart) utt.onstart();
    });

    // Turn 1 and Turn 2 arrive in rapid succession
    ttsService.speakDialogueTurn('Turn 1 speech', { segmentId: 'turn-a' });
    ttsService.speakDialogueTurn('Turn 2 speech', { segmentId: 'turn-b' });

    // Defensive advisory arrives while Turn 1 is speaking and Turn 2 is queued
    ttsService.speakDefensiveAdvisory('Warning fraud alert', 'adv-seq');

    // Only Turn 1 is speaking
    expect(spokenUtterances.length).toBe(1);
    expect(spokenUtterances[0].text).toBe('Turn 1 speech');

    // Turn 1 ends -> Turn 2 speaks (NOT advisory yet)
    spokenUtterances[0].onend();
    expect(spokenUtterances.length).toBe(2);
    expect(spokenUtterances[1].text).toBe('Turn 2 speech');

    // Turn 2 ends -> Defensive Advisory now speaks
    spokenUtterances[1].onend();
    expect(spokenUtterances.length).toBe(3);
    expect(spokenUtterances[2].text).toBe('Warning fraud alert');
  });

  it('queues rapid incoming transcript events without overlapping or dropping them', () => {
    const spokenUtterances: any[] = [];
    mockSpeak.mockImplementation((utt: any) => {
      spokenUtterances.push(utt);
      if (utt.onstart) utt.onstart();
    });

    // 5 rapid turns dispatched simultaneously
    for (let i = 1; i <= 5; i++) {
      ttsService.speakDialogueTurn(`Rapid turn ${i}`, { segmentId: `rapid-${i}` });
    }

    // Only Turn 1 started
    expect(spokenUtterances.length).toBe(1);

    // Complete all 5 turns in sequence
    for (let i = 0; i < 4; i++) {
      spokenUtterances[i].onend();
      expect(spokenUtterances.length).toBe(i + 2);
    }
    expect(spokenUtterances.length).toBe(5);
  });

  it('reset() clears the queue and halts any pending turns and advisories', () => {
    const spokenUtterances: any[] = [];
    mockSpeak.mockImplementation((utt: any) => {
      spokenUtterances.push(utt);
      if (utt.onstart) utt.onstart();
    });

    ttsService.speakDialogueTurn('Turn 1', { segmentId: 'reset-1' });
    ttsService.speakDialogueTurn('Turn 2', { segmentId: 'reset-2' });
    ttsService.speakDefensiveAdvisory('Warning', 'reset-adv');

    expect(spokenUtterances.length).toBe(1);

    // Operator clicks Reset Demo
    ttsService.reset();
    expect(mockCancel).toHaveBeenCalled();

    // If an onend fires from aborted utterance, queue is empty so nothing else plays
    if (spokenUtterances[0].onend) {
      spokenUtterances[0].onend();
    }
    expect(spokenUtterances.length).toBe(1);
  });

  describe('Multi-Scenario Generic Queue Execution', () => {
    it('Scenario: Bank OTP Scam (3 turns -> Advisory)', () => {
      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      const turns = [
        { id: 'bank_t1', text: 'Hello, I am calling from bank security.' },
        { id: 'bank_t2', text: 'Please tell me the OTP.' },
        { id: 'bank_t3', text: 'You need to do it immediately or account will be blocked.' },
      ];

      turns.forEach((t) =>
        ttsService.speakDialogueTurn(t.text, { segmentId: t.id, speaker: 'CALLER' })
      );
      ttsService.speakDefensiveAdvisory('Fraud warning: never share OTP', 'adv_bank');

      expect(spokenUtterances.length).toBe(1);
      expect(spokenUtterances[0].text).toBe(turns[0].text);

      spokenUtterances[0].onend();
      expect(spokenUtterances.length).toBe(2);
      expect(spokenUtterances[1].text).toBe(turns[1].text);

      spokenUtterances[1].onend();
      expect(spokenUtterances.length).toBe(3);
      expect(spokenUtterances[2].text).toBe(turns[2].text);

      spokenUtterances[2].onend();
      expect(spokenUtterances.length).toBe(4);
      expect(spokenUtterances[3].text).toBe('Fraud warning: never share OTP');
    });

    it('Scenario: Tech Support Scam (7 dialogue turns -> Advisory)', () => {
      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      const techTurns = [
        'Turn 1: David Miller calling from Microsoft.',
        'Turn 2: Is my computer at risk?',
        'Turn 3: Your personal bank files have been breached.',
        'Turn 4: What do I need to do to stop them?',
        'Turn 5: Download AnyDesk or TeamViewer now.',
        'Turn 6: Remote address number is 492 810 391.',
        'Turn 7: Open your online banking portal now.',
      ];

      techTurns.forEach((txt, idx) =>
        ttsService.speakDialogueTurn(txt, {
          segmentId: `tech_${idx + 1}`,
          speaker: idx % 2 === 0 ? 'CALLER' : 'CALLEE',
        })
      );
      ttsService.speakDefensiveAdvisory('Remote access scam intercepted.', 'adv_tech');

      expect(spokenUtterances.length).toBe(1);

      for (let i = 0; i < techTurns.length; i++) {
        expect(spokenUtterances[i].text).toBe(techTurns[i]);
        spokenUtterances[i].onend();
      }

      // After all 7 turns finish, the advisory plays
      expect(spokenUtterances.length).toBe(8);
      expect(spokenUtterances[7].text).toBe('Remote access scam intercepted.');
    });

    it('Scenario: IRS Extortion Scam (5 dialogue turns -> Advisory)', () => {
      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      const irsTurns = [
        'Turn 1: Special Agent John Davis from IRS.',
        'Turn 2: An arrest warrant?!',
        'Turn 3: Unpaid balance of 4890 dollars.',
        'Turn 4: Can I pay with credit card?',
        'Turn 5: Purchase four 500 dollar gift cards immediately.',
      ];

      irsTurns.forEach((txt, idx) =>
        ttsService.speakDialogueTurn(txt, {
          segmentId: `irs_${idx + 1}`,
          speaker: idx % 2 === 0 ? 'CALLER' : 'CALLEE',
        })
      );
      ttsService.speakDefensiveAdvisory('Government extortion scam detected.', 'adv_irs');

      for (let i = 0; i < irsTurns.length; i++) {
        expect(spokenUtterances[i].text).toBe(irsTurns[i]);
        spokenUtterances[i].onend();
      }

      expect(spokenUtterances.length).toBe(6);
      expect(spokenUtterances[5].text).toBe('Government extortion scam detected.');
    });

    it('Scenario: Benign Customer Support (6 turns -> Zero advisories injected)', () => {
      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      const benignTurns = [
        'Turn 1: Bank of America Customer Care Sarah.',
        'Turn 2: Twelve dollar maintenance fee inquiry.',
        'Turn 3: Enroll in direct deposit to waive fee.',
        'Turn 4: How do I set up direct deposit?',
        'Turn 5: Download form from website.',
        'Turn 6: Thank you very much Sarah.',
      ];

      benignTurns.forEach((txt, idx) =>
        ttsService.speakDialogueTurn(txt, {
          segmentId: `benign_${idx + 1}`,
          speaker: idx % 2 === 0 ? 'CALLER' : 'CALLEE',
        })
      );

      // No defensive advisory is added for benign conversation
      for (let i = 0; i < benignTurns.length; i++) {
        expect(spokenUtterances[i].text).toBe(benignTurns[i]);
        spokenUtterances[i].onend();
      }

      // Exactly 6 turns spoken, zero advisories
      expect(spokenUtterances.length).toBe(6);
    });

    it('handles switching scenarios and multiple RESET DEMO cycles without duplicate speech', () => {
      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      // 1. Start Bank OTP Scam
      ttsService.speakDialogueTurn('Bank OTP Turn 1', { segmentId: 'bank_t1' });
      expect(spokenUtterances.length).toBe(1);

      // 2. User switches to Tech Support and hits Reset
      ttsService.reset();
      expect(mockCancel).toHaveBeenCalled();

      // 3. Start Tech Support
      ttsService.speakDialogueTurn('Tech Support Turn 1', { segmentId: 'tech_t1' });
      expect(spokenUtterances.length).toBe(2);

      // 4. Repeated Reset
      ttsService.reset();
      ttsService.reset();

      // 5. Restart Bank OTP Scam again -> should speak fresh without blocked cache
      ttsService.speakDialogueTurn('Bank OTP Turn 1', { segmentId: 'bank_t1' });
      expect(spokenUtterances.length).toBe(3);
      expect(spokenUtterances[2].text).toBe('Bank OTP Turn 1');
    });

    it('synchronizes transcript rendering with audio playback: Turn 2 onTurnStart only triggers after Turn 1 onend', () => {
      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      const renderedTurns: string[] = [];
      const unsubscribe = ttsService.onTurnStart((item: any) => {
        if (item.metadata?.turnName) {
          renderedTurns.push(item.metadata.turnName);
        }
      });

      // 1. Turn 1 arrives from WebSocket -> starts speaking -> onTurnStart fires
      ttsService.speakDialogueTurn('Turn 1 spoken text', {
        segmentId: 'sync_1',
        metadata: { turnName: 'Turn 1' },
      });
      expect(renderedTurns).toEqual(['Turn 1']);

      // 2. Turn 2 arrives while Turn 1 is still speaking -> queued in TTS -> onTurnStart MUST NOT FIRE YET
      ttsService.speakDialogueTurn('Turn 2 spoken text', {
        segmentId: 'sync_2',
        metadata: { turnName: 'Turn 2' },
      });
      expect(renderedTurns).toEqual(['Turn 1']); // Turn 2 is NOT in rendered transcript yet!

      // 3. Turn 3 arrives while Turn 1 is still speaking -> queued in TTS -> onTurnStart MUST NOT FIRE YET
      ttsService.speakDialogueTurn('Turn 3 spoken text', {
        segmentId: 'sync_3',
        metadata: { turnName: 'Turn 3' },
      });
      expect(renderedTurns).toEqual(['Turn 1']);

      // 4. Turn 1 finishes speaking (utterance.onend)
      spokenUtterances[0].onend();

      // Now Turn 2 audio begins -> onTurnStart fires -> Turn 2 rendered
      expect(renderedTurns).toEqual(['Turn 1', 'Turn 2']);

      // 5. Turn 2 finishes speaking (utterance.onend)
      spokenUtterances[1].onend();

      // Now Turn 3 audio begins -> onTurnStart fires -> Turn 3 rendered
      expect(renderedTurns).toEqual(['Turn 1', 'Turn 2', 'Turn 3']);

      unsubscribe();
    });

    it('triggers onPlaybackComplete callback precisely when the final queued item finishes', () => {
      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      let playbackCompleted = false;
      const unsubscribe = ttsService.onPlaybackComplete(() => {
        playbackCompleted = true;
      });

      // Push 2 turns + 1 defensive advisory
      ttsService.speakDialogueTurn('Turn 1 text', { segmentId: 'comp_1' });
      ttsService.speakDialogueTurn('Turn 2 text', { segmentId: 'comp_2' });
      ttsService.speakDefensiveAdvisory('Defensive warning', 'comp_adv');

      expect(playbackCompleted).toBe(false);

      // Turn 1 ends
      spokenUtterances[0].onend();
      expect(playbackCompleted).toBe(false);

      // Turn 2 ends
      spokenUtterances[1].onend();
      expect(playbackCompleted).toBe(false);

      // Advisory ends -> now queue is empty and speech is finished!
      spokenUtterances[2].onend();
      expect(playbackCompleted).toBe(true);

      unsubscribe();
    });

    it('emits onProgressiveWord events to progressively build transcripts word-by-word', () => {
      let activeUtterance: any = null;
      mockSpeak.mockImplementation((utt: any) => {
        activeUtterance = utt;
        if (utt.onstart) utt.onstart();
      });

      const wordsRevealed: string[] = [];
      const isCompleteFlags: boolean[] = [];

      const unsubscribe = ttsService.onProgressiveWord((event: any) => {
        wordsRevealed.push(event.revealedText);
        isCompleteFlags.push(event.isComplete);
      });

      ttsService.speakDialogueTurn('Hello I am calling from your bank', {
        segmentId: 'prog_1',
      });

      // On start, initial word "Hello" is emitted
      expect(wordsRevealed[0]).toBe('Hello');
      expect(isCompleteFlags[0]).toBe(false);

      // Simulate boundary events firing for subsequent words
      if (activeUtterance?.onboundary) {
        // "Hello I" (charIndex 6)
        activeUtterance.onboundary({ name: 'word', charIndex: 6 });
        expect(wordsRevealed[wordsRevealed.length - 1]).toBe('Hello I');

        // "Hello I am" (charIndex 8)
        activeUtterance.onboundary({ name: 'word', charIndex: 8 });
        expect(wordsRevealed[wordsRevealed.length - 1]).toBe('Hello I am');

        // "Hello I am calling" (charIndex 11)
        activeUtterance.onboundary({ name: 'word', charIndex: 11 });
        expect(wordsRevealed[wordsRevealed.length - 1]).toBe('Hello I am calling');
      }

      // Simulate utterance onend -> final complete sentence emitted
      activeUtterance.onend();
      expect(wordsRevealed[wordsRevealed.length - 1]).toBe('Hello I am calling from your bank');
      expect(isCompleteFlags[isCompleteFlags.length - 1]).toBe(true);

      unsubscribe();
    });

    it('selects male voice for CALLER and female voice for CALLEE per turn', () => {
      const mockVoices = [
        { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
        { name: 'Microsoft Zira Desktop - English (United States)', lang: 'en-US' },
        { name: 'Google UK English Female', lang: 'en-GB' },
      ];
      ttsService.setVoices(mockVoices as any);

      const callerVoice = ttsService.getVoiceForSpeaker('CALLER');
      const calleeVoice = ttsService.getVoiceForSpeaker('CALLEE');
      const victimVoice = ttsService.getVoiceForSpeaker('VICTIM');
      const advisoryVoice = ttsService.getVoiceForSpeaker('ADVISORY');

      expect(callerVoice?.name).toContain('David');
      expect(calleeVoice?.name).toContain('Zira');
      expect(victimVoice?.name).toContain('Zira');
      expect(advisoryVoice?.name).toBeDefined();

      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      // Turn 1: CALLER
      ttsService.speakDialogueTurn('Hello, this is tech support.', {
        segmentId: 'turn_call_1',
        speaker: 'CALLER',
      });
      expect(spokenUtterances[0].voice?.name).toContain('David');
      expect(spokenUtterances[0].pitch).toBe(1.0);

      // Turn 2: CALLEE
      spokenUtterances[0].onend();
      ttsService.speakDialogueTurn('Oh no, is my computer infected?', {
        segmentId: 'turn_call_2',
        speaker: 'CALLEE',
      });
      expect(spokenUtterances[1].voice?.name).toContain('Zira');
      expect(spokenUtterances[1].pitch).toBeGreaterThan(1.0); // Higher female pitch
    });

    it('handles missing preferred voices gracefully without crashing', () => {
      ttsService.setVoices([]);
      const fallbackCaller = ttsService.getVoiceForSpeaker('CALLER');
      const fallbackCallee = ttsService.getVoiceForSpeaker('CALLEE');

      expect(fallbackCaller).toBeNull();
      expect(fallbackCallee).toBeNull();

      const spokenUtterances: any[] = [];
      mockSpeak.mockImplementation((utt: any) => {
        spokenUtterances.push(utt);
        if (utt.onstart) utt.onstart();
      });

      // Speaking without loaded voices should not crash
      expect(() => {
        ttsService.speakDialogueTurn('Testing without voices', {
          segmentId: 'no_voice_turn',
          speaker: 'CALLEE',
        });
      }).not.toThrow();

      expect(spokenUtterances[0].pitch).toBe(1.25);
    });
  });
});


