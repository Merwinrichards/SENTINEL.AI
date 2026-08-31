import pytest
from fastapi.testclient import TestClient

from backend.agents.decision_engine import decision_engine
from backend.agents.inspector import ScamIndicator
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_decision_case_1_benign():
    """TEST 1: No suspicious indicators produces GREEN / ALLOW with no intervention required."""
    result = decision_engine.evaluate_indicators(indicators=[])
    assert result.score == 0.0
    assert result.threat_state == "GREEN"
    assert result.decision == "ALLOW"
    assert result.requires_intervention is False
    assert result.confidence >= 0.90
    assert "No suspicious scam indicators" in result.reasons[0]


def test_decision_case_2_single_medium_signal():
    """TEST 2: Single medium indicator generates low/moderate score without automatic termination."""
    ind = ScamIndicator(
        category="IMPERSONATION",
        matched_signal="customer support",
        severity="MEDIUM",
        evidence="I am customer support",
        confidence=0.85,
        explanation="Standard support persona claim",
    )
    result = decision_engine.evaluate_indicators(indicators=[ind])
    assert 10.0 <= result.score <= 35.0
    assert result.threat_state in ["GREEN", "YELLOW"]
    assert result.requires_intervention is False
    assert "RULE_DETECTED_IMPERSONATION" in result.triggered_rules


def test_decision_case_3_otp_request():
    """TEST 3: High severity OTP solicitation raises threat score with explainable reasoning."""
    ind = ScamIndicator(
        category="CREDENTIAL_REQUEST",
        matched_signal="one-time passcode",
        severity="HIGH",
        evidence="Tell me your one-time passcode",
        confidence=0.96,
        explanation="Solicitation of 2FA authentication code",
    )
    result = decision_engine.evaluate_indicators(indicators=[ind])
    assert result.score >= 35.0
    assert "RULE_DETECTED_CREDENTIAL_REQUEST" in result.triggered_rules
    assert any("Credential Request" in r for r in result.reasons)


def test_decision_case_4_remote_access():
    """TEST 4: Remote access request generates high risk score."""
    ind = ScamIndicator(
        category="REMOTE_ACCESS_REQUEST",
        matched_signal="AnyDesk",
        severity="HIGH",
        evidence="Please install AnyDesk",
        confidence=0.98,
        explanation="Remote desktop control software",
    )
    result = decision_engine.evaluate_indicators(indicators=[ind])
    assert result.score >= 35.0
    assert "RULE_DETECTED_REMOTE_ACCESS_REQUEST" in result.triggered_rules


def test_decision_case_5_remote_access_plus_otp_combination():
    """TEST 5: Remote access + OTP request triggers combination rule and escalates to RED / INTERVENE."""
    ind1 = ScamIndicator(
        category="REMOTE_ACCESS_REQUEST",
        matched_signal="AnyDesk",
        severity="HIGH",
        evidence="Install AnyDesk and connect",
        confidence=0.98,
        explanation="Remote software request",
    )
    ind2 = ScamIndicator(
        category="CREDENTIAL_REQUEST",
        matched_signal="OTP",
        severity="HIGH",
        evidence="Read me the 6-digit OTP",
        confidence=0.97,
        explanation="2FA interception",
    )
    result = decision_engine.evaluate_indicators(indicators=[ind1, ind2])
    assert "COMBINATION_REMOTE_ACCESS_AND_CREDENTIALS" in result.combination_rules_triggered
    assert result.score >= 82.0
    assert result.threat_state == "RED"
    assert result.decision == "INTERVENE"
    assert result.requires_intervention is True


def test_decision_case_6_complete_tech_support_scam_triad():
    """TEST 6: Full multi-vector tech support attack triggers triad combination and critical intervention."""
    indicators = [
        ScamIndicator(
            category="IMPERSONATION",
            matched_signal="Microsoft Support",
            severity="HIGH",
            evidence="Microsoft",
            confidence=0.95,
            explanation="Support impersonation",
        ),
        ScamIndicator(
            category="REMOTE_ACCESS_REQUEST",
            matched_signal="TeamViewer",
            severity="CRITICAL",
            evidence="TeamViewer",
            confidence=0.99,
            explanation="Remote access tool",
        ),
        ScamIndicator(
            category="CREDENTIAL_REQUEST",
            matched_signal="banking password",
            severity="CRITICAL",
            evidence="password",
            confidence=0.98,
            explanation="Password request",
        ),
        ScamIndicator(
            category="URGENCY_PRESSURE",
            matched_signal="immediately",
            severity="HIGH",
            evidence="immediately",
            confidence=0.95,
            explanation="Urgency trigger",
        ),
        ScamIndicator(
            category="THREAT_INTIMIDATION",
            matched_signal="account blocked",
            severity="HIGH",
            evidence="account blocked",
            confidence=0.95,
            explanation="Threat trigger",
        ),
    ]
    result = decision_engine.evaluate_indicators(indicators=indicators)
    assert "COMBINATION_TECH_SUPPORT_TRIAD" in result.combination_rules_triggered
    assert result.score >= 88.0
    assert result.threat_state == "RED"
    assert result.decision == "INTERVENE"
    assert result.requires_intervention is True
    assert len(result.recommended_actions) >= 2


def test_decision_case_7_payment_plus_impersonation():
    """TEST 7: Impersonation + payment demand triggers combination rule and escalates risk."""
    indicators = [
        ScamIndicator(
            category="IMPERSONATION",
            matched_signal="Police Department",
            severity="HIGH",
            evidence="Police Officer",
            confidence=0.95,
            explanation="Authority claim",
        ),
        ScamIndicator(
            category="PAYMENT_REQUEST",
            matched_signal="gift cards",
            severity="CRITICAL",
            evidence="Target Gift Cards",
            confidence=0.98,
            explanation="Anomalous payment demand",
        ),
    ]
    result = decision_engine.evaluate_indicators(indicators=indicators)
    assert "COMBINATION_IMPERSONATION_AND_PAYMENT" in result.combination_rules_triggered
    assert result.score >= 60.0
    assert result.threat_state in ["ORANGE", "RED"]


def test_decision_case_8_payment_threat_urgency():
    """TEST 8: Payment + Threat + Urgency triggers extortion combination rule."""
    indicators = [
        ScamIndicator(
            category="PAYMENT_REQUEST",
            matched_signal="wire transfer",
            severity="HIGH",
            evidence="wire $5000",
            confidence=0.95,
            explanation="Wire demand",
        ),
        ScamIndicator(
            category="THREAT_INTIMIDATION",
            matched_signal="arrest warrant",
            severity="CRITICAL",
            evidence="arrest warrant",
            confidence=0.99,
            explanation="Arrest threat",
        ),
        ScamIndicator(
            category="URGENCY_PRESSURE",
            matched_signal="within 30 minutes",
            severity="HIGH",
            evidence="30 minutes",
            confidence=0.95,
            explanation="Urgent deadline",
        ),
    ]
    result = decision_engine.evaluate_indicators(indicators=indicators)
    assert "COMBINATION_PAYMENT_THREAT_URGENCY" in result.combination_rules_triggered
    assert result.score >= 75.0
    assert result.threat_state == "RED"
    assert result.requires_intervention is True


def test_decision_case_9_benign_otp_warning():
    """TEST 9: Contextual benign security advice suppresses risk and yields GREEN / ALLOW."""
    ind = ScamIndicator(
        category="BENIGN_SECURITY_ADVICE",
        matched_signal="never share OTP",
        severity="LOW",
        evidence="Never share your OTP with anyone",
        confidence=0.98,
        explanation="Security disclaimer",
    )
    result = decision_engine.evaluate_indicators(indicators=[ind], is_benign_advice=True)
    assert result.score == 0.0
    assert result.threat_state == "GREEN"
    assert result.decision == "ALLOW"
    assert result.requires_intervention is False
    assert "RULE_BENIGN_SECURITY_ADVICE_SUPPRESSION" in result.triggered_rules


def test_decision_case_10_duplicate_indicators_deduplication():
    """TEST 10: Repeated identical indicators within same category do not cause runaway score inflation."""
    repeated_inds = [
        ScamIndicator(
            category="CREDENTIAL_REQUEST",
            matched_signal="OTP",
            severity="HIGH",
            evidence="OTP",
            confidence=0.95,
            explanation="OTP 1",
        ),
        ScamIndicator(
            category="CREDENTIAL_REQUEST",
            matched_signal="OTP",
            severity="HIGH",
            evidence="OTP",
            confidence=0.95,
            explanation="OTP 2",
        ),
        ScamIndicator(
            category="CREDENTIAL_REQUEST",
            matched_signal="OTP",
            severity="HIGH",
            evidence="OTP",
            confidence=0.95,
            explanation="OTP 3",
        ),
        ScamIndicator(
            category="CREDENTIAL_REQUEST",
            matched_signal="OTP",
            severity="HIGH",
            evidence="OTP",
            confidence=0.95,
            explanation="OTP 4",
        ),
        ScamIndicator(
            category="CREDENTIAL_REQUEST",
            matched_signal="OTP",
            severity="HIGH",
            evidence="OTP",
            confidence=0.95,
            explanation="OTP 5",
        ),
    ]
    result = decision_engine.evaluate_indicators(indicators=repeated_inds)
    # Score must be bounded and not 5 * 35.0 = 175
    assert result.score <= 55.0


def test_decision_case_11_score_bounds_guarantee():
    """TEST 11: Score is strictly clamped between 0.0 and 100.0 even with massive indicator volume."""
    massive_indicators = [
        ScamIndicator(
            category=cat,
            matched_signal=f"sig_{i}",
            severity="CRITICAL",
            evidence="ev",
            confidence=0.99,
            explanation="exp",
        )
        for i in range(20)
        for cat in [
            "REMOTE_ACCESS_REQUEST",
            "CREDENTIAL_REQUEST",
            "PAYMENT_REQUEST",
            "IMPERSONATION",
            "THREAT_INTIMIDATION",
            "URGENCY_PRESSURE",
        ]
    ]
    result = decision_engine.evaluate_indicators(indicators=massive_indicators)
    assert 0.0 <= result.score <= 100.0
    assert result.score == 100.0


def test_decision_case_12_determinism():
    """TEST 12: Evaluating identical indicator input produces identical scores, rules, and decisions."""
    indicators = [
        ScamIndicator(
            category="REMOTE_ACCESS_REQUEST",
            matched_signal="AnyDesk",
            severity="HIGH",
            evidence="AnyDesk",
            confidence=0.98,
            explanation="Remote access",
        ),
        ScamIndicator(
            category="CREDENTIAL_REQUEST",
            matched_signal="OTP",
            severity="HIGH",
            evidence="OTP",
            confidence=0.97,
            explanation="OTP",
        ),
    ]
    runs = [decision_engine.evaluate_indicators(indicators=indicators) for _ in range(10)]

    first = runs[0]
    for r in runs[1:]:
        assert r.score == first.score
        assert r.threat_state == first.threat_state
        assert r.decision == first.decision
        assert r.requires_intervention == first.requires_intervention
        assert r.triggered_rules == first.triggered_rules
        assert r.combination_rules_triggered == first.combination_rules_triggered
        assert r.reasons == first.reasons


def test_decision_case_13_rest_api_endpoint(client: TestClient):
    """TEST 13: POST /api/decision endpoint schema and Swagger compatibility."""
    resp = client.post(
        "/api/decision",
        json={
            "indicators": [
                {
                    "category": "REMOTE_ACCESS_REQUEST",
                    "matched_signal": "AnyDesk",
                    "severity": "HIGH",
                    "evidence": "Install AnyDesk",
                    "confidence": 0.98,
                    "explanation": "Remote access request",
                },
                {
                    "category": "CREDENTIAL_REQUEST",
                    "matched_signal": "OTP",
                    "severity": "HIGH",
                    "evidence": "Give me the OTP",
                    "confidence": 0.97,
                    "explanation": "Credential request",
                },
            ],
            "is_benign_advice": False,
            "speaker": "CALLER",
            "turn_index": 2,
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["agent"] == "DecisionEngine"
    assert data["score"] >= 82.0
    assert data["threat_state"] == "RED"
    assert data["decision"] == "INTERVENE"
    assert data["requires_intervention"] is True
    assert "COMBINATION_REMOTE_ACCESS_AND_CREDENTIALS" in data["combination_rules_triggered"]
    assert len(data["reasons"]) >= 3
    assert len(data["triggered_rules"]) >= 3
