import React from 'react';
import { AlertTriangle, Key, Laptop, DollarSign, UserX, Flame, Link as LinkIcon, ShieldCheck } from 'lucide-react';
import { ScamIndicator } from '../../types/sentinel';

interface DetectionIndicatorsProps {
  indicators: ScamIndicator[];
}

export const DetectionIndicators: React.FC<DetectionIndicatorsProps> = ({ indicators }) => {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'URGENCY_PRESSURE':
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'CREDENTIAL_REQUEST':
        return <Key className="w-3.5 h-3.5 text-red-400" />;
      case 'REMOTE_ACCESS_REQUEST':
        return <Laptop className="w-3.5 h-3.5 text-red-400" />;
      case 'PAYMENT_REQUEST':
        return <DollarSign className="w-3.5 h-3.5 text-orange-400" />;
      case 'IMPERSONATION':
        return <UserX className="w-3.5 h-3.5 text-amber-400" />;
      case 'THREAT_INTIMIDATION':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-400" />;
      case 'SUSPICIOUS_LINK_ACTION':
        return <LinkIcon className="w-3.5 h-3.5 text-orange-400" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-cyan-400" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-950/80 border-red-500/60 text-red-400';
      case 'HIGH':
        return 'bg-orange-950/80 border-orange-500/60 text-orange-400';
      case 'MEDIUM':
        return 'bg-amber-950/80 border-amber-500/60 text-amber-400';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-300">DETECTED SCAM INDICATORS</span>
        </div>
        <span className="font-mono text-[10px] px-2 py-0.5 bg-slate-950 border border-slate-800 rounded text-slate-400">
          {indicators.length} Active
        </span>
      </div>

      {indicators.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-slate-600 font-mono text-xs gap-2">
          <ShieldCheck className="w-8 h-8 text-emerald-500/40" />
          <span>No social engineering indicators detected</span>
        </div>
      ) : (
        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
          {indicators.map((ind, idx) => (
            <div
              key={`${ind.category}-${idx}`}
              className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1.5 transition-all hover:border-slate-700 animate-in fade-in slide-in-from-top-1 duration-300"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-200">
                  {getCategoryIcon(ind.category)}
                  <span>{ind.category.replace(/_/g, ' ')}</span>
                </div>
                <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-extrabold uppercase ${getSeverityBadge(ind.severity)}`}>
                  {ind.severity}
                </span>
              </div>

              <div className="text-[11px] font-mono text-slate-400">
                <span className="text-cyan-400 font-semibold">Matched:</span> "{ind.matched_signal}"
              </div>

              {ind.explanation && (
                <div className="text-[10px] font-mono text-slate-500 italic">
                  {ind.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

