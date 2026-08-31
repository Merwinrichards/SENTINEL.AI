import logging
import time
from typing import Any

from backend.agents.decision_engine import DecisionAction, decision_engine
from backend.agents.inspector import ScamIndicator, inspector_agent
from backend.agents.intervention_agent import intervention_agent
from pydantic import BaseModel, Field

logger = logging.getLogger("sentinel.orchestrator")


class AnalyzeRequest(BaseModel):
    text: str = Field(..., description="Raw dialogue text segment or transcript turn")
    speaker: str = Field(default="CALLER", description="Speaker identity: CALLER or CALLEE")
    session_id: str | None = Field(default=None, description="Unique call session ID")
    turn_index: int = Field(default=1, description="Sequential dialogue turn index (1-based)")
    auto_intervene: bool = Field(
        default=True,
        description="Whether to automatically execute simulated kill switch when intervention is required",
    )


class InspectionSummary(BaseModel):
    indicators: list[ScamIndicator] = Field(default_factory=list)
    normalized_text: str = ""
    is_benign_advice: bool = False
    severity: str = "LOW"


class DecisionSummary(BaseModel):
    score: float
    threat_state: str
    decision: str
    requires_intervention: bool
    confidence: float
    triggered_rules: list[str] = Field(default_factory=list)
    combination_rules_triggered: list[str] = Field(default_factory=list)
    critical_triggers_active: bool = False
    reasons: list[str] = Field(default_factory=list)


class AnalyzeResponse(BaseModel):
    agent: str = "Orchestrator"
    session_id: str | None = None
    turn_index: int = 1
    original_text: str
    inspection: InspectionSummary
    decision: DecisionSummary
    actions: list[DecisionAction] = Field(default_factory=list)
    intervention_executed: bool = False
    intervention_details: dict[str, Any] | None = None


class PipelineOrchestrator:
    """
    End-to-End Pipeline Orchestrator:
    Coordinates raw transcript processing across InspectorAgent -> DecisionEngine -> InterventionAgent,
    producing a unified end-to-end security analysis without duplicating core agent logic.
    """

    def __init__(self):
        self.agent_name = "Orchestrator"

    async def analyze_turn(
        self,
        text: str,
        speaker: str = "CALLER",
        session_id: str | None = None,
        turn_index: int = 1,
        auto_intervene: bool = True,
    ) -> AnalyzeResponse:
        """
        Execute full end-to-end detection, decision, and defense pipeline for a single dialogue turn.
        """
        sess_id = session_id or f"sess_{int(time.time() * 1000)}"
        corr_id = f"corr_{sess_id}_t{turn_index}"

        logger.info(
            f"Orchestrator: Starting analysis for Turn #{turn_index} [{speaker}] (Session: {sess_id})"
        )

        # 1. Inspector Agent Analysis
        try:
            inspection_result = inspector_agent.inspect(
                text=text,
                speaker=speaker,
                session_id=sess_id,
                turn_index=turn_index,
            )
            logger.info(
                f"Orchestrator: Inspector extracted {len(inspection_result.indicators)} indicators (Severity: {inspection_result.severity})"
            )
        except Exception as e:
            logger.error(f"Orchestrator: InspectorAgent failed: {e}", exc_info=True)
            raise RuntimeError(f"Inspection processing error: {e}") from e

        # 2. Decision Engine Evaluation
        try:
            decision_result = decision_engine.evaluate_indicators(
                indicators=inspection_result.indicators,
                is_benign_advice=inspection_result.is_benign_advice,
                speaker=speaker,
                session_id=sess_id,
                turn_index=turn_index,
            )
            logger.info(
                f"Orchestrator: Decision evaluated -> Threat State: {decision_result.threat_state} ({decision_result.score} pts), Decision: {decision_result.decision}"
            )
        except Exception as e:
            logger.error(f"Orchestrator: DecisionEngine failed: {e}", exc_info=True)
            raise RuntimeError(f"Decision engine evaluation error: {e}") from e

        # 3. Defensive Action Layer Execution
        intervention_executed = False
        intervention_details = None

        if decision_result.requires_intervention and auto_intervene:
            logger.warning(
                f"Orchestrator: Intervention required for Session {sess_id}. Triggering automated defensive countermeasures."
            )
            try:
                status = await intervention_agent.execute_intervention(
                    source="ORCHESTRATOR_AUTOMATED",
                    reason=decision_result.reasons[0]
                    if decision_result.reasons
                    else "CRITICAL_THREAT_THRESHOLD_EXCEEDED",
                    triggers=decision_result.triggered_rules,
                    reasons=decision_result.reasons,
                    correlation_id=corr_id,
                    conversation_id=sess_id,
                    decision_score=decision_result.score,
                    threat_state=decision_result.threat_state,
                )
                intervention_executed = status.is_active
                intervention_details = status.model_dump()
                logger.info(
                    f"Orchestrator: Kill-switch executed successfully (Call State: {status.call_state})"
                )
            except Exception as e:
                logger.error(f"Orchestrator: InterventionAgent execution error: {e}", exc_info=True)
                # Do not fail entire response if defensive action encounters issue; record detail
                intervention_details = {"error": str(e)}

        # 4. Construct Unified End-to-End Response
        return AnalyzeResponse(
            agent=self.agent_name,
            session_id=sess_id,
            turn_index=turn_index,
            original_text=text,
            inspection=InspectionSummary(
                indicators=inspection_result.indicators,
                normalized_text=inspection_result.normalized_text,
                is_benign_advice=inspection_result.is_benign_advice,
                severity=inspection_result.severity,
            ),
            decision=DecisionSummary(
                score=decision_result.score,
                threat_state=decision_result.threat_state,
                decision=decision_result.decision,
                requires_intervention=decision_result.requires_intervention,
                confidence=decision_result.confidence,
                triggered_rules=decision_result.triggered_rules,
                combination_rules_triggered=decision_result.combination_rules_triggered,
                critical_triggers_active=decision_result.critical_triggers_active,
                reasons=decision_result.reasons,
            ),
            actions=decision_result.recommended_actions,
            intervention_executed=intervention_executed,
            intervention_details=intervention_details,
        )


# Global orchestrator service instance
orchestrator = PipelineOrchestrator()
