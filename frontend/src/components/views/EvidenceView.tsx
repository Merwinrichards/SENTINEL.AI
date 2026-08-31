import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Lock,
  Link2,
  Copy,
  Check,
  FileCheck2,
  Flame,
  Clock,
  AlertTriangle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileCode,
  CheckCircle2,
  Zap,
  Activity,
  Layers,
  Terminal,
  Hash,
  User,
  Shield
} from 'lucide-react';
import { EvidenceBlock, TimelineEvent, ThreatLevel } from '../../types/sentinel';

interface EvidenceViewProps {
  evidenceChain: EvidenceBlock[];
  isChainValid: boolean;
  onSimulateTamper: () => Promise<void>;
  onRepairChain: () => Promise<void>;
  onOpenAuditExport: () => void;
  activeIncidentId?: string;
  threatState?: ThreatLevel;
  threatScore?: number;
}

export const EvidenceView: React.FC<EvidenceViewProps> = ({
  evidenceChain,
  isChainValid,
  onSimulateTamper,
  onRepairChain,
  onOpenAuditExport,
  activeIncidentId = 'INC-2026-INIT',
  threatState = 'GREEN',
  threatScore = 0,
}) => {
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [expandedRawPayloads, setExpandedRawPayloads] = useState<Record<number, boolean>>({});
  const [expandedFullHashes, setExpandedFullHashes] = useState<Record<string, boolean>>({});
  const [tamperState, setTamperState] = useState<'SEALED' | 'COMPROMISED' | 'RESTORED'>('SEALED');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const blockRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Synchronize tamper state with chain validity
  useEffect(() => {
    if (!isChainValid) {
      setTamperState('COMPROMISED');
    } else if (tamperState === 'COMPROMISED') {
      setTamperState('RESTORED');
    }
  }, [isChainValid]);

  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const toggleRawPayload = (blockIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRawPayloads((prev) => ({
      ...prev,
      [blockIndex]: !prev[blockIndex],
    }));
  };

  const toggleHashExpand = (hashKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFullHashes((prev) => ({
      ...prev,
      [hashKey]: !prev[hashKey],
    }));
  };

  const handleSelectBlock = (index: number) => {
    setSelectedBlockIndex(index);
    const targetElement = blockRefs.current.get(index);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleTamperAction = async () => {
    setIsProcessingAction(true);
    try {
      await onSimulateTamper();
      setTamperState('COMPROMISED');
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRepairAction = async () => {
    setIsProcessingAction(true);
    try {
      await onRepairChain();
      setTamperState('RESTORED');
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Generate event timeline derived from actual evidence chain blocks
  const timelineEvents: TimelineEvent[] = evidenceChain.map((block) => {
    let severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'INFO' = 'INFO';
    if (
      block.event_type.includes('INTERVENTION') ||
      block.event_type.includes('KILLSWITCH') ||
      block.event_type.includes('RED')
    ) {
      severity = 'CRITICAL';
    } else if (
      block.event_type.includes('ORANGE') ||
      block.event_type.includes('HIGH') ||
      block.event_type.includes('THREAT')
    ) {
      severity = 'HIGH';
    } else if (
      block.event_type.includes('YELLOW') ||
      block.event_type.includes('EVALUATION') ||
      block.event_type.includes('INSPECTION')
    ) {
      severity = 'MEDIUM';
    }

    const d = new Date(block.timestamp * 1000);
    const timeStr = d.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    let desc = `${block.event_type} registered by ${block.agent_source}`;
    if (block.payload?.trigger_reason) {
      desc = `${block.payload.trigger_reason}`;
    } else if (block.payload?.reason) {
      desc = `${block.payload.reason}`;
    } else if (block.payload?.decision) {
      desc = `Decision: ${block.payload.decision} (Risk: ${block.payload.composite_risk_score || 0}/100)`;
    } else if (block.payload?.summary) {
      desc = `${block.payload.summary}`;
    } else if (block.event_type === 'GENESIS') {
      desc = 'Genesis block initialized and anchored to Merkle root.';
    }

    return {
      id: `evt-${block.index}-${block.timestamp}`,
      timestamp: block.iso_time || d.toISOString(),
      time: timeStr,
      eventType: block.event_type,
      severity,
      description: desc,
      source: block.agent_source,
      details: block.payload,
    };
  });

  const formatShortHash = (hash: string) => {
    if (!hash || hash === '0') return '0 (GENESIS_ROOT)';
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 8)}...${hash.slice(-8)}`;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1920px] mx-auto select-none">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 font-mono text-[10px] font-bold uppercase">
              CRYPTOGRAPHIC EVIDENCE LEDGER
            </span>
            <span className="text-xs font-mono text-slate-500">•</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              Session: {activeIncidentId}
            </span>
            <span className="text-xs font-mono text-slate-500">•</span>
            <span
              className={`text-xs font-mono font-bold ${
                threatState === 'RED'
                  ? 'text-red-400'
                  : threatState === 'ORANGE'
                  ? 'text-orange-400'
                  : threatState === 'YELLOW'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              DEFCON {threatState} ({threatScore}/100)
            </span>
          </div>
          <h2 className="text-lg font-bold font-mono text-slate-100">
            Forensic Blockchain Ledger & Chronological Incident Timeline
          </h2>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleTamperAction}
            disabled={isProcessingAction}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/70 border border-red-600/60 text-red-300 text-xs font-mono font-bold shadow-md shadow-red-950/40 transition-all hover:scale-102 disabled:opacity-50"
            title="Simulate unauthorized payload mutation to test tamper detection"
          >
            <Flame className="w-3.5 h-3.5" />
            <span>SIMULATE TAMPER</span>
          </button>

          <button
            onClick={handleRepairAction}
            disabled={isProcessingAction}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-mono font-bold transition-all hover:scale-102 disabled:opacity-50"
            title="Re-verify signatures and recalculate Merkle hashes"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>REPAIR CHAIN</span>
          </button>

          <button
            onClick={onOpenAuditExport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white text-xs font-mono font-bold shadow-lg shadow-cyan-950/60 transition-all hover:scale-102"
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>EXPORT AUDIT CERTIFICATE</span>
          </button>
        </div>
      </div>

      {/* Dynamic Tamper Alert Banner */}
      {tamperState === 'COMPROMISED' && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-500/80 shadow-2xl flex items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-900/80 border border-red-500 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-red-300" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-red-300 uppercase tracking-wider flex items-center gap-2">
                <span>SECURITY ALERT: EVIDENCE CHAIN COMPROMISED</span>
                <span className="px-1.5 py-0.5 rounded bg-red-900 text-red-200 text-[10px]">
                  INTEGRITY VIOLATION
                </span>
              </div>
              <p className="text-xs text-red-200/90 font-sans mt-0.5">
                Unauthorized block modification detected. SHA-256 parent hash linkage failed validation.
              </p>
            </div>
          </div>
          <button
            onClick={handleRepairAction}
            className="px-3.5 py-1.5 rounded-lg bg-red-900 hover:bg-red-800 border border-red-400 text-white text-xs font-mono font-bold shrink-0 transition-all"
          >
            RESTORE INTEGRITY
          </button>
        </div>
      )}

      {tamperState === 'RESTORED' && isChainValid && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/60 shadow-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-900/60 border border-emerald-500/50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-emerald-300 uppercase tracking-wider">
                BLOCKCHAIN INTEGRITY RESTORED & RE-SEALED
              </div>
              <p className="text-xs text-emerald-200/80 font-sans mt-0.5">
                All cryptographic signatures, parent hashes, and Merkle root verified against original authority.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded bg-emerald-900/60 text-emerald-300 border border-emerald-600/60 text-xs font-mono font-bold">
            VALIDATED
          </span>
        </div>
      )}

      {/* Main 2-Column Visually Balanced Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Column: Chronological Event Timeline (5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              Chronological Incident Timeline
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-800/60">
              {timelineEvents.length} EVENTS RECORDED
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3">
            {timelineEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                No events recorded yet. Start a call or simulation to generate forensic blocks.
              </div>
            ) : (
              timelineEvents.map((evt, idx) => {
                const isSelected = selectedBlockIndex === idx;

                return (
                  <div
                    key={evt.id}
                    onClick={() => handleSelectBlock(idx)}
                    className={`relative p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-500/50'
                        : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950/90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        {/* Severity Dot Indicator */}
                        <span
                          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            evt.severity === 'CRITICAL'
                              ? 'bg-red-500 animate-ping shadow-md shadow-red-500'
                              : evt.severity === 'HIGH'
                              ? 'bg-orange-500'
                              : evt.severity === 'MEDIUM'
                              ? 'bg-amber-400'
                              : 'bg-cyan-400'
                          }`}
                        />
                        <span className="text-xs font-mono font-bold text-slate-200 truncate">
                          {evt.eventType}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-mono text-cyan-400 font-semibold">
                          {evt.time}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                            evt.severity === 'CRITICAL'
                              ? 'text-red-400 bg-red-950/60 border border-red-700'
                              : evt.severity === 'HIGH'
                              ? 'text-orange-400 bg-orange-950/60 border border-orange-700'
                              : evt.severity === 'MEDIUM'
                              ? 'text-amber-400 bg-amber-950/60 border border-amber-700'
                              : 'text-cyan-400 bg-cyan-950/60 border border-cyan-700'
                          }`}
                        >
                          {evt.severity}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 font-sans line-clamp-2 mb-2 pl-4">
                      {evt.description}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pl-4 border-t border-slate-900/90 pt-1.5">
                      <span className="truncate">Source: <strong className="text-slate-400">{evt.source}</strong></span>
                      <span className="text-cyan-400 font-bold">Inspect Block #{idx.toString().padStart(3, '0')} →</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: SHA-256 Blockchain Cards & Structured Inspector (7 cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              Cryptographic Blockchain Blocks ({evidenceChain.length})
            </h3>

            {/* Prominent but Balanced Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border font-mono text-xs font-bold shadow-md ${
                isChainValid
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/60 shadow-emerald-950/40'
                  : 'bg-red-950/80 text-red-400 border-red-500/80 shadow-red-950/60 animate-pulse'
              }`}
            >
              {isChainValid ? (
                <>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>CHAIN INTEGRITY SEALED</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-red-400" />
                  <span>CHAIN COMPROMISED</span>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {evidenceChain.map((block) => {
              const isSelected = selectedBlockIndex === block.index;
              const isRawExpanded = !!expandedRawPayloads[block.index];
              const prevHashKey = `prev_${block.index}`;
              const currHashKey = `curr_${block.index}`;
              const isPrevExpanded = !!expandedFullHashes[prevHashKey];
              const isCurrExpanded = !!expandedFullHashes[currHashKey];

              const payload = block.payload || {};
              const turnIndex = payload.turn_index;
              const speaker = payload.speaker;
              const riskScore = payload.composite_risk_score !== undefined ? payload.composite_risk_score : payload.score;
              const threatLevel = payload.threat_state;
              const decision = payload.decision;
              const reasons = payload.reasons || [];
              const triggeredRules = payload.triggered_rules || [];
              const criticalTriggers = payload.critical_triggers || payload.triggers || [];
              const highlightedPhrases = payload.highlighted_phrases || [];
              const triggerReason = payload.trigger_reason;
              const syntheticWarning = payload.synthetic_warning_text;

              return (
                <div
                  key={block.index}
                  ref={(el) => {
                    if (el) blockRefs.current.set(block.index, el);
                    else blockRefs.current.delete(block.index);
                  }}
                  onClick={() => setSelectedBlockIndex(block.index)}
                  className={`p-4 rounded-xl bg-slate-900/90 border transition-all space-y-3 font-mono shadow-xl cursor-pointer ${
                    isSelected
                      ? 'border-cyan-500 shadow-cyan-950/60 ring-1 ring-cyan-500/60 bg-slate-900'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Block Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-bold">
                        BLOCK #{block.index.toString().padStart(3, '0')}
                      </span>
                      <span className="text-xs font-bold text-slate-200">
                        {block.event_type}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {block.iso_time ? new Date(block.iso_time).toLocaleTimeString() : new Date(block.timestamp * 1000).toLocaleTimeString()}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-400">
                        Source: {block.agent_source}
                      </span>
                    </div>
                  </div>

                  {/* SHA-256 Hashes: Prev & Block Hash */}
                  <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/80 space-y-2 text-[11px]">
                    {/* Previous Hash */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span className="text-slate-500 flex items-center gap-1.5 shrink-0">
                        <Link2 className="w-3.5 h-3.5 text-slate-500" />
                        PREV HASH:
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          onClick={(e) => toggleHashExpand(prevHashKey, e)}
                          className="text-slate-400 hover:text-slate-200 cursor-pointer font-mono text-[10px] truncate"
                          title="Click to toggle full hash"
                        >
                          {isPrevExpanded ? block.prev_hash : formatShortHash(block.prev_hash)}
                        </span>
                        {block.prev_hash && block.prev_hash !== '0' && (
                          <button
                            onClick={(e) => copyToClipboard(block.prev_hash, e)}
                            className="text-slate-500 hover:text-cyan-300 p-1 shrink-0"
                            title="Copy Previous Hash"
                          >
                            {copiedHash === block.prev_hash ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Block Hash */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-t border-slate-900 pt-2">
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5 shrink-0">
                        <Lock className="w-3.5 h-3.5 text-cyan-400" />
                        BLOCK HASH:
                      </span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          onClick={(e) => toggleHashExpand(currHashKey, e)}
                          className="text-cyan-300 hover:text-cyan-100 font-bold cursor-pointer font-mono text-[10px] truncate"
                          title="Click to toggle full hash"
                        >
                          {isCurrExpanded ? block.block_hash : formatShortHash(block.block_hash)}
                        </span>
                        <button
                          onClick={(e) => copyToClipboard(block.block_hash, e)}
                          className="text-slate-500 hover:text-cyan-300 p-1 shrink-0"
                          title="Copy Block Hash"
                        >
                          {copiedHash === block.block_hash ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Structured Forensic Evidence Inspector */}
                  <div className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800/80 space-y-2.5">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800/60 pb-1.5">
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                        Forensic Evidence Inspector
                      </span>
                      {threatLevel && (
                        <span
                          className={`px-2 py-0.2 rounded font-bold ${
                            threatLevel === 'RED'
                              ? 'text-red-400 bg-red-950/50 border border-red-800'
                              : threatLevel === 'ORANGE'
                              ? 'text-orange-400 bg-orange-950/50 border border-orange-800'
                              : threatLevel === 'YELLOW'
                              ? 'text-amber-400 bg-amber-950/50 border border-amber-800'
                              : 'text-emerald-400 bg-emerald-950/50 border border-emerald-800'
                          }`}
                        >
                          DEFCON {threatLevel} ({riskScore || 0}/100)
                        </span>
                      )}
                    </div>

                    {/* Key Attributes Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                      {turnIndex !== undefined && (
                        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                          <span className="text-slate-500 block">TURN</span>
                          <strong className="text-slate-200">#{turnIndex}</strong>
                        </div>
                      )}
                      {speaker && (
                        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                          <span className="text-slate-500 block">SPEAKER</span>
                          <strong className="text-slate-200">{speaker}</strong>
                        </div>
                      )}
                      {decision && (
                        <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                          <span className="text-slate-500 block">DECISION</span>
                          <strong className="text-cyan-300">{decision}</strong>
                        </div>
                      )}
                      {triggerReason && (
                        <div className="p-2 rounded bg-slate-900/80 border border-slate-800 col-span-2">
                          <span className="text-slate-500 block">TRIGGER REASON</span>
                          <strong className="text-red-300 truncate block">{triggerReason}</strong>
                        </div>
                      )}
                    </div>

                    {/* Reasons List */}
                    {reasons.length > 0 && (
                      <div className="text-[11px] space-y-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Assessment Rationale:</span>
                        <ul className="list-disc list-inside text-slate-300 font-sans space-y-0.5 pl-1">
                          {reasons.map((r: string, i: number) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Triggered Rules & Triggers Pills */}
                    {(triggeredRules.length > 0 || criticalTriggers.length > 0) && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Triggered Defense Rules:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {triggeredRules.map((rule: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-red-950/60 text-red-300 border border-red-800 text-[10px] font-bold"
                            >
                              ⚡ {rule}
                            </span>
                          ))}
                          {criticalTriggers.map((trig: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-orange-950/60 text-orange-300 border border-orange-800 text-[10px]"
                            >
                              ⚠️ {trig}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Highlighted Phrases */}
                    {highlightedPhrases.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[10px] text-slate-500 uppercase font-bold">Detected Signal Keywords:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {highlightedPhrases.map((phrase: string, i: number) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800 text-[10px]"
                            >
                              "{phrase}"
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Synthetic Advisory Text if present */}
                    {syntheticWarning && (
                      <div className="p-2 rounded bg-red-950/40 border border-red-800/60 text-[11px] text-red-200 font-sans">
                        <span className="text-[9px] font-mono text-red-400 uppercase font-bold block mb-0.5">
                          Injected Synthetic Audio Advisory:
                        </span>
                        "{syntheticWarning}"
                      </div>
                    )}
                  </div>

                  {/* Collapsible Raw JSON Payload Section */}
                  <div className="border border-slate-800/70 rounded-lg overflow-hidden">
                    <button
                      onClick={(e) => toggleRawPayload(block.index, e)}
                      className="w-full px-3 py-2 bg-slate-950 hover:bg-slate-850 flex items-center justify-between text-[10px] text-slate-400 hover:text-slate-200 transition-all font-mono"
                    >
                      <span className="flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                        <span>RAW CRYPTOGRAPHIC PAYLOAD</span>
                        <span className="text-slate-600">({JSON.stringify(payload).length} bytes)</span>
                      </span>
                      {isRawExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </button>

                    {isRawExpanded && (
                      <div className="p-3 bg-slate-950 border-t border-slate-800">
                        <pre className="text-[10px] text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-60 p-2 rounded bg-slate-900/80 border border-slate-800 font-mono">
                          {JSON.stringify(payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};


