# CLAUDE.md // SENTINEL AI Engineering Invariants & Coding Standards

This document establishes the **permanent architectural invariants, development workflows, and engineering rules** for the SENTINEL AI codebase. Every contributor and AI agent must adhere strictly to these principles.

---

## 1. Core Architecture Invariants

1. **Deterministic Multi-Agent Coordination (A2A Protocol)**:
   - All inter-agent communication (`InspectorAgent`, `DecisionEngine`, `EvidenceAgent`, `InterventionAgent`, `SpeechEngine`) MUST pass through the strongly typed `A2AEventBus` in `backend/core/a2a.py`.
   - Every `A2AMessage` MUST contain: `id`, `timestamp`, `iso_time`, `sender`, `recipient`, `message_type`, `priority`, `payload`, and a computed cryptographic `signature`.
   - Direct cross-agent mutable state mutation is strictly forbidden. State changes occur purely via event consumption.

2. **Immutable Cryptographic Proof-of-Scam Chain**:
   - Every threat classification or intervention event MUST be committed as an `EvidenceBlock` to the `EvidenceChain` in `backend/core/crypto_chain.py`.
   - Block $N$ MUST hash the exact `block_hash` of Block $N-1$ (`prev_hash`).
   - The canonical hash formula is:
     $$\text{Hash} = \text{SHA256}(\text{index} \parallel \text{timestamp} \parallel \text{prev\_hash} \parallel \text{event\_type} \parallel \text{agent\_source} \parallel \text{canonical\_json}(\text{payload}) \parallel \text{nonce})$$
   - Any tampering or modification of a prior block MUST be detected deterministically by `verify_integrity()`.

3. **Active Intervention Safety & Kill-Switch Guarantees**:
   - When the threat score breaches $\ge 85.0$ or a deterministic critical trigger (e.g., OTP solicitation or AnyDesk remote control) is detected, the `DecisionEngine` MUST immediately issue a `KILLSWITCH_DIRECTIVE`.
   - The `InterventionAgent` MUST sever the live audio stream, broadcast the defensive synthetic voice warning, flag the line, and commit an immutable intervention record to the cryptographic chain.
   - Manual kill-switch override from the operator dashboard MUST always supersede automated logic.

4. **Speaker Diarization & Monotonic Threat Envelope**:
   - Diarization tags turns as either `CALLER` (potential scammer) or `CALLEE` (victim).
   - Scam threat scores are smoothed monotonically during active attack turns: an attack score does not reset to zero simply because a confused victim answers a question.

---

## 2. Directory Structure

```
Unstoppable/
├── backend/
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── inspector.py          # 5-vector conversational linguistics analyzer
│   │   ├── decision_engine.py    # Threat state machine (GREEN/YELLOW/ORANGE/RED)
│   │   ├── evidence_agent.py     # Blockchain committer & audit auditor
│   │   └── intervention_agent.py # Active kill-switch & voice advisory coordinator
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py             # Pydantic BaseSettings & threshold constants
│   │   ├── a2a.py                # Strongly typed Agent-to-Agent message bus
│   │   └── crypto_chain.py       # SHA-256 evidence blockchain engine
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── scenarios.py          # Realistic scam test scenarios & benign baseline
│   │   └── stt_engine.py         # Live audio & streaming speech processor
│   ├── tests/
│   │   ├── __init__.py
│   │   └── test_sentinel.py      # Automated pytest test suite
│   ├── main.py                   # FastAPI app, REST API & WebSockets
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/           # Modular SOC cybersecurity UI components
│   │   │   ├── Header.tsx
│   │   │   ├── AudioVisualizer.tsx
│   │   │   ├── ThreatRadar.tsx
│   │   │   ├── TranscriptStream.tsx
│   │   │   ├── AgentChatterFeed.tsx
│   │   │   ├── EvidenceChainExplorer.tsx
│   │   │   ├── KillSwitchControl.tsx
│   │   │   ├── ScenarioSelector.tsx
│   │   │   └── ForensicReportModal.tsx
│   │   ├── hooks/                # Custom React hooks for WS & WebAudio
│   │   │   ├── useSentinelWebSocket.ts
│   │   │   └── useAudioStreamer.ts
│   │   ├── types/
│   │   │   └── sentinel.ts       # Strict TypeScript interfaces
│   │   ├── utils/
│   │   │   ├── crypto.ts         # Client Web Crypto SHA-256 utilities
│   │   │   └── soundEffects.ts   # WebAudio synthesizer & speech synthesizer
│   │   ├── App.tsx               # Main SOC cyber command layout
│   │   ├── main.tsx              # React DOM entrypoint
│   │   └── index.css             # Tailwind base & custom cyber theme styles
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── ARCHITECTURE.md               # Complete architectural specifications
├── CLAUDE.md                     # Permanent engineering rules & guidelines
├── README.md                     # Project overview & documentation
├── .gitignore
├── .env.example
└── run_sentinel.bat              # Quickstart launch script for Windows
```

---

## 3. Development Commands & Workflows

### Python Backend
```bash
# Install dependencies
pip install -r backend/requirements.txt

# Run server with live reload
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload

# Run test suite
python -m pytest backend/tests -v -o pythonpath=.
```

### React Frontend
```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Run TypeScript check & production build
npm run build
```

---

## 4. Coding Standards & Conventions

### Python (Backend)
- Use **Pydantic v2** (`BaseModel`, `SettingsConfigDict`, `model_dump()`). Do not use deprecated `.dict()`.
- Use `datetime.now(timezone.utc)` for all timestamps to ensure strict ISO 8601 UTC compliance.
- Keep all agent message handlers asynchronous (`async def`) and non-blocking.
- Maintain 100% type annotations on all function signatures and return types.

### TypeScript / React (Frontend)
- Enable strict mode (`"strict": true` in `tsconfig.json`).
- Centralize all data contracts in `src/types/sentinel.ts`.
- Components MUST be modular, accessible, and follow the Dark Cyber SOC theme using Tailwind CSS classes.
- Use the Web Audio API and Web Speech API responsibly with graceful fallback when permissions are unavailable.

---

## 5. Security & Cryptographic Rules

1. **No Cleartext PII in Logs**: Any mock credit card numbers or credentials captured during testing must be sanitized or redacted in audit exports.
2. **Deterministic Canonical JSON**: When hashing payloads for `EvidenceBlock`, keys MUST be sorted (`sort_keys=True`) with fixed separators `(',', ':')` to guarantee hash consistency across Python and JavaScript.
3. **Defense in Depth**: Automated kill-switch directives must be logged both in memory and on the cryptographic ledger, ensuring non-repudiation for forensic audits.

