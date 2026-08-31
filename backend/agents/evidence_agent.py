import time

from backend.core.a2a import A2AMessage, event_bus
from backend.core.crypto_chain import EvidenceChain


class EvidenceAgent:
    """
    Evidence Agent: Captures forensic audit telemetry, seals conversational events,
    threat assessments, and intervention records into an immutable SHA-256 evidence chain.
    """

    def __init__(self):
        self.agent_name = "EvidenceAgent"
        self.chain = EvidenceChain()
        self._setup_subscriptions()

    def _setup_subscriptions(self) -> None:
        event_bus.subscribe("EVIDENCE_REQUEST", self.handle_threat_decision)
        event_bus.subscribe("THREAT_DECISION", self.handle_threat_decision)
        event_bus.subscribe("INTERVENTION_RESULT", self.handle_killswitch_executed)
        event_bus.subscribe("KILLSWITCH_EXECUTED", self.handle_killswitch_executed)
        event_bus.subscribe("KILLSWITCH_RESET", self.handle_killswitch_reset)
        event_bus.subscribe("SCENARIO_STARTED", self._handle_session_reset)

    async def _handle_session_reset(self, message: A2AMessage) -> None:
        """Initialize fresh chain for new call session."""
        self.chain = EvidenceChain()
        genesis_block = self.chain.latest_block
        correlation_id = message.correlation_id or f"corr_{int(time.time() * 1000)}"

        await event_bus.send(
            A2AMessage(
                sender=self.agent_name,
                receiver="ALL",
                recipient="ALL",
                correlation_id=correlation_id,
                conversation_id=message.conversation_id,
                message_type="EVIDENCE_SEALED",
                priority="NORMAL",
                payload={
                    "block": genesis_block.model_dump(),
                    "chain_length": len(self.chain.chain),
                    "is_valid": True,
                    "correlation_id": correlation_id,
                },
            )
        )

    async def handle_threat_decision(self, message: A2AMessage) -> None:
        payload = message.payload
        decision = payload.get("decision", {})
        evaluation = payload.get("evaluation", {})
        threat_state = decision.get("current_state", decision.get("threat_state", "GREEN"))
        threat_score = decision.get("threat_score", decision.get("score", 0.0))
        correlation_id = message.correlation_id or payload.get(
            "correlation_id", f"corr_{int(time.time() * 1000)}"
        )

        turn_index = evaluation.get("turn_index", 0)
        should_commit = (
            threat_state in ["YELLOW", "ORANGE", "RED"]
            or turn_index == 1
            or evaluation.get("critical_triggers")
        )

        if should_commit:
            event_type = f"THREAT_ASSESSMENT_{threat_state}"
            block_payload = {
                "turn_index": turn_index,
                "speaker": evaluation.get("speaker", "CALLER"),
                "dialogue_snippet": evaluation.get("dialogue_snippet", ""),
                "composite_risk_score": threat_score,
                "threat_state": threat_state,
                "decision": decision.get("decision", "ALLOW_PASSIVE_MONITORING"),
                "reasons": decision.get("reasons", []),
                "triggered_rules": decision.get("triggered_rules", []),
                "requested_action": evaluation.get("requested_action", "NONE"),
                "critical_triggers": evaluation.get("critical_triggers", []),
                "highlighted_phrases": evaluation.get("highlighted_phrases", []),
                "session_id": payload.get("session_id", message.conversation_id),
                "correlation_id": correlation_id,
            }

            block = self.chain.add_block(
                event_type=event_type,
                agent_source="DecisionEngine/InspectorAgent",
                payload=block_payload,
            )

            is_valid, _, _ = self.chain.verify_integrity()

            await event_bus.send(
                A2AMessage(
                    sender=self.agent_name,
                    receiver="DecisionEngine",
                    recipient="DecisionEngine",
                    correlation_id=correlation_id,
                    conversation_id=message.conversation_id,
                    message_type="EVIDENCE_SEALED",
                    priority="HIGH" if threat_state in ["ORANGE", "RED"] else "NORMAL",
                    payload={
                        "block": block.model_dump(),
                        "chain_length": len(self.chain.chain),
                        "is_valid": is_valid,
                        "correlation_id": correlation_id,
                    },
                )
            )

    async def handle_killswitch_executed(self, message: A2AMessage) -> None:
        """Commit immutable intervention record to chain."""
        payload = message.payload
        correlation_id = message.correlation_id or payload.get(
            "correlation_id", f"corr_{int(time.time() * 1000)}"
        )

        block = self.chain.add_block(
            event_type="ACTIVE_INTERVENTION_KILLSWITCH_ENGAGED",
            agent_source="InterventionAgent",
            payload={
                "trigger_reason": payload.get("reason", "EMERGENCY_INTERVENTION"),
                "timestamp": payload.get("timestamp", time.time()),
                "triggers": payload.get("triggers", []),
                "reasons": payload.get("reasons", []),
                "intervention_status": payload.get("status", {}),
                "synthetic_warning_text": payload.get("synthetic_warning_text", ""),
                "session_id": payload.get("session_id", message.conversation_id),
                "correlation_id": correlation_id,
            },
        )

        is_valid, _, _ = self.chain.verify_integrity()
        await event_bus.send(
            A2AMessage(
                sender=self.agent_name,
                receiver="ALL",
                recipient="ALL",
                correlation_id=correlation_id,
                conversation_id=message.conversation_id,
                message_type="EVIDENCE_SEALED",
                priority="CRITICAL",
                payload={
                    "block": block.model_dump(),
                    "chain_length": len(self.chain.chain),
                    "is_valid": is_valid,
                    "correlation_id": correlation_id,
                },
            )
        )

    async def handle_killswitch_reset(self, message: A2AMessage) -> None:
        """Commit immutable kill-switch reset record to chain."""
        payload = message.payload
        correlation_id = message.correlation_id or payload.get(
            "correlation_id", f"corr_{int(time.time() * 1000)}"
        )

        block = self.chain.add_block(
            event_type="KILLSWITCH_DISARMED_AND_RESET",
            agent_source="InterventionAgent",
            payload={
                "action": "RESET_KILLSWITCH",
                "timestamp": time.time(),
                "status": payload.get("status", {}),
                "correlation_id": correlation_id,
            },
        )

        is_valid, _, _ = self.chain.verify_integrity()
        await event_bus.send(
            A2AMessage(
                sender=self.agent_name,
                receiver="ALL",
                recipient="ALL",
                correlation_id=correlation_id,
                conversation_id=message.conversation_id,
                message_type="EVIDENCE_SEALED",
                priority="NORMAL",
                payload={
                    "block": block.model_dump(),
                    "chain_length": len(self.chain.chain),
                    "is_valid": is_valid,
                    "correlation_id": correlation_id,
                },
            )
        )


# Global Evidence Agent instance
evidence_agent = EvidenceAgent()
