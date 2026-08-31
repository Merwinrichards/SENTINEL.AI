import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Download, Printer, Lock, CheckCircle2, AlertTriangle, FileText, Copy, Check } from 'lucide-react';
import { api } from '../services/api';
import { AuditReportPackage, EvidenceBlock } from '../types/sentinel';

interface ForensicReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForensicReportModal: React.FC<ForensicReportModalProps> = ({ isOpen, onClose }) => {
  const [report, setReport] = useState<AuditReportPackage | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api.exportAuditPackage()
        .then(data => {
          setReport(data);
          setLoading(false);
        })
        .catch(err => {
          console.error('Error fetching audit report:', err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDownloadJSON = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SENTINEL_FORENSIC_INCIDENT_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyJSON = () => {
    if (!report) return;
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="cyber-card w-full max-w-4xl max-h-[90vh] flex flex-col bg-slate-950 border border-cyan-500/40 shadow-2xl shadow-cyan-500/10 rounded-xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-cyan-950 border border-cyan-500/50 rounded text-cyan-400">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-mono font-bold text-sm text-white tracking-wider">
                CRYPTOGRAPHIC FORENSIC INCIDENT AUDIT CERTIFICATE
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Tamper-Evident SHA-256 Chained Evidentiary Package for Law Enforcement & Banking SOC
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-xs text-slate-200">
          {loading ? (
            <div className="py-16 text-center text-slate-400 animate-pulse">
              Compiling cryptographic certificate and verifying SHA-256 chain links...
            </div>
          ) : report ? (
            <>
              {/* Seal Certificate Box */}
              <div className="p-4 rounded-lg bg-slate-900/90 border border-emerald-500/40 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-emerald-400 font-bold mb-1">
                    <ShieldCheck className="w-5 h-5" />
                    <span className="text-sm">CERTIFIED FORENSIC RECORD // SEAL ACTIVE</span>
                  </div>
                  <p className="text-slate-400 text-[11px]">
                    Root Seal Digest: <span className="text-cyan-300 font-mono">{report.metadata.chain_seal_root_hash}</span>
                  </p>
                  <p className="text-slate-500 text-[10px]">
                    Export Timestamp: {report.metadata.export_timestamp} | Blocks: {report.metadata.total_blocks}
                  </p>
                </div>

                <div className="px-3 py-1.5 bg-emerald-950 border border-emerald-500/50 rounded font-bold text-emerald-300 text-xs">
                  {report.metadata.integrity_status}
                </div>
              </div>

              {/* Forensic Timeline */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-300 uppercase tracking-wider text-xs flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Sequential Evidentiary Timeline (SHA-256 Hash Chain)</span>
                </h4>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {report.chain.map((b: EvidenceBlock) => (
                    <div key={b.index} className="p-3 bg-slate-900/60 border border-slate-800 rounded">
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-cyan-400 font-bold">
                          BLOCK #{b.index} // {b.event_type}
                        </span>
                        <span className="text-slate-500">{new Date(b.timestamp * 1000).toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-slate-300 bg-slate-950 p-2 rounded border border-slate-900 my-1">
                        {b.payload.dialogue_snippet && (
                          <div className="mb-1">
                            <span className="text-slate-500">EXCERPT:</span> "{b.payload.dialogue_snippet}"
                          </div>
                        )}
                        {b.payload.composite_risk_score !== undefined && (
                          <div>
                            <span className="text-slate-500">RISK SCORE:</span> {b.payload.composite_risk_score}/100 ({b.payload.threat_state})
                          </div>
                        )}
                        {b.payload.critical_triggers && b.payload.critical_triggers.length > 0 && (
                          <div className="text-red-400 font-bold mt-1">
                            TRIGGERS: {b.payload.critical_triggers.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                        <span>PREV: {b.prev_hash.slice(0, 16)}...</span>
                        <span>HASH: {b.block_hash.slice(0, 16)}...</span>
                        <span className="text-emerald-400 font-bold">{b.signature}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-red-400">
              Failed to load audit package.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/80">
          <button
            onClick={handleCopyJSON}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono font-bold transition"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY JSON'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono font-bold transition"
            >
              <Printer className="w-4 h-4" />
              <span>PRINT REPORT</span>
            </button>
            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 rounded text-xs font-mono font-bold transition shadow-lg shadow-cyan-600/30"
            >
              <Download className="w-4 h-4 stroke-[2.5]" />
              <span>DOWNLOAD SIGNED JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

