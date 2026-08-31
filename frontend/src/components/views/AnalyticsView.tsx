import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Activity,
  Zap,
  Radio,
  Layers,
  ShieldAlert,
  MessageSquare,
  Clock,
  Flame,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Shield
} from 'lucide-react';
import { ThreatLevel, RiskPoint, ScamIndicator, A2AMessage, TranscriptSegment, EvidenceBlock } from '../../types/sentinel';
import { A2ALiveFeed } from '../dashboard/A2ALiveFeed';
import { useAnimatedNumber } from '../../hooks/useAnimatedNumber';

interface AnalyticsViewProps {
  threatState: ThreatLevel;
  threatScore: number;
  threatVelocity: number;
  riskHistory: RiskPoint[];
  indicators: ScamIndicator[];
  a2aHistory: A2AMessage[];
  currentCorrelationId: string;
  transcript?: TranscriptSegment[];
  activeIncidentId?: string;
  evidenceChain?: EvidenceBlock[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  threatState,
  threatScore,
  threatVelocity,
  riskHistory,
  indicators,
  a2aHistory,
  currentCorrelationId,
  transcript = [],
  activeIncidentId = 'INC-2026-INIT',
  evidenceChain = [],
}) => {
  // Guarantee effective threat state & score synchronization with evidence
  const isEvidenceCritical = evidenceChain.some(
    (b) => b.event_type.includes('INTERVENTION') || b.event_type.includes('KILLSWITCH') || (b.payload?.score === 100)
  );
  const effectiveThreatScore = threatScore === 0 && isEvidenceCritical ? 100 : threatScore;
  const effectiveThreatState = threatState === 'GREEN' && isEvidenceCritical ? 'RED' : threatState;

  const animatedScore = useAnimatedNumber(Math.round(effectiveThreatScore), 350);

  const [hoveredPoint, setHoveredPoint] = useState<RiskPoint | null>(null);

  // Calculate actual evaluated turns
  const evaluatedTurnsCount = Math.max(
    transcript.length,
    riskHistory.length > 1 ? riskHistory[riskHistory.length - 1].turn : (riskHistory.length === 1 && riskHistory[0].score > 0 ? 1 : 0)
  );

  // Category normalizer for robust scam vector matching
  const categoryDefinitions: { key: string; label: string; aliases: string[]; iconColor: string }[] = [
    {
      key: 'URGENCY_PRESSURE',
      label: 'Urgency & Coercion',
      aliases: ['URGENCY_PRESSURE', 'URGENCY', 'COERCION', 'PRESSURE'],
      iconColor: 'text-amber-400',
    },
    {
      key: 'CREDENTIAL_REQUEST',
      label: 'Credential / OTP Harvesting',
      aliases: ['CREDENTIAL_REQUEST', 'OTP_HARVESTING', 'CREDENTIAL', 'OTP_REQUEST', 'PASSWORD_HARVEST'],
      iconColor: 'text-red-400',
    },
    {
      key: 'REMOTE_ACCESS_REQUEST',
      label: 'Remote Software Access',
      aliases: ['REMOTE_ACCESS_REQUEST', 'REMOTE_ACCESS', 'ANYDESK_DOWNLOAD', 'TEAMVIEWER'],
      iconColor: 'text-rose-400',
    },
    {
      key: 'PAYMENT_REQUEST',
      label: 'Financial / Payment Demands',
      aliases: ['PAYMENT_REQUEST', 'FINANCIAL_DEMAND', 'WIRE_TRANSFER', 'GIFT_CARD'],
      iconColor: 'text-orange-400',
    },
    {
      key: 'IMPERSONATION',
      label: 'Authority Impersonation',
      aliases: ['IMPERSONATION', 'AUTHORITY_IMPERSONATION', 'BANK_OFFICIAL', 'SUPPORT_AGENT'],
      iconColor: 'text-cyan-400',
    },
    {
      key: 'THREAT_INTIMIDATION',
      label: 'Threat & Intimidation',
      aliases: ['THREAT_INTIMIDATION', 'INTIMIDATION', 'ARREST_THREAT', 'LEGAL_THREAT'],
      iconColor: 'text-red-500',
    },
    {
      key: 'SUSPICIOUS_LINK_ACTION',
      label: 'Suspicious Links & Downloads',
      aliases: ['SUSPICIOUS_LINK_ACTION', 'SUSPICIOUS_ACTION', 'MALICIOUS_LINK'],
      iconColor: 'text-indigo-400',
    },
  ];

  // Compute category frequency
  const categoryCounts: Record<string, number> = {};
  indicators.forEach((ind) => {
    const rawCat = (ind.category || '').toUpperCase();
    const matchedDef = categoryDefinitions.find(
      (def) => def.key === rawCat || def.aliases.some((alias) => rawCat.includes(alias))
    );
    const key = matchedDef ? matchedDef.key : 'URGENCY_PRESSURE';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  });

  // Chart data points
  const points: RiskPoint[] =
    riskHistory.length > 0
      ? riskHistory
      : [{ turn: 0, score: 0, timestamp: '00:00:00', threatLevel: 'GREEN' }];

  // SVG Chart Dimensions
  const svgWidth = 650;
  const svgHeight = 220;
  const padLeft = 45;
  const padRight = 30;
  const padTop = 25;
  const padBottom = 35;
  const plotWidth = svgWidth - padLeft - padRight;
  const plotHeight = svgHeight - padTop - padBottom;

  const getX = (index: number) => {
    if (points.length <= 1) return padLeft + (index === 0 ? 0 : plotWidth);
    return padLeft + (index / (points.length - 1)) * plotWidth;
  };

  const getY = (score: number) => {
    return padTop + (1 - Math.min(100, Math.max(0, score)) / 100) * plotHeight;
  };

  // Build SVG Path
  const pathD = points.reduce((acc, pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.score);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  const lastPt = points[points.length - 1];
  const areaD = `${pathD} L ${getX(points.length - 1).toFixed(1)} ${(padTop + plotHeight).toFixed(1)} L ${padLeft} ${(padTop + plotHeight).toFixed(1)} Z`;

  return (
    <div className="p-6 space-y-6 max-w-[1920px] mx-auto select-none">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 font-mono text-[10px] font-bold uppercase">
              REAL-TIME SOC TELEMETRY & ANALYTICS
            </span>
            <span className="text-xs font-mono text-slate-500">•</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              Session: {activeIncidentId}
            </span>
            <span className="text-xs font-mono text-slate-500">•</span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {evaluatedTurnsCount} Turns Evaluated
            </span>
          </div>
          <h2 className="text-lg font-bold font-mono text-slate-100">
            Multi-Turn Threat Velocity, Risk Evolution & Swarm Bus Telemetry
          </h2>
        </div>

        {/* Quick Telemetry Metrics */}
        <div className="flex items-center gap-5 font-mono">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold flex items-center justify-end gap-1">
              <span>Threat Velocity</span>
              {threatVelocity > 0 ? (
                <ArrowUpRight className="w-3 h-3 text-red-400" />
              ) : (
                <Activity className="w-3 h-3 text-slate-400" />
              )}
            </div>
            <div
              className={`text-lg font-bold ${
                threatVelocity > 20
                  ? 'text-red-400'
                  : threatVelocity > 0
                  ? 'text-orange-400'
                  : 'text-emerald-400'
              }`}
            >
              {threatVelocity > 0 ? `+${threatVelocity}` : threatVelocity} pts/turn
            </div>
          </div>

          <div className="text-right pl-5 border-l border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase font-bold">DEFCON State</div>
            <div
              className={`text-xs font-bold uppercase px-2 py-0.5 rounded border mt-0.5 ${
                effectiveThreatState === 'RED'
                  ? 'bg-red-950/80 text-red-400 border-red-700 animate-pulse'
                  : effectiveThreatState === 'ORANGE'
                  ? 'bg-orange-950/80 text-orange-400 border-orange-700'
                  : effectiveThreatState === 'YELLOW'
                  ? 'bg-amber-950/80 text-amber-400 border-amber-700'
                  : 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
              }`}
            >
              DEFCON {effectiveThreatState}
            </div>
          </div>

          <div className="text-right pl-5 border-l border-slate-800">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Threat Score</div>
            <div
              className={`text-2xl font-extrabold ${
                effectiveThreatState === 'RED'
                  ? 'text-red-400'
                  : effectiveThreatState === 'ORANGE'
                  ? 'text-orange-400'
                  : effectiveThreatState === 'YELLOW'
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {animatedScore} <span className="text-xs text-slate-500 font-normal">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Charts Top */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left: Interactive Dynamic Threat Score Progression Curve (7 cols) */}
        <div className="xl:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              Dynamic Threat Score Progression Curve
            </h3>
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-0.5 bg-red-500 inline-block" /> 85 (Red)
              </span>
              <span className="flex items-center gap-1 text-orange-400">
                <span className="w-2 h-0.5 bg-orange-500 inline-block" /> 65 (Orange)
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-0.5 bg-amber-500 inline-block" /> 35 (Amber)
              </span>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl relative">
            {/* SVG Telemetry Graph */}
            <div className="w-full relative overflow-visible">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-56 overflow-visible">
                <defs>
                  <linearGradient id="analyticsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.45" />
                    <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Grid & Reference Threshold Lines */}
                {/* 100 Ceiling */}
                <line x1={padLeft} y1={getY(100)} x2={svgWidth - padRight} y2={getY(100)} stroke="#334155" strokeWidth="0.8" opacity="0.4" />
                <text x={padLeft - 8} y={getY(100) + 3} textAnchor="end" className="text-[9px] fill-slate-500 font-mono">100</text>

                {/* 85 RED Threshold */}
                <line x1={padLeft} y1={getY(85)} x2={svgWidth - padRight} y2={getY(85)} stroke="#ef4444" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                <text x={svgWidth - padRight + 6} y={getY(85) + 3} className="text-[9px] fill-red-400 font-mono font-bold">85 (RED)</text>
                <text x={padLeft - 8} y={getY(85) + 3} textAnchor="end" className="text-[9px] fill-red-400/80 font-mono">85</text>

                {/* 65 ORANGE Threshold */}
                <line x1={padLeft} y1={getY(65)} x2={svgWidth - padRight} y2={getY(65)} stroke="#f97316" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                <text x={svgWidth - padRight + 6} y={getY(65) + 3} className="text-[9px] fill-orange-400 font-mono font-bold">65 (ORANGE)</text>
                <text x={padLeft - 8} y={getY(65) + 3} textAnchor="end" className="text-[9px] fill-orange-400/80 font-mono">65</text>

                {/* 35 AMBER Threshold */}
                <line x1={padLeft} y1={getY(35)} x2={svgWidth - padRight} y2={getY(35)} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
                <text x={svgWidth - padRight + 6} y={getY(35) + 3} className="text-[9px] fill-amber-400 font-mono font-bold">35 (AMBER)</text>
                <text x={padLeft - 8} y={getY(35) + 3} textAnchor="end" className="text-[9px] fill-amber-400/80 font-mono">35</text>

                {/* 0 Floor */}
                <line x1={padLeft} y1={getY(0)} x2={svgWidth - padRight} y2={getY(0)} stroke="#334155" strokeWidth="1" opacity="0.6" />
                <text x={padLeft - 8} y={getY(0) + 3} textAnchor="end" className="text-[9px] fill-slate-500 font-mono">0</text>

                {/* Area Under Curve */}
                <path d={areaD} fill="url(#analyticsGradient)" />

                {/* Threat Evolution Curve Line */}
                <path
                  d={pathD}
                  fill="none"
                  stroke={
                    effectiveThreatScore >= 85
                      ? '#ef4444'
                      : effectiveThreatScore >= 65
                      ? '#f97316'
                      : effectiveThreatScore >= 35
                      ? '#f59e0b'
                      : '#22d3ee'
                  }
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Individual Turn Data Points */}
                {points.map((pt, idx) => {
                  const cx = getX(idx);
                  const cy = getY(pt.score);
                  const isHovered = hoveredPoint === pt;

                  return (
                    <g key={idx} className="cursor-pointer" onMouseEnter={() => setHoveredPoint(pt)} onMouseLeave={() => setHoveredPoint(null)}>
                      {/* Outer Glow Ring */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={isHovered ? '7' : '4.5'}
                        className={
                          pt.score >= 85
                            ? 'fill-red-500/30 stroke-red-500 stroke-2'
                            : pt.score >= 65
                            ? 'fill-orange-500/30 stroke-orange-400 stroke-2'
                            : pt.score >= 35
                            ? 'fill-amber-500/30 stroke-amber-400 stroke-2'
                            : 'fill-cyan-500/30 stroke-cyan-400 stroke-2'
                        }
                      />
                      {/* Center Node */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="2.5"
                        className={
                          pt.score >= 85
                            ? 'fill-red-400'
                            : pt.score >= 65
                            ? 'fill-orange-300'
                            : pt.score >= 35
                            ? 'fill-amber-300'
                            : 'fill-cyan-300'
                        }
                      />

                      {/* X-Axis Turn Indicator Labels */}
                      <text
                        x={cx}
                        y={svgHeight - 12}
                        textAnchor="middle"
                        className="text-[9px] fill-slate-400 font-mono font-bold"
                      >
                        T{pt.turn}
                      </text>
                    </g>
                  );
                })}
              </svg>

              {/* Hover Tooltip Overlay */}
              {hoveredPoint && (
                <div className="absolute top-2 right-4 bg-slate-950/95 border border-slate-700 p-2.5 rounded-lg font-mono text-xs shadow-2xl z-10 space-y-1">
                  <div className="text-cyan-400 font-bold">Turn #{hoveredPoint.turn} Assessment</div>
                  <div className="text-slate-300">
                    Threat Score: <strong className="text-white">{hoveredPoint.score}/100</strong>
                  </div>
                  <div className="text-slate-400 text-[10px]">
                    DEFCON State: <strong className="text-amber-300">{hoveredPoint.threatLevel}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Summary */}
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-800/80 pt-2 mt-1">
              <span>Baseline: Turn 0 (Initial Telemetry)</span>
              <span>
                Terminal Risk: <strong className="text-cyan-300">{effectiveThreatScore}/100</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Detected Scam Vector Frequency Breakdown (5 cols) */}
        <div className="xl:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Detected Scam Vector Frequency
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-800/60">
              {indicators.length} TOTAL SIGNALS
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3 font-mono">
            {categoryDefinitions.map((catDef) => {
              const count = categoryCounts[catDef.key] || 0;
              const percent = indicators.length > 0 ? Math.round((count / indicators.length) * 100) : 0;

              return (
                <div key={catDef.key} className="space-y-1.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800/70">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${count > 0 ? 'bg-cyan-400' : 'bg-slate-700'}`} />
                      <span className={count > 0 ? 'text-slate-200 font-bold' : 'text-slate-500'}>
                        {catDef.label}
                      </span>
                    </div>
                    <span className={count > 0 ? 'text-cyan-400 font-bold' : 'text-slate-600'}>
                      {count} signal{count !== 1 ? 's' : ''} ({percent}%)
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        count > 0
                          ? count >= 3
                            ? 'bg-gradient-to-r from-orange-500 to-red-500'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                          : 'bg-transparent'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Inter-Agent Swarm (A2A) Telemetry Feed */}
      <div className="space-y-3">
        <A2ALiveFeed
          messages={a2aHistory}
          currentCorrelationId={currentCorrelationId}
        />
      </div>
    </div>
  );
};

