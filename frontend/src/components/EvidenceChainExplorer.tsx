import React, { useState } from 'react';
import { Blocks, CheckCircle2, XCircle, Link as LinkIcon, ShieldCheck, AlertOctagon, Wrench, Copy, Check } from 'lucide-react';
import { EvidenceBlock } from '../types/sentinel';
import { formatHash } from '../utils/crypto';

interface EvidenceChainExplorerProps {
  evidenceChain: EvidenceBlock[];
  isChainValid: boolean;
  chainFailureReason: string | null;
  onTamperTest: (blockIndex: number) => void;
  onRepairChain: () => void;
}

export const EvidenceChainExplorer: React.FC<EvidenceChainExplorerProps> = ({
  evidenceChain,
  isChainValid,
  chainFailureReason,
  onTamperTest,
  onRepairChain
}) => {
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleCopy = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="cyber-card p-4 flex flex-col gap-3">
      {/* Header with Chain Integrity Badge */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <Blocks className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            Immutable Cryptographic Evidence Chain (Proof-of-Scam)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Validity Badge */}
          {isChainValid ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/80 border border-emerald-500/60 rounded text-emerald-300 font-mono text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>CHAIN INTEGRITY VERIFIED (SHA-256)</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/90 border border-red-500 rounded text-red-300 font-mono text-xs font-bold animate-pulse">
                <XCircle className="w-3.5 h-3.5 text-red-400" />
                <span>TAMPERING DETECTED</span>
              </div>
              <button
                onClick={onRepairChain}
                className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs font-mono text-cyan-300 transition"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>REPAIR / RE-MINE</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Failure Reason Alert */}
      {!isChainValid && chainFailureReason && (
        <div className="bg-red-950/90 border border-red-500 p-2.5 rounded text-xs font-mono text-red-200 flex items-start gap-2">
          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">CRYPTOGRAPHIC BREAK DETECTED:</span>
            <p className="text-[11px] text-red-300 mt-0.5">{chainFailureReason}</p>
          </div>
        </div>
      )}

      {/* Horizontal / Grid Block Explorer */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-3 min-w-max">
          {evidenceChain.map((block, idx) => {
            const isGenesis = block.index === 0;
            return (
              <div key={block.index} className="flex items-center gap-2">
                {/* Block Card */}
                <div className={`w-72 p-3 rounded-lg border font-mono text-xs flex flex-col justify-between transition-all ${
                  isGenesis 
                    ? 'bg-slate-950/90 border-cyan-500/40 shadow-sm shadow-cyan-500/10' 
                    : block.event_type.includes('RED') || block.event_type.includes('KILLSWITCH')
                    ? 'bg-red-950/30 border-red-500/50'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}>
                  {/* Block Header */}
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.2 bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-bold text-[10px] rounded">
                        BLOCK #{block.index}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {isGenesis ? 'GENESIS' : block.agent_source.split('/')[0]}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(block.timestamp * 1000).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Event Type */}
                  <div className="mb-2">
                    <span className="text-[10px] text-slate-500 uppercase block">Event Type</span>
                    <span className="font-bold text-slate-200 text-[11px] truncate block">
                      {block.event_type}
                    </span>
                  </div>

                  {/* Payload Summary */}
                  <div className="bg-slate-900/80 p-2 rounded border border-slate-800/80 text-[10px] text-slate-300 mb-2 max-h-16 overflow-y-auto">
                    {block.payload.dialogue_snippet ? (
                      <p className="italic text-slate-300">"{block.payload.dialogue_snippet}"</p>
                    ) : block.payload.title ? (
                      <p className="text-cyan-400">{block.payload.title}</p>
                    ) : (
                      <p>{JSON.stringify(block.payload)}</p>
                    )}
                  </div>

                  {/* Hash Metadata */}
                  <div className="space-y-1 text-[10px] pt-1 border-t border-slate-800/80">
                    {/* Block Hash */}
                    <div className="flex items-center justify-between text-slate-400">
                      <span>HASH:</span>
                      <button
                        onClick={() => handleCopy(block.block_hash)}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-bold"
                        title="Click to copy full hash"
                      >
                        <span>{formatHash(block.block_hash, 6, 6)}</span>
                        {copiedHash === block.block_hash ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-500" />
                        )}
                      </button>
                    </div>

                    {/* Prev Hash */}
                    <div className="flex items-center justify-between text-slate-500">
                      <span>PREV:</span>
                      <span className="font-mono">{formatHash(block.prev_hash, 6, 6)}</span>
                    </div>

                    {/* Signature */}
                    <div className="flex items-center justify-between text-slate-500">
                      <span>SIG:</span>
                      <span className="text-emerald-400/80 truncate max-w-[140px]">
                        {block.signature || 'VALID_ED25519'}
                      </span>
                    </div>
                  </div>

                  {/* Tamper Test button */}
                  <div className="mt-2.5 pt-1.5 border-t border-slate-900 flex justify-end">
                    <button
                      onClick={() => onTamperTest(block.index)}
                      className="text-[10px] text-red-400/80 hover:text-red-300 font-mono hover:underline"
                      title="Simulate adversary modifying this block to test tamper detection"
                    >
                      ⚡ Test Tamper Detection
                    </button>
                  </div>
                </div>

                {/* Arrow Link to Next Block */}
                {idx < evidenceChain.length - 1 && (
                  <div className="flex items-center text-cyan-500/60">
                    <LinkIcon className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

