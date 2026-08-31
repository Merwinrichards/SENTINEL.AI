import pytest
from fastapi.testclient import TestClient

from backend.agents.intervention_agent import intervention_agent
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
async def reset_system_state():
    await intervention_agent.reset_intervention()
    yield
    await intervention_agent.reset_intervention()


def test_three_turn_live_voice_ingestion_and_intervention(client: TestClient):
    """
    Test the exact 3-turn live voice ingestion progression:
    Turn 1: "I am calling from your bank security department."
    Turn 2: "Please tell me the OTP that was just sent to your phone."
    Turn 3: "You need to do it immediately otherwise your account will be blocked within 10 minutes."

    Verifies:
    1. Three turns ingested through /api/live/turn and /api/analyze.
    2. Threat score rises deterministically.
    3. State transitions from GREEN to RED.
    4. Decision reaches INTERVENE.
    5. Kill-switch activates.
    6. Evidence chain is sealed and cryptographically verified.
    """
    session_id = "test-live-voice-001"

    # ----------------------------------------------------
    # TURN 1: Brand / Authority Impersonation
    # ----------------------------------------------------
    turn1_text = "I am calling from your bank security department."
    res1 = client.post(
        "/api/analyze",
        json={
            "text": turn1_text,
            "speaker": "CALLER",
            "session_id": session_id,
            "turn_index": 1,
            "auto_intervene": True,
        },
    )
    assert res1.status_code == 200
    data1 = res1.json()

    assert data1["turn_index"] == 1
    assert data1["decision"]["threat_state"] == "GREEN"
    assert data1["decision"]["decision"] == "ALLOW"
    assert data1["intervention_executed"] is False
    assert any(i["category"] == "IMPERSONATION" for i in data1["inspection"]["indicators"])

    # ----------------------------------------------------
    # TURN 2: Credential & OTP Harvesting
    # ----------------------------------------------------
    turn2_text = "Please tell me the OTP that was just sent to your phone."
    res2 = client.post(
        "/api/analyze",
        json={
            "text": turn2_text,
            "speaker": "CALLER",
            "session_id": session_id,
            "turn_index": 2,
            "auto_intervene": True,
        },
    )
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2["turn_index"] == 2
    assert data2["decision"]["score"] >= 35.0
    assert any(i["category"] == "CREDENTIAL_REQUEST" for i in data2["inspection"]["indicators"])

    # ----------------------------------------------------
    # TURN 3: Coercive Urgency & Account Threat Intimidation
    # ----------------------------------------------------
    turn3_text = (
        "You need to do it immediately otherwise your account will be blocked within 10 minutes."
    )
    res3 = client.post(
        "/api/analyze",
        json={
            "text": turn3_text,
            "speaker": "CALLER",
            "session_id": session_id,
            "turn_index": 3,
            "auto_intervene": True,
        },
    )
    assert res3.status_code == 200
    data3 = res3.json()

    assert data3["turn_index"] == 3
    assert data3["decision"]["score"] >= 80.0
    assert data3["decision"]["threat_state"] == "RED"
    assert data3["decision"]["decision"] == "INTERVENE"
    assert data3["decision"]["requires_intervention"] is True

    # Indicators verified
    detected_cats = {i["category"] for i in data3["inspection"]["indicators"]}
    assert "URGENCY_PRESSURE" in detected_cats
    assert "THREAT_INTIMIDATION" in detected_cats

    # Automated Intervention & Actions
    assert data3["intervention_executed"] is True
    assert data3["intervention_details"] is not None
    assert data3["intervention_details"]["call_state"] == "CALL_TERMINATED"
    assert data3["intervention_details"]["audio_stream_severed"] is True
    assert data3["intervention_details"]["warning_voice_broadcasted"] is True

    # ----------------------------------------------------
    # Evidence Blockchain Verification
    # ----------------------------------------------------
    verify_res = client.post("/api/evidence/verify")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["is_valid"] is True
    assert verify_data["status"] == "CHAIN_INTEGRITY_VERIFIED"
    assert verify_data["block_count"] >= 3


def test_live_turn_endpoint_direct_ingestion(client: TestClient):
    """Verify that POST /api/live/turn accepts spoken speech turns smoothly."""
    res = client.post(
        "/api/live/turn",
        json={
            "text": "Hello, this is a live spoken microphone test.",
            "speaker": "CALLER",
            "confidence": 0.97,
            "session_id": "sess-live-turn-test",
            "turn_index": 1,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "INGESTED"
    assert data["segment"]["text"] == "Hello, this is a live spoken microphone test."
    assert data["segment"]["speaker"] == "CALLER"


def test_exact_user_scam_sentence_analysis(client: TestClient):
    """
    Test the single combined prompt scenario:
    "Hello, I am calling from your bank security department. We detected suspicious activity on your account. You must immediately share your OTP or your account will be blocked within 10 minutes."
    """
    sentence = (
        "Hello, I am calling from your bank security department. We detected suspicious activity on your account. "
        "You must immediately share your OTP or your account will be blocked within 10 minutes."
    )
    res = client.post(
        "/api/analyze",
        json={
            "text": sentence,
            "speaker": "CALLER",
            "session_id": "test-exact-sentence-001",
            "turn_index": 1,
            "auto_intervene": True,
        },
    )
    assert res.status_code == 200
    data = res.json()

    # Verify Inspector extracted indicators
    categories = {i["category"] for i in data["inspection"]["indicators"]}
    assert "IMPERSONATION" in categories
    assert "CREDENTIAL_REQUEST" in categories
    assert "URGENCY_PRESSURE" in categories
    assert "THREAT_INTIMIDATION" in categories

    # Verify Decision Engine calculation
    assert data["decision"]["score"] >= 80.0
    assert data["decision"]["threat_state"] == "RED"
    assert data["decision"]["decision"] == "INTERVENE"
    assert data["decision"]["requires_intervention"] is True
    assert data["intervention_executed"] is True
    assert data["intervention_details"]["call_state"] == "CALL_TERMINATED"


