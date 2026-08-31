import React from 'react';
import { Search, Brain, Shield, ShieldAlert, Cpu, ArrowRight } from 'lucide-react';
import { AgentSwarmState } from '../../hooks/useSentinelWebSocket';

interface AgentSwarmViewProps {
  swarm: AgentSwarmState;
  activeMessageLink: { from: string; to: string; type: string } | null;
}

export const AgentSwarmView: React.FC<AgentSwarmViewProps> = ({ swarm, activeMessageLink }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'INTERVENING':
        return 'bg-red-950/80 border-red-500 text-red-300 animate-pulse';
      case 'DECIDING':
      case 'PROCESSING':
        return 'bg-cyan-950/80 border-cyan-400 text-cyan-300 animate-pulse';
      case 'SEALING':
        return 'bg-emerald-950/80 border-emerald-400 text-emerald-300';
      default:
        return 'bg-slate-900 border-slate-700 text-slate-400';
    }
  };

  const isLinkActive = (from: string, to: string) => {
    if (!activeMessageLink) return false;
    return activeMessageLink.from.toLowerCase().includes(from.toLowerCase()) ||
           activeMessageLink.to.toLowerCase().includes(to.toLowerCase());
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-3 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-200 uppercase">
            Autonomous Multi-Agent Swarm
          </span>
        </div>
        <span className="font-mono text-[10px] px-2 py-0.5 bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 rounded font-bold">
          4 Nodes
        </span>
      </div>

      {/* Swarm Cards Grid */}
      <div className="grid grid-cols-1 gap-2">
        {/* Agent 1: InspectorAgent */}
        <div className={`bg-slate-950/80 border rounded-lg p-2.5 flex flex-col gap-1.5 transition-all duration-300 ${
          swarm.inspector.status === 'PROCESSING' ? 'border-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-cyan-950/60 rounded border border-cyan-500/30 text-cyan-400 shrink-0">
                <Search className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-mono text-xs font-bold text-slate-100 leading-tight">InspectorAgent</h4>
                <p className="font-mono text-[9px] text-slate-400 leading-tight">NLP & Signal Extraction</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold shrink-0 ${getStatusBadge(swarm.inspector.status)}`}>
              {swarm.inspector.status}
            </span>
          </div>
          <p className="font-mono text-[10px] text-slate-400 truncate pl-0.5" title={swarm.inspector.lastAction}>
            › {swarm.inspector.lastAction}
          </p>
        </div>

        {/* Agent 2: DecisionEngine */}
        <div className={`bg-slate-950/80 border rounded-lg p-2.5 flex flex-col gap-1.5 transition-all duration-300 ${
          swarm.decisionEngine.status === 'DECIDING' || swarm.decisionEngine.status === 'INTERVENING'
            ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]'
            : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-purple-950/60 rounded border border-purple-500/30 text-purple-400 shrink-0">
                <Brain className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-mono text-xs font-bold text-slate-100 leading-tight">DecisionEngine</h4>
                <p className="font-mono text-[9px] text-slate-400 leading-tight">Risk Assessment & Policy</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold shrink-0 ${getStatusBadge(swarm.decisionEngine.status)}`}>
              {swarm.decisionEngine.status}
            </span>
          </div>
          <p className="font-mono text-[10px] text-slate-400 truncate pl-0.5" title={swarm.decisionEngine.lastAction}>
            › {swarm.decisionEngine.lastAction}
          </p>
        </div>

        {/* Agent 3: EvidenceAgent */}
        <div className={`bg-slate-950/80 border rounded-lg p-2.5 flex flex-col gap-1.5 transition-all duration-300 ${
          swarm.evidenceAgent.status === 'SEALING' ? 'border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-emerald-950/60 rounded border border-emerald-500/30 text-emerald-400 shrink-0">
                <Shield className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-mono text-xs font-bold text-slate-100 leading-tight">EvidenceAgent</h4>
                <p className="font-mono text-[9px] text-slate-400 leading-tight">SHA-256 Ledger & Custody</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold shrink-0 ${getStatusBadge(swarm.evidenceAgent.status)}`}>
              {swarm.evidenceAgent.status}
            </span>
          </div>
          <p className="font-mono text-[10px] text-slate-400 truncate pl-0.5" title={swarm.evidenceAgent.lastAction}>
            › {swarm.evidenceAgent.lastAction}
          </p>
        </div>

        {/* Agent 4: InterventionAgent */}
        <div className={`bg-slate-950/80 border rounded-lg p-2.5 flex flex-col gap-1.5 transition-all duration-300 ${
          swarm.interventionAgent.status === 'INTERVENING'
            ? 'border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
            : 'border-slate-800'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-1.5 bg-red-950/60 rounded border border-red-500/30 text-red-400 shrink-0">
                <ShieldAlert className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-mono text-xs font-bold text-slate-100 leading-tight">InterventionAgent</h4>
                <p className="font-mono text-[9px] text-slate-400 leading-tight">Audio Severance & Countermeasures</p>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded border text-[9px] font-mono font-bold shrink-0 ${getStatusBadge(swarm.interventionAgent.status)}`}>
              {swarm.interventionAgent.status}
            </span>
          </div>
          <p className="font-mono text-[10px] text-slate-400 truncate pl-0.5" title={swarm.interventionAgent.lastAction}>
            › {swarm.interventionAgent.lastAction}
          </p>
        </div>
      </div>

      {/* Visual Inter-Agent Topology Indicator */}
      <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-2 flex items-center justify-between text-[9px] font-mono text-slate-400 min-w-0">
        <span className={`transition-colors ${isLinkActive('Inspector', 'Decision') ? 'text-cyan-400 font-bold' : ''}`}>Inspector</span>
        <ArrowRight className={`w-3 h-3 shrink-0 ${isLinkActive('Inspector', 'Decision') ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
        <span className={`transition-colors ${isLinkActive('Decision', 'Evidence') || isLinkActive('Decision', 'Intervention') ? 'text-purple-400 font-bold' : ''}`}>Decision</span>
        <ArrowRight className={`w-3 h-3 shrink-0 ${isLinkActive('Decision', 'Evidence') ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`} />
        <span className={`transition-colors ${isLinkActive('Decision', 'Evidence') ? 'text-emerald-400 font-bold' : ''}`}>Evidence</span>
        <ArrowRight className={`w-3 h-3 shrink-0 ${isLinkActive('Decision', 'Intervention') ? 'text-red-400 animate-pulse' : 'text-slate-600'}`} />
        <span className={`transition-colors ${isLinkActive('Intervention', '') ? 'text-red-400 font-bold' : ''}`}>Intervention</span>
      </div>
    </div>
  );
};

