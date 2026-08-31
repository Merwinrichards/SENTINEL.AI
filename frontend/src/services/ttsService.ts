/**
 * SENTINEL AI - Production Text-To-Speech (TTS) Engine
 * Handles scenario dialogue voice playback, defense advisories, Chrome autoplay unlocking,
 * voice selection, and speech deduplication.
 */

export interface SpeechQueueItem {
  type: 'DIALOGUE' | 'ADVISORY';
  text: string;
  id?: string;
  speaker?: string;
  speedMultiplier?: number;
  metadata?: any;
}

export interface ProgressiveWordEvent {
  item: SpeechQueueItem;
  charIndex: number;
  wordIndex: number;
  totalWords: number;
  revealedText: string;
  isComplete: boolean;
}

class TTSService {
  private enabled: boolean = true;
  private voices: SpeechSynthesisVoice[] = [];
  private callerVoice: SpeechSynthesisVoice | null = null;
  private calleeVoice: SpeechSynthesisVoice | null = null;
  private advisorVoice: SpeechSynthesisVoice | null = null;
  private spokenSegmentIds: Set<string> = new Set<string>();
  private spokenAdvisoryIds: Set<string> = new Set<string>();
  private isUnlocked: boolean = false;
  private isSpeaking: boolean = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private queue: SpeechQueueItem[] = [];
  private turnStartListeners: Set<(item: SpeechQueueItem) => void> = new Set();
  private turnEndListeners: Set<(item: SpeechQueueItem) => void> = new Set();
  private progressiveWordListeners: Set<(event: ProgressiveWordEvent) => void> = new Set();
  private playbackCompleteListeners: Set<() => void> = new Set();
  private wordProgressTimer: any = null;

  constructor() {
    this.initVoices();
  }

  public onTurnStart(callback: (item: SpeechQueueItem) => void): () => void {
    this.turnStartListeners.add(callback);
    return () => this.turnStartListeners.delete(callback);
  }

  public onTurnEnd(callback: (item: SpeechQueueItem) => void): () => void {
    this.turnEndListeners.add(callback);
    return () => this.turnEndListeners.delete(callback);
  }

  public onProgressiveWord(callback: (event: ProgressiveWordEvent) => void): () => void {
    this.progressiveWordListeners.add(callback);
    return () => this.progressiveWordListeners.delete(callback);
  }

  public onPlaybackComplete(callback: () => void): () => void {
    this.playbackCompleteListeners.add(callback);
    return () => this.playbackCompleteListeners.delete(callback);
  }

  private notifyTurnStart(item: SpeechQueueItem): void {
    this.turnStartListeners.forEach((cb) => {
      try {
        cb(item);
      } catch (err) {
        console.error('[TTS] Error in turnStart listener:', err);
      }
    });
  }

  private notifyTurnEnd(item: SpeechQueueItem): void {
    this.turnEndListeners.forEach((cb) => {
      try {
        cb(item);
      } catch (err) {
        console.error('[TTS] Error in turnEnd listener:', err);
      }
    });
  }

  private notifyProgressiveWord(event: ProgressiveWordEvent): void {
    this.progressiveWordListeners.forEach((cb) => {
      try {
        cb(event);
      } catch (err) {
        console.error('[TTS] Error in progressiveWord listener:', err);
      }
    });
  }

  private notifyPlaybackComplete(): void {
    this.playbackCompleteListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[TTS] Error in playbackComplete listener:', err);
      }
    });
  }

  private isFemaleVoice(name: string): boolean {
    const n = name.toLowerCase();
    return (
      n.includes('female') ||
      n.includes('zira') ||
      n.includes('samantha') ||
      n.includes('victoria') ||
      n.includes('karen') ||
      n.includes('susan') ||
      n.includes('hazel') ||
      n.includes('linda') ||
      n.includes('jenny') ||
      n.includes('siri') ||
      n.includes('heera') ||
      n.includes('aria') ||
      n.includes('ava')
    );
  }

  private isMaleVoice(name: string): boolean {
    const n = name.toLowerCase();
    return (
      n.includes('male') ||
      n.includes('david') ||
      n.includes('guy') ||
      n.includes('mark') ||
      n.includes('george') ||
      n.includes('james') ||
      n.includes('richard') ||
      n.includes('daniel') ||
      n.includes('ravi') ||
      n.includes('alex')
    );
  }

  public getVoiceForSpeaker(speaker?: string): SpeechSynthesisVoice | null {
    const spk = (speaker || '').toUpperCase();
    if (spk === 'CALLEE' || spk === 'VICTIM' || spk === 'USER') {
      return this.calleeVoice || this.advisorVoice || this.callerVoice || this.voices[0] || null;
    }
    if (spk === 'ADVISORY' || spk === 'SYSTEM') {
      return this.advisorVoice || this.calleeVoice || this.callerVoice || this.voices[0] || null;
    }
    // Default for CALLER / SCAMMER
    return this.callerVoice || this.voices[0] || null;
  }

  public getCallerVoice(): SpeechSynthesisVoice | null {
    return this.callerVoice;
  }

  public getCalleeVoice(): SpeechSynthesisVoice | null {
    return this.calleeVoice;
  }

  public getAdvisorVoice(): SpeechSynthesisVoice | null {
    return this.advisorVoice;
  }

  public setVoices(voices: SpeechSynthesisVoice[]): void {
    this.voices = voices;
    if (voices.length === 0) {
      this.callerVoice = null;
      this.calleeVoice = null;
      this.advisorVoice = null;
      return;
    }

    const enVoices = voices.filter((v) => v.lang.startsWith('en'));
    const pool = enVoices.length > 0 ? enVoices : voices;

    this.callerVoice =
      pool.find((v) => this.isMaleVoice(v.name)) ||
      pool.find((v) => !this.isFemaleVoice(v.name)) ||
      pool[0] ||
      null;

    this.calleeVoice =
      pool.find((v) => this.isFemaleVoice(v.name)) ||
      pool.find((v) => v !== this.callerVoice) ||
      pool[pool.length > 1 ? 1 : 0] ||
      null;

    this.advisorVoice =
      pool.find(
        (v) =>
          v.name.includes('Zira') ||
          v.name.includes('Samantha') ||
          v.name.includes('Google UK English Female')
      ) ||
      this.calleeVoice ||
      this.callerVoice ||
      pool[0] ||
      null;
  }

  private initVoices(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.warn('[TTS] Web Speech API (speechSynthesis) is not available in this browser.');
      return;
    }

    const loadVoices = () => {
      const rawVoices = window.speechSynthesis.getVoices();
      if (rawVoices.length > 0) {
        this.setVoices(rawVoices);
        console.log('[TTS] Voices loaded:', {
          total: this.voices.length,
          callerVoice: this.callerVoice?.name || 'Default (Male)',
          calleeVoice: this.calleeVoice?.name || 'Default (Female)',
          advisorVoice: this.advisorVoice?.name || 'Default (Advisory)',
        });
      }
    };

    loadVoices();

    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Unlock audio playback using the user interaction gesture (e.g. click START SIMULATION).
   * Also works around the Chrome idle freeze issue with speechSynthesis.resume().
   */
  public unlockAudio(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.resume();
      this.isUnlocked = true;

      // Speak an ultra-short silent cue if needed to fully prime Chrome TTS
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      console.log('[TTS] Audio engine unlocked & resumed via user gesture.');
    } catch (e) {
      console.warn('[TTS] Audio unlock notice:', e);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`[TTS] Voice output ${enabled ? 'ENABLED' : 'MUTED'}`);
    if (!enabled) {
      this.stop();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Speak a scenario dialogue turn.
   * If speech is already active, queues the turn so caller dialogue is spoken strictly sequentially.
   */
  public speakDialogueTurn(
    text: string,
    options: {
      segmentId?: string;
      speaker?: string;
      speedMultiplier?: number;
      metadata?: any;
    } = {}
  ): boolean {
    const cleanText = text.trim();
    if (!cleanText) return false;

    // Deduplication check
    if (options.segmentId) {
      if (this.spokenSegmentIds.has(options.segmentId)) {
        console.log(`[TTS] Turn '${options.segmentId}' already spoken or queued. Skipping duplicate.`);
        return false;
      }
      this.spokenSegmentIds.add(options.segmentId);
    }

    const queueItem: SpeechQueueItem = {
      type: 'DIALOGUE',
      text: cleanText,
      id: options.segmentId,
      speaker: options.speaker,
      speedMultiplier: options.speedMultiplier,
      metadata: options.metadata,
    };

    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      console.log('[TTS] Audio is disabled/muted: notifying transcript listeners immediately.');
      this.notifyTurnStart(queueItem);
      this.notifyTurnEnd(queueItem);
      return false;
    }

    this.queue.push(queueItem);
    this.processQueue();
    return true;
  }

  /**
   * Speak defensive advisory warning when intervention is triggered.
   * Queued behind active caller speech and earlier queued turns so it never interrupts dialogue.
   */
  public speakDefensiveAdvisory(
    text: string = 'Warning. This conversation has been identified as potentially fraudulent. Do not share your OTP, password, or banking credentials.',
    advisoryId: string = 'default_advisory',
    metadata?: any
  ): boolean {
    const cleanText = text.trim();
    if (!cleanText) return false;

    // Deduplication check for advisory
    if (this.spokenAdvisoryIds.has(advisoryId)) {
      console.log(`[TTS] Advisory '${advisoryId}' already spoken or queued. Skipping duplicate.`);
      return false;
    }
    this.spokenAdvisoryIds.add(advisoryId);

    const queueItem: SpeechQueueItem = {
      type: 'ADVISORY',
      text: cleanText,
      id: advisoryId,
      metadata,
    };

    if (!this.enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.notifyTurnStart(queueItem);
      this.notifyProgressiveWord({
        item: queueItem,
        charIndex: queueItem.text.length,
        wordIndex: 0,
        totalWords: 1,
        revealedText: queueItem.text,
        isComplete: true,
      });
      this.notifyTurnEnd(queueItem);
      return false;
    }

    this.queue.push(queueItem);
    this.processQueue();
    return true;
  }

  /**
   * Serialized queue processor: executes one utterance at a time.
   * The next item is triggered ONLY from onend or onerror.
   */
  private processQueue(): void {
    if (!this.enabled) {
      this.queue = [];
      return;
    }

    // If currently speaking an utterance, wait for onend/onerror to advance queue
    if (this.isSpeaking) {
      return;
    }

    if (this.queue.length === 0) {
      if (!this.isSpeaking) {
        this.notifyPlaybackComplete();
      }
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    try {
      this.unlockAudio();
      window.speechSynthesis.resume();

      const utterance = new SpeechSynthesisUtterance(item.text);
      const words = item.text.trim().split(/\s+/).filter(Boolean);
      let currentWordIdx = 0;
      let boundaryFired = false;

      // Handle onboundary for real-time word-level tracking
      utterance.onboundary = (event: SpeechSynthesisEvent) => {
        boundaryFired = true;
        const charIdx = event.charIndex || 0;
        let accumulated = 0;
        let matchedIdx = 0;
        for (let i = 0; i < words.length; i++) {
          accumulated += words[i].length + 1;
          if (accumulated > charIdx) {
            matchedIdx = i;
            break;
          }
        }
        currentWordIdx = Math.max(currentWordIdx, matchedIdx);
        const revealed = words.slice(0, currentWordIdx + 1).join(' ');
        console.log(`[TRANSCRIPT] Revealed word ${currentWordIdx + 1}/${words.length}: "${words[currentWordIdx]}"`);
        this.notifyProgressiveWord({
          item,
          charIndex: charIdx,
          wordIndex: currentWordIdx,
          totalWords: words.length,
          revealedText: revealed,
          isComplete: currentWordIdx >= words.length - 1,
        });
      };

      if (item.type === 'DIALOGUE') {
        const selectedVoice = this.getVoiceForSpeaker(item.speaker);
        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }
        const mult = item.speedMultiplier || 1.0;
        utterance.rate = Math.max(0.8, Math.min(1.8, 0.9 + mult * 0.2));
        const isCallee =
          (item.speaker || '').toUpperCase() === 'CALLEE' ||
          (item.speaker || '').toUpperCase() === 'VICTIM' ||
          (item.speaker || '').toUpperCase() === 'USER';
        utterance.pitch = isCallee ? 1.25 : 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => {
          this.isSpeaking = true;
          this.notifyTurnStart(item);
          console.log(
            `[TTS] ▶ Speaking Turn (${item.speaker || 'CALLER'}, Voice: ${selectedVoice?.name || 'Default'}): "${item.text.substring(0, 60)}..." [Rate: ${utterance.rate.toFixed(2)}]`
          );
          console.log(`[TRANSCRIPT] Turn started (total words: ${words.length})`);

          // Emit initial first word immediately
          const initialText = words.length > 0 ? words[0] : item.text;
          this.notifyProgressiveWord({
            item,
            charIndex: 0,
            wordIndex: 0,
            totalWords: words.length,
            revealedText: initialText,
            isComplete: words.length <= 1,
          });

          // Fallback timer: advances word-by-word if onboundary is not fired by browser/voice
          if (this.wordProgressTimer) clearInterval(this.wordProgressTimer);
          const effectiveRate = utterance.rate || 1.0;
          const intervalMs = Math.max(120, Math.min(500, Math.round(1000 / (3.2 * effectiveRate))));
          this.wordProgressTimer = setInterval(() => {
            if (!boundaryFired && currentWordIdx < words.length - 1) {
              currentWordIdx++;
              const revealed = words.slice(0, currentWordIdx + 1).join(' ');
              console.log(`[TRANSCRIPT] Revealed word ${currentWordIdx + 1}/${words.length}: "${words[currentWordIdx]}"`);
              this.notifyProgressiveWord({
                item,
                charIndex: 0,
                wordIndex: currentWordIdx,
                totalWords: words.length,
                revealedText: revealed,
                isComplete: currentWordIdx >= words.length - 1,
              });
            }
          }, intervalMs);
        };
      } else {
        const advVoice = this.getVoiceForSpeaker('ADVISORY');
        if (advVoice) {
          utterance.voice = advVoice;
        }
        utterance.rate = 1.05;
        utterance.pitch = 0.95;
        utterance.volume = 1.0;

        utterance.onstart = () => {
          this.isSpeaking = true;
          this.notifyTurnStart(item);
          console.log(`[TTS] 🚨 DEFENSIVE ADVISORY BROADCAST: "${item.text}"`);

          const initialText = words.length > 0 ? words[0] : item.text;
          this.notifyProgressiveWord({
            item,
            charIndex: 0,
            wordIndex: 0,
            totalWords: words.length,
            revealedText: initialText,
            isComplete: words.length <= 1,
          });

          if (this.wordProgressTimer) clearInterval(this.wordProgressTimer);
          const intervalMs = Math.max(120, Math.min(500, Math.round(1000 / 3.4)));
          this.wordProgressTimer = setInterval(() => {
            if (!boundaryFired && currentWordIdx < words.length - 1) {
              currentWordIdx++;
              const revealed = words.slice(0, currentWordIdx + 1).join(' ');
              this.notifyProgressiveWord({
                item,
                charIndex: 0,
                wordIndex: currentWordIdx,
                totalWords: words.length,
                revealedText: revealed,
                isComplete: currentWordIdx >= words.length - 1,
              });
            }
          }, intervalMs);
        };
      }

      utterance.onend = () => {
        if (this.wordProgressTimer) {
          clearInterval(this.wordProgressTimer);
          this.wordProgressTimer = null;
        }
        this.notifyProgressiveWord({
          item,
          charIndex: item.text.length,
          wordIndex: words.length - 1,
          totalWords: words.length,
          revealedText: item.text,
          isComplete: true,
        });
        console.log(
          `[TTS] ✓ Completed ${item.type === 'DIALOGUE' ? 'turn speech' : 'defensive advisory'}.`
        );
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.notifyTurnEnd(item);
        if (this.queue.length === 0) {
          this.notifyPlaybackComplete();
        } else {
          this.processQueue();
        }
      };

      utterance.onerror = (event) => {
        if (this.wordProgressTimer) {
          clearInterval(this.wordProgressTimer);
          this.wordProgressTimer = null;
        }
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          console.warn('[TTS] Speech synthesis notice:', event.error);
        }
        this.notifyProgressiveWord({
          item,
          charIndex: item.text.length,
          wordIndex: words.length - 1,
          totalWords: words.length,
          revealedText: item.text,
          isComplete: true,
        });
        this.isSpeaking = false;
        this.currentUtterance = null;
        this.notifyTurnEnd(item);
        if (this.queue.length === 0) {
          this.notifyPlaybackComplete();
        } else if (event.error !== 'canceled') {
          this.processQueue();
        }
      };

      this.isSpeaking = true;
      this.currentUtterance = utterance;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('[TTS] Queue playback error:', e);
      if (this.wordProgressTimer) {
        clearInterval(this.wordProgressTimer);
        this.wordProgressTimer = null;
      }
      this.isSpeaking = false;
      this.currentUtterance = null;
      this.notifyTurnEnd(item);
      this.processQueue();
    }
  }

  /**
   * Immediately cancel any ongoing speech and empty browser queue (e.g. manual kill switch).
   */
  public stop(): void {
    if (this.wordProgressTimer) {
      clearInterval(this.wordProgressTimer);
      this.wordProgressTimer = null;
    }
    this.queue = [];
    this.isSpeaking = false;
    this.currentUtterance = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        console.log('[TTS] Speech canceled and queue emptied.');
      } catch (e) {
        console.warn('[TTS] Stop error:', e);
      }
    }
  }

  /**
   * Full reset: cancels ongoing speech and clears spoken turns & advisory cache.
   */
  public reset(): void {
    this.stop();
    this.spokenSegmentIds.clear();
    this.spokenAdvisoryIds.clear();
    console.log('[TTS] Spoken turns, advisory cache, and queue reset.');
  }
}

export const ttsService = new TTSService();

