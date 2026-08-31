import json
import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.agents.decision_engine import DecisionResult, decision_engine
from backend.agents.evidence_agent import evidence_agent
from backend.agents.inspector import InspectionResult, ScamIndicator, inspector_agent
from backend.agents.intervention_agent import intervention_agent
from backend.core.a2a import A2AMessage, event_bus
from backend.core.config import settings
from backend.engine.scenarios import SCENARIOS
from backend.engine.stt_engine import stt_engine
from backend.services.orchestrator import AnalyzeRequest, AnalyzeResponse, orchestrator

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentinel.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"SENTINEL AI Backend v{settings.VERSION} starting up...")
    logger.info(f"A2A Active Agents: {[a.agent_name for a in event_bus.registry.list_agents()]}")
    yield
    logger.info("SENTINEL AI Backend shutting down...")
    stt_engine.stop_scenario()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="SENTINEL AI - Autonomous Scam-Call Detection & Cryptographic Defense Platform",
    lifespan=lifespan,
)

# Enable CORS for Frontend Dev & Production
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active WebSocket clients set
active_websockets: list[WebSocket] = []


async def broadcast_ws(event_type: str, data: dict[str, Any]):
    """Broadcast real-time event to all connected dashboard clients."""
    if not active_websockets:
        return
    message = json.dumps({"event": event_type, "data": data})
    disconnected = []
    for ws in list(active_websockets):
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        if ws in active_websockets:
            active_websockets.remove(ws)


async def on_a2a_event(msg: A2AMessage):
    await broadcast_ws("A2A_MESSAGE", msg.model_dump())

    if msg.message_type in ["TRANSCRIPT_TURN"]:
        await broadcast_ws("TRANSCRIPT_UPDATE", msg.payload)
    elif msg.message_type in ["INSPECTOR_EVALUATION", "INSPECTION_RESULT"]:
        await broadcast_ws("INSPECTOR_UPDATE", msg.payload)
    elif msg.message_type in ["THREAT_DECISION", "DECISION_RESULT"]:
        await broadcast_ws("DECISION_UPDATE", msg.payload)
    elif msg.message_type in ["EVIDENCE_COMMITTED", "EVIDENCE_SEALED"]:
        await broadcast_ws("EVIDENCE_UPDATE", msg.payload)
    elif msg.message_type in ["KILLSWITCH_EXECUTED", "INTERVENTION_RESULT"]:
        await broadcast_ws("KILLSWITCH_UPDATE", msg.payload)
    elif msg.message_type in ["KILLSWITCH_RESET"]:
        await broadcast_ws("KILLSWITCH_RESET", msg.payload)
    elif msg.message_type in ["SCENARIO_STARTED"]:
        await broadcast_ws("SCENARIO_STARTED", msg.payload)
    elif msg.message_type in ["SCENARIO_COMPLETED"]:
        await broadcast_ws("SCENARIO_COMPLETED", msg.payload)


event_bus.subscribe_all(on_a2a_event)

# --- REST Endpoints ---


@app.get("/api/health")
async def health_check():
    """System health, scenario state, threat level, call state, and cryptographic chain status."""
    is_valid, fail_idx, reason = evidence_agent.chain.verify_integrity()
    return {
        "status": "OPERATIONAL",
        "system": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "active_scenario": stt_engine.current_scenario_id,
        "is_streaming": stt_engine.is_streaming,
        "threat_state": decision_engine.current_state,
        "highest_score": decision_engine.highest_threat_score,
        "killswitch_active": intervention_agent.status.is_active,
        "call_state": intervention_agent.status.call_state,
        "active_incident_id": intervention_agent.status.incident_id,
        "evidence_blocks": len(evidence_agent.chain.chain),
        "chain_cryptographically_valid": is_valid,
        "connected_dashboards": len(active_websockets),
    }


@app.get("/api/scenarios")
async def list_scenarios():
    """List all available pre-packaged scam and baseline scenarios."""
    return [
        {
            "id": s.id,
            "title": s.title,
            "category": s.category,
            "description": s.description,
            "target_risk_level": s.target_risk_level,
            "caller_id_spoof": s.caller_id_spoof,
            "turn_count": len(s.dialogue),
        }
        for s in SCENARIOS.values()
    ]


class StartScenarioRequest(BaseModel):
    scenario_id: str
    speed_multiplier: float = 1.0


@app.post("/api/scenarios/start")
async def start_scenario(req: StartScenarioRequest):
    """Launch automated timed playback of a scam scenario."""
    if req.scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Scenario '{req.scenario_id}' not found")

    try:
        await intervention_agent.reset_intervention()
        await stt_engine.start_scenario_simulation(req.scenario_id, req.speed_multiplier)
        return {
            "status": "STARTED",
            "scenario_id": req.scenario_id,
            "speed_multiplier": req.speed_multiplier,
        }
    except Exception as e:
        logger.error(f"Failed to start scenario '{req.scenario_id}': {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Failed to start scenario simulation: {str(e)}"
        ) from e


@app.post("/api/scenarios/stop")
async def stop_scenario():
    """Stop active scenario simulation."""
    stt_engine.stop_scenario()
    return {"status": "STOPPED"}


class LiveTurnRequest(BaseModel):
    speaker: str = "CALLER"
    text: str
    confidence: float = 0.95
    session_id: str | None = None
    turn_index: int | None = None


@app.post("/api/live/turn")
async def ingest_live_turn(req: LiveTurnRequest):
    """Ingest a live spoken turn and trigger multi-agent pipeline."""
    segment = await stt_engine.ingest_live_segment(
        speaker=req.speaker, text=req.text, confidence=req.confidence
    )
    return {"status": "INGESTED", "segment": segment.model_dump()}


class InspectRequest(BaseModel):
    text: str
    speaker: str = "CALLER"
    session_id: str | None = None
    turn_index: int = 1


@app.post("/api/inspect", response_model=InspectionResult, tags=["Inspector"])
async def inspect_transcript_text(req: InspectRequest):
    """
    Direct InspectorAgent endpoint.
    Normalizes transcript, extracts structured scam indicators, evaluates context,
    and returns deterministic preliminary risk scoring without making final decision.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Transcript text cannot be empty")

    result = inspector_agent.inspect(
        text=req.text,
        speaker=req.speaker,
        session_id=req.session_id,
        turn_index=req.turn_index,
    )
    return result


class DecisionRequest(BaseModel):
    indicators: list[ScamIndicator] = []
    is_benign_advice: bool = False
    speaker: str = "CALLER"
    session_id: str | None = None
    turn_index: int = 1


@app.post("/api/decision", response_model=DecisionResult, tags=["DecisionEngine"])
async def evaluate_decision(req: DecisionRequest):
    """
    Direct DecisionEngine endpoint.
    Consumes structured scam indicators from InspectorAgent, evaluates combination rules,
    computes deterministic risk score, maps threat state, and outputs recommended defense actions.
    """
    result = decision_engine.evaluate_indicators(
        indicators=req.indicators,
        is_benign_advice=req.is_benign_advice,
        speaker=req.speaker,
        session_id=req.session_id,
        turn_index=req.turn_index,
    )
    return result


@app.post("/api/analyze", response_model=AnalyzeResponse, tags=["Orchestrator"])
async def analyze_turn_pipeline(req: AnalyzeRequest):
    """
    Complete End-to-End Orchestration Endpoint:
    Processes raw conversation turn through InspectorAgent -> DecisionEngine -> Defensive Actions Layer.
    Returns unified intelligence payload with indicators, risk score, decision, and recommended actions.
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Dialogue text cannot be empty")

    try:
        response = await orchestrator.analyze_turn(
            text=req.text,
            speaker=req.speaker,
            session_id=req.session_id,
            turn_index=req.turn_index,
            auto_intervene=req.auto_intervene,
        )
        return response
    except Exception as e:
        logger.error(f"Pipeline orchestration error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Orchestration pipeline failure: {str(e)}"
        ) from e


class KillSwitchRequest(BaseModel):
    reason: str = "MANUAL_OPERATOR_INTERVENTION"


@app.post("/api/killswitch/trigger")
async def trigger_killswitch(req: KillSwitchRequest):
    """Manually trigger emergency kill switch and commit evidence."""
    status = await intervention_agent.execute_intervention(
        source="MANUAL_OPERATOR",
        reason=req.reason,
        triggers=["Manual emergency override engaged by security analyst"],
    )
    return {"status": "ENGAGED", "details": status.model_dump()}


@app.post("/api/killswitch/reset", tags=["KillSwitch"])
async def reset_killswitch():
    """Disarm kill switch and reset intervention state."""
    stt_engine.stop_scenario()
    stt_engine.reset_session()
    inspector_agent.reset_state()
    await decision_engine._reset_state()
    status = await intervention_agent.reset_intervention()
    return {"status": "RESET", "details": status.model_dump()}


@app.get("/api/killswitch/status", tags=["KillSwitch"])
async def get_killswitch_status():
    """Retrieve current kill switch status and call state machine details."""
    return intervention_agent.status.model_dump()


@app.get("/api/evidence/chain")
async def get_evidence_chain():
    """Retrieve full immutable SHA-256 evidence blockchain."""
    is_valid, fail_idx, fail_reason = evidence_agent.chain.verify_integrity()
    total = len(evidence_agent.chain.chain)
    return {
        "is_valid": is_valid,
        "failing_block_index": fail_idx,
        "failure_reason": fail_reason,
        "block_count": total,
        "total_blocks": total,
        "chain": [b.model_dump() for b in evidence_agent.chain.chain],
    }


@app.post("/api/evidence/verify")
async def verify_evidence_chain():
    """Run full cryptographic integrity verification over all evidence blocks."""
    is_valid, fail_idx, fail_reason = evidence_agent.chain.verify_integrity()
    return {
        "is_valid": is_valid,
        "failing_block_index": fail_idx,
        "failure_reason": fail_reason,
        "block_count": len(evidence_agent.chain.chain),
        "status": "CHAIN_INTEGRITY_VERIFIED" if is_valid else "TAMPERING_OR_CORRUPTION_DETECTED",
    }


class TamperTestRequest(BaseModel):
    block_index: int
    field: str = "dialogue_snippet"
    malicious_value: Any = "ALTERED_BY_ATTACKER_FRAUD_RECORD_DELETED"
    target_property: str = "payload"


@app.post("/api/evidence/tamper-test")
async def tamper_test(req: TamperTestRequest):
    """Simulate an adversary modifying a block to demonstrate tamper detection."""
    success = evidence_agent.chain.tamper_block_for_test(
        block_index=req.block_index,
        field_to_alter=req.field,
        malicious_value=req.malicious_value,
        target_property=req.target_property,
    )
    if not success:
        raise HTTPException(status_code=400, detail="Invalid block index")

    is_valid, fail_idx, fail_reason = evidence_agent.chain.verify_integrity()

    await broadcast_ws(
        "CHAIN_TAMPERED",
        {
            "tampered_block_index": req.block_index,
            "is_valid": is_valid,
            "failure_reason": fail_reason,
        },
    )

    return {
        "status": "TAMPER_SIMULATION_EXECUTED",
        "block_index": req.block_index,
        "is_valid_after_tamper": is_valid,
        "detected_failure_block": fail_idx,
        "error_message": fail_reason,
    }


@app.post("/api/evidence/repair")
async def repair_chain():
    """Recalculate chain cryptographic hashes to restore validity after tamper test."""
    evidence_agent.chain.repair_chain_recalculate()
    is_valid, _, _ = evidence_agent.chain.verify_integrity()
    await broadcast_ws("CHAIN_REPAIRED", {"is_valid": is_valid})
    return {"status": "CHAIN_REPAIRED", "is_valid": is_valid}


@app.get("/api/evidence/export-audit")
async def export_audit_package():
    """Export signed cryptographic forensic package with root digest seal."""
    return evidence_agent.chain.export_audit_package()


@app.get("/api/a2a/history", tags=["A2A"])
async def get_a2a_history(
    limit: int = 100,
    sender: str | None = None,
    receiver: str | None = None,
    message_type: str | None = None,
    correlation_id: str | None = None,
):
    """Retrieve filtered historical inter-agent messages, signatures, and audit trails."""
    return event_bus.get_history(
        limit=limit,
        sender=sender,
        receiver=receiver,
        message_type=message_type,
        correlation_id=correlation_id,
    )


@app.get("/api/a2a/messages/{message_id}", tags=["A2A"])
async def get_a2a_message_by_id(message_id: str):
    """Retrieve specific A2A message by unique message_id."""
    msg = event_bus.get_by_id(message_id)
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    return msg


@app.get("/api/a2a/correlations/{correlation_id}", tags=["A2A"])
async def get_a2a_messages_by_correlation(correlation_id: str):
    """Retrieve all A2A messages belonging to a single security incident lineage."""
    return event_bus.get_by_correlation(correlation_id)


@app.get("/api/a2a/agents", tags=["A2A"])
async def get_registered_agents():
    """List all registered active agents in the internal registry."""
    return event_bus.registry.list_agents()


# --- WebSocket Call & Telemetry Stream ---


@app.websocket("/ws/call-stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    if websocket not in active_websockets:
        active_websockets.append(websocket)
    logger.info(f"Dashboard client connected. Total connected: {len(active_websockets)}")

    try:
        is_valid, fail_idx, fail_reason = evidence_agent.chain.verify_integrity()
        initial_payload = {
            "event": "INITIAL_STATE",
            "data": {
                "system_name": settings.PROJECT_NAME,
                "threat_state": decision_engine.current_state,
                "highest_score": decision_engine.highest_threat_score,
                "killswitch_active": intervention_agent.status.is_active,
                "transcript": [t.model_dump() for t in stt_engine.rolling_transcript],
                "evidence_chain": [b.model_dump() for b in evidence_agent.chain.chain],
                "is_chain_valid": is_valid,
                "chain_failure_reason": fail_reason,
                "a2a_history": event_bus.get_history(limit=50),
                "is_streaming": stt_engine.is_streaming,
                "active_scenario_id": stt_engine.current_scenario_id,
            },
        }
        await websocket.send_text(json.dumps(initial_payload))

        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
                action = data.get("action")

                if action == "LIVE_SPEECH_TURN":
                    await stt_engine.ingest_live_segment(
                        speaker=data.get("speaker", "CALLER"),
                        text=data.get("text", ""),
                        confidence=data.get("confidence", 0.95),
                    )
                elif action == "START_SCENARIO":
                    scenario_id = data.get("scenario_id")
                    speed = data.get("speed", 1.0)
                    if scenario_id in SCENARIOS:
                        await intervention_agent.reset_intervention()
                        await stt_engine.start_scenario_simulation(scenario_id, speed)
                elif action == "STOP_SCENARIO":
                    stt_engine.stop_scenario()
                elif action == "TRIGGER_KILLSWITCH":
                    await intervention_agent.execute_intervention(
                        source="MANUAL_OPERATOR",
                        reason=data.get("reason", "Operator emergency override"),
                        triggers=["Manual emergency override via dashboard"],
                    )
                elif action == "RESET_KILLSWITCH":
                    await intervention_agent.reset_intervention()
            except Exception as e:
                logger.error(f"Error handling WS message: {e}")

    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket unexpected error: {e}")
    finally:
        if websocket in active_websockets:
            active_websockets.remove(websocket)
        logger.info(f"Dashboard client disconnected. Remaining: {len(active_websockets)}")
