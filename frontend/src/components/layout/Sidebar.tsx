import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  PhoneCall,
  BrainCircuit,
  ShieldCheck,
  BarChart3,
  Activity,
  Radio,
  Server
} from 'lucide-react';
import { NavigationTab, SystemHealthStatus, CallState } from '../../types/sentinel';
import { api } from '../../services/api';
import sentinelLogo from '../../assets/sentinel-core.png';

interface SidebarProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  threatScore: number;
  threatState: 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED';
  activeIncidentId: string;
  callState?: CallState;
  isStreaming?: boolean;
  evidenceCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  threatScore,
  threatState,
  activeIncidentId,
  callState,
  isStreaming,
  evidenceCount: propEvidenceCount,
}) => {
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus>('OPERATIONAL');
  const [connectedDashboards, setConnectedDashboards] = useState<number>(1);
  const [backendEvidenceCount, setBackendEvidenceCount] = useState<number>(0);

  const evidenceCount = propEvidenceCount !== undefined ? propEvidenceCount : backendEvidenceCount;

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const data = await api.getHealth();
        if (isMounted) {
          if (data && (data.status === 'OPERATIONAL' || data.status === 'HEALTHY')) {
            setHealthStatus('OPERATIONAL');
          } else if (data && data.status === 'DEGRADED') {
            setHealthStatus('DEGRADED');
          } else {
            setHealthStatus('OPERATIONAL');
          }
          setConnectedDashboards(data.connected_dashboards || 1);
          setBackendEvidenceCount(data.evidence_blocks || 0);
        }
      } catch (err) {
        console.warn('Backend Health Check unreachable:', err);
        if (isMounted) {
          setHealthStatus('OFFLINE');
        }
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const navItems = [
    {
      id: 'DASHBOARD' as NavigationTab,
      label: 'Dashboard',
      sublabel: 'Command Center',
      icon: LayoutDashboard,
    },
    {
      id: 'LIVE_CALL' as NavigationTab,
      label: 'Live Call',
      sublabel: 'Voice & Simulation',
      icon: PhoneCall,
      badge: threatState === 'RED' ? 'ALERT' : undefined,
    },
    {
      id: 'THREAT_INTEL' as NavigationTab,
      label: 'Threat Intelligence',
      sublabel: '7-Taxonomy Matrix',
      icon: BrainCircuit,
    },
    {
      id: 'EVIDENCE' as NavigationTab,
      label: 'Evidence Ledger',
      sublabel: 'Cryptographic Chain',
      icon: ShieldCheck,
      count: evidenceCount > 0 ? evidenceCount : undefined,
    },
    {
      id: 'ANALYTICS' as NavigationTab,
      label: 'SOC Analytics',
      sublabel: 'Telemetry & Trends',
      icon: BarChart3,
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/30 border border-cyan-500/40 flex items-center justify-center shadow-lg shadow-cyan-950/40 p-1">
                <img
                  src={sentinelLogo}
                  alt="Sentinel Core Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold tracking-wider text-slate-100 font-mono">
                  SENTINEL<span className="text-cyan-400">.AI</span>
                </h1>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
                Real-Time Defense
              </p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1.5 overflow-y-auto flex-1">
          <div className="px-3 py-1 text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
            Platform Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-950/70 to-slate-900/90 border-l-2 border-l-cyan-400 border-t border-r border-b border-cyan-500/30 text-slate-100 shadow-md shadow-cyan-950/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-200 ${
                      isActive
                        ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-300'
                        : 'bg-slate-900/80 border border-slate-800 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div
                      className={`text-xs font-mono font-bold tracking-wide truncate ${
                        isActive ? 'text-cyan-200 font-extrabold' : 'text-slate-200'
                      }`}
                    >
                      {item.label}
                    </div>
                    <div
                      className={`text-[10px] font-mono truncate ${
                        isActive ? 'text-cyan-400/80 font-medium' : 'text-slate-500'
                      }`}
                    >
                      {item.sublabel}
                    </div>
                  </div>
                </div>

                {item.badge && (
                  <span className="px-2 py-0.5 text-[9px] font-mono font-bold rounded bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse shrink-0 ml-1">
                    {item.badge}
                  </span>
                )}
                {item.count !== undefined && !item.badge && (
                  <span className="px-2 py-0.5 text-[9px] font-mono font-bold text-cyan-300 rounded bg-cyan-950/80 border border-cyan-800/80 shrink-0 ml-1">
                    #{item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Anchored Clean Session Status Footer */}
      <div className="p-3.5 border-t border-slate-800/80 space-y-2.5 bg-slate-950 shrink-0">
        {/* Active Incident Pill */}
        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
            <div className="min-w-0">
              <div className="text-[9px] text-slate-500 font-mono uppercase tracking-wider">
                {threatState === 'RED' || callState === 'KILL_SWITCH_ACTIVE'
                  ? 'Critical Incident'
                  : callState === 'CALL_ACTIVE' || isStreaming
                  ? 'Active Incident'
                  : 'Session Monitor'}
              </div>
              <div className="text-xs font-mono font-bold text-slate-200 truncate">
                {activeIncidentId || 'INC-DEMO-2026-01'}
              </div>
            </div>
          </div>
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ml-1 ${
              threatState === 'RED'
                ? 'bg-red-500 shadow-md shadow-red-500/80 animate-ping'
                : threatState === 'ORANGE'
                ? 'bg-orange-500'
                : threatState === 'YELLOW'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
          />
        </div>

        {/* Backend Health Telemetry */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-[10px] font-mono">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Server className="w-3 h-3 text-slate-400 shrink-0" />
              Backend Engine
            </span>
            <span
              className={`flex items-center gap-1.5 font-bold ${
                healthStatus === 'OPERATIONAL'
                  ? 'text-emerald-400'
                  : healthStatus === 'DEGRADED'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  healthStatus === 'OPERATIONAL'
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse'
                    : healthStatus === 'DEGRADED'
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
              />
              {healthStatus === 'OPERATIONAL' ? 'ONLINE' : healthStatus}
            </span>
          </div>
          <div className="flex items-center justify-between text-[9px] text-slate-500">
            <span>FastAPI Core 1.0.0</span>
            <span>{connectedDashboards} Client{connectedDashboards > 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

