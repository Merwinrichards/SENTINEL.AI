import React from 'react';
import { TrendingUp, Activity } from 'lucide-react';
import { RiskPoint } from '../../types/sentinel';

interface RiskHistoryChartProps {
  history: RiskPoint[];
}

export const RiskHistoryChart: React.FC<RiskHistoryChartProps> = ({ history }) => {
  const points = history.length > 0 ? history : [{ turn: 0, score: 0, timestamp: '00:00:00', threatLevel: 'GREEN' }];
  const maxScore = 100;
  const width = 320;
  const height = 80;
  const padding = 12;

  const getX = (index: number) => {
    if (points.length <= 1) return padding;
    return padding + (index / (points.length - 1)) * (width - 2 * padding);
  };

  const getY = (score: number) => {
    return height - padding - (score / maxScore) * (height - 2 * padding);
  };

  const pathD = points.reduce((acc, pt, idx) => {
    const x = getX(idx);
    const y = getY(pt.score);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
  }, '');

  const areaD = `${pathD} L ${getX(points.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`;

  const latestPoint = points[points.length - 1];

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2 shadow-xl">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-300">RISK SCORE TIMELINE</span>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
          <Activity className="w-3 h-3 text-cyan-400" />
          <span>Latest: <strong className="text-cyan-300">{latestPoint.score} pts</strong></span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden flex items-center justify-center">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20 overflow-visible">
          <defs>
            <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={padding} y1={getY(75)} x2={width - padding} y2={getY(75)} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.4" />
          <line x1={padding} y1={getY(50)} x2={width - padding} y2={getY(50)} stroke="#f59e0b" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.3" />
          <line x1={padding} y1={getY(25)} x2={width - padding} y2={getY(25)} stroke="#06b6d4" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.2" />

          {/* Area under curve */}
          <path d={areaD} fill="url(#riskGradient)" />

          {/* Line */}
          <path
            d={pathD}
            fill="none"
            stroke={latestPoint.score >= 75 ? '#ef4444' : latestPoint.score >= 50 ? '#f97316' : '#22d3ee'}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {points.map((pt, idx) => (
            <circle
              key={idx}
              cx={getX(idx)}
              cy={getY(pt.score)}
              r="3"
              className={
                pt.score >= 75
                  ? 'fill-red-500 stroke-slate-900 stroke-2'
                  : pt.score >= 50
                  ? 'fill-orange-400 stroke-slate-900 stroke-2'
                  : 'fill-cyan-400 stroke-slate-900 stroke-2'
              }
            />
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono text-slate-500 px-1 border-t border-slate-800/40 pt-1">
        <span>Turn 1 (Ingest)</span>
        <span>Turn {points.length} (Current)</span>
      </div>
    </div>
  );
};

