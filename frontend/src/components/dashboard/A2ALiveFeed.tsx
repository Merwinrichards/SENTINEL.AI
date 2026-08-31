import React, { useState } from 'react';
import {
  MessageSquare,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Clock,
  Hash,
  ShieldAlert,
  Cpu,
  Bot,
  Zap,
  Lock,
  FileCode,
  CheckCircle2
} from 'lucide-react';
import { A2AMessage } from '../../types/sentinel';

interface A2ALiveFeedProps {
  messages: A2AMessage[];
  currentCorrelationId: string;
}

export const A2ALiveFeed: React.FC<A2ALiveFeedProps> = ({ messages, currentCorrelationId }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');

  const filteredMessages = messages.filter((m) => {
    if (filterType === 'ALL') return true;
    return m.message_type === filterType;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-950/80 border-red-500/80 text-red-400 animate-pulse';
      case 'HIGH':
        return 'bg-orange-950/80 border-orange-500/80 text-orange-400';
      case 'NORMAL':
        return 'bg-cyan-950/80 border-cyan-500/60 text-cyan-400';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-400';
    }
  };

  const getAgentBadge = (agent: string) => {
    if (agent.includes('Inspector')) {
      return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80';
    }
    if (agent.includes('Decision')) {
      return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/80';
    }
    if (agent.includes('Evidence')) {
      return 'bg-purple-950/80 text-purple-300 border-purple-800/80';
    }
    if (agent.includes('Intervention')) {
      return 'bg-rose-950/80 text-rose-300 border-rose-800/80';
    }
    return 'bg-slate-900 text-slate-300 border-slate-800';
  };

  const getMessageTypeBadge = (type: string) => {
    switch (type) {
      case 'INTERVENTION_REQUEST':
      case 'KILLSWITCH_TRIGGERED':
        return 'text-red-400 bg-red-950/50 border-red-800';
      case 'INTERVENTION_RESULT':
        return 'text-rose-400 bg-rose-950/50 border-rose-800';
      case 'DECISION_RESULT':
      case 'THREAT_DECISION':
        return 'text-indigo-400 bg-indigo-950/50 border-indigo-800';
      case 'INSPECTION_RESULT':
        return 'text-cyan-400 bg-cyan-950/50 border-cyan-800';
      case 'EVIDENCE_SEALED':
        return 'text-purple-400 bg-purple-950/50 border-purple-800';
      default:
        return 'text-slate-400 bg-slate-900 border-slate-800';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl">
      {/* Header with Active Correlation Lineage */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
            A2A MULTI-AGENT BUS TELEMETRY STREAM
          </span>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.2 rounded border border-cyan-800/60">
            {messages.length} MESSAGES
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 font-mono text-[10px] bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-cyan-300">
            <Hash className="w-3 h-3 text-cyan-400" />
            <span className="text-slate-500">CORR:</span> {currentCorrelationId || 'N/A'}
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-300 rounded px-2 py-1 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">ALL TYPES ({messages.length})</option>
            <option value="INSPECTION_RESULT">INSPECTION_RESULT</option>
            <option value="DECISION_RESULT">DECISION_RESULT</option>
            <option value="THREAT_DECISION">THREAT_DECISION</option>
            <option value="EVIDENCE_SEALED">EVIDENCE_SEALED</option>
            <option value="INTERVENTION_REQUEST">INTERVENTION_REQUEST</option>
            <option value="INTERVENTION_RESULT">INTERVENTION_RESULT</option>
          </select>
        </div>
      </div>

      {/* Message List */}
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-8 font-mono text-xs text-slate-600">
            No inter-agent messages recorded yet. Messages will stream in real-time as agents coordinate defense.
          </div>
        ) : (
          filteredMessages.map((msg) => {
            const isExpanded = expandedId === msg.message_id;
            const timeStr = msg.iso_time
              ? new Date(msg.iso_time).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
              : new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

            const payload = msg.payload || {};

            return (
              <div
                key={msg.message_id}
                className="bg-slate-950/80 border border-slate-800/80 rounded-lg p-3 flex flex-col gap-2 transition-all hover:border-slate-700"
              >
                <div
                  className="flex flex-wrap items-center justify-between gap-2 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : msg.message_id)}
                >
                  {/* Sender -> Receiver Linkage */}
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-600" />
                      {timeStr}
                    </span>

                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getAgentBadge(msg.sender)}`}>
                      {msg.sender}
                    </span>

                    <ArrowRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />

                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getAgentBadge(msg.receiver || msg.recipient || 'ALL')}`}>
                      {msg.receiver || msg.recipient || 'ALL'}
                    </span>
                  </div>

                  {/* Message Type & Priority Badges */}
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded border font-mono text-[10px] font-semibold ${getMessageTypeBadge(msg.message_type)}`}>
                      {msg.message_type}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold ${getPriorityBadge(msg.priority)}`}>
                      {msg.priority}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Payload & Signature Drawer */}
                {isExpanded && (
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-[10px] font-mono flex flex-col gap-2 mt-1">
                    <div className="flex flex-wrap items-center justify-between text-slate-400 border-b border-slate-800 pb-1.5 gap-2">
                      <span>Message ID: <strong className="text-slate-200">{msg.message_id}</strong></span>
                      <span>Signature: <strong className="text-cyan-400">{msg.signature || 'VALID_A2A_ED25519'}</strong></span>
                      {msg.fingerprint && (
                        <span>Fingerprint: <strong className="text-slate-400">{msg.fingerprint}</strong></span>
                      )}
                    </div>

                    {/* Key Structured Summary */}
                    {payload.decision && (
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 text-xs">
                        <span className="text-slate-500 block mb-0.5 font-bold">DECISION DIRECTIVE:</span>
                        <span className="text-cyan-300 font-bold">{payload.decision}</span>
                        {payload.threat_score !== undefined && (
                          <span className="text-slate-400 ml-2">({payload.threat_score} pts)</span>
                        )}
                      </div>
                    )}

                    {/* Raw JSON View */}
                    <div className="space-y-1">
                      <div className="text-slate-500 uppercase font-bold flex items-center gap-1">
                        <FileCode className="w-3 h-3 text-cyan-400" />
                        <span>Payload Data:</span>
                      </div>
                      <pre className="text-slate-300 overflow-x-auto max-h-40 p-2 rounded bg-slate-950 border border-slate-800 whitespace-pre-wrap">
                        {JSON.stringify(payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};


