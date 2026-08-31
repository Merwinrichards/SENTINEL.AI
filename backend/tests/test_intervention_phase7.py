import asyncio

import pytest
from fastapi.testclient import TestClient

from backend.agents.evidence_agent import evidence_agent
from backend.agents.inspector import inspector_agent
from backend.agents.intervention_agent import CallState, InterventionOutcome, intervention_agent
from backend.core.a2a import A2AMessage, event_bus
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
async def cleanup_state():
    await intervention_agent.reset_intervention()
    yield
    await intervention_agent.reset_intervention()


@pytest.mark.asyncio
async def test_case_1_valid_automated_intervention():
    """TEST 1: DecisionEngine INTERVENTION_REQUEST triggers kill switch and sets CALL_TERMINATED."""
    await intervention_agent.reset_intervention()
    corr_id = "corr_phase7_test_1"

    req = A2AMessage(
        sender="DecisionEngine",
        receiver="InterventionAgent",
        correlation_id=corr_id,
        conversation_id="conv_test_1",
        message_type="INTERVENTION_REQUEST",
        priority="CRITICAL",
        payload={
            "decision": "INTERVENE",
            "threat_state": "RED",
            "threat_score": 95.0,
            "reason": "CRITICAL_THREAT_THRESHOLD_EXCEEDED",
            "triggers": ["CRITICAL_REMOTE_ACCESS_REQUEST: AnyDesk"],
            "reasons": ["Remote access combined with credential solicitation"],
            "requires_intervention": True,
            "correlation_id": corr_id,
        },
    )

    await intervention_agent.handle_intervention_request(req)

    assert intervention_agent.status.is_active is True
    assert intervention_agent.status.call_state == CallState.CALL_TERMINATED.value
    assert intervention_agent.status.audio_stream_severed is True
    assert intervention_agent.status.warning_voice_broadcasted is True
    assert intervention_agent.status.fraud_desk_notified is True
    assert intervention_agent.status.outcome == InterventionOutcome.SUCCESS.value
    assert intervention_agent.status.correlation_id == corr_id


@pytest.mark.asyncio
async def test_case_2_low_risk_suppresses_intervention():
    """TEST 2: Low-risk decision with requires_intervention=False is rejected without state change."""
    await intervention_agent.reset_intervention()

    req = A2AMessage(
        sender="DecisionEngine",
        receiver="InterventionAgent",
        correlation_id="corr_phase7_test_2",
        message_type="INTERVENTION_REQUEST",
        payload={
            "decision": "ALLOW",
            "threat_state": "GREEN",
            "threat_score": 10.0,
            "requires_intervention": False,
        },
    )

    await intervention_agent.handle_intervention_request(req)

    assert intervention_agent.status.is_active is False
    assert intervention_agent.status.call_state != CallState.CALL_TERMINATED.value


@pytest.mark.asyncio
async def test_case_3_unauthorized_sender_rejected():
    """TEST 3: Direct intervention request from unauthorized agent (InspectorAgent) is rejected."""
    await intervention_agent.reset_intervention()

    unauthorized_req = A2AMessage(
        sender="InspectorAgent",
        receiver="InterventionAgent",
        correlation_id="corr_unauthorized",
        message_type="INTERVENTION_REQUEST",
        payload={
            "decision": "INTERVENE",
            "requires_intervention": True,
            "threat_score": 99.0,
        },
    )

    await intervention_agent.handle_intervention_request(unauthorized_req)

    assert intervention_agent.status.is_active is False
    assert intervention_agent.status.call_state != CallState.CALL_TERMINATED.value


@pytest.mark.asyncio
async def test_case_4_malformed_request_handled_safely():
    """TEST 4: Malformed payload with missing fields does not crash or corrupt state."""
    await intervention_agent.reset_intervention()

    malformed_req = A2AMessage(
        sender="DecisionEngine",
        receiver="InterventionAgent",
        message_type="INTERVENTION_REQUEST",
        payload={},
    )

    await intervention_agent.handle_intervention_request(malformed_req)
    assert intervention_agent.status.is_active is True
    assert intervention_agent.status.call_state == CallState.CALL_TERMINATED.value


@pytest.mark.asyncio
async def test_case_5_duplicate_request_idempotency():
    """TEST 5: Consecutive duplicate intervention requests are idempotent without re-triggering."""
    await intervention_agent.reset_intervention()
    corr_id = "corr_idempotent_test"

    # First call
    status1 = await intervention_agent.execute_intervention(
        source="DECISION_ENGINE_AUTOMATED", reason="First attempt", correlation_id=corr_id
    )
    assert status1.is_active is True
    assert status1.outcome == InterventionOutcome.SUCCESS.value
    engaged_time_1 = status1.engaged_at

    # Second identical call
    status2 = await intervention_agent.execute_intervention(
        source="DECISION_ENGINE_AUTOMATED", reason="Second attempt", correlation_id=corr_id
    )
    assert status2.is_active is True
    assert status2.outcome == InterventionOutcome.ALREADY_ACTIVE.value
    assert status2.engaged_at == engaged_time_1


def test_case_6_manual_operator_trigger_api(client: TestClient):
    """TEST 6: POST /api/killswitch/trigger endpoint engages manual operator intervention."""
    client.post("/api/killswitch/reset")
    res = client.post(
        "/api/killswitch/trigger",
        json={"reason": "Security analyst manual escalation"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ENGAGED"
    assert data["details"]["is_active"] is True
    assert data["details"]["trigger_source"] == "MANUAL_OPERATOR"
    assert data["details"]["call_state"] == "CALL_TERMINATED"
    assert data["details"]["reason"] == "Security analyst manual escalation"


def test_case_7_reset_api(client: TestClient):
    """TEST 7: POST /api/killswitch/reset endpoint disarms kill switch and resets state."""
    # Ensure engaged first
    client.post("/api/killswitch/trigger", json={"reason": "Test"})
    res = client.post("/api/killswitch/reset")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "RESET"
    assert data["details"]["is_active"] is False
    assert data["details"]["call_state"] == "RECOVERY"


@pytest.mark.asyncio
async def test_case_8_reset_preserves_evidence_history():
    """TEST 8: Resetting kill switch does NOT delete previous evidence blocks in blockchain."""
    await intervention_agent.reset_intervention()
    initial_len = len(evidence_agent.chain.chain)

    await intervention_agent.execute_intervention(
        source="MANUAL_OPERATOR", reason="Evidence preservation test"
    )
    await asyncio.sleep(0.05)
    len_after_trigger = len(evidence_agent.chain.chain)
    assert len_after_trigger > initial_len

    await intervention_agent.reset_intervention()
    await asyncio.sleep(0.05)
    len_after_reset = len(evidence_agent.chain.chain)
    assert len_after_reset > len_after_trigger

    # Verify blockchain is still cryptographically unbroken
    is_valid, _, _ = evidence_agent.chain.verify_integrity()
    assert is_valid is True


@pytest.mark.asyncio
async def test_case_9_correlation_id_full_propagation():
    """TEST 9: Complete incident from Inspector -> Decision -> Evidence -> Intervention shares correlation_id."""
    await intervention_agent.reset_intervention()
    corr_id = "corr_end_to_end_phase7"

    scam_turn = A2AMessage(
        sender="System",
        receiver="InspectorAgent",
        correlation_id=corr_id,
        message_type="TRANSCRIPT_TURN",
        payload={
            "segment": {
                "speaker": "CALLER",
                "text": "This is technical support. Download AnyDesk right now and tell me your banking OTP.",
                "turn_index": 2,
            }
        },
    )

    await inspector_agent.handle_transcript_turn(scam_turn)
    await asyncio.sleep(0.1)

    history = event_bus.get_by_correlation(corr_id)
    assert len(history) >= 4
    for msg in history:
        assert msg["correlation_id"] == corr_id

    assert intervention_agent.status.is_active is True
    assert intervention_agent.status.correlation_id == corr_id


def test_case_10_evidence_chain_integrity_after_intervention(client: TestClient):
    """TEST 10: POST /api/evidence/verify returns valid after intervention commits."""
    client.post("/api/killswitch/reset")
    client.post("/api/killswitch/trigger", json={"reason": "Integrity check test"})
    res = client.post("/api/evidence/verify")
    assert res.status_code == 200
    data = res.json()
    assert data["is_valid"] is True
    assert data["status"] == "CHAIN_INTEGRITY_VERIFIED"
    assert data["failure_reason"] is None


@pytest.mark.asyncio
async def test_case_11_fresh_context_for_new_incident():
    """TEST 11: Starting a new scenario generates fresh correlation context without stale pollution."""
    await intervention_agent.reset_intervention()

    # Incident 1
    await intervention_agent.execute_intervention(
        source="MANUAL_OPERATOR", reason="Incident 1", correlation_id="corr_incident_1"
    )
    assert intervention_agent.status.correlation_id == "corr_incident_1"

    # Reset
    await intervention_agent.reset_intervention()

    # Incident 2
    scenario_msg = A2AMessage(
        sender="System",
        receiver="ALL",
        correlation_id="corr_incident_2",
        message_type="SCENARIO_STARTED",
        payload={"scenario_id": "bank_fraud_otp_theft"},
    )
    await intervention_agent._handle_scenario_started(scenario_msg)

    assert intervention_agent.status.is_active is False
    assert intervention_agent.status.correlation_id == "corr_incident_2"
    assert intervention_agent.status.call_state == CallState.CALL_ACTIVE.value


@pytest.mark.asyncio
async def test_case_12_concurrent_intervention_requests():
    """TEST 12: Concurrent intervention requests are serialized safely without race conditions."""
    await intervention_agent.reset_intervention()
    corr_id = "corr_concurrent_test"

    results = await asyncio.gather(
        intervention_agent.execute_intervention(
            source="Agent_A", reason="Concurrent trigger A", correlation_id=corr_id
        ),
        intervention_agent.execute_intervention(
            source="Agent_B", reason="Concurrent trigger B", correlation_id=corr_id
        ),
    )

    assert len(results) == 2
    outcomes = [r.outcome for r in results]
    assert InterventionOutcome.SUCCESS.value in outcomes
    assert InterventionOutcome.ALREADY_ACTIVE.value in outcomes


def test_case_13_killswitch_status_and_health_api(client: TestClient):
    """TEST 13: GET /api/killswitch/status and GET /api/health include call state and status."""
    client.post("/api/killswitch/reset")
    res_status = client.get("/api/killswitch/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert "call_state" in status_data
    assert "is_active" in status_data
    assert "audio_stream_severed" in status_data

    res_health = client.get("/api/health")
    assert res_health.status_code == 200
    health_data = res_health.json()
    assert "call_state" in health_data
    assert "killswitch_active" in health_data
    assert "chain_cryptographically_valid" in health_data
