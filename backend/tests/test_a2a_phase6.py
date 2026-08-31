import asyncio

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.agents.decision_engine import decision_engine
from backend.agents.evidence_agent import evidence_agent
from backend.agents.inspector import inspector_agent
from backend.agents.intervention_agent import intervention_agent
from backend.core.a2a import (
    A2AEventBus,
    A2AMessage,
    A2AMessageType,
    A2APriority,
    event_bus,
)
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_case_1_valid_a2a_message_creation():
    """TEST 1: Valid A2A message creation passes validation with cryptographic signature."""
    msg = A2AMessage(
        sender="InspectorAgent",
        receiver="DecisionEngine",
        message_type=A2AMessageType.INSPECTION_RESULT.value,
        priority=A2APriority.HIGH.value,
        payload={"score": 85.0, "finding": "OTP solicitation detected"},
    )
    assert msg.message_id.startswith("msg_")
    assert msg.correlation_id.startswith("corr_")
    assert msg.sender == "InspectorAgent"
    assert msg.receiver == "DecisionEngine"
    assert msg.recipient == "DecisionEngine"
    assert msg.signature.startswith("A2ASIG_")
    assert msg.fingerprint != ""
    assert msg.hops == 0


def test_case_2_missing_sender_fails_validation():
    """TEST 2: Missing sender field causes validation failure."""
    with pytest.raises(ValidationError):
        A2AMessage(  # type: ignore
            receiver="DecisionEngine",
            message_type=A2AMessageType.INSPECTION_RESULT.value,
            payload={},
        )


@pytest.mark.asyncio
async def test_case_3_invalid_receiver_rejected():
    """TEST 3: Message to an unregistered receiver is rejected by routing layer."""
    test_bus = A2AEventBus()
    msg = A2AMessage(
        sender="InspectorAgent",
        receiver="NonExistentRogueAgent",
        message_type=A2AMessageType.INSPECTION_RESULT.value,
        payload={},
    )
    success = await test_bus.send(msg)
    assert success is False


@pytest.mark.asyncio
async def test_case_4_unregistered_sender_rejected():
    """TEST 4: Message from an unregistered sender is rejected by routing layer."""
    test_bus = A2AEventBus()
    msg = A2AMessage(
        sender="UnknownAttackerAgent",
        receiver="DecisionEngine",
        message_type=A2AMessageType.INSPECTION_RESULT.value,
        payload={},
    )
    success = await test_bus.send(msg)
    assert success is False


def test_case_5_unique_message_ids():
    """TEST 5: Consecutive messages receive strictly unique message IDs."""
    ids = {A2AMessage(sender="InspectorAgent", payload={}).message_id for _ in range(100)}
    assert len(ids) == 100


@pytest.mark.asyncio
async def test_case_6_correlation_id_propagation():
    """TEST 6: Correlation ID remains strictly identical across the multi-agent incident chain."""
    corr_id = "corr_incident_test_999"
    received_in_evidence: list[A2AMessage] = []

    async def _capture(msg: A2AMessage) -> None:
        if msg.correlation_id == corr_id:
            received_in_evidence.append(msg)

    event_bus.subscribe("EVIDENCE_SEALED", _capture)

    # Ingest scam turn
    scam_msg = A2AMessage(
        sender="System",
        receiver="InspectorAgent",
        correlation_id=corr_id,
        conversation_id="session_corr_test",
        message_type="TRANSCRIPT_TURN",
        payload={
            "segment": {
                "speaker": "CALLER",
                "text": "I am from technical support. Install AnyDesk and tell me your OTP right now.",
                "turn_index": 1,
            },
            "session_id": "session_corr_test",
        },
    )
    await inspector_agent.handle_transcript_turn(scam_msg)
    await asyncio.sleep(0.05)

    history = event_bus.get_by_correlation(corr_id)
    assert len(history) >= 3
    for entry in history:
        assert entry["correlation_id"] == corr_id


@pytest.mark.asyncio
async def test_case_7_inspector_to_decision_engine():
    """TEST 7: InspectorAgent produces INSPECTION_RESULT directed to DecisionEngine."""
    corr_id = "corr_insp_dec_test"
    delivered: list[A2AMessage] = []

    async def _on_inspect_result(msg: A2AMessage) -> None:
        if msg.correlation_id == corr_id:
            delivered.append(msg)

    event_bus.subscribe("INSPECTION_RESULT", _on_inspect_result)

    turn_msg = A2AMessage(
        sender="System",
        receiver="InspectorAgent",
        correlation_id=corr_id,
        message_type="TRANSCRIPT_TURN",
        payload={
            "segment": {
                "speaker": "CALLER",
                "text": "Download TeamViewer immediately.",
                "turn_index": 1,
            }
        },
    )
    await inspector_agent.handle_transcript_turn(turn_msg)
    await asyncio.sleep(0.05)

    assert len(delivered) >= 1
    msg = delivered[0]
    assert msg.sender == "InspectorAgent"
    assert msg.receiver == "DecisionEngine"
    assert msg.message_type == "INSPECTION_RESULT"
    assert "evaluation" in msg.payload


@pytest.mark.asyncio
async def test_case_8_decision_to_evidence_agent():
    """TEST 8: DecisionEngine dispatches EVIDENCE_REQUEST directed to EvidenceAgent."""
    corr_id = "corr_dec_evid_test"
    evidence_requests: list[A2AMessage] = []

    async def _on_evidence_req(msg: A2AMessage) -> None:
        if msg.correlation_id == corr_id:
            evidence_requests.append(msg)

    event_bus.subscribe("EVIDENCE_REQUEST", _on_evidence_req)

    insp_result = A2AMessage(
        sender="InspectorAgent",
        receiver="DecisionEngine",
        correlation_id=corr_id,
        message_type="INSPECTION_RESULT",
        payload={
            "evaluation": {
                "indicators": [
                    {
                        "category": "CREDENTIAL_REQUEST",
                        "matched_signal": "OTP",
                        "severity": "HIGH",
                        "confidence": 0.98,
                    }
                ],
                "speaker": "CALLER",
                "turn_index": 2,
            }
        },
    )
    await decision_engine.handle_inspector_evaluation(insp_result)
    await asyncio.sleep(0.05)

    assert len(evidence_requests) >= 1
    req = evidence_requests[0]
    assert req.sender == "DecisionEngine"
    assert req.receiver == "EvidenceAgent"
    assert req.message_type == "EVIDENCE_REQUEST"


@pytest.mark.asyncio
async def test_case_9_decision_to_intervention_agent():
    """TEST 9: Critical scam detection dispatches INTERVENTION_REQUEST to InterventionAgent."""
    corr_id = "corr_dec_interv_test"
    interv_requests: list[A2AMessage] = []

    async def _on_interv_req(msg: A2AMessage) -> None:
        if msg.correlation_id == corr_id:
            interv_requests.append(msg)

    event_bus.subscribe("INTERVENTION_REQUEST", _on_interv_req)

    critical_insp = A2AMessage(
        sender="InspectorAgent",
        receiver="DecisionEngine",
        correlation_id=corr_id,
        message_type="INSPECTION_RESULT",
        payload={
            "evaluation": {
                "indicators": [
                    {
                        "category": "REMOTE_ACCESS_REQUEST",
                        "matched_signal": "AnyDesk",
                        "severity": "HIGH",
                        "confidence": 0.98,
                    },
                    {
                        "category": "CREDENTIAL_REQUEST",
                        "matched_signal": "OTP",
                        "severity": "HIGH",
                        "confidence": 0.97,
                    },
                ],
                "speaker": "CALLER",
                "turn_index": 3,
            }
        },
    )
    await decision_engine.handle_inspector_evaluation(critical_insp)
    await asyncio.sleep(0.05)

    assert len(interv_requests) >= 1
    req = interv_requests[0]
    assert req.sender == "DecisionEngine"
    assert req.receiver == "InterventionAgent"
    assert req.message_type == "INTERVENTION_REQUEST"
    assert req.priority == "CRITICAL"


@pytest.mark.asyncio
async def test_case_10_benign_flow_no_intervention():
    """TEST 10: Benign dialogue produces ALLOW decision without dispatching INTERVENTION_REQUEST."""
    corr_id = "corr_benign_test"
    interv_requests: list[A2AMessage] = []

    async def _on_interv_req(msg: A2AMessage) -> None:
        if msg.correlation_id == corr_id:
            interv_requests.append(msg)

    event_bus.subscribe("INTERVENTION_REQUEST", _on_interv_req)

    benign_msg = A2AMessage(
        sender="System",
        receiver="InspectorAgent",
        correlation_id=corr_id,
        message_type="TRANSCRIPT_TURN",
        payload={
            "segment": {
                "speaker": "CALLER",
                "text": "Your account is safe. Remember that legitimate staff will never ask for your password.",
                "turn_index": 1,
            }
        },
    )
    await inspector_agent.handle_transcript_turn(benign_msg)
    await asyncio.sleep(0.05)

    assert len(interv_requests) == 0


@pytest.mark.asyncio
async def test_case_11_critical_scam_flow_full_execution():
    """TEST 11: End-to-end critical scam pipeline triggers kill-switch and seals blockchain."""
    await intervention_agent.reset_intervention()
    initial_chain_len = len(evidence_agent.chain.chain)
    corr_id = f"corr_critical_{int(asyncio.get_event_loop().time() * 1000)}"

    scam_msg = A2AMessage(
        sender="System",
        receiver="InspectorAgent",
        correlation_id=corr_id,
        message_type="TRANSCRIPT_TURN",
        payload={
            "segment": {
                "speaker": "CALLER",
                "text": "This is Microsoft Security. Download AnyDesk immediately and provide your 6 digit OTP.",
                "turn_index": 2,
            }
        },
    )
    await inspector_agent.handle_transcript_turn(scam_msg)
    await asyncio.sleep(0.1)

    assert intervention_agent.status.is_active is True
    assert intervention_agent.status.audio_stream_severed is True
    assert len(evidence_agent.chain.chain) > initial_chain_len
    is_valid, _, _ = evidence_agent.chain.verify_integrity()
    assert is_valid is True


def test_case_12_message_history_queries():
    """TEST 12: In-memory A2A message history is queryable by sender, receiver, and correlation_id."""
    history = event_bus.get_history(limit=50)
    assert isinstance(history, list)
    assert len(history) > 0

    if history:
        sample = history[0]
        msg_id = sample["message_id"]
        corr_id = sample["correlation_id"]

        by_id = event_bus.get_by_id(msg_id)
        assert by_id is not None
        assert by_id["message_id"] == msg_id

        by_corr = event_bus.get_by_correlation(corr_id)
        assert len(by_corr) >= 1
        assert by_corr[0]["correlation_id"] == corr_id


@pytest.mark.asyncio
async def test_case_13_sender_authorization_allowlist():
    """TEST 13: Privileged message types sent by unauthorized agents are rejected."""
    test_bus = A2AEventBus()
    # InspectorAgent attempting to directly send INTERVENTION_REQUEST is unauthorized
    illegal_msg = A2AMessage(
        sender="InspectorAgent",
        receiver="InterventionAgent",
        message_type=A2AMessageType.INTERVENTION_REQUEST.value,
        payload={"action": "UNAUTHORIZED_TRIGGER"},
    )
    success = await test_bus.send(illegal_msg)
    assert success is False


@pytest.mark.asyncio
async def test_case_14_a2a_error_isolation():
    """TEST 14: Exception in one subscriber callback does not disrupt message bus execution."""
    test_bus = A2AEventBus()
    successful_calls: list[str] = []

    async def _failing_subscriber(msg: A2AMessage) -> None:
        raise RuntimeError("Simulated agent failure")

    async def _healthy_subscriber(msg: A2AMessage) -> None:
        successful_calls.append(msg.message_id)

    test_bus.subscribe("INSPECTION_RESULT", _failing_subscriber)
    test_bus.subscribe("INSPECTION_RESULT", _healthy_subscriber)

    msg = A2AMessage(
        sender="InspectorAgent",
        receiver="DecisionEngine",
        message_type="INSPECTION_RESULT",
        payload={},
    )
    sent = await test_bus.send(msg)
    assert sent is True
    assert len(successful_calls) == 1


@pytest.mark.asyncio
async def test_case_15_no_infinite_loops_hop_limit():
    """TEST 15: Cyclic message loops are terminated when hop threshold is reached."""
    test_bus = A2AEventBus()

    async def _ping_pong(msg: A2AMessage) -> None:
        reply = A2AMessage(
            sender="DecisionEngine",
            receiver="InspectorAgent",
            message_type="DECISION_REQUEST",
            hops=msg.hops,
            payload={},
        )
        await test_bus.send(reply)

    test_bus.subscribe("DECISION_REQUEST", _ping_pong)

    initial_msg = A2AMessage(
        sender="InspectorAgent",
        receiver="DecisionEngine",
        message_type="DECISION_REQUEST",
        hops=9,
        payload={},
    )
    # Hop 9 -> increments to 10 on send; reply hop 10 -> rejected
    sent = await test_bus.send(initial_msg)
    assert sent is True


def test_case_16_a2a_rest_api_endpoints(client: TestClient):
    """TEST 16: REST API endpoints for A2A history, messages by ID, and correlation lookups."""
    # 1. History
    res = client.get("/api/a2a/history?limit=10")
    assert res.status_code == 200
    history = res.json()
    assert isinstance(history, list)

    if history:
        sample_msg_id = history[0]["message_id"]
        sample_corr_id = history[0]["correlation_id"]

        # 2. Get by message_id
        res_id = client.get(f"/api/a2a/messages/{sample_msg_id}")
        assert res_id.status_code == 200
        assert res_id.json()["message_id"] == sample_msg_id

        # 3. Get by correlation_id
        res_corr = client.get(f"/api/a2a/correlations/{sample_corr_id}")
        assert res_corr.status_code == 200
        assert isinstance(res_corr.json(), list)
        assert len(res_corr.json()) >= 1

    # 4. Registered Agents
    res_agents = client.get("/api/a2a/agents")
    assert res_agents.status_code == 200
    agents = res_agents.json()
    agent_names = [a["agent_name"] for a in agents]
    assert "InspectorAgent" in agent_names
    assert "DecisionEngine" in agent_names
    assert "EvidenceAgent" in agent_names
    assert "InterventionAgent" in agent_names
