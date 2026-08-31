import React, { useState } from 'react';
import { Cpu, Terminal, Key, ChevronDown, ChevronRight, CheckCheck } from 'lucide-react';
import { A2AMessage } from '../types/sentinel';
import { formatHash } from '../utils/crypto';

interface AgentChatterFeedProps {
  a2aHistory: A2AMessage[];
}

export const AgentChatterFeed: React.FC<AgentChatterFeedProps> = ({ a2aHistory }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const getAgentColor = (sender: string) => {
    switch (sender) {
      case 'InspectorAgent':
        return 'text-amber-400 border-amber-500/40 bg-amber-950/40';
      case 'DecisionEngine':
        return 'text-cyan-400 border-cyan-500/40 bg-cyan-950/40';
      case 'EvidenceAgent':
        return 'text-emerald-400 border-emerald-500/40 bg-emerald-950/40';
      case 'InterventionAgent':
        return 'text-red-400 border-red-500/40 bg-red-950/40';
      default:
        return 'text-slate-400 border-slate-700 bg-slate-900';
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-red-900/80 text-red-300 border border-red-500/60 animate-pulse';
      case 'HIGH':
        return 'bg-orange-900/80 text-orange-300 border border-orange-500/60';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="cyber-card p-4 flex flex-col h-[400px] flex-1">
      {/* Title */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">
            A2A Autonomous Agent Telemetry Bus
          </span>
        </div>
        <span className="text-[11px] font-mono text-purple-300">
          EVENT BUS // PROTOCOL v2.4
        </span>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-2 font-mono text-xs">
        {a2aHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
            <Terminal className="w-6 h-6 text-slate-600 animate-pulse" />
            <span>A2A Message Bus Idle</span>
          </div>
        ) : (
          a2aHistory.map((msg) => {
            const key = msg.message_id || msg.id || String(msg.timestamp);
            const isExpanded = expandedId === key;
            return (
              <div
                key={key}
                className="bg-slate-950/80 border border-slate-800/90 rounded p-2.5 hover:border-slate-700 transition"
              >
                <div
                  onClick={() => toggleExpand(key)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Sender */}
                    <span className={`px-2 py-0.5 rounded border text-[11px] font-bold ${getAgentColor(msg.sender)}`}>
                      {msg.sender}
                    </span>
                    <span className="text-slate-500">➔</span>
                    <span className="text-slate-400 text-[11px] font-semibold">{msg.recipient}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-300 text-[11px] font-bold">{msg.message_type}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getPriorityBadge(msg.priority)}`}>
                      {msg.priority}
                    </span>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Sub row: signature & timestamp */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1.5 pt-1 border-t border-slate-900">
                  <div className="flex items-center gap-1">
                    <Key className="w-3 h-3 text-cyan-400" />
                    <span className="text-slate-400">{msg.signature || 'SIGNED_OK'}</span>
                  </div>
                  <span>{new Date(msg.timestamp * 1000).toLocaleTimeString()}</span>
                </div>

                {/* Expandable JSON Payload */}
                {isExpanded && (
                  <div className="mt-2 p-2 bg-slate-900/90 rounded border border-slate-800 text-[11px] overflow-x-auto">
                    <pre className="text-cyan-300 font-mono">
                      {JSON.stringify(msg.payload, null, 2)}
                    </pre>
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

