import pytest
from fastapi.testclient import TestClient

from backend.agents.decision_engine import decision_engine
from backend.agents.evidence_agent import evidence_agent
from backend.agents.inspector import inspector_agent
from backend.agents.intervention_agent import intervention_agent
from backend.core.crypto_chain import EvidenceChain
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_crypto_chain_valid_creation():
    """Verify clean evidence chain initialization and sequential block sealing."""
    chain = EvidenceChain()
    assert len(chain.chain) == 1
    genesis = chain.chain[0]
    assert genesis.index == 0
    assert genesis.prev_hash == "0" * 64
    assert genesis.event_type == "GENESIS"

    # Add block 1
    b1 = chain.add_block(
        event_type="THREAT_ASSESSMENT_YELLOW",
        agent_source="DecisionEngine",
        payload={"turn": 1, "threat_score": 45.0, "speaker": "CALLER"},
    )
    assert b1.index == 1
    assert b1.prev_hash == genesis.block_hash
    assert len(chain.chain) == 2

    # Add block 2
    b2 = chain.add_block(
        event_type="ACTIVE_INTERVENTION_KILLSWITCH_ENGAGED",
        agent_source="InterventionAgent",
        payload={"reason": "CRITICAL_THREAT", "triggers": ["AnyDesk remote access"]},
    )
    assert b2.index == 2
    assert b2.prev_hash == b1.block_hash
    assert len(chain.chain) == 3

    # Verification
    is_valid, fail_idx, reason = chain.verify_integrity()
    assert is_valid is True
    assert fail_idx is None
    assert reason is None


def test_tampered_payload_detection():
    """Verify tamper detection when internal block payload is modified without recalculating hash."""
    chain = EvidenceChain()
    chain.add_block("EVENT_A", "AgentA", {"msg": "original 1"})
    chain.add_block("EVENT_B", "AgentB", {"msg": "original 2"})

    is_valid_before, _, _ = chain.verify_integrity()
    assert is_valid_before is True

    # Tamper with block 1
    tampered = chain.tamper_block_for_test(
        block_index=1,
        field_to_alter="msg",
        malicious_value="MALICIOUS_MODIFIED_PAYLOAD",
        target_property="payload",
    )
    assert tampered is True

    # Verification must flag block 1
    is_valid, fail_idx, reason = chain.verify_integrity()
    assert is_valid is False
    assert fail_idx == 1
    assert "internal hash compromised" in reason.lower() or "modified" in reason.lower()

    # Repair should restore integrity
    chain.repair_chain_recalculate()
    is_valid_repaired, _, _ = chain.verify_integrity()
    assert is_valid_repaired is True


def test_tampered_current_hash_detection():
    """Verify tamper detection when stored block hash is manually altered."""
    chain = EvidenceChain()
    chain.add_block("EVENT_A", "AgentA", {"data": "test"})
    chain.add_block("EVENT_B", "AgentB", {"data": "test2"})

    # Tamper block_hash of block 2
    chain.tamper_block_for_test(
        block_index=2,
        target_property="block_hash",
        malicious_value="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    )

    is_valid, fail_idx, reason = chain.verify_integrity()
    assert is_valid is False
    assert fail_idx == 2
    assert "compromised" in reason.lower() or "signature" in reason.lower()


def test_broken_prev_hash_linkage_detection():
    """Verify detection when previous hash link between blocks is broken."""
    chain = EvidenceChain()
    chain.add_block("EVENT_1", "Agent1", {"step": 1})
    chain.add_block("EVENT_2", "Agent2", {"step": 2})

    # Tamper prev_hash of block 2
    chain.tamper_block_for_test(
        block_index=2,
        target_property="prev_hash",
        malicious_value="ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    )

    is_valid, fail_idx, reason = chain.verify_integrity()
    assert is_valid is False
    assert fail_idx == 2
    assert "hash link broken" in reason.lower()


def test_inspector_and_decision_engine_transparent_flow():
    """Verify InspectorAgent extracts signals and DecisionEngine produces explainable reasons and rules."""
    scam_text = "Press Windows Key and R on your keyboard right now. Type 'www.anydesk.com' and give me the 9-digit remote access ID."

    # 1. Inspector evaluation
    evaluation = inspector_agent.evaluate_text(scam_text, speaker="CALLER", turn_index=5)
    assert evaluation.composite_risk_score >= 85.0
    assert evaluation.active_threat_level == "RED"
    assert evaluation.requested_action == "DOWNLOAD_REMOTE_ACCESS_SOFTWARE"
    assert len(evaluation.suspicious_indicators) > 0
    assert any("anydesk" in ind.lower() for ind in evaluation.suspicious_indicators)
    assert len(evaluation.critical_triggers) > 0

    # 2. Decision engine evaluation
    state = decision_engine.evaluate_state_transition(
        threat_score=evaluation.composite_risk_score, critical_triggers=evaluation.critical_triggers
    )
    assert state == "RED"


@pytest.mark.asyncio
async def test_killswitch_trigger_and_reset_flow():
    """Verify manual killswitch engagement and reset cycle updates state and commits to evidence chain."""
    await intervention_agent.reset_intervention()
    # 1. Manual trigger
    init_chain_len = len(evidence_agent.chain.chain)
    status_engaged = await intervention_agent.execute_intervention(
        source="MANUAL_OPERATOR",
        reason="MANUAL_OPERATOR_INTERVENTION",
        triggers=["Operator manual emergency override"],
    )
    assert status_engaged.is_active is True
    assert status_engaged.audio_stream_severed is True
    assert status_engaged.reason == "MANUAL_OPERATOR_INTERVENTION"

    # Evidence block committed
    assert len(evidence_agent.chain.chain) == init_chain_len + 1
    last_block = evidence_agent.chain.latest_block
    assert last_block.event_type == "ACTIVE_INTERVENTION_KILLSWITCH_ENGAGED"

    # 2. Reset killswitch
    status_reset = await intervention_agent.reset_intervention()
    assert status_reset.is_active is False
    assert intervention_agent.status.is_active is False

    # Reset evidence block committed
    assert len(evidence_agent.chain.chain) == init_chain_len + 2
    reset_block = evidence_agent.chain.latest_block
    assert reset_block.event_type == "KILLSWITCH_DISARMED_AND_RESET"

    # Chain remains 100% valid
    is_valid, _, _ = evidence_agent.chain.verify_integrity()
    assert is_valid is True


def test_api_health_endpoint(client: TestClient):
    """Test GET /api/health endpoint structure and fields."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"
    assert data["system"] == "SENTINEL AI"
    assert data["version"] == "1.0.0"
    assert "threat_state" in data
    assert "highest_score" in data
    assert "evidence_blocks" in data
    assert data["chain_cryptographically_valid"] is True
    assert isinstance(data["killswitch_active"], bool)


def test_api_evidence_chain_and_verify(client: TestClient):
    """Test GET /api/evidence/chain and POST /api/evidence/verify."""
    # Chain retrieval
    chain_resp = client.get("/api/evidence/chain")
    assert chain_resp.status_code == 200
    chain_data = chain_resp.json()
    assert chain_data["is_valid"] is True
    assert chain_data["failing_block_index"] is None
    assert chain_data["block_count"] >= 1
    assert len(chain_data["chain"]) == chain_data["block_count"]

    # Verify endpoint
    verify_resp = client.post("/api/evidence/verify")
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["is_valid"] is True
    assert verify_data["failing_block_index"] is None
    assert verify_data["status"] == "CHAIN_INTEGRITY_VERIFIED"


def test_api_killswitch_trigger_and_reset(client: TestClient):
    """Test POST /api/killswitch/trigger and POST /api/killswitch/reset via REST API."""
    client.post("/api/killswitch/reset")
    # Trigger
    trig_resp = client.post(
        "/api/killswitch/trigger", json={"reason": "MANUAL_OPERATOR_INTERVENTION"}
    )
    assert trig_resp.status_code == 200
    trig_data = trig_resp.json()
    assert trig_data["status"] == "ENGAGED"
    assert trig_data["details"]["is_active"] is True
    assert trig_data["details"]["reason"] == "MANUAL_OPERATOR_INTERVENTION"

    # Reset
    reset_resp = client.post("/api/killswitch/reset")
    assert reset_resp.status_code == 200
    reset_data = reset_resp.json()
    assert reset_data["status"] == "RESET"
    assert reset_data["details"]["is_active"] is False


def test_api_tamper_and_repair_demonstration(client: TestClient):
    """Test POST /api/evidence/tamper-test detects violation and POST /api/evidence/repair restores chain."""
    # Run tamper test on genesis block or block 0
    tamper_resp = client.post(
        "/api/evidence/tamper-test",
        json={
            "block_index": 0,
            "field": "title",
            "malicious_value": "MALICIOUS_ADVERSARY_MODIFICATION",
        },
    )
    assert tamper_resp.status_code == 200
    tamper_data = tamper_resp.json()
    assert tamper_data["status"] == "TAMPER_SIMULATION_EXECUTED"
    assert tamper_data["is_valid_after_tamper"] is False
    assert tamper_data["detected_failure_block"] == 0

    # Verify endpoint must report violation
    verify_resp = client.post("/api/evidence/verify")
    assert verify_resp.status_code == 200
    assert verify_resp.json()["is_valid"] is False
    assert verify_resp.json()["status"] == "TAMPERING_OR_CORRUPTION_DETECTED"

    # Repair chain
    repair_resp = client.post("/api/evidence/repair")
    assert repair_resp.status_code == 200
    assert repair_resp.json()["status"] == "CHAIN_REPAIRED"
    assert repair_resp.json()["is_valid"] is True

    # Verify endpoint must report verified
    verify_resp_2 = client.post("/api/evidence/verify")
    assert verify_resp_2.status_code == 200
    assert verify_resp_2.json()["is_valid"] is True
    assert verify_resp_2.json()["status"] == "CHAIN_INTEGRITY_VERIFIED"
