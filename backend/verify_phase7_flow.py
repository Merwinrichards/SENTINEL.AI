import asyncio

from fastapi.testclient import TestClient

from backend.agents.inspector import inspector_agent
from backend.agents.intervention_agent import intervention_agent
from backend.core.a2a import A2AMessage
from backend.main import app


async def run_phase7_flow():
    print("\n=======================================================")
    print("DEMO: PHASE 7 INTERVENTION & KILL-SWITCH ORCHESTRATION")
    print("=======================================================")

    client = TestClient(app)

    # 1. Reset / initialize clean state
    await intervention_agent.reset_intervention()
    print("\n1. Initial System State:")
    health = client.get("/api/health").json()
    print(
        f"   Status: {health['status']} | Call State: {health['call_state']} | Kill Switch Active: {health['killswitch_active']}"
    )

    # 2. Ingest Critical Scam Turn in Incident A
    corr_a = "corr_incident_alpha_701"
    print(f"\n2. Ingesting Scam Turn in Incident A (Correlation: {corr_a})...")
    scam_turn = A2AMessage(
        sender="System",
        receiver="InspectorAgent",
        correlation_id=corr_a,
        conversation_id="conv_session_alpha",
        message_type="TRANSCRIPT_TURN",
        payload={
            "segment": {
                "speaker": "CALLER",
                "text": "This is Microsoft Security. Download AnyDesk immediately and provide your 6 digit banking OTP right now.",
                "turn_index": 1,
            }
        },
    )

    await inspector_agent.handle_transcript_turn(scam_turn)
    await asyncio.sleep(0.2)

    # 3. Verify Kill Switch Engagement
    print("\n3. Kill-Switch State After Autonomous Intervention:")
    status = client.get("/api/killswitch/status").json()
    print(f"   Active: {status['is_active']} | Call State: {status['call_state']}")
    print(f"   Trigger Source: {status['trigger_source']}")
    print(f"   Audio Stream Severed: {status['audio_stream_severed']}")
    print(f"   Warning Broadcasted: {status['warning_voice_broadcasted']}")
    print(f"   Fraud Desk Notified: {status['fraud_desk_notified']}")
    print(f"   Reason: {status['reason']}")

    # 4. Verify Evidence Chain
    print("\n4. Cryptographic Evidence Chain Verification:")
    verify = client.post("/api/evidence/verify").json()
    print(f"   Integrity Status: {verify['status']} | Is Valid: {verify['is_valid']}")
    print(f"   Total Chain Blocks: {verify['block_count']}")

    # 5. Idempotent Duplicate Request Test
    print("\n5. Testing Idempotent Secondary Intervention Request...")
    duplicate_res = await intervention_agent.execute_intervention(
        source="DECISION_ENGINE_AUTOMATED",
        reason="Duplicate trigger attempt",
        correlation_id=corr_a,
    )
    print(f"   Outcome on duplicate attempt: {duplicate_res.outcome} (Safe No-Op)")

    # 6. Reset System for Incident B
    print("\n6. Resetting Kill Switch for Incident B...")
    reset_res = client.post("/api/killswitch/reset").json()
    print(
        f"   Reset Status: {reset_res['status']} | New Call State: {reset_res['details']['call_state']}"
    )

    # 7. Start Scenario B with Fresh Context
    corr_b = "corr_incident_beta_702"
    print(f"\n7. Launching Scenario B with Fresh Context (Correlation: {corr_b})...")
    scenario_b_msg = A2AMessage(
        sender="System",
        receiver="ALL",
        correlation_id=corr_b,
        message_type="SCENARIO_STARTED",
        payload={"scenario_id": "bank_fraud_otp_theft"},
    )
    await intervention_agent._handle_scenario_started(scenario_b_msg)
    status_b = client.get("/api/killswitch/status").json()
    print(f"   Scenario B Active: {status_b['is_active']} | Call State: {status_b['call_state']}")
    print(f"   Scenario B Correlation: {status_b['correlation_id']}")

    # 8. Verify Evidence Chain Still Preserved Across Incidents
    print("\n8. Final Evidence Chain Verification Across All Incidents:")
    verify_final = client.post("/api/evidence/verify").json()
    print(f"   Is Valid: {verify_final['is_valid']} | Total Blocks: {verify_final['block_count']}")
    print("=======================================================\n")


if __name__ == "__main__":
    asyncio.run(run_phase7_flow())
