import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Play,
  RotateCcw,
  Square,
  Radio,
  Volume2,
  ShieldAlert,
  AlertTriangle,
  Zap,
  Activity,
  Layers,
  ChevronRight,
  Info,
  CheckCircle2,
  Lock,
  Sparkles,
  Loader2,
  Send,
  Terminal,
  MessageSquare,
} from 'lucide-react';
import {
  CallState,
  ThreatLevel,
  TranscriptSegment,
  MicState,
  LiveCallMode,
  ScamIndicator,
  ScenarioMeta
} from '../../types/sentinel';
import { TranscriptStream } from '../TranscriptStream';
import { ExecutiveThreatSummary } from '../dashboard/ExecutiveThreatSummary';
import { DemoPipelineTracker } from '../dashboard/DemoPipelineTracker';
import { api } from '../../services/api';
import { soundEffects } from '../../utils/soundEffects';
import { ttsService } from '../../services/ttsService';

interface LiveCallViewProps {
  callState: CallState;
  threatState: ThreatLevel;
  threatScore: number;
  callDurationSeconds: number;
  audioActivityLevel: number;
  transcript: TranscriptSegment[];
  activeScenarioId: string | null;
  activeCallerId: string | null;
  activeSessionId: string;
  isVoiceWarningEnabled: boolean;
  onToggleVoiceWarning: () => void;
  onStartScenario: (scenarioId: string, speedMultiplier?: number) => Promise<void>;
  onStopScenario: () => Promise<void>;
  onTriggerKillSwitch: (reason?: string) => Promise<void>;
  onResetKillSwitch: () => Promise<void>;
  indicators?: ScamIndicator[];
  decisionDirective?: 'ALLOW' | 'MONITOR' | 'WARN' | 'INTERVENE';
  decisionReasons?: string[];
  confidence?: number;
  evidenceCount?: number;
  onOpenAuditCertificate?: () => void;
}

export const LiveCallView: React.FC<LiveCallViewProps> = ({
  callState,
  threatState,
  threatScore,
  callDurationSeconds,
  audioActivityLevel,
  transcript,
  activeScenarioId,
  activeCallerId,
  activeSessionId,
  isVoiceWarningEnabled,
  onToggleVoiceWarning,
  onStartScenario,
  onStopScenario,
  onTriggerKillSwitch,
  onResetKillSwitch,
  indicators = [],
  decisionDirective = 'ALLOW',
  decisionReasons = [],
  confidence = 98,
  evidenceCount = 0,
  onOpenAuditCertificate,
}) => {
  const [callMode, setCallMode] = useState<LiveCallMode>('SIMULATION');
  const [selectedScenario, setSelectedScenario] = useState<string>('bank_otp_scam');
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(2.0); // Default fast presentation speed
  const [speedLabel, setSpeedLabel] = useState<string>('Presentation');
  const [micState, setMicState] = useState<MicState>('READY');
  const [speechRecognitionSupported, setSpeechRecognitionSupported] = useState<boolean>(true);
  const [micError, setMicError] = useState<string | null>(null);
  const [liveInterimText, setLiveInterimText] = useState<string>('');
  const [turnCounter, setTurnCounter] = useState<number>(1);
  const [isVoiceWarningPlaying, setIsVoiceWarningPlaying] = useState<boolean>(false);
  const [simulationStatusText, setSimulationStatusText] = useState<string | null>(null);
  const [scenariosList, setScenariosList] = useState<ScenarioMeta[]>([
    {
      id: 'bank_otp_scam',
      title: 'Bank OTP Scam (Presentation Demo Benchmark)',
      category: 'Banking & Credential Theft',
      description: 'Caller impersonates a bank security representative and attempts to obtain an OTP using urgency and account threats.',
      target_risk_level: 'CRITICAL',
      caller_id_spoof: '+1 (800) 555-0199',
      turn_count: 3,
    },
    {
      id: 'tech_support_remote_access',
      title: 'Tech Support: Urgent Ransomware & Remote Access Scam',
      category: 'Remote Access & Extortion',
      description: 'Scammer claims computer has critical Trojan virus and instructs victim to install AnyDesk/TeamViewer to access bank vault.',
      target_risk_level: 'CRITICAL',
      caller_id_spoof: '+1 (800) 642-7676',
      turn_count: 7,
    },
    {
      id: 'irs_federal_arrest_threat',
      title: 'IRS / Law Enforcement: Immediate Arrest & Extortion',
      category: 'Government Impersonation & Extortion',
      description: 'Caller claims to be IRS Agent threatening arrest warrant unless unpaid taxes are settled immediately via gift cards or wire.',
      target_risk_level: 'CRITICAL',
      caller_id_spoof: '+1 (202) 555-0199',
      turn_count: 5,
    },
    {
      id: 'legitimate_bank_support',
      title: 'Legitimate Bank Inbound: Checking Account Fee Inquiry',
      category: 'Benign / Negative Control Baseline',
      description: 'Customer calling bank to ask about a monthly maintenance fee. Normal negative control; should remain SAFE/GREEN throughout.',
      target_risk_level: 'SAFE',
      caller_id_spoof: '+1 (800) 432-1000',
      turn_count: 6,
    },
    {
      id: 'bank_fraud_otp_theft',
      title: 'Chase / Wells Fargo: 2FA Passcode Interception Scam',
      category: 'Banking & Credential Theft',
      description: 'Scammer poses as Chase Fraud Prevention agent claiming unauthorized $2,450 Zelle transfer and requests 6-digit one-time passcode.',
      target_risk_level: 'CRITICAL',
      caller_id_spoof: '+1 (800) 935-9935',
      turn_count: 6,
    },
    {
      id: 'family_emergency_bail',
      title: 'Grandparent / Family Emergency: Fake Bail Wire Extortion',
      category: 'Social Engineering & Distress Extortion',
      description: 'Impersonates grandson who claims to have been arrested after a car accident and urgently needs cash bail wire transfer.',
      target_risk_level: 'CRITICAL',
      caller_id_spoof: '+1 (702) 555-0144',
      turn_count: 4,
    },
  ]);

  useEffect(() => {
    api.getScenarios().then(data => {
      if (Array.isArray(data) && data.length > 0) {
        setScenariosList(data);
      }
    }).catch(err => {
      console.warn('Could not fetch scenarios list from backend, using default list:', err);
    });
  }, []);

  // Manual Turn Analysis State
  const [customTextInput, setCustomTextInput] = useState<string>(
    'Hello, I am calling from your bank security department. We detected suspicious activity on your account. You must immediately share your OTP or your account will be blocked within 10 minutes.'
  );
  const [isAnalyzingTurn, setIsAnalyzingTurn] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Live Mode Duration Timer & Lifecycle State
  const [liveDurationSeconds, setLiveDurationSeconds] = useState<number>(0);
  const liveTimerRef = useRef<any>(null);
  const liveStartTimeRef = useRef<number | null>(null);

  const recognitionRef = useRef<any>(null);
  const voiceWarningSpokenRef = useRef<boolean>(false);
  const lastSentTextRef = useRef<string>('');
  const lastSentTimeRef = useRef<number>(0);
  const simulationTimeoutRef = useRef<any>(null);

  // Check Web Speech Recognition support on mount
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechRecognitionSupported(false);
    }
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    };
  }, []);

  // Freeze live timer if RED autonomous kill switch is engaged
  useEffect(() => {
    if (threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE') {
      if (liveTimerRef.current) {
        clearInterval(liveTimerRef.current);
        liveTimerRef.current = null;
      }
    }
  }, [threatState, callState]);

  // Format mm:ss
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Derive effective mic visual state
  const effectiveMicState: MicState =
    threatState === 'RED' || callState === 'CALL_TERMINATED'
      ? 'INTERVENING'
      : threatScore >= 50.0 || threatState === 'ORANGE' || threatState === 'YELLOW'
      ? micState === 'LISTENING' || micState === 'PROCESSING'
        ? micState
        : 'THREAT_DETECTED'
      : micState;

  // Synchronize Voice Output toggle with TTSService
  useEffect(() => {
    ttsService.setEnabled(isVoiceWarningEnabled);
  }, [isVoiceWarningEnabled]);

  const [isConfirmingReset, setIsConfirmingReset] = useState<boolean>(false);

  // Handle Simulation Start with Presentation Initialization Sequencing
  const handleStartSimulation = async () => {
    if (callState === 'CALL_ACTIVE' || isAnalyzingTurn) {
      console.warn('[SIMULATION] Start ignored: simulation already in progress.');
      return;
    }
    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
    }
    console.log(`[SIMULATION] START - Scenario: ${selectedScenario} (Speed: ${speedMultiplier}x)`);
    ttsService.unlockAudio();
    console.log('[SIMULATION] Audio unlocked');
    ttsService.setEnabled(isVoiceWarningEnabled);
    setSimulationStatusText('INITIALIZING SECURE CALL...');
    soundEffects.playAlertBeep(440, 'sine', 0.08);

    simulationTimeoutRef.current = setTimeout(async () => {
      setSimulationStatusText('CALL CONNECTED');
      try {
        await onStartScenario(selectedScenario, speedMultiplier);
      } catch (err) {
        console.error('[SIMULATION] Failed to start scenario:', err);
      } finally {
        setTimeout(() => setSimulationStatusText(null), 1500);
      }
    }, 600);
  };

  // Stop Running Scenario
  const handleStopScenario = async () => {
    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
      simulationTimeoutRef.current = null;
    }
    stopListening();
    ttsService.stop();
    await onStopScenario();
    soundEffects.playAlertBeep(440, 'sawtooth', 0.08);
  };

  // Full Presentation Reset with Confirmation
  const handleResetPresentationDemo = async () => {
    if (transcript.length > 0 || threatScore > 0) {
      if (!isConfirmingReset) {
        setIsConfirmingReset(true);
        setTimeout(() => setIsConfirmingReset(false), 4000);
        return;
      }
    }
    setIsConfirmingReset(false);

    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current);
      simulationTimeoutRef.current = null;
    }
    stopListening();
    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    liveStartTimeRef.current = null;
    setLiveDurationSeconds(0);
    ttsService.reset();
    setSimulationStatusText(null);
    setTurnCounter(1);
    setAnalysisError(null);
    setCustomTextInput(
      'Hello, I am calling from your bank security department. We detected suspicious activity on your account. You must immediately share your OTP or your account will be blocked within 10 minutes.'
    );
    lastSentTextRef.current = '';
    voiceWarningSpokenRef.current = false;
    await onResetKillSwitch();
    soundEffects.playAlertBeep(660, 'sine', 0.06);
  };

  // Handle Microphone Toggle
  const toggleMicrophone = () => {
    if (micState === 'LISTENING' || micState === 'PROCESSING') {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicError('Live voice recognition is unavailable in this browser.');
      return;
    }

    try {
      setMicError(null);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setMicState('LISTENING');
        soundEffects.playAlertBeep(520, 'sine', 0.08);

        // Record live session start timestamp & start elapsed timer
        if (liveStartTimeRef.current === null) {
          liveStartTimeRef.current = Date.now();
          setLiveDurationSeconds(0);
          console.log('[LIVE MODE] Live session started');
        }
        if (liveTimerRef.current) {
          clearInterval(liveTimerRef.current);
        }
        liveTimerRef.current = setInterval(() => {
          setLiveDurationSeconds((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = async (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcriptPiece = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            const cleanedFinal = transcriptPiece.trim();
            setLiveInterimText('');
            setCustomTextInput(cleanedFinal);

            const now = Date.now();
            if (
              cleanedFinal.length > 0 &&
              (cleanedFinal !== lastSentTextRef.current || now - lastSentTimeRef.current > 2000)
            ) {
              lastSentTextRef.current = cleanedFinal;
              lastSentTimeRef.current = now;
              setMicState('PROCESSING');

              try {
                // Ingest turn through backend STT & A2A multi-agent intelligence pipeline
                await api.ingestLiveTurn(
                  cleanedFinal,
                  'CALLER',
                  0.96,
                  activeSessionId || `voice-${now}`,
                  turnCounter
                );
                setTurnCounter((prev) => prev + 1);
              } catch (err) {
                console.error('Failed to ingest live turn:', err);
              } finally {
                setMicState('LISTENING');
              }
            }
          } else {
            interim += transcriptPiece;
          }
        }
        setLiveInterimText(interim);
        if (interim) {
          setCustomTextInput(interim);
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicError('Microphone access is blocked. Enable microphone permissions and try again.');
        } else if (event.error === 'no-speech') {
          // Expected background silence
        } else {
          setMicError(`Speech recognition notice: ${event.error}`);
        }
        if (event.error === 'not-allowed') {
          setMicState('READY');
        }
      };

      recognition.onend = () => {
        if (recognitionRef.current && micState === 'LISTENING') {
          try {
            recognition.start();
          } catch {
            setMicState('READY');
          }
        } else {
          setMicState('READY');
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setMicError(`Failed to initialize microphone: ${err.message}`);
      setMicState('READY');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error(e);
      }
      recognitionRef.current = null;
    }
    setMicState('READY');
    setLiveInterimText('');

    if (liveTimerRef.current) {
      clearInterval(liveTimerRef.current);
      liveTimerRef.current = null;
    }

    if (liveStartTimeRef.current !== null) {
      const formatted = formatDuration(liveDurationSeconds);
      console.log(
        `[LIVE MODE] Live session ended by user\n  Duration: ${formatted}\n  Final DEFCON: ${threatScore}/100`
      );
      liveStartTimeRef.current = null;
    }
  };

  // Direct Turn Ingestion & Analysis (from custom input or quick scenario button)
  const handleAnalyzeTextTurn = async (rawText?: string) => {
    const textToAnalyze = (rawText || customTextInput).trim();
    if (!textToAnalyze) return;

    ttsService.unlockAudio();
    ttsService.setEnabled(isVoiceWarningEnabled);
    setIsAnalyzingTurn(true);
    setAnalysisError(null);
    setMicState('PROCESSING');

    try {
      // Ingest turn to STT / rolling transcript & A2A multi-agent intelligence pipeline
      await api.ingestLiveTurn(
        textToAnalyze,
        'CALLER',
        0.98,
        activeSessionId || `session-${Date.now()}`,
        turnCounter
      );

      setTurnCounter((prev) => prev + 1);
      soundEffects.playAlertBeep(520, 'sine', 0.08);
    } catch (err: any) {
      console.error('Turn analysis failed:', err);
      setAnalysisError(err.message || 'Failed to communicate with FastAPI backend.');
    } finally {
      setIsAnalyzingTurn(false);
      setMicState('READY');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1920px] mx-auto select-none">
      {/* Top Banner & Mode Switcher */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 font-mono text-[10px] font-bold uppercase tracking-wider">
              DEMO SIMULATION & LIVE VOICE ENGINE
            </span>
            <span className="text-xs font-mono text-slate-500">•</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              Session: {activeSessionId || 'sess-presentation-demo'}
            </span>
          </div>
          <h2 className="text-lg font-bold font-mono text-slate-100">
            Real-Time Conversational Threat Ingestion & Presentation Suite
          </h2>
        </div>

        {/* Mode Selector Tabs + Quick Reset */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => {
                if (micState === 'LISTENING') stopListening();
                setCallMode('SIMULATION');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                callMode === 'SIMULATION'
                  ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-500/40 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>DEMO SIMULATION</span>
            </button>

            <button
              onClick={() => {
                if (micState === 'LISTENING') stopListening();
                setCallMode('VOICE');
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all ${
                callMode === 'VOICE'
                  ? 'bg-gradient-to-r from-cyan-950 to-slate-900 text-cyan-300 border border-cyan-500/40 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>LIVE VOICE & TEXT MODE</span>
            </button>
          </div>

          <button
            onClick={handleResetPresentationDemo}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border ${
              isConfirmingReset
                ? 'bg-amber-950/80 border-amber-500 text-amber-300 animate-pulse shadow-md shadow-amber-950'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-300'
            }`}
            title="Reset simulation and state for fresh presentation demo"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>{isConfirmingReset ? '⚠ CONFIRM RESET?' : '↻ RESET DEMO'}</span>
          </button>
        </div>
      </div>

      {/* 6-Stage Autonomous Incident Defense Pipeline Tracker */}
      <DemoPipelineTracker
        threatState={threatState}
        threatScore={threatScore}
        decisionDirective={decisionDirective}
        callState={callState}
        isStreaming={callMode === 'VOICE' ? (micState === 'LISTENING') : (callState === 'CALL_ACTIVE')}
        transcriptLength={transcript.length}
        indicators={indicators}
        evidenceCount={evidenceCount || 0}
        killswitchActive={threatState === 'RED' || callState === 'CALL_TERMINATED' || callState === 'KILL_SWITCH_ACTIVE'}
        onOpenAuditCertificate={onOpenAuditCertificate}
      />

      {/* FINAL CONTAINMENT EXECUTIVE SUMMARY (Appears upon RED threat / Kill Switch) */}
      {(threatState === 'RED' || callState === 'CALL_TERMINATED' || callState === 'KILL_SWITCH_ACTIVE') && (
        <ExecutiveThreatSummary
          threatScore={threatScore}
          threatState={threatState}
          decisionDirective={decisionDirective}
          confidence={confidence}
          indicators={indicators}
          reasons={decisionReasons}
          onResetDemo={handleResetPresentationDemo}
        />
      )}

      {/* Main Grid: Controls Left + Conversation Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Interactive Telemetry & Controls (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Audio Telemetry & Spectrum Status */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3 font-mono">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                {callMode === 'VOICE' ? 'VOICE TELEMETRY FEED' : 'INBOUND LINE TELEMETRY'}
              </span>
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded border flex items-center gap-1.5 uppercase tracking-wider ${
                  threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                    ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                    : callMode === 'VOICE' && micState !== 'LISTENING' && micState !== 'PROCESSING'
                    ? 'bg-slate-800 text-slate-400 border-slate-700'
                    : simulationStatusText
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                    : callState === 'CALL_TERMINATED'
                    ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                    : callState === 'CALL_ACTIVE' || callState === 'MONITORING'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {callMode === 'VOICE'
                  ? threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                    ? 'KILL SWITCH ACTIVE'
                    : micState === 'LISTENING'
                    ? threatState === 'ORANGE' || threatState === 'YELLOW' || threatScore >= 50
                      ? 'THREAT DETECTED'
                      : 'LISTENING'
                    : micState === 'PROCESSING'
                    ? 'PROCESSING'
                    : liveDurationSeconds > 0
                    ? 'CALL ENDED'
                    : 'READY'
                  : simulationStatusText || (callState === 'COMPLETED' ? '✓ SIMULATION COMPLETE' : callState)}
              </span>
            </div>

            {/* Compact 3-Column Telemetry Box */}
            <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80 text-[10px]">
              <div>
                <span className="text-slate-500 uppercase block">Duration</span>
                <strong className="text-slate-200 text-sm block">
                  {formatDuration(callMode === 'VOICE' ? liveDurationSeconds : callDurationSeconds)}
                </strong>
              </div>
              <div className="border-l border-slate-850 pl-2">
                <span className="text-slate-500 uppercase block">Caller ID</span>
                <strong className="text-cyan-400 truncate block text-xs">
                  {activeCallerId || scenariosList.find(s => s.id === selectedScenario)?.caller_id_spoof || '+1 (800) 555-0199'}
                </strong>
              </div>
              <div className="border-l border-slate-850 pl-2">
                <span className="text-slate-500 uppercase block">Audio Status</span>
                <strong
                  className={`truncate block text-xs ${
                    threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                      ? 'text-red-400'
                      : micState === 'LISTENING' || audioActivityLevel > 0 || callState === 'CALL_ACTIVE'
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                    ? 'SEVERED'
                    : micState === 'LISTENING' || audioActivityLevel > 0 || callState === 'CALL_ACTIVE'
                    ? 'ACTIVE'
                    : 'STANDBY'}
                </strong>
              </div>
            </div>

            {/* 24-Band Dynamic Audio Spectrum Waveform */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1">
                <span>AUDIO CARRIER WAVEFORM</span>
                <span>
                  {callMode === 'VOICE'
                    ? threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                      ? 'LINE SEVERED (CONTAINED)'
                      : micState === 'LISTENING'
                      ? 'SIGNAL ACTIVE (MICROPHONE)'
                      : micState === 'PROCESSING'
                      ? 'ANALYZING SIGNAL'
                      : 'LINE IDLE'
                    : callState === 'COMPLETED'
                    ? threatState === 'RED'
                      ? 'LINE SEVERED (CONTAINED)'
                      : 'BENIGN COMPLETE (IDLE)'
                    : micState === 'LISTENING' || audioActivityLevel > 0 || callState === 'CALL_ACTIVE'
                    ? 'SIGNAL ACTIVE'
                    : 'LINE IDLE'}
                </span>
              </div>
              <div className="h-10 bg-slate-950 rounded-lg border border-slate-800/90 flex items-center justify-between px-3 gap-1">
                {Array.from({ length: 24 }).map((_, i) => {
                  const isAudioActive =
                    callMode === 'VOICE'
                      ? (micState === 'LISTENING' || micState === 'PROCESSING') &&
                        threatState !== 'RED' &&
                        callState !== 'KILL_SWITCH_ACTIVE'
                      : (micState === 'LISTENING' || audioActivityLevel > 0 || callState === 'CALL_ACTIVE') &&
                        callState !== 'COMPLETED';
                  const baseHeight = isAudioActive
                    ? Math.max(15, Math.sin((i + Date.now() / 150) * 0.5) * 85 * (audioActivityLevel || 0.75))
                    : 8;
                  return (
                    <div
                      key={i}
                      className={`w-1.5 rounded-full transition-all duration-150 ${
                        threatState === 'RED'
                          ? 'bg-red-500'
                          : threatState === 'ORANGE'
                          ? 'bg-orange-400'
                          : threatState === 'YELLOW'
                          ? 'bg-amber-400'
                          : 'bg-cyan-400'
                      }`}
                      style={{
                        height: `${Math.min(100, Math.max(8, baseHeight))}%`,
                        opacity: isAudioActive ? 0.9 : 0.25,
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Mode 1: DEMO SIMULATION MODE */}
          {callMode === 'SIMULATION' && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  Presentation Scenario Setup
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                  BENCHMARK
                </span>
              </div>

              {/* Scenario Selector Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400">Simulation Scenario</label>
                <select
                  value={selectedScenario}
                  onChange={(e) => {
                    setSelectedScenario(e.target.value);
                    ttsService.reset();
                  }}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-cyan-500"
                >
                  {scenariosList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.target_risk_level === 'CRITICAL' ? '🚨' : s.target_risk_level === 'SAFE' ? '🛡️' : '⚠️'}{' '}
                      {s.title}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 font-sans mt-1">
                  {scenariosList.find((s) => s.id === selectedScenario)?.description ||
                    'Real-time scam conversation simulation.'}
                </p>
              </div>

              {/* Secondary Playback Speed Controls */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/80 border border-slate-850 text-[11px] font-mono">
                <span className="text-slate-400">Playback Speed:</span>
                <div className="flex items-center gap-1.5">
                  {[
                    { mult: 1.0, label: '1.0x' },
                    { mult: 1.5, label: '1.5x' },
                    { mult: 2.0, label: '2.0x' },
                  ].map((s) => (
                    <button
                      key={s.mult}
                      onClick={() => {
                        setSpeedMultiplier(s.mult);
                        setSpeedLabel(s.mult === 1.0 ? 'Normal' : s.mult === 1.5 ? 'Fast' : 'Presentation');
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                        speedMultiplier === s.mult
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simulation Action Controls: START (Primary) + STOP + RESET */}
              <div className="pt-1 space-y-2">
                {/* Obvious Primary START Action */}
                <button
                  onClick={handleStartSimulation}
                  disabled={callState === 'CALL_ACTIVE' || callState === 'MONITORING'}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-mono font-bold transition-all shadow-lg shadow-emerald-950/80 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.01]"
                >
                  {simulationStatusText ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>▶ START SIMULATION</span>
                </button>

                {/* Secondary Stop & Reset Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={handleStopScenario}
                    disabled={callState !== 'CALL_ACTIVE' && callState !== 'MONITORING'}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-all border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>■ STOP</span>
                  </button>

                  <button
                    onClick={handleResetPresentationDemo}
                    className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold transition-all border border-slate-700 hover:border-cyan-500 hover:text-cyan-300"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>↻ RESET DEMO</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Mode 2: LIVE VOICE & TEXT MODE */}
          {callMode === 'VOICE' && (
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  Live Voice & Dialogue Ingestion
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] border ${
                    effectiveMicState === 'INTERVENING'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                      : effectiveMicState === 'LISTENING'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                      : effectiveMicState === 'PROCESSING'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  STATE: {effectiveMicState}
                </span>
              </div>

              {/* Live Current Utterance / Direct Ingestion Form */}
              <div className="space-y-2 bg-slate-950/90 border border-slate-800 p-3 rounded-xl">
                <label className="text-[10px] font-mono text-slate-400 uppercase flex items-center justify-between">
                  <span>Live Current Utterance / Direct Ingestion:</span>
                  <span className="text-cyan-400">Turn #{turnCounter}</span>
                </label>
                <textarea
                  value={customTextInput}
                  onChange={(e) => setCustomTextInput(e.target.value)}
                  rows={2}
                  placeholder="Listening for live speech or type any dialogue sentence to analyze..."
                  className="w-full bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono rounded-lg p-2 focus:outline-none focus:border-cyan-500 resize-none"
                />

                {analysisError && (
                  <div className="text-[11px] font-mono text-red-400 bg-red-950/40 p-2 rounded border border-red-800">
                    {analysisError}
                  </div>
                )}

                <button
                  onClick={() => handleAnalyzeTextTurn()}
                  disabled={isAnalyzingTurn || !customTextInput.trim()}
                  className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-mono font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-950 transition-all disabled:opacity-50"
                >
                  {isAnalyzingTurn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>ANALYZE TURN VIA BACKEND API</span>
                </button>
              </div>

              {/* Microphone Section */}
              <div className="py-2 flex flex-col items-center justify-center border-t border-slate-800">
                <div className="relative">
                  {micState === 'LISTENING' && (
                    <div className="absolute -inset-3 rounded-full bg-cyan-500/20 animate-ping" />
                  )}
                  {threatState === 'RED' && (
                    <div className="absolute -inset-3 rounded-full bg-red-500/30 animate-pulse" />
                  )}

                  <button
                    onClick={toggleMicrophone}
                    disabled={!speechRecognitionSupported}
                    className={`w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 relative group shadow-xl ${
                      effectiveMicState === 'INTERVENING'
                        ? 'bg-gradient-to-br from-red-600 to-rose-800 text-white ring-4 ring-red-500/40 scale-105 shadow-red-950/80 animate-pulse'
                        : micState === 'LISTENING'
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white ring-4 ring-cyan-400/30 scale-105 shadow-cyan-950/80'
                        : micState === 'PROCESSING'
                        ? 'bg-amber-600 text-white ring-4 ring-amber-500/30'
                        : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-cyan-400 hover:text-white hover:border-cyan-500 hover:scale-105 hover:ring-4 hover:ring-cyan-500/20'
                    }`}
                  >
                    {effectiveMicState === 'INTERVENING' ? (
                      <ShieldAlert className="w-7 h-7" />
                    ) : micState === 'LISTENING' ? (
                      <Mic className="w-7 h-7 animate-pulse" />
                    ) : (
                      <Mic className="w-7 h-7" />
                    )}
                    <span className="text-[8px] font-mono font-bold uppercase mt-0.5 tracking-wider">
                      {effectiveMicState === 'INTERVENING'
                        ? 'TERMINATED'
                        : micState === 'LISTENING'
                        ? 'LISTENING'
                        : micState === 'PROCESSING'
                        ? 'PROCESSING'
                        : liveDurationSeconds > 0
                        ? 'CALL ENDED'
                        : 'READY'}
                    </span>
                  </button>
                </div>

                <div className="mt-1.5 text-[10px] font-mono text-slate-400 text-center">
                  {micState === 'LISTENING' ? (
                    <span className="text-cyan-400 font-bold flex items-center gap-1 justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      Listening to microphone in real time...
                    </span>
                  ) : (
                    <span>Or speak into your browser microphone</span>
                  )}
                </div>
              </div>

              {/* Quick Benchmark Sentence Buttons */}
              <div className="pt-2 border-t border-slate-800 text-left space-y-1">
                <div className="text-[10px] font-mono text-slate-500 uppercase flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  Quick Scenario Benchmark Injections:
                </div>
                <div className="space-y-1">
                  <button
                    onClick={() =>
                      handleAnalyzeTextTurn(
                        'Hello, I am calling from your bank security department. We detected suspicious activity on your account. You must immediately share your OTP or your account will be blocked within 10 minutes.'
                      )
                    }
                    className="w-full text-left p-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/60 border border-red-800/60 text-[10px] font-mono text-red-200 transition-all flex items-center justify-between group"
                  >
                    <span className="truncate">🔥 Full Bank OTP Extortion Scam (All 3 Vectors)</span>
                    <ChevronRight className="w-3 h-3 text-red-400 shrink-0" />
                  </button>

                  <button
                    onClick={() =>
                      handleAnalyzeTextTurn('Hello, I am calling from your bank security department. We detected suspicious activity on your account.')
                    }
                    className="w-full text-left p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-300 transition-all flex items-center justify-between group"
                  >
                    <span className="truncate">Turn 1: "Hello, I am calling from bank security..."</span>
                    <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 shrink-0" />
                  </button>

                  <button
                    onClick={() =>
                      handleAnalyzeTextTurn('To verify your identity, please tell me the OTP that was just sent to your phone.')
                    }
                    className="w-full text-left p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-300 transition-all flex items-center justify-between group"
                  >
                    <span className="truncate">Turn 2: "Please tell me the OTP sent to your phone..."</span>
                    <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 shrink-0" />
                  </button>

                  <button
                    onClick={() =>
                      handleAnalyzeTextTurn('You need to do it immediately, otherwise your account will be blocked within 10 minutes.')
                    }
                    className="w-full text-left p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[10px] font-mono text-slate-300 transition-all flex items-center justify-between group"
                  >
                    <span className="truncate">Turn 3: "Do it immediately or account blocked in 10 mins..."</span>
                    <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 shrink-0" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Isolated Emergency Manual Kill Switch Panel */}
          <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-900/60 shadow-lg flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-red-950 border border-red-800 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold text-red-300 uppercase">
                  EMERGENCY OPERATOR OVERRIDE
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  Manual kill-switch line severance
                </div>
              </div>
            </div>
            <button
              onClick={() => onTriggerKillSwitch('MANUAL_OPERATOR_ENGAGEMENT')}
              className="px-3 py-1.5 rounded-lg bg-red-950 hover:bg-red-900 border border-red-600 text-red-200 text-xs font-mono font-bold shadow-md shadow-red-950 transition-all hover:scale-102 shrink-0"
            >
              TRIGGER KILL SWITCH
            </button>
          </div>
        </div>

        {/* Right Column: Live Spoken Dialogue Stream (7 cols) */}
        <div className="lg:col-span-7">
          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col h-[700px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold font-mono text-slate-200 uppercase tracking-wider">
                  Live Spoken Dialogue Transcript Stream
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                  {transcript.length} turns captured
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  EN-US
                </span>
              </div>
            </div>

            {/* Conversation Feed */}
            <div className="flex-1 overflow-y-auto py-3 pr-1">
              <TranscriptStream
                transcript={transcript}
                highlightedPhrases={Array.from(
                  new Set(
                    indicators
                      .map((i) => i.matched_signal)
                      .filter((s): s is string => Boolean(s && s.trim().length > 1))
                  )
                )}
                selectedScenarioTitle={scenariosList.find(s => s.id === selectedScenario)?.title}
                onStartSimulation={handleStartSimulation}
                indicators={indicators}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
