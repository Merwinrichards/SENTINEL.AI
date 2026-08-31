# SENTINEL AI // Backend Infrastructure & Real-Time Audio Pipeline (Phase 2)

This module implements the **production-grade FastAPI backend infrastructure and real-time streaming audio pipeline** for the SENTINEL AI cyber-defense platform.

---

## 🏗️ Architecture & Modules

```
backend/
├── app/
│   ├── api/
│   │   ├── health.py         # GET /, GET /health, GET /health/ready
│   │   └── websocket.py      # /ws endpoint supporting JSON control & binary audio frames
│   ├── audio/
│   │   ├── models.py         # SessionStatus, AudioCodec, AudioFrameMetadata, TransportAnomaly
│   │   ├── session.py        # AudioSession state machine & multi-client SessionManager
│   │   └── processor.py      # AudioProcessor (sequence validation, backpressure queue, STT dispatch)
│   ├── stt/
│   │   ├── base.py           # STTProvider abstract protocol & STTCallback contract
│   │   ├── models.py         # TranscriptSegment schemas (speaker, confidence, timestamps)
│   │   ├── mock.py           # Deterministic streaming MockSTTProvider
│   │   └── provider.py       # Real streaming STT adapter & provider factory
│   ├── core/
│   │   ├── config.py         # Pydantic v2 settings, audio constraints & STT configurations
│   │   └── logging.py        # Centralized structured logging with ISO timestamps
│   ├── events/
│   │   ├── types.py          # Strongly typed EventType enum
│   │   ├── models.py         # BaseEvent, AudioFrameReceivedEvent, TranscriptPartialEvent, TranscriptFinalEvent
│   │   └── bus.py            # Asynchronous Event Bus with full exception isolation
│   ├── websocket/
│   │   └── manager.py        # Multi-client WebSocket connection manager & broadcaster
│   ├── schemas/
│   │   └── common.py         # Standard reusable schemas (ProjectInfo, HealthResponse, WebSocketMessage)
│   ├── services/             # Domain service layer
│   └── main.py               # FastAPI application factory, CORS & global error handlers
├── tests/
│   ├── conftest.py           # Pytest fixtures and clean state resets
│   ├── test_health.py        # Health, liveness & readiness tests
│   ├── test_event_bus.py     # Event bus concurrency & exception isolation tests
│   ├── test_websocket.py     # Basic WebSocket lifecycle tests
│   ├── test_audio_session.py # AudioSession lifecycle & anomaly tracking tests
│   ├── test_audio_processor.py # Sequence validation & backpressure tests
│   ├── test_stt_provider.py  # MockSTTProvider & factory tests
│   └── test_audio_websocket_integration.py # Full end-to-end integration tests
├── pyproject.toml            # Project configuration for pytest, ruff & mypy
├── requirements.txt          # Python dependencies
└── README.md                 # Backend documentation (this file)
```

---

## 🚀 Getting Started

### 1. Environment Setup
```bash
# Create Python virtual environment
python -m venv .venv

# Activate virtual environment
# Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate
```

### 2. Dependency Installation
```bash
pip install -r requirements.txt
```

### 3. Running the Server
```bash
# Start FastAPI with Uvicorn (from backend/ directory):
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 🧪 Testing & Code Quality

### Run Complete Test Suite (27 tests)
```bash
pytest tests/ -v
```

### Run Linter & Formatter (Ruff)
```bash
ruff check app/ tests/
ruff format app/ tests/
```

### Run Static Type Checker (mypy)
```bash
mypy app/ tests/
```

---

## 🔌 WebSocket Audio Protocol (`/ws`)

### 1. Call & Audio Streaming Lifecycle
```text
Client                                  Server
  │                                       │
  ├─── CALL_START (JSON) ────────────────>│  (Initializes AudioSession)
  │<── CALL_STARTED (JSON) ───────────────┤
  │                                       │
  ├─── AUDIO_START (JSON) ───────────────>│  (Initializes STT & Processor)
  │<── AUDIO_ACK (JSON) ──────────────────┤
  │                                       │
  ├─── Binary Audio Frame 0 ─────────────>│  (Queues frame, verifies seq)
  │<── TRANSCRIPT_PARTIAL (JSON) ─────────┤
  │                                       │
  ├─── Binary Audio Frame 1 ─────────────>│
  │<── TRANSCRIPT_PARTIAL (JSON) ─────────┤
  │                                       │
  ├─── AUDIO_STOP (JSON) ────────────────>│  (Flushes final transcript)
  │<── TRANSCRIPT_FINAL (JSON) ───────────┤
  │<── AUDIO_ACK (status: stopped) ───────┤
  │                                       │
  ├─── CALL_END (JSON) ──────────────────>│  (Closes session)
  │<── CALL_ENDED (JSON) ─────────────────┤
```

### 2. Message Schemas

#### Client `CALL_START`
```json
{
  "type": "CALL_START",
  "payload": {
    "audio_format": "audio/webm;codecs=opus",
    "sample_rate": 16000,
    "channels": 1
  }
}
```

#### Server `CALL_STARTED`
```json
{
  "type": "CALL_STARTED",
  "payload": {
    "session_id": "sess_a8f9c0e12b34",
    "status": "CREATED",
    "audio_format": "audio/webm;codecs=opus",
    "sample_rate": 16000,
    "channels": 1
  }
}
```

#### Server `TRANSCRIPT_PARTIAL` / `TRANSCRIPT_FINAL`
```json
{
  "type": "TRANSCRIPT_FINAL",
  "payload": {
    "session_id": "sess_a8f9c0e12b34",
    "segment": {
      "session_id": "sess_a8f9c0e12b34",
      "segment_id": "seg_f1084b238cd2",
      "text": "Hello, I am calling from your bank security department.",
      "is_final": true,
      "start_time": 0.0,
      "end_time": 1.25,
      "confidence": 0.99,
      "speaker": "CALLER",
      "timestamp": 1724872200.123
    }
  }
}
```
