import { ttsService } from '../services/ttsService';

/**
 * Web Audio API synthesizer for high-tech alerts, jamming tones, and synthetic speech
 */

class SoundEffectsController {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  public playAlertBeep(freq = 880, type: OscillatorType = 'sine', duration = 0.15) {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  public playCriticalAlarm() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      
      // Siren sweep
      osc.frequency.setValueAtTime(500, now);
      osc.frequency.linearRampToValueAtTime(950, now + 0.25);
      osc.frequency.linearRampToValueAtTime(500, now + 0.5);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(now + 0.55);
    } catch (e) {
      console.warn('Alarm error:', e);
    }
  }

  public playJammerPulse() {
    if (this.isMuted) return;
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      
      // White noise buffer + filter for active radio jamming sound
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1200, now);
      filter.Q.setValueAtTime(3.0, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.38);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.4);
    } catch (e) {
      console.warn('Jammer error:', e);
    }
  }

  public speakSyntheticWarning(
    text = "SENTINEL DEFENSE ALERT: Critical scam detected. Call terminated. Never share 2FA codes.",
    advisoryId?: string
  ) {
    if (this.isMuted) return;
    try {
      ttsService.speakDefensiveAdvisory(text, advisoryId);
    } catch (e) {
      console.warn('TTS error:', e);
    }
  }
}

export const soundEffects = new SoundEffectsController();

