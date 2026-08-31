import asyncio

import pytest
from fastapi.testclient import TestClient

from backend.agents.intervention_agent import intervention_agent
from backend.core.a2a import A2AMessage, event_bus
from backend.engine.stt_engine import stt_engine
from backend.main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
async def reset_state():
    await intervention_agent.reset_intervention()
    stt_engine.stop_scenario()
    stt_engine.reset_session()
    yield
    stt_engine.stop_scenario()
    await intervention_agent.reset_intervention()


def test_speech_engine_is_registered_in_a2a_registry():
    """Verify that SpeechEngine is properly registered in A2A registry and authorized."""
    assert event_bus.registry.is_registered("SpeechEngine") is True
    assert event_bus.registry.is_registered("SpeechToTextEngine") is True
    assert event_bus.registry.is_registered("InspectorAgent") is True
    assert event_bus.registry.is_registered("DecisionEngine") is True
    assert event_bus.registry.is_registered("EvidenceAgent") is True
    assert event_bus.registry.is_registered("InterventionAgent") is True
    assert event_bus.registry.is_registered("Orchestrator") is True
    assert event_bus.registry.is_registered("MANUAL_OPERATOR") is True

    # Authorization checks
    assert event_bus.is_authorized("SpeechEngine", "TRANSCRIPT_TURN") is True
    assert event_bus.is_authorized("SpeechEngine", "SCENARIO_STARTED") is True
    assert event_bus.is_authorized("SpeechEngine", "SCENARIO_COMPLETED") is True


@pytest.mark.asyncio
async def test_live_turn_a2a_delivery_and_multiagent_flow():
    """Verify that ingest_live_segment successfully publishes TRANSCRIPT_TURN without rejection."""
    transcript_events: list[A2AMessage] = []

    async def on_turn(msg: A2AMessage):
        transcript_events.append(msg)

    event_bus.subscribe("TRANSCRIPT_TURN", on_turn)

    segment = await stt_engine.ingest_live_segment(
        speaker="CALLER",
        text="Hello, I am calling from your bank security department.",
        confidence=0.98,
    )

    assert segment.text == "Hello, I am calling from your bank security department."
    assert segment.turn_index == 1
    assert len(stt_engine.rolling_transcript) == 1

    # Allow event bus async dispatch
    await asyncio.sleep(0.05)

    assert len(transcript_events) >= 1
    assert transcript_events[0].sender == "SpeechEngine"
    assert transcript_events[0].message_type == "TRANSCRIPT_TURN"
    assert transcript_events[0].payload["segment"]["text"] == segment.text


def test_start_scenario_api_endpoint(client: TestClient):
    """Verify that POST /api/scenarios/start initiates playback cleanly."""
    res = client.post(
        "/api/scenarios/start",
        json={"scenario_id": "bank_otp_scam", "speed_multiplier": 5.0},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "STARTED"
    assert data["scenario_id"] == "bank_otp_scam"


def test_start_invalid_scenario_returns_404(client: TestClient):
    """Verify that unknown scenario returns 404."""
    res = client.post(
        "/api/scenarios/start",
        json={"scenario_id": "non_existent_scenario", "speed_multiplier": 1.0},
    )
    assert res.status_code == 404


def test_direct_sentence_input_analyze_endpoint(client: TestClient):
    """Verify that the direct sentence input from Live Demo processes through the full pipeline."""
    sentence = "Hello, I'm calling from your bank security department. We detected suspicious activity on your account."
    res = client.post(
        "/api/analyze",
        json={
            "text": sentence,
            "speaker": "CALLER",
            "session_id": "live-demo-sentence-test",
            "turn_index": 1,
            "auto_intervene": True,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["original_text"] == sentence
    assert any(i["category"] == "IMPERSONATION" for i in data["inspection"]["indicators"])
    assert data["decision"]["score"] >= 10.0
    assert data["decision"]["threat_state"] in ["GREEN", "YELLOW", "ORANGE", "RED"]


def test_websocket_receives_initial_state_and_turn_broadcast(client: TestClient):
    """Verify WebSocket connection and real-time event broadcasting."""
    with client.websocket_connect("/ws/call-stream") as ws:
        # Receive initial state
        initial_msg = ws.receive_json()
        assert initial_msg["event"] == "INITIAL_STATE"
        assert "threat_state" in initial_msg["data"]
        assert "highest_score" in initial_msg["data"]

        # Send live turn via REST API and verify WS receives broadcast
        post_res = client.post(
            "/api/live/turn",
            json={
                "text": "This is a real-time WebSocket test turn.",
                "speaker": "CALLER",
                "confidence": 0.99,
                "session_id": "ws-test-sess",
                "turn_index": 1,
            },
        )
        assert post_res.status_code == 200

        # Receive broadcasted events over WebSocket
        received_events = []
        for _ in range(5):
            try:
                msg = ws.receive_json(mode="text")
                received_events.append(msg["event"])
                if "TRANSCRIPT_UPDATE" in received_events and "INSPECTOR_UPDATE" in received_events:
                    break
            except Exception:
                break

        assert "A2A_MESSAGE" in received_events or "TRANSCRIPT_UPDATE" in received_events


@pytest.mark.asyncio
async def test_bank_otp_scam_full_three_turn_escalation_to_killswitch():
    """Verify that bank_otp_scam demonstrates the complete 3-turn attack escalation."""
    from backend.agents.decision_engine import decision_engine
    from backend.agents.inspector import inspector_agent
    from backend.engine.scenarios import SCENARIOS

    scenario = SCENARIOS["bank_otp_scam"]
    assert len(scenario.dialogue) == 3

    session_id = "test-bank-otp-3turn-session"
    await decision_engine._reset_state()

    # Turn 1: Impersonation of bank security -> GREEN / ALLOW
    turn1 = scenario.dialogue[0]
    insp1 = inspector_agent.inspect(turn1.text, turn1.speaker, session_id, turn1.turn_id)
    dec1 = decision_engine.evaluate_indicators(
        insp1.indicators, insp1.is_benign_advice, turn1.speaker, session_id, turn1.turn_id
    )
    assert dec1.threat_state == "GREEN"
    assert dec1.decision == "ALLOW"
    assert dec1.requires_intervention is False
    assert 10.0 <= dec1.threat_score <= 35.0

    # Turn 2: OTP request -> ORANGE / WARN (elevated warning, audio line remains open)
    turn2 = scenario.dialogue[1]
    insp2 = inspector_agent.inspect(turn2.text, turn2.speaker, session_id, turn2.turn_id)
    dec2 = decision_engine.evaluate_indicators(
        insp2.indicators, insp2.is_benign_advice, turn2.speaker, session_id, turn2.turn_id
    )
    assert dec2.threat_state == "ORANGE"
    assert dec2.decision == "WARN"
    assert dec2.requires_intervention is False
    assert 40.0 <= dec2.threat_score <= 70.0

    # Turn 3: Urgency pressure & account threat -> RED / INTERVENE (Kill-switch triggered!)
    turn3 = scenario.dialogue[2]
    insp3 = inspector_agent.inspect(turn3.text, turn3.speaker, session_id, turn3.turn_id)
    dec3 = decision_engine.evaluate_indicators(
        insp3.indicators, insp3.is_benign_advice, turn3.speaker, session_id, turn3.turn_id
    )
    assert dec3.threat_state == "RED"
    assert dec3.decision == "INTERVENE"
    assert dec3.requires_intervention is True
    assert dec3.threat_score >= 85.0
    assert "COMBINATION_URGENCY_AND_CREDENTIALS" in dec3.combination_rules_triggered


@pytest.mark.asyncio
async def test_arbitrary_unseen_speech_sentence_dynamic_scoring():
    """Verify that arbitrary live speech is analyzed dynamically without any scenario context."""
    from backend.agents.decision_engine import decision_engine
    from backend.agents.inspector import inspector_agent

    arbitrary_sentence = (
        "I am calling from your bank security team. Your account has suspicious activity. "
        "Tell me the OTP immediately or your account will be blocked."
    )
    session_id = "test-arbitrary-live-session"
    await decision_engine._reset_state()

    insp = inspector_agent.inspect(arbitrary_sentence, "CALLER", session_id, 1)
    dec = decision_engine.evaluate_indicators(
        insp.indicators, insp.is_benign_advice, "CALLER", session_id, 1
    )

    assert dec.threat_state == "RED"
    assert dec.decision == "INTERVENE"
    assert dec.requires_intervention is True
    assert dec.threat_score >= 85.0
    assert "COMBINATION_URGENCY_AND_CREDENTIALS" in dec.combination_rules_triggered


@pytest.mark.asyncio
async def test_session_reset_purity_flow():
    """Verify that START -> INTERVENTION -> RESET -> START produces a completely clean state."""
    from backend.agents.decision_engine import decision_engine
    from backend.agents.inspector import inspector_agent
    from backend.agents.intervention_agent import intervention_agent
    from backend.engine.stt_engine import stt_engine

    # 1. Simulate incident
    await decision_engine._reset_state()
    stt_engine.reset_session()
    inspector_agent.reset_state()
    await intervention_agent.reset_intervention()

    # Trigger mock intervention
    await intervention_agent.execute_intervention(
        source="DECISION_ENGINE_AUTOMATED",
        reason="CRITICAL_THREAT_THRESHOLD_EXCEEDED",
        triggers=["Simulated test trigger"],
    )
    assert intervention_agent.status.is_active is True

    # 2. Reset
    stt_engine.stop_scenario()
    stt_engine.reset_session()
    inspector_agent.reset_state()
    await decision_engine._reset_state()
    status = await intervention_agent.reset_intervention()

    assert status.is_active is False
    assert decision_engine.current_state == "GREEN"
    assert decision_engine.highest_threat_score == 0.0
    assert len(decision_engine._session_indicators) == 0
    assert len(stt_engine.rolling_transcript) == 0
    assert stt_engine.is_streaming is False



