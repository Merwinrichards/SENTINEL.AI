import logging
import time
from datetime import UTC, datetime

from pydantic import BaseModel, Field

from backend.agents.inspector import ScamIndicator
from backend.core.a2a import A2AMessage, event_bus
from backend.core.config import settings

logger = logging.getLogger("sentinel.decision_engine")


class DecisionAction(BaseModel):
    action_type: str  # "LOG_PASSIVE", "ALERT_BANNER", "EARPIECE_VOICE_WARNING", "ARM_KILLSWITCH", "EXECUTE_KILLSWITCH"
    recommended: bool
    urgency: str  # "INFO", "WARN", "CRITICAL"
    reasoning: str


class DecisionResult(BaseModel):
    agent: str = "DecisionEngine"
    decision_id: str
    timestamp: float
    iso_time: str
    score: float = 0.0
    threat_score: float = 0.0  # Backward compatibility
    threat_state: str = "GREEN"  # "GREEN", "YELLOW", "ORANGE", "RED"
    current_state: str = "GREEN"  # Backward compatibility
    previous_state: str = "GREEN"
    decision: str = (
        "ALLOW"  # "ALLOW", "MONITOR", "WARN", "INTERVENE", "EXECUTE_KILLSWITCH_SEVERANCE"
    )
    requires_intervention: bool = False
    automated_intervention_triggered: bool = False  # Backward compatibility
    confidence: float = 0.95
    reasons: list[str] = Field(default_factory=list)
    triggered_rules: list[str] = Field(default_factory=list)
    combination_rules_triggered: list[str] = Field(default_factory=list)
    critical_triggers_active: bool = False
    recommended_actions: list[DecisionAction] = Field(default_factory=list)
    event_type: str = "THREAT_DECISION_EVALUATION"
    source: str = "DecisionEngine"


class CombinationRule(BaseModel):
    rule_id: str
    categories: set[str]
    score_adjustment: float
    reason: str


class DecisionEngineAgent:
    """
    Decision Engine: Evaluates Inspector signals, executes deterministic scoring,
    evaluates high-risk indicator combinations, determines threat states,
    and produces explainable defense directives without directly executing the kill switch.
    """

    def __init__(self):
        self.agent_name = "DecisionEngine"
        self.current_state = "GREEN"
        self.previous_state = "GREEN"
        self.highest_threat_score = 0.0
        self._session_indicators: dict[str, list[ScamIndicator]] = {}
        self.combination_rules: list[CombinationRule] = []
        self._setup_combination_rules()
        self._setup_subscriptions()

    def _setup_subscriptions(self) -> None:
        event_bus.subscribe("INSPECTOR_EVALUATION", self.handle_inspector_evaluation)
        event_bus.subscribe("INSPECTION_RESULT", self.handle_inspector_evaluation)
        event_bus.subscribe("DECISION_REQUEST", self.handle_inspector_evaluation)
        event_bus.subscribe("SCENARIO_STARTED", self._reset_state)
        event_bus.subscribe("KILLSWITCH_RESET", self._reset_state)

    async def _reset_state(self, message: A2AMessage | None = None) -> None:
        self.current_state = "GREEN"
        self.previous_state = "GREEN"
        self.highest_threat_score = 0.0
        self._session_indicators.clear()

    def evaluate_state_transition(
        self, threat_score: float, critical_triggers: list[str] | None = None
    ) -> str:
        """Evaluate state machine transitions (backward compatible)."""
        triggers = critical_triggers or []
        if threat_score >= settings.THRESHOLD_RED or len(triggers) >= 1:
            return "RED"
        elif threat_score >= settings.THRESHOLD_ORANGE:
            return "ORANGE"
        elif threat_score >= settings.THRESHOLD_YELLOW:
            return "YELLOW"
        else:
            return "GREEN"

    def _setup_combination_rules(self) -> None:
        """Define explicit multi-vector combination escalation rules."""
        self.combination_rules = [
            CombinationRule(
                rule_id="COMBINATION_TECH_SUPPORT_TRIAD",
                categories={"IMPERSONATION", "REMOTE_ACCESS_REQUEST", "CREDENTIAL_REQUEST"},
                score_adjustment=30.0,
                reason="Full Tech Support Scam Triad: Impersonation combined with remote device control and credential harvesting.",
            ),
            CombinationRule(
                rule_id="COMBINATION_REMOTE_ACCESS_AND_CREDENTIALS",
                categories={"REMOTE_ACCESS_REQUEST", "CREDENTIAL_REQUEST"},
                score_adjustment=25.0,
                reason="Critical Threat Synergy: Remote desktop takeover request combined with 2FA/credential solicitation.",
            ),
            CombinationRule(
                rule_id="COMBINATION_PAYMENT_THREAT_URGENCY",
                categories={"PAYMENT_REQUEST", "THREAT_INTIMIDATION", "URGENCY_PRESSURE"},
                score_adjustment=30.0,
                reason="Aggressive Extortion Pattern: Coerced financial transfer enforced by legal/arrest threats and extreme urgency.",
            ),
            CombinationRule(
                rule_id="COMBINATION_IMPERSONATION_AND_PAYMENT",
                categories={"IMPERSONATION", "PAYMENT_REQUEST"},
                score_adjustment=20.0,
                reason="Authority Impersonation combined with abnormal payment or gift card demand.",
            ),
            CombinationRule(
                rule_id="COMBINATION_URGENCY_AND_CREDENTIALS",
                categories={"URGENCY_PRESSURE", "CREDENTIAL_REQUEST"},
                score_adjustment=15.0,
                reason="Panic Coercion combined with credential or OTP interception.",
            ),
        ]

    def evaluate_indicators(
        self,
        indicators: list[ScamIndicator],
        is_benign_advice: bool = False,
        speaker: str = "CALLER",
        session_id: str | None = None,
        turn_index: int = 1,
    ) -> DecisionResult:
        """
        Primary Phase 5 Decision Method.
        Consumes structured indicators, executes deterministic scoring & combination rules,
        and outputs explainable decision result.
        """
        now = time.time()
        reasons: list[str] = []
        triggered_rules: list[str] = []
        combination_rules_triggered: list[str] = []
        critical_triggers: list[str] = []

        # 1. Handle Benign Educational / Defensive Context
        if is_benign_advice or any(ind.category == "BENIGN_SECURITY_ADVICE" for ind in indicators):
            existing_session_inds = self._session_indicators.get(session_id, []) if session_id else []
            if not existing_session_inds:
                return DecisionResult(
                    agent=self.agent_name,
                    decision_id=f"dec_{int(now * 1000)}",
                    timestamp=now,
                    iso_time=datetime.now(UTC).isoformat(),
                    score=0.0,
                    threat_score=0.0,
                    threat_state="GREEN",
                    current_state="GREEN",
                    previous_state=self.current_state,
                    decision="ALLOW",
                    requires_intervention=False,
                    automated_intervention_triggered=False,
                    confidence=0.98,
                    reasons=[
                        "Context recognized as benign educational guidance or defensive security disclaimer (e.g. 'Never share your OTP').",
                        "No affirmative fraud solicitation detected. Continuous passive monitoring active.",
                    ],
                    triggered_rules=["RULE_BENIGN_SECURITY_ADVICE_SUPPRESSION"],
                    combination_rules_triggered=[],
                    critical_triggers_active=False,
                    recommended_actions=[
                        DecisionAction(
                            action_type="LOG_PASSIVE",
                            recommended=True,
                            urgency="INFO",
                            reasoning="Benign educational conversation. No protective action required.",
                        )
                    ],
                    event_type="THREAT_DECISION_EVALUATION",
                    source=self.agent_name,
                )

        # Multi-turn session indicator accumulation
        eval_indicators = list(indicators)
        if session_id:
            existing = self._session_indicators.setdefault(session_id, [])
            for ind in indicators:
                if not any(
                    e.category == ind.category and e.matched_signal == ind.matched_signal
                    for e in existing
                ):
                    existing.append(ind)
            eval_indicators = existing

        # 2. Handle Empty Indicator Case
        if not eval_indicators:
            return DecisionResult(
                agent=self.agent_name,
                decision_id=f"dec_{int(now * 1000)}",
                timestamp=now,
                iso_time=datetime.now(UTC).isoformat(),
                score=0.0,
                threat_score=0.0,
                threat_state="GREEN",
                current_state="GREEN",
                previous_state=self.current_state,
                decision="ALLOW",
                requires_intervention=False,
                automated_intervention_triggered=False,
                confidence=0.95,
                reasons=[
                    "No suspicious scam indicators detected. Conversation conforms to normal baseline."
                ],
                triggered_rules=["RULE_BASELINE_NORMAL"],
                combination_rules_triggered=[],
                critical_triggers_active=False,
                recommended_actions=[
                    DecisionAction(
                        action_type="LOG_PASSIVE",
                        recommended=True,
                        urgency="INFO",
                        reasoning="Conversation parameters within normal baseline. Continuous monitoring active.",
                    )
                ],
                event_type="THREAT_DECISION_EVALUATION",
                source=self.agent_name,
            )

        # 3. Deterministic Category Weighting with Controlled Deduplication
        base_category_weights = {
            "REMOTE_ACCESS_REQUEST": 35.0,
            "CREDENTIAL_REQUEST": 35.0,
            "PAYMENT_REQUEST": 25.0,
            "THREAT_INTIMIDATION": 20.0,
            "IMPERSONATION": 15.0,
            "URGENCY_PRESSURE": 12.0,
            "SUSPICIOUS_LINK_ACTION": 10.0,
        }

        category_counts: dict[str, int] = {}
        calculated_score = 0.0

        for ind in eval_indicators:
            cat = ind.category
            category_counts[cat] = category_counts.get(cat, 0) + 1
            count = category_counts[cat]

            if count == 1:
                # First indicator in this category gets full weight
                weight = base_category_weights.get(cat, 10.0)
                calculated_score += weight
                triggered_rules.append(f"RULE_DETECTED_{cat}")
                reasons.append(
                    f"Detected {cat.replace('_', ' ').title()}: '{ind.matched_signal}' ({ind.explanation})"
                )
            else:
                # Deduplication: Repeated indicators within same category contribute diminishing increments
                diminishing_increment = min(3.0, base_category_weights.get(cat, 10.0) * 0.10)
                calculated_score += diminishing_increment

            if ind.severity == "CRITICAL":
                critical_triggers.append(f"CRITICAL_{ind.category}: {ind.matched_signal}")

        # 4. Evaluate Multi-Vector Combination Escalation Rules
        detected_categories = set(category_counts.keys())
        for rule in self.combination_rules:
            if rule.categories.issubset(detected_categories):
                calculated_score += rule.score_adjustment
                combination_rules_triggered.append(rule.rule_id)
                triggered_rules.append(f"RULE_{rule.rule_id}")
                reasons.append(f"Combination Escalation: {rule.reason}")

        raw_final_score = min(100.0, max(0.0, round(calculated_score, 1)))

        # Update running state
        self.highest_threat_score = max(self.highest_threat_score, raw_final_score)
        self.previous_state = self.current_state

        # 6. Map Score to Threat State
        if (
            raw_final_score >= settings.THRESHOLD_RED
            or len(combination_rules_triggered) >= 2
        ):
            threat_state = "RED"
        elif (
            raw_final_score >= settings.THRESHOLD_ORANGE
            or len(critical_triggers) >= 1
            or len(combination_rules_triggered) >= 1
        ):
            threat_state = "ORANGE"
        elif raw_final_score >= settings.THRESHOLD_YELLOW:
            threat_state = "YELLOW"
        else:
            threat_state = "GREEN"

        self.current_state = threat_state

        # 7. Map Threat State to Decision & Actions Policy
        actions: list[DecisionAction] = []
        requires_intervention = False

        if threat_state == "GREEN":
            decision_label = "ALLOW"
            actions.append(
                DecisionAction(
                    action_type="LOG_PASSIVE",
                    recommended=True,
                    urgency="INFO",
                    reasoning="Conversation parameters within normal baseline. Continuous monitoring active.",
                )
            )

        elif threat_state == "YELLOW":
            decision_label = "MONITOR"
            actions.append(
                DecisionAction(
                    action_type="ALERT_BANNER",
                    recommended=True,
                    urgency="WARN",
                    reasoning="Elevated conversational anomalies detected. Visual advisory banner primed on dashboard.",
                )
            )

        elif threat_state == "ORANGE":
            decision_label = "WARN"
            actions.append(
                DecisionAction(
                    action_type="EARPIECE_VOICE_WARNING",
                    recommended=True,
                    urgency="WARN",
                    reasoning="Severe social engineering patterns identified. Defensive earpiece voice advisory prepared.",
                )
            )
            actions.append(
                DecisionAction(
                    action_type="ARM_KILLSWITCH",
                    recommended=True,
                    urgency="WARN",
                    reasoning="Emergency kill-switch armed in automated standby.",
                )
            )

        elif threat_state == "RED":
            decision_label = "INTERVENE"
            requires_intervention = True
            actions.append(
                DecisionAction(
                    action_type="EXECUTE_KILLSWITCH",
                    recommended=True,
                    urgency="CRITICAL",
                    reasoning=f"Critical threat confirmed ({raw_final_score}/100). Line termination and immediate audio severance required.",
                )
            )
            actions.append(
                DecisionAction(
                    action_type="EARPIECE_VOICE_WARNING",
                    recommended=True,
                    urgency="CRITICAL",
                    reasoning="Immediate defensive voice intervention broadcasted to protect victim.",
                )
            )

        # 8. Dynamic Confidence Calculation
        avg_ind_conf = sum(ind.confidence for ind in indicators) / max(1, len(indicators))
        cat_diversity_boost = min(0.04, 0.01 * len(detected_categories))
        confidence = min(0.99, max(0.50, round(avg_ind_conf + cat_diversity_boost, 2)))

        return DecisionResult(
            agent=self.agent_name,
            decision_id=f"dec_{int(now * 1000)}",
            timestamp=now,
            iso_time=datetime.now(UTC).isoformat(),
            score=raw_final_score,
            threat_score=raw_final_score,
            threat_state=threat_state,
            current_state=threat_state,
            previous_state=self.previous_state,
            decision=decision_label,
            requires_intervention=requires_intervention,
            automated_intervention_triggered=requires_intervention,
            confidence=confidence,
            reasons=reasons,
            triggered_rules=triggered_rules,
            combination_rules_triggered=combination_rules_triggered,
            critical_triggers_active=len(critical_triggers) > 0,
            recommended_actions=actions,
            event_type="THREAT_DECISION_EVALUATION",
            source=self.agent_name,
        )

    async def handle_inspector_evaluation(self, message: A2AMessage) -> None:
        """Handle incoming evaluation from InspectorAgent via Event Bus."""
        payload = message.payload
        eval_data = payload.get("evaluation", {})
        indicators_raw = eval_data.get("indicators", [])

        # Convert indicator dicts to ScamIndicator instances
        indicators = [
            ScamIndicator(**ind) if isinstance(ind, dict) else ind for ind in indicators_raw
        ]

        is_benign = eval_data.get("is_benign_advice", False)
        speaker = eval_data.get("speaker", "CALLER")
        turn_index = eval_data.get("turn_index", 1)
        session_id = payload.get("session_id", message.conversation_id)
        correlation_id = message.correlation_id or payload.get(
            "correlation_id", f"corr_{int(time.time() * 1000)}"
        )

        decision = self.evaluate_indicators(
            indicators=indicators,
            is_benign_advice=is_benign,
            speaker=speaker,
            session_id=session_id,
            turn_index=turn_index,
        )
        logger.info(
            f"[DecisionEngine] analyzing turn #{turn_index}: {decision.threat_state} ({decision.score} pts) -> {decision.decision}"
        )

        priority = (
            "CRITICAL"
            if decision.threat_state == "RED"
            else "HIGH"
            if decision.threat_state == "ORANGE"
            else "NORMAL"
        )

        # 1. Send DECISION_RESULT to ALL (telemetry, WebSockets)
        await event_bus.send(
            A2AMessage(
                sender=self.agent_name,
                receiver="ALL",
                recipient="ALL",
                correlation_id=correlation_id,
                conversation_id=session_id,
                message_type="DECISION_RESULT",
                priority=priority,
                payload={
                    "decision": decision.model_dump(),
                    "evaluation": eval_data,
                    "session_id": session_id,
                    "correlation_id": correlation_id,
                },
            )
        )

        # 2. Send EVIDENCE_REQUEST to EvidenceAgent
        await event_bus.send(
            A2AMessage(
                sender=self.agent_name,
                receiver="EvidenceAgent",
                recipient="EvidenceAgent",
                correlation_id=correlation_id,
                conversation_id=session_id,
                message_type="EVIDENCE_REQUEST",
                priority=priority,
                payload={
                    "decision": decision.model_dump(),
                    "evaluation": eval_data,
                    "session_id": session_id,
                    "correlation_id": correlation_id,
                },
            )
        )

        # 2. If intervention is required, send INTERVENTION_REQUEST to InterventionAgent
        if decision.requires_intervention:
            await event_bus.send(
                A2AMessage(
                    sender=self.agent_name,
                    receiver="InterventionAgent",
                    recipient="InterventionAgent",
                    correlation_id=correlation_id,
                    conversation_id=session_id,
                    message_type="INTERVENTION_REQUEST",
                    priority="CRITICAL",
                    payload={
                        "reason": "CRITICAL_THREAT_THRESHOLD_EXCEEDED",
                        "threat_score": decision.score,
                        "triggers": [
                            f"CRITICAL_{ind.category}: {ind.matched_signal}"
                            for ind in indicators
                            if ind.severity == "CRITICAL"
                        ],
                        "reasons": decision.reasons,
                        "triggered_rules": decision.triggered_rules,
                        "session_id": session_id,
                        "correlation_id": correlation_id,
                    },
                )
            )


# Global Decision Engine instance
decision_engine = DecisionEngineAgent()
