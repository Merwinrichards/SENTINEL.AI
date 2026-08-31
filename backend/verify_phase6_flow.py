import asyncio

from backend.agents.evidence_agent import evidence_agent
from backend.agents.inspector import inspector_agent
from backend.agents.intervention_agent import intervention_agent
from backend.core.a2a import A2AMessage, event_bus


async def run_demo():
    print("\n=======================================================")
    print("DEMO: TECH SUPPORT REMOTE ACCESS (Phase 6 A2A Flow)")
    print("=======================================================")

    await intervention_agent.reset_intervention()
    corr_id = "corr_tech_support_demo_123"

    scam_msg = A2AMessage(
        sender="System",
        receiver="InspectorAgent",
        correlation_id=corr_id,
        conversation_id="conv_tech_support",
        message_type="TRANSCRIPT_TURN",
        payload={
            "segment": {
                "speaker": "CALLER",
                "text": "I am from technical support. Your computer has a security issue. Install AnyDesk immediately and give me remote access. Then provide the OTP to verify your account.",
                "turn_index": 1,
            }
        },
    )

    print("\n1. Ingesting Speech-to-Text transcript turn...")
    await inspector_agent.handle_transcript_turn(scam_msg)
    await asyncio.sleep(0.15)

    print("\n2. Traceable A2A Message History (correlation_id = " + corr_id + "):")
    history = event_bus.get_by_correlation(corr_id)
    for i, msg in enumerate(history):
        print(
            f"   Step {i + 1}: [{msg['sender']:18} -> {msg['receiver']:18}] Type: {msg['message_type']:22} | Priority: {msg['priority']:8} | ID: {msg['message_id']}"
        )

    print("\n3. Kill-Switch State:")
    print(f"   Active: {intervention_agent.status.is_active}")
    print(f"   Audio Severed: {intervention_agent.status.audio_stream_severed}")
    print(f"   Trigger Source: {intervention_agent.status.trigger_source}")
    print(f"   Reason: {intervention_agent.status.reason}")

    print("\n4. Cryptographic Evidence Chain Verification:")
    is_valid, fail_idx, fail_reason = evidence_agent.chain.verify_integrity()
    print(f"   Total Chain Blocks: {len(evidence_agent.chain.chain)}")
    print(f"   Is Cryptographically Valid: {is_valid}")
    print(f"   Latest Block Hash: {evidence_agent.chain.latest_block.block_hash}")
    print(f"   Latest Block Event: {evidence_agent.chain.latest_block.event_type}")
    print("=======================================================\n")


if __name__ == "__main__":
    asyncio.run(run_demo())
