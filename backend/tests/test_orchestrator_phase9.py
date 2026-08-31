import pytest
from fastapi.testclient import TestClient

from backend.agents.intervention_agent import intervention_agent
from backend.main import app
from backend.services.orchestrator import orchestrator


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
async def reset_state():
    await intervention_agent.reset_intervention()
    yield
    await intervention_agent.reset_intervention()


@pytest.mark.asyncio
async def test_case_1_benign_customer_support_turn():
    """TEST 1: Benign customer support dialogue returns score 0, GREEN, ALLOW, no intervention."""
    text = "Thank you for contacting customer support. How may I help you today?"
    res = await orchestrator.analyze_turn(
        text=text,
        speaker="CALLER",
        session_id="sess_benign_001",
        turn_index=1,
        auto_intervene=True,
    )

    assert res.agent == "Orchestrator"
    assert res.session_id == "sess_benign_001"
    assert res.turn_index == 1
    assert res.original_text == text
    assert res.decision.score <= 20.0  # low/zero risk
    assert res.decision.threat_state == "GREEN"
    assert res.decision.decision == "ALLOW"
    assert res.decision.requires_intervention is False
    assert res.intervention_executed is False
    assert any(a.action_type == "LOG_PASSIVE" for a in res.actions)


@pytest.mark.asyncio
async def test_case_2_suspicious_unusual_transaction_turn():
    """TEST 2: Suspicious inquiry raises anomalies without triggering critical kill-switch severance."""
    text = "Your account has an unusual transaction. Please verify some information."
    res = await orchestrator.analyze_turn(
        text=text,
        speaker="CALLER",
        session_id="sess_suspicious_002",
        turn_index=1,
        auto_intervene=True,
    )

    assert res.agent == "Orchestrator"
    assert res.decision.requires_intervention is False
    assert res.intervention_executed is False
    assert res.decision.threat_state in ["GREEN", "YELLOW", "ORANGE"]
    assert res.decision.decision in ["ALLOW", "MONITOR", "WARN"]


@pytest.mark.asyncio
async def test_case_3_high_risk_scam_with_killswitch_engagement():
    """TEST 3: High-risk banking scam triggers combinations, RED state, and automated kill-switch."""
    text = (
        "Hello, I am calling from your bank security department. We detected suspicious activity on your account. "
        "You must immediately share your OTP and confirm your account details, otherwise your account will be blocked within 10 minutes."
    )
    res = await orchestrator.analyze_turn(
        text=text,
        speaker="CALLER",
        session_id="sess_scam_003",
        turn_index=1,
        auto_intervene=True,
    )

    assert res.agent == "Orchestrator"
    assert res.session_id == "sess_scam_003"
    assert res.turn_index == 1

    # Detected categories
    cats = {ind.category for ind in res.inspection.indicators}
    assert "URGENCY_PRESSURE" in cats
    assert "CREDENTIAL_REQUEST" in cats
    assert "THREAT_INTIMIDATION" in cats

    # Decision parameters
    assert res.decision.score >= 75.0
    assert res.decision.threat_state == "RED"
    assert res.decision.decision == "INTERVENE"
    assert res.decision.requires_intervention is True
    assert res.decision.confidence >= 0.90

    # Defensive Actions
    action_types = {a.action_type for a in res.actions}
    assert "EXECUTE_KILLSWITCH" in action_types
    assert "EARPIECE_VOICE_WARNING" in action_types

    # Intervention Execution
    assert res.intervention_executed is True
    assert res.intervention_details is not None
    assert res.intervention_details.get("call_state") == "CALL_TERMINATED"


@pytest.mark.asyncio
async def test_case_4_auto_intervene_disabled():
    """TEST 4: When auto_intervene=False, intervention is recommended but kill-switch is not executed."""
    text = "Download AnyDesk immediately and tell me the 6 digit OTP."
    res = await orchestrator.analyze_turn(
        text=text,
        speaker="CALLER",
        session_id="sess_no_auto_004",
        turn_index=2,
        auto_intervene=False,
    )

    assert res.decision.requires_intervention is True
    assert res.intervention_executed is False
    assert intervention_agent.status.is_active is False


def test_case_5_rest_api_analyze_endpoint(client: TestClient):
    """TEST 5: POST /api/analyze REST API works end-to-end with valid payload structure."""
    client.post("/api/killswitch/reset")
    payload = {
        "text": "Hello, I am calling from your bank security department. We detected suspicious activity. You must immediately share your OTP or your account will be blocked.",
        "speaker": "CALLER",
        "session_id": "e2e-test-001",
        "turn_index": 1,
        "auto_intervene": True,
    }

    resp = client.post("/api/analyze", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    # Verify top-level structure
    assert data["agent"] == "Orchestrator"
    assert data["session_id"] == "e2e-test-001"
    assert data["turn_index"] == 1
    assert data["original_text"] == payload["text"]

    # Verify inspection object
    assert "inspection" in data
    assert "indicators" in data["inspection"]
    assert len(data["inspection"]["indicators"]) >= 2

    # Verify decision object
    assert "decision" in data
    assert data["decision"]["score"] >= 75.0
    assert data["decision"]["threat_state"] == "RED"
    assert data["decision"]["decision"] == "INTERVENE"
    assert data["decision"]["requires_intervention"] is True
    assert "triggered_rules" in data["decision"]

    # Verify actions object
    assert "actions" in data
    action_types = [a["action_type"] for a in data["actions"]]
    assert "EXECUTE_KILLSWITCH" in action_types
    assert "EARPIECE_VOICE_WARNING" in action_types


def test_case_6_empty_text_returns_400(client: TestClient):
    """TEST 6: Empty text rejected cleanly with 400 Bad Request."""
    resp = client.post("/api/analyze", json={"text": "   ", "speaker": "CALLER"})
    assert resp.status_code == 400
    assert "cannot be empty" in resp.json()["detail"]
