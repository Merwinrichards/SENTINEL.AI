import React from 'react';
import {
  BrainCircuit,
  ShieldAlert,
  Flame,
  KeyRound,
  Laptop,
  CreditCard,
  UserCheck,
  FileWarning,
  ExternalLink,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Lock,
  Activity
} from 'lucide-react';
import { ThreatLevel, ScamIndicator, EvidenceBlock } from '../../types/sentinel';

interface ThreatIntelligenceViewProps {
  threatState: ThreatLevel;
  threatScore: number;
  indicators: ScamIndicator[];
  confidence: number;
  decisionDirective: string;
  activeIncidentId?: string;
  evidenceChain?: EvidenceBlock[];
}

export const ThreatIntelligenceView: React.FC<ThreatIntelligenceViewProps> = ({
  threatState,
  threatScore,
  indicators,
  confidence,
  decisionDirective,
  activeIncidentId = 'INC-2026-INIT',
  evidenceChain = [],
}) => {
  // Guarantee effective threat state & score synchronization with evidence
  const isEvidenceCritical = evidenceChain.some(
    (b) => b.event_type.includes('INTERVENTION') || b.event_type.includes('KILLSWITCH') || (b.payload?.score === 100)
  );
  const effectiveThreatScore = threatScore === 0 && isEvidenceCritical ? 100 : threatScore;
  const effectiveThreatState = threatState === 'GREEN' && isEvidenceCritical ? 'RED' : threatState;

  // 7 Core Vector taxonomy definitions
  const vectorTaxonomy = [
    {
      key: 'URGENCY_PRESSURE',
      name: 'Urgency & Coercion',
      aliases: ['URGENCY_PRESSURE', 'URGENCY', 'COERCION', 'PRESSURE'],
      description: 'Psychological time pressure and artificial deadlines designed to induce panic and compliance.',
      icon: Flame,
      color: 'text-amber-400',
      border: 'border-amber-500/50',
      activeBg: 'bg-gradient-to-b from-amber-950/40 via-slate-900 to-slate-950',
      baseWeight: 20,
    },
    {
      key: 'CREDENTIAL_REQUEST',
      name: 'Credential & 2FA Harvesting',
      aliases: ['CREDENTIAL_REQUEST', 'OTP_HARVESTING', 'CREDENTIAL', 'OTP_REQUEST', 'PASSWORD_HARVEST'],
      description: 'Direct solicitation of one-time passcodes (OTP), banking PINs, or account login credentials.',
      icon: KeyRound,
      color: 'text-red-400',
      border: 'border-red-500/60',
      activeBg: 'bg-gradient-to-b from-red-950/40 via-slate-900 to-slate-950',
      baseWeight: 35,
    },
    {
      key: 'REMOTE_ACCESS_REQUEST',
      name: 'Remote Access Takeover',
      aliases: ['REMOTE_ACCESS_REQUEST', 'REMOTE_ACCESS', 'ANYDESK_DOWNLOAD', 'TEAMVIEWER'],
      description: 'Coercion to install AnyDesk, TeamViewer, or QuickAssist for full unattended device takeover.',
      icon: Laptop,
      color: 'text-rose-400',
      border: 'border-rose-500/60',
      activeBg: 'bg-gradient-to-b from-rose-950/40 via-slate-900 to-slate-950',
      baseWeight: 35,
    },
    {
      key: 'PAYMENT_REQUEST',
      name: 'Financial Demands & Gift Cards',
      aliases: ['PAYMENT_REQUEST', 'FINANCIAL_DEMAND', 'WIRE_TRANSFER', 'GIFT_CARD'],
      description: 'Demands for irreversible wire transfers, Bitcoin ATM deposits, or retail prepaid gift cards.',
      icon: CreditCard,
      color: 'text-orange-400',
      border: 'border-orange-500/50',
      activeBg: 'bg-gradient-to-b from-orange-950/40 via-slate-900 to-slate-950',
      baseWeight: 25,
    },
    {
      key: 'IMPERSONATION',
      name: 'Authority & Brand Impersonation',
      aliases: ['IMPERSONATION', 'AUTHORITY_IMPERSONATION', 'BANK_OFFICIAL', 'SUPPORT_AGENT'],
      description: 'Deceptive impersonation of Microsoft, Chase Bank, Federal IRS agents, or law enforcement.',
      icon: UserCheck,
      color: 'text-cyan-400',
      border: 'border-cyan-500/50',
      activeBg: 'bg-gradient-to-b from-cyan-950/40 via-slate-900 to-slate-950',
      baseWeight: 25,
    },
    {
      key: 'THREAT_INTIMIDATION',
      name: 'Threat & Legal Intimidation',
      aliases: ['THREAT_INTIMIDATION', 'INTIMIDATION', 'ARREST_THREAT', 'LEGAL_THREAT'],
      description: 'Aggressive threats of immediate arrest warrants, account freezing, or prosecution.',
      icon: FileWarning,
      color: 'text-red-500',
      border: 'border-red-500/60',
      activeBg: 'bg-gradient-to-b from-red-950/40 via-slate-900 to-slate-950',
      baseWeight: 30,
    },
    {
      key: 'SUSPICIOUS_LINK_ACTION',
      name: 'Malicious Links & Attachments',
      aliases: ['SUSPICIOUS_LINK_ACTION', 'SUSPICIOUS_ACTION', 'MALICIOUS_LINK'],
      description: 'Directing the callee to open external phishing portals or download malicious executables.',
      icon: ExternalLink,
      color: 'text-indigo-400',
      border: 'border-indigo-500/50',
      activeBg: 'bg-gradient-to-b from-indigo-950/40 via-slate-900 to-slate-950',
      baseWeight: 25,
    },
  ];

  // Multi-vector combination escalation rules
  const combinationRules = [
    {
      ruleId: 'COMBINATION_URGENCY_AND_CREDENTIALS',
      name: 'Panic Credential Coercion',
      categories: ['URGENCY_PRESSURE', 'CREDENTIAL_REQUEST'],
      boostValue: 15,
      boost: '+15 pts',
      description: 'Urgency psychological trigger combined with immediate OTP or password demand.',
    },
    {
      ruleId: 'COMBINATION_REMOTE_ACCESS_AND_CREDENTIALS',
      name: 'Device Takeover & Credential Interception',
      categories: ['REMOTE_ACCESS_REQUEST', 'CREDENTIAL_REQUEST'],
      boostValue: 25,
      boost: '+25 pts',
      description: 'Remote screen-sharing tool paired with credential or OTP harvesting.',
    },
    {
      ruleId: 'COMBINATION_PAYMENT_THREAT_URGENCY',
      name: 'Extortion Financial Coercion',
      categories: ['PAYMENT_REQUEST', 'THREAT_INTIMIDATION', 'URGENCY_PRESSURE'],
      boostValue: 25,
      boost: '+25 pts',
      description: 'Financial wire demands enforced by legal or arrest threats and urgency.',
    },
    {
      ruleId: 'COMBINATION_TECH_SUPPORT_TRIAD',
      name: 'Full Tech Support Scam Triad',
      categories: ['IMPERSONATION', 'REMOTE_ACCESS_REQUEST', 'CREDENTIAL_REQUEST'],
      boostValue: 30,
      boost: '+30 pts',
      description: 'Brand authority assertion combined with remote access software and credentials.',
    },
  ];

  // Helper to match active indicators to a taxonomy key
  const getMatchedIndicatorsForTaxonomy = (vec: (typeof vectorTaxonomy)[0]) => {
    return indicators.filter((ind) => {
      const rawCat = (ind.category || '').toUpperCase();
      return (
        rawCat === vec.key ||
        vec.aliases.some((alias) => rawCat.includes(alias))
      );
    });
  };

  // Helper to check if a category is detected
  const isCategoryDetected = (catKey: string) => {
    return indicators.some((ind) => {
      const rawCat = (ind.category || '').toUpperCase();
      const def = vectorTaxonomy.find((v) => v.key === catKey);
      return (
        rawCat === catKey ||
        (def && def.aliases.some((alias) => rawCat.includes(alias)))
      );
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-[1920px] mx-auto select-none">
      {/* Header Banner */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/60 text-cyan-400 font-mono text-[10px] font-bold uppercase">
              THREAT INTELLIGENCE MATRIX
            </span>
            <span className="text-xs font-mono text-slate-500">•</span>
            <span className="text-xs font-mono font-bold text-slate-300">
              Session: {activeIncidentId}
            </span>
            <span className="text-xs font-mono text-slate-500">•</span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              Confidence: {confidence}%
            </span>
          </div>
          <h2 className="text-lg font-bold font-mono text-slate-100">
            Multi-Vector Scam Classification & Synergy Escalation Engine
          </h2>
        </div>

        <div className="flex items-center gap-4 font-mono">
          <div className="text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Composite Score</div>
            <div className="text-2xl font-extrabold text-slate-100">
              {effectiveThreatScore} <span className="text-xs text-slate-500 font-normal">/ 100</span>
            </div>
          </div>
          <span
            className={`px-3 py-1.5 rounded-lg font-mono text-xs font-bold border ${
              effectiveThreatState === 'RED'
                ? 'bg-red-500/20 text-red-400 border-red-500/60 animate-pulse'
                : effectiveThreatState === 'ORANGE'
                ? 'bg-orange-500/20 text-orange-400 border-orange-500/50'
                : effectiveThreatState === 'YELLOW'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
            }`}
          >
            DEFCON {effectiveThreatState} // {decisionDirective}
          </span>
        </div>
      </div>

      {/* 7-Vector Matrix Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-cyan-400" />
            Scam Vector Categorization Matrix (7 Taxonomies)
          </h3>
          <span className="text-[10px] font-mono text-slate-400">
            {indicators.length} total active signals identified
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {vectorTaxonomy.map((vec) => {
            const Icon = vec.icon;
            const matchedList = getMatchedIndicatorsForTaxonomy(vec);
            const isDetected = matchedList.length > 0;

            // Compute score contribution
            const calculatedContribution = isDetected
              ? Math.min(
                  45,
                  matchedList.reduce((acc, i) => {
                    const sevWeight = i.severity === 'CRITICAL' ? 35 : i.severity === 'HIGH' ? 25 : 15;
                    return Math.max(acc, sevWeight);
                  }, vec.baseWeight)
                )
              : 0;

            return (
              <div
                key={vec.key}
                className={`p-4 rounded-xl border transition-all duration-300 flex flex-col justify-between ${
                  isDetected
                    ? `${vec.activeBg} ${vec.border} shadow-xl shadow-black/60 ring-1 ring-cyan-500/30`
                    : 'bg-slate-900/60 border-slate-800/80 opacity-70 hover:opacity-90'
                }`}
              >
                <div>
                  {/* Taxonomy Header */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isDetected
                            ? 'bg-slate-950 border border-slate-700 shadow-md'
                            : 'bg-slate-950/60'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${vec.color}`} />
                      </div>
                      <span className="text-xs font-mono font-bold text-slate-200 leading-snug">
                        {vec.name}
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase shrink-0 ${
                        isDetected
                          ? 'bg-red-500/20 text-red-400 border-red-500/50 animate-pulse'
                          : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {isDetected ? 'DETECTED' : 'INACTIVE'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans mb-3 line-clamp-2">
                    {vec.description}
                  </p>
                </div>

                {/* Detected Signals & Risk Contribution Footer */}
                {isDetected ? (
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400 font-bold">
                        {matchedList.length} signal{matchedList.length !== 1 ? 's' : ''} detected
                      </span>
                      <span className="text-amber-400 font-bold">
                        +{calculatedContribution} pts contribution
                      </span>
                    </div>

                    <div className="space-y-1">
                      {matchedList.map((m, idx) => (
                        <div
                          key={idx}
                          className="p-1.5 rounded bg-slate-950/90 border border-slate-800 text-[10px] font-mono flex items-center justify-between gap-1"
                        >
                          <span className="text-slate-200 font-semibold truncate">
                            "{m.matched_signal}"
                          </span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-bold shrink-0 ${
                              m.severity === 'CRITICAL'
                                ? 'text-red-400 bg-red-950/60'
                                : m.severity === 'HIGH'
                                ? 'text-orange-400 bg-orange-950/60'
                                : 'text-amber-400 bg-amber-950/60'
                            }`}
                          >
                            {m.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-slate-800/40 flex items-center justify-between text-[10px] font-mono text-slate-600">
                    <span>No indicators active</span>
                    <span>0 pts</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Combination Escalation Synergy Rules & SOC Directives */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Combination Escalation Synergy Rules (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Combination Escalation Synergy Rules
            </h3>
            <span className="text-[10px] font-mono text-slate-500">
              Multi-Vector Attack Multipliers
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3 font-mono">
            {combinationRules.map((rule) => {
              const totalRequired = rule.categories.length;
              const matchedCount = rule.categories.filter((cat) => isCategoryDetected(cat)).length;
              const isTriggered = matchedCount === totalRequired;
              const isArmed = matchedCount > 0 && matchedCount < totalRequired;
              const isClear = matchedCount === 0;

              return (
                <div
                  key={rule.ruleId}
                  className={`p-4 rounded-xl border transition-all ${
                    isTriggered
                      ? 'bg-gradient-to-r from-red-950/50 via-slate-900 to-slate-950 border-red-500 shadow-xl shadow-red-950/50 ring-1 ring-red-500/60'
                      : isArmed
                      ? 'bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-950 border-amber-500/50 shadow-md ring-1 ring-amber-500/30'
                      : 'bg-slate-950/60 border-slate-800/80 opacity-70'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between mb-2 gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-bold ${
                          isTriggered
                            ? 'text-red-300'
                            : isArmed
                            ? 'text-amber-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {rule.name}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ({rule.ruleId})
                      </span>
                    </div>

                    {/* Highly Distinct ARMED / TRIGGERED / CLEAR Status Badge */}
                    <div className="flex items-center gap-2">
                      {isTriggered ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-red-950 text-red-300 border border-red-500 text-[10px] font-bold shadow-md shadow-red-950/80 animate-pulse flex items-center gap-1">
                          <Zap className="w-3 h-3 text-red-400" />
                          TRIGGERED ({rule.boost})
                        </span>
                      ) : isArmed ? (
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-950 text-amber-300 border border-amber-500 text-[10px] font-bold shadow-md shadow-amber-950/60 animate-pulse flex items-center gap-1">
                          <Activity className="w-3 h-3 text-amber-400" />
                          ARMED ({matchedCount}/{totalRequired} MET)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800 text-[10px] font-bold">
                          CLEAR (0/{totalRequired})
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-400 font-sans mb-3">
                    {rule.description}
                  </p>

                  {/* Prerequisite Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-850">
                    {rule.categories.map((cat) => {
                      const isCatActive = isCategoryDetected(cat);
                      return (
                        <span
                          key={cat}
                          className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 ${
                            isCatActive
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600 font-bold'
                              : 'bg-slate-900 text-slate-500 border-slate-800'
                          }`}
                        >
                          {isCatActive ? '✓ ' : '○ '}
                          {cat}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: SOC Action Directives & Runbooks (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              SOC Countermeasure Runbooks
            </h3>
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
              POLICY AUTOMATION
            </span>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-3 font-mono">
            <div
              className={`p-3 rounded-lg border transition-all ${
                effectiveThreatState === 'RED'
                  ? 'bg-red-950/40 border-red-500/80 shadow-md shadow-red-950'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="text-xs font-bold text-red-400 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                CRITICAL THREAT (DEFCON 1 // SCORE ≥ 85)
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Mandatory autonomous audio line severance, instant synthetic voice advisory broadcast, SHA-256 evidence chain lock, and automated fraud desk dispatch.
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border transition-all ${
                effectiveThreatState === 'ORANGE'
                  ? 'bg-orange-950/40 border-orange-500/80 shadow-md shadow-orange-950'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="text-xs font-bold text-orange-400 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-orange-400" />
                HIGH THREAT (DEFCON 2 // SCORE 65-84)
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Arm emergency kill-switch standby, prime synthetic voice warning, increase STT speech inspector analysis frequency to maximum.
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border transition-all ${
                effectiveThreatState === 'YELLOW'
                  ? 'bg-amber-950/40 border-amber-500/80 shadow-md shadow-amber-950'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                GUARDED / SUSPICIOUS (DEFCON 3 // SCORE 35-64)
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Continuous background surveillance, flag conversational anomalies, track multi-turn threat velocity and prerequisite rule triggers.
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border transition-all ${
                effectiveThreatState === 'GREEN'
                  ? 'bg-emerald-950/40 border-emerald-500/80'
                  : 'bg-slate-950 border-slate-800'
              }`}
            >
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                NORMAL BASELINE (DEFCON 4 // SCORE 0-34)
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                Passive logging to blockchain evidence ledger, all systems armed and monitoring incoming conversational turns.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


