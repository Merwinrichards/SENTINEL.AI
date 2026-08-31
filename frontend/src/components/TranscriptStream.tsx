import React, { useEffect, useRef } from 'react';
import {
  MessageSquare,
  User,
  Bot,
  AlertCircle,
  Sparkles,
  Mic,
  Play,
  Shield,
  Volume2,
  Zap,
  Activity
} from 'lucide-react';
import { TranscriptSegment, ScamIndicator } from '../types/sentinel';

interface TranscriptStreamProps {
  transcript: TranscriptSegment[];
  highlightedPhrases: string[];
  showHeader?: boolean;
  isStreaming?: boolean;
  selectedScenarioTitle?: string;
  onStartSimulation?: () => void;
  indicators?: ScamIndicator[];
}

export const TranscriptStream: React.FC<TranscriptStreamProps> = ({
  transcript,
  highlightedPhrases,
  showHeader = false,
  isStreaming = false,
  selectedScenarioTitle = 'Bank OTP Scam (Presentation Demo Benchmark)',
  onStartSimulation,
  indicators = [],
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Helper to highlight suspicious keywords subtly without looking like a code editor
  const renderHighlightedText = (text: string) => {
    if (!text || !highlightedPhrases || highlightedPhrases.length === 0) {
      return text;
    }

    const validPhrases = highlightedPhrases
      .map((p) => p.trim())
      .filter((p) => p.length >= 2)
      .sort((a, b) => b.length - a.length);

    if (validPhrases.length === 0) {
      return text;
    }

    const intervals: Array<{ start: number; end: number }> = [];

    for (const phrase of validPhrases) {
      const escaped = phrase
        .split(/\s+/)
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('[\\s\\p{P}]+');

      try {
        const regex = new RegExp(`\\b${escaped}\\b|${escaped}`, 'gui');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text)) !== null) {
          const matchText = match[0];
          if (matchText.length > 0) {
            intervals.push({
              start: match.index,
              end: match.index + matchText.length,
            });
          }
          if (regex.lastIndex === match.index) {
            regex.lastIndex++;
          }
        }
      } catch (_) {
        let searchIndex = 0;
        const lowerText = text.toLowerCase();
        const lowerPhrase = phrase.toLowerCase();
        while (searchIndex < lowerText.length) {
          const found = lowerText.indexOf(lowerPhrase, searchIndex);
          if (found === -1) break;
          intervals.push({ start: found, end: found + lowerPhrase.length });
          searchIndex = found + lowerPhrase.length;
        }
      }
    }

    if (intervals.length === 0) {
      return text;
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

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    merged.forEach((interval, idx) => {
      if (interval.start > lastIndex) {
        elements.push(text.slice(lastIndex, interval.start));
      }
      elements.push(
        <span
          key={`hl-${idx}-${interval.start}`}
          className="bg-red-500/20 text-red-200 border-b border-red-500/80 font-semibold px-1 py-0.5 rounded-sm transition-all"
        >
          {text.slice(interval.start, interval.end)}
        </span>
      );
      lastIndex = interval.end;
    });

    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return elements;
  };

  // Match indicators to a specific turn
  const getTurnIndicators = (turnIndex: number, text: string) => {
    return indicators.filter((ind) => {
      if (!ind.matched_signal) return false;
      return text.toLowerCase().includes(ind.matched_signal.toLowerCase());
    });
  };

  const renderFeed = () => (
    <div className="flex-1 overflow-y-auto pr-2 space-y-3.5 font-sans">
      {transcript.length === 0 ? (
        <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400 shadow-xl relative group">
            <div className="absolute -inset-1 rounded-2xl bg-cyan-500/10 animate-pulse" />
            <Mic className="w-8 h-8 text-cyan-400 relative z-10" />
          </div>

          <div className="space-y-1 max-w-sm">
            <h4 className="text-sm font-mono font-bold text-slate-200">
              Ready for incoming speech
            </h4>
            <p className="text-xs text-slate-400 font-sans">
              Waiting for live voice audio or benchmark scenario stream to commence analysis.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] font-mono text-slate-300 max-w-md w-full flex items-center justify-between gap-3">
            <div className="text-left truncate">
              <span className="text-[9px] text-slate-500 uppercase block">Selected Benchmark</span>
              <strong className="text-cyan-300 truncate block">{selectedScenarioTitle}</strong>
            </div>
            {onStartSimulation && (
              <button
                onClick={onStartSimulation}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-950 transition-all hover:scale-105"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Start Simulation</span>
              </button>
            )}
          </div>
        </div>
      ) : (
        transcript.map((seg) => {
          const isCaller = seg.speaker === 'CALLER';
          const isIntervention = (seg.speaker as string) === 'SYSTEM' || seg.text.includes('SECURITY ADVISORY') || seg.text.includes('KILLSWITCH');
          const turnIndicators = getTurnIndicators(seg.turn_index, seg.text);
          const timeStr = new Date(seg.timestamp * 1000).toLocaleTimeString([], {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          if (isIntervention) {
            return (
              <div
                key={seg.segment_id}
                className="p-3.5 rounded-xl bg-red-950/70 border border-red-500/80 text-xs shadow-xl space-y-2 animate-pulse"
              >
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-red-900 text-red-200 border border-red-700 font-bold flex items-center gap-1.5 uppercase">
                    <AlertCircle className="w-3.5 h-3.5" />
                    SENTINEL // AUTONOMOUS INTERVENTION BROADCAST
                  </span>
                  <span className="text-red-300 font-semibold">{timeStr}</span>
                </div>
                <div className="text-red-100 font-sans text-xs font-semibold leading-relaxed pl-1">
                  "{seg.text}"
                </div>
              </div>
            );
          }

          return (
            <div
              key={seg.segment_id}
              className={`p-3.5 rounded-xl border text-xs transition-all shadow-md ${
                isCaller
                  ? 'bg-slate-950/90 border-slate-800 ml-0 mr-6 hover:border-slate-700'
                  : 'bg-cyan-950/20 border-cyan-800/40 ml-6 mr-0 hover:border-cyan-700/50'
              }`}
            >
              {/* Speaker Header & Timestamp */}
              <div className="flex items-center justify-between font-mono text-[11px] mb-2 border-b border-slate-900 pb-1.5">
                <div className="flex items-center gap-2">
                  {isCaller ? (
                    <span className="px-2 py-0.5 rounded bg-red-950/70 border border-red-600/50 text-red-300 font-bold flex items-center gap-1.5 text-[10px]">
                      <User className="w-3 h-3 text-red-400" />
                      CALLER (INBOUND SPEECH)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-600/50 text-cyan-300 font-bold flex items-center gap-1.5 text-[10px]">
                      <Bot className="w-3 h-3 text-cyan-400" />
                      CALLEE (USER / TARGET)
                    </span>
                  )}
                  <span className="text-slate-500 font-bold text-[10px]">Turn #{seg.turn_index}</span>
                </div>
                <span className="text-slate-500 font-mono text-[10px]">
                  {timeStr}
                </span>
              </div>

              {/* Text Content */}
              <div className="text-slate-200 leading-relaxed font-sans text-xs pl-0.5">
                {renderHighlightedText(seg.text)}
                {!seg.is_final && (
                  <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 animate-pulse align-middle" />
                )}
              </div>

              {/* Detected Indicators Tag Chips under turn */}
              {turnIndicators.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-slate-900/90">
                  {turnIndicators.map((ind, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-red-950/50 text-red-300 border border-red-800 text-[9px] font-mono font-bold flex items-center gap-1"
                    >
                      <Zap className="w-2.5 h-2.5 text-red-400" />
                      {ind.category}: "{ind.matched_signal}"
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );

  if (!showHeader) {
    return <div className="flex flex-col h-full">{renderFeed()}</div>;
  }

  return (
    <div className="p-4 flex flex-col h-[420px] flex-1 bg-slate-900/90 rounded-xl border border-slate-800 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Real-Time Rolling Transcript Stream
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          TOTAL TURNS: {transcript.length}
        </span>
      </div>
      {renderFeed()}
    </div>
  );
};


