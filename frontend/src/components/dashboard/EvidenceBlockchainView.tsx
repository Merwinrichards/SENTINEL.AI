import React, { useState } from 'react';
import { Lock, ShieldCheck, ShieldAlert, CheckCircle, Copy, Check, Wrench, AlertTriangle, ArrowDown } from 'lucide-react';
import { EvidenceBlock } from '../../types/sentinel';

interface EvidenceBlockchainViewProps {
  chain: EvidenceBlock[];
  isChainValid: boolean;
  failureReason: string | null;
  onVerify: () => Promise<any>;
  onTamper: () => Promise<any>;
  onRepair: () => Promise<any>;
  onOpenReportModal: () => void;
}

export const EvidenceBlockchainView: React.FC<EvidenceBlockchainViewProps> = ({
  chain,
  isChainValid,
  failureReason,
  onVerify,
  onTamper,
  onRepair,
  onOpenReportModal,
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const handleManualVerify = async () => {
    setIsVerifying(true);
    try {
      await onVerify();
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 shadow-xl">
      {/* Header with Verification Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-cyan-400" />
          <div>
            <h3 className="font-mono text-xs font-bold tracking-wider text-slate-200">
              CRYPTOGRAPHIC EVIDENCE BLOCKCHAIN
            </h3>
            <p className="font-mono text-[10px] text-slate-500">
              Immutable SHA-256 chained ledger ({chain.length} blocks)
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isChainValid ? (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/60 rounded text-emerald-400 font-mono text-xs font-bold">
              <ShieldCheck className="w-4 h-4" />
              <span>INTEGRITY VERIFIED</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 bg-red-950/80 border border-red-500/60 rounded text-red-400 font-mono text-xs font-bold animate-pulse">
              <ShieldAlert className="w-4 h-4" />
              <span>CHAIN TAMPERED</span>
            </div>
          )}

          <button
            onClick={onOpenReportModal}
            className="px-2.5 py-1 bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-900/60 rounded text-[11px] font-mono font-bold"
          >
            EXPORT AUDIT
          </button>
        </div>
      </div>

      {/* Failure Banner if Tampered */}
      {!isChainValid && failureReason && (
        <div className="bg-red-950/40 border border-red-500/50 p-2.5 rounded-lg text-xs font-mono text-red-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span>Security Alert: {failureReason}</span>
        </div>
      )}

      {/* Block List with Visual Chain Connections */}
      <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
        {chain.map((block, idx) => {
          const isExpanded = expandedIndex === block.index;
          const shortPrev = block.prev_hash === '0' ? 'GENESIS_ROOT' : `${block.prev_hash.slice(0, 8)}...${block.prev_hash.slice(-6)}`;
          const shortCurr = `${block.block_hash.slice(0, 10)}...${block.block_hash.slice(-8)}`;

          return (
            <React.Fragment key={block.index}>
              <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col gap-2 transition-all hover:border-slate-700">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedIndex(isExpanded ? null : block.index)}
                >
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-extrabold text-[10px]">
                      BLOCK #{block.index.toString().padStart(3, '0')}
                    </span>
                    <span className="font-bold text-slate-200">{block.event_type}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    {new Date(block.iso_time).toLocaleTimeString()}
                  </span>
                </div>

                {/* Hashes & Linkage */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono bg-slate-900/60 p-2 rounded border border-slate-800/60">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Prev Hash:</span>
                    <span className="text-slate-500 font-mono">{shortPrev}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Block Hash:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-cyan-300 font-bold">{shortCurr}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(block.block_hash);
                        }}
                        className="text-slate-500 hover:text-cyan-300"
                        title="Copy full hash"
                      >
                        {copiedHash === block.block_hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Payload */}
                {isExpanded && (
                  <div className="mt-1 p-2 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-slate-300">
                    <div className="text-slate-500 mb-1 font-bold">Source Agent: {block.agent_source}</div>
                    <pre className="max-h-28 overflow-x-auto overflow-y-auto">
                      {JSON.stringify(block.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {idx < chain.length - 1 && (
                <div className="flex items-center justify-center -my-1">
                  <ArrowDown className="w-3.5 h-3.5 text-cyan-600/70 animate-pulse" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Interactive Verification / Tamper Demonstration Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
        <button
          onClick={handleManualVerify}
          disabled={isVerifying}
          className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-mono font-bold flex items-center gap-1.5"
        >
          <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
          VERIFY INTEGRITY
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onTamper}
            className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 text-xs font-mono font-bold flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            SIMULATE TAMPER
          </button>

          <button
            onClick={onRepair}
            className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 text-xs font-mono font-bold flex items-center gap-1.5"
          >
            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
            REPAIR CHAIN
          </button>
        </div>
      </div>
    </div>
  );
};

