import re
import time
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from backend.core.a2a import A2AMessage, event_bus
from backend.core.config import settings


class ScamIndicator(BaseModel):
    category: str  # "URGENCY_PRESSURE", "CREDENTIAL_REQUEST", "REMOTE_ACCESS_REQUEST", "PAYMENT_REQUEST", "IMPERSONATION", "THREAT_INTIMIDATION", "SUSPICIOUS_LINK_ACTION", "BENIGN_SECURITY_ADVICE"
    matched_signal: str
    severity: str = "MEDIUM"  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    evidence: str = ""
    confidence: float = 0.95
    explanation: str = ""


class ScamVectorScore(BaseModel):
    vector_name: str
    score: float  # 0.0 to 100.0
    detected_keywords: list[str]
    severity: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    reasoning: str


class InspectionResult(BaseModel):
    agent: str = "InspectorAgent"
    timestamp: float
    iso_time: str
    session_id: str | None = None
    turn_index: int = 1
    speaker: str = "CALLER"
    original_text: str
    normalized_text: str
    indicators: list[ScamIndicator] = Field(default_factory=list)
    risk_factors: dict[str, Any] = Field(default_factory=dict)
    behavioral_signals: list[str] = Field(default_factory=list)
    detected_entities: list[str] = Field(default_factory=list)
    preliminary_score: float = 0.0
    severity: str = "LOW"  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    summary: str = ""
    is_benign_advice: bool = False
    event_type: str = "INSPECTION_COMPLETED"


class InspectorEvaluation(BaseModel):
    evaluation_id: str
    turn_index: int
    timestamp: float
    iso_time: str
    speaker: str
    composite_risk_score: float  # 0.0 to 100.0
    threat_velocity: float  # Rate of risk score increase
    active_threat_level: str  # "GREEN", "YELLOW", "ORANGE", "RED"
    severity: str = "LOW"  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    requested_action: str = "NONE"
    suspicious_indicators: list[str] = Field(default_factory=list)
    risk_factors: dict[str, Any] = Field(default_factory=dict)
    relevant_metadata: dict[str, Any] = Field(default_factory=dict)
    vectors: dict[str, ScamVectorScore]
    highlighted_phrases: list[str]
    critical_triggers: list[str]
    dialogue_snippet: str
    indicators: list[ScamIndicator] = Field(default_factory=list)
    normalized_text: str = ""
    event_type: str = "INSPECTION_EVALUATION"
    source: str = "InspectorAgent"


class TextNormalizer:
    """Safe, deterministic normalizer that prepares transcript text without destroying raw data."""

    @staticmethod
    def normalize(text: str) -> str:
        if not text:
            return ""
        # 1. Remove bracketed transcript markers e.g. [laughter], [inaudible], <cough>
        cleaned = re.sub(r"\[[^\]]*\]|<[^>]*>", " ", text)
        # 2. Strip speaker prefixes like "Caller:", "Callee:", "Agent:"
        cleaned = re.sub(
            r"^(caller|callee|speaker\s*\d+|agent):\s*", "", cleaned, flags=re.IGNORECASE
        )
        # 3. Collapse repeated punctuation (e.g. "???" -> "?", "!!!" -> "!")
        cleaned = re.sub(r"([?!.,;])\1+", r"\1", cleaned)
        # 4. Collapse whitespace
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned


class InspectorAgent:
    """
    Inspector Agent: Deep conversational linguistics and multi-vector scam pattern analyzer.
    Extracts structured scam indicators, contextually evaluates false-positives,
    and calculates explainable preliminary risk scores without issuing final defense actions.
    """

    def __init__(self):
        self.agent_name = "InspectorAgent"
        self._history_scores: list[float] = [0.0]
        self._setup_lexicons()
        self._setup_subscriptions()

    def reset_state(self) -> None:
        """Reset internal history for a new session."""
        self._history_scores = [0.0]

    def _setup_subscriptions(self) -> None:
        """Subscribe to speech transcript turns."""
        event_bus.subscribe("TRANSCRIPT_TURN", self.handle_transcript_turn)
        event_bus.subscribe("SCENARIO_STARTED", self._on_scenario_started)

    async def _on_scenario_started(self, message: A2AMessage) -> None:
        self.reset_state()

    def _setup_lexicons(self) -> None:
        """Compile regexes and pattern dictionaries for 7 scam indicator categories & context negations."""
        # Negation / Educational Advice markers - specific to genuine fraud warnings/disclaimers
        self.negation_patterns = [
            r"\b(never share (your )?(otp|password|pin|passcode|code|credentials)|never give (your )?(otp|password|pin|passcode|code))\b",
            r"\b(do not share (your )?(otp|password|pin|passcode|code)|don't share (your )?(otp|password|pin|passcode|code))\b",
            r"\b(beware of (scams?|fraud)|security tips?|fraud alert|security disclaimer|protect yourself from fraud)\b",
            r"\b(will never ask you for (your )?(otp|password|pin|passcode|code)|no legitimate bank will ask)\b",
        ]

        # 7 Indicator Categories
        self.category_lexicons = {
            "URGENCY_PRESSURE": [
                (
                    r"\b(act immediately|immediately|right now|act now|do this now|last warning|urgent)\b",
                    "CRITICAL",
                ),
                (
                    r"\b(within \d+ (minutes|seconds|hours)|before noon|in 10 seconds|deadline|unrecoverable|today itself|\bnow\b)\b",
                    "HIGH",
                ),
                (
                    r"\b(don't hang up|do not turn off|stay on the line|gag order|don't tell anyone|don't tell mom and dad|keep this confidential)\b",
                    "HIGH",
                ),
                (r"\b(as soon as possible|fast|hurry|quickly|right away)\b", "MEDIUM"),
            ],
            "CREDENTIAL_REQUEST": [
                (
                    r"\b(one-time (passcode|password|pin)|6-digit|six digits|verification code|security code|2fa|otp|push code)\b",
                    "CRITICAL",
                ),
                (
                    r"\b(read me the (code|digits|six)|tell me the (code|otp|pin)|provide your (otp|password|pin|credentials))\b",
                    "CRITICAL",
                ),
                (
                    r"\b(password|pin number|cvv|security pin|login credentials|banking credentials|social security number|ssn)\b",
                    "HIGH",
                ),
            ],
            "REMOTE_ACCESS_REQUEST": [
                (
                    r"\b(anydesk|teamviewer|quickassist|ultraviewer|zoho assist|logmein)\b",
                    "CRITICAL",
                ),
                (
                    r"\b(install remote access software|give me access to your computer|remote desktop|screen shar(e|ing)|remote access( id)?)\b",
                    "CRITICAL",
                ),
                (
                    r"\b(windows key and r|run command|type www\.|9-digit (id|code|number)|remote address number)\b",
                    "HIGH",
                ),
                (
                    r"\b(accept incoming connection|open your online banking|connect to your pc|remote support session)\b",
                    "HIGH",
                ),
            ],
            "PAYMENT_REQUEST": [
                (
                    r"\b(gift cards?|target card|apple (gift )?card|google play card|walmart gift card|scratch the back|serial numbers?)\b",
                    "CRITICAL",
                ),
                (r"\b(bitcoin|crypto kiosk|cryptocurrency|western union|moneygram|cash bail)\b", "CRITICAL"),
                (
                    r"\b(transfer money|send payment|bank transfer|wire transfer|zelle|bail wire|processing fee|verification payment)\b",
                    "HIGH",
                ),
                (
                    r"\b((send|transfer|pay)\s*(₹|\$|rs\.?|inr|usd)?\s*\d+[\d,]*)(\.\d{2})?\b",
                    "HIGH",
                ),
                (
                    r"\b(unpaid taxes|unpaid balance|penalty fee|reverse this fraudulent wire|holding cells)\b",
                    "MEDIUM",
                ),
            ],
            "IMPERSONATION": [
                (
                    r"\b(microsoft defender|windows defender|windows global security|microsoft technical support|microsoft windows|apple support)\b",
                    "HIGH",
                ),
                (
                    r"\b(bank security( department| team)?|account security( department| team)?|fraud department|fraud prevention|security department|chase bank|wells fargo|bank of america)\b",
                    "HIGH",
                ),
                (
                    r"\b(internal revenue service|irs|criminal investigation bureau|federal reserve|fbi|treasury department|police department|police officer|sheriff deputies|special agent|officer marcus)\b",
                    "HIGH",
                ),
                (
                    r"\b(technical support|customer support|bank representative|government official|public defender)\b",
                    "MEDIUM",
                ),
            ],
            "THREAT_INTIMIDATION": [
                (
                    r"\b(arrest warrant|police are on the way|in jail|custody|arrest|federal cyber laws)\b",
                    "CRITICAL",
                ),
                (
                    r"\b(account (will be|has been) (blocked|frozen|suspended|closed)|account closure|account suspension|frozen by fraud operations)\b",
                    "HIGH",
                ),
                (
                    r"\b(legal action|felony charges|criminal charges|criminal investigation|penalty|fine|lawsuit|permanently locked)\b",
                    "HIGH",
                ),
                (r"\b(terrible trouble|serious consequences|facing prosecution|trojan( viruses)?|malicious trojan|foreign hacking signals)\b", "MEDIUM"),
            ],
            "SUSPICIOUS_LINK_ACTION": [
                (
                    r"\b(click (the|this)? link|download (the|this)? (software|file|attachment)|install (the|this)? (software|application|app))\b",
                    "HIGH",
                ),
                (
                    r"\b(open (the|this)? (attachment|file)|type www\.|visit (the|this)? website)\b",
                    "MEDIUM",
                ),
            ],
        }

    def inspect(
        self,
        text: str,
        speaker: str = "CALLER",
        session_id: str | None = None,
        turn_index: int = 1,
    ) -> InspectionResult:
        """
        Primary Phase 4 Inspection Method.
        Performs normalization, contextual false-positive check, indicator extraction, and preliminary scoring.
        """
        now = time.time()
        normalized_text = TextNormalizer.normalize(text)

        if not normalized_text:
            return InspectionResult(
                agent=self.agent_name,
                timestamp=now,
                iso_time=datetime.now(UTC).isoformat(),
                session_id=session_id,
                turn_index=turn_index,
                speaker=speaker,
                original_text=text,
                normalized_text="",
                indicators=[],
                risk_factors={},
                behavioral_signals=[],
                detected_entities=[],
                preliminary_score=0.0,
                severity="LOW",
                summary="Empty or whitespace-only transcript received.",
                is_benign_advice=False,
            )

        norm_lower = normalized_text.lower()

        # Step 1: Contextual Negation / Benign Security Advice Check
        is_benign_advice = self._check_benign_security_advice(norm_lower)

        indicators: list[ScamIndicator] = []
        detected_entities: list[str] = []
        behavioral_signals: list[str] = []

        if is_benign_advice:
            indicators.append(
                ScamIndicator(
                    category="BENIGN_SECURITY_ADVICE",
                    matched_signal="security disclaimer / negation",
                    severity="LOW",
                    evidence=normalized_text[:140],
                    confidence=0.98,
                    explanation="Contextual analysis identified defensive security guidance (e.g. 'never share OTP'). Classified as benign education rather than scam solicitation.",
                )
            )
            summary = "Benign security education or fraud warning detected. No affirmative scam indicators flagged."
            return InspectionResult(
                agent=self.agent_name,
                timestamp=now,
                iso_time=datetime.now(UTC).isoformat(),
                session_id=session_id,
                turn_index=turn_index,
                speaker=speaker,
                original_text=text,
                normalized_text=normalized_text,
                indicators=indicators,
                risk_factors={"context": "BENIGN_ADVICE"},
                behavioral_signals=["DEFENSIVE_SECURITY_EDUCATION"],
                detected_entities=[],
                preliminary_score=0.0,
                severity="LOW",
                summary=summary,
                is_benign_advice=True,
            )

        # Step 2: Affirmative Scam Indicator Extraction
        for category, patterns in self.category_lexicons.items():
            for pattern, sev in patterns:
                matches = re.finditer(pattern, norm_lower)
                for m in matches:
                    matched_val = m.group(0).strip()
                    # Capture exact span evidence
                    start_pos = max(0, m.start() - 15)
                    end_pos = min(len(normalized_text), m.end() + 15)
                    evidence_snippet = normalized_text[start_pos:end_pos]

                    # Generate explanation
                    explanation = self._build_explanation(category, matched_val, sev)

                    # Deduplicate within category
                    if not any(
                        ind.category == category
                        and ind.matched_signal.lower() == matched_val.lower()
                        for ind in indicators
                    ):
                        indicators.append(
                            ScamIndicator(
                                category=category,
                                matched_signal=matched_val,
                                severity=sev,
                                evidence=evidence_snippet,
                                confidence=0.95,
                                explanation=explanation,
                            )
                        )
                        # Extract entities/behavioral signals
                        if category in ["REMOTE_ACCESS_REQUEST", "IMPERSONATION"]:
                            detected_entities.append(matched_val)
                        if category in ["URGENCY_PRESSURE", "THREAT_INTIMIDATION"]:
                            behavioral_signals.append(f"{category}:{matched_val}")

        # Step 3: Preliminary Risk Score Calculation
        preliminary_score = self._calculate_preliminary_score(indicators)

        # Step 4: Determine Overall Severity
        if preliminary_score >= 80.0:
            overall_severity = "CRITICAL"
        elif preliminary_score >= 50.0:
            overall_severity = "HIGH"
        elif preliminary_score >= 25.0:
            overall_severity = "MEDIUM"
        else:
            overall_severity = "LOW"

        # Step 5: Build Summary
        if indicators:
            cats = list(dict.fromkeys(ind.category for ind in indicators))
            summary = f"Detected {len(indicators)} scam indicator(s) across categories: {', '.join(cats)}. Preliminary risk score: {preliminary_score:.1f}/100 ({overall_severity})."
        else:
            summary = "No anomalous scam patterns or fraud indicators detected. Normal conversational flow."

        risk_factors_dict = {
            ind.category: {
                "signal": ind.matched_signal,
                "severity": ind.severity,
                "confidence": ind.confidence,
            }
            for ind in indicators
        }

        return InspectionResult(
            agent=self.agent_name,
            timestamp=now,
            iso_time=datetime.now(UTC).isoformat(),
            session_id=session_id,
            turn_index=turn_index,
            speaker=speaker,
            original_text=text,
            normalized_text=normalized_text,
            indicators=indicators,
            risk_factors=risk_factors_dict,
            behavioral_signals=behavioral_signals,
            detected_entities=list(set(detected_entities)),
            preliminary_score=preliminary_score,
            severity=overall_severity,
            summary=summary,
            is_benign_advice=False,
        )

    def _check_benign_security_advice(self, text_lower: str) -> bool:
        """Determine whether security phrases appear strictly in defensive / warning context."""
        for pattern in self.negation_patterns:
            if re.search(pattern, text_lower):
                return True
        return False

    def _build_explanation(self, category: str, matched_signal: str, severity: str) -> str:
        """Create transparent explainable reasoning for detected indicator."""
        explanations = {
            "URGENCY_PRESSURE": f"Detected psychological urgency trigger ('{matched_signal}') designed to induce panic and rush callee into compliance.",
            "CREDENTIAL_REQUEST": f"Detected solicitation of sensitive authentication credentials or 2FA one-time passcodes ('{matched_signal}').",
            "REMOTE_ACCESS_REQUEST": f"Detected solicitation or instruction to install remote device control software ('{matched_signal}').",
            "PAYMENT_REQUEST": f"Detected demand for unconventional or coerced financial transactions ('{matched_signal}').",
            "IMPERSONATION": f"Detected deceptive assertion of institutional authority or support persona ('{matched_signal}').",
            "THREAT_INTIMIDATION": f"Detected coercive intimidation or legal/account threat ('{matched_signal}').",
            "SUSPICIOUS_LINK_ACTION": f"Detected suspicious instruction to execute downloads or access external web resources ('{matched_signal}').",
        }
        return explanations.get(
            category, f"Flagged signal '{matched_signal}' with severity {severity}."
        )

    def _calculate_preliminary_score(self, indicators: list[ScamIndicator]) -> float:
        """Deterministic preliminary scoring based on contributing indicators."""
        if not indicators:
            return 0.0

        base_weights = {
            "REMOTE_ACCESS_REQUEST": 35.0,
            "CREDENTIAL_REQUEST": 35.0,
            "PAYMENT_REQUEST": 25.0,
            "THREAT_INTIMIDATION": 20.0,
            "IMPERSONATION": 15.0,
            "URGENCY_PRESSURE": 12.0,
            "SUSPICIOUS_LINK_ACTION": 10.0,
            "BENIGN_SECURITY_ADVICE": 0.0,
        }

        total_score = 0.0
        seen_categories: set[str] = set()

        for ind in indicators:
            cat_weight = base_weights.get(ind.category, 10.0)
            if ind.category not in seen_categories:
                total_score += cat_weight
                seen_categories.add(ind.category)
            else:
                # Diminishing increment for repeated indicators in same category
                total_score += cat_weight * 0.35

        # Critical severity boost
        if any(ind.severity == "CRITICAL" for ind in indicators):
            total_score = max(total_score, 88.0)

        return min(100.0, round(total_score, 1))

    # Backward compatibility with existing pipeline
    def evaluate_text(self, text: str, speaker: str, turn_index: int) -> InspectorEvaluation:
        """Run backward-compatible multi-vector analysis while integrating Phase 4 indicators."""
        inspection = self.inspect(text=text, speaker=speaker, turn_index=turn_index)
        now = inspection.timestamp

        # Vector scores mapped from indicators
        vectors: dict[str, ScamVectorScore] = {}
        vector_mappings = {
            "urgency_coercion": ("URGENCY_PRESSURE", "Urgency & Psychological Coercion"),
            "remote_access": ("REMOTE_ACCESS_REQUEST", "Remote Access & Device Takeover"),
            "otp_credentials": ("CREDENTIAL_REQUEST", "OTP & Credential Interception"),
            "financial_demand": ("PAYMENT_REQUEST", "Financial & Alternative Payment Demands"),
            "authority_impersonation": ("IMPERSONATION", "Authority & Brand Impersonation"),
        }

        for vec_key, (cat_name, display_name) in vector_mappings.items():
            cat_indicators = [ind for ind in inspection.indicators if ind.category == cat_name]
            score = 0.0
            detected_kw = [ind.matched_signal for ind in cat_indicators]
            if cat_indicators:
                if any(ind.severity == "CRITICAL" for ind in cat_indicators):
                    score = 90.0
                elif any(ind.severity == "HIGH" for ind in cat_indicators):
                    score = 65.0
                else:
                    score = 35.0
            vectors[vec_key] = ScamVectorScore(
                vector_name=display_name,
                score=score,
                detected_keywords=detected_kw,
                severity=self._score_to_severity(score),
                reasoning=f"Identified signals: {detected_kw}"
                if detected_kw
                else "No active indicators in vector.",
            )

        critical_triggers = [
            f"CRITICAL_{ind.category}: {ind.matched_signal}"
            for ind in inspection.indicators
            if ind.severity == "CRITICAL"
        ]

        # Monotonic smoothing for call session
        prev_score = self._history_scores[-1]
        composite_score = inspection.preliminary_score
        if not inspection.is_benign_advice:
            if speaker.upper() == "CALLER":
                composite_score = max(prev_score, composite_score)
            else:
                composite_score = max(prev_score * 0.96, composite_score)
        else:
            composite_score = 0.0

        composite_score = min(100.0, round(composite_score, 1))
        threat_velocity = round(composite_score - prev_score, 1)
        self._history_scores.append(composite_score)

        if composite_score >= settings.THRESHOLD_RED:
            threat_level = "RED"
        elif composite_score >= settings.THRESHOLD_ORANGE:
            threat_level = "ORANGE"
        elif composite_score >= settings.THRESHOLD_YELLOW:
            threat_level = "YELLOW"
        else:
            threat_level = "GREEN"

        requested_action = "NONE"
        if any(ind.category == "REMOTE_ACCESS_REQUEST" for ind in inspection.indicators):
            requested_action = "DOWNLOAD_REMOTE_ACCESS_SOFTWARE"
        elif any(ind.category == "CREDENTIAL_REQUEST" for ind in inspection.indicators):
            requested_action = "SOLICIT_2FA_ONE_TIME_PASSCODE"
        elif any(ind.category == "PAYMENT_REQUEST" for ind in inspection.indicators):
            requested_action = "DEMAND_GIFT_CARDS_OR_CRYPTO_WIRE"
        elif any(ind.category == "URGENCY_PRESSURE" for ind in inspection.indicators):
            requested_action = "COERCE_IMMEDIATE_COMPLIANCE"
        elif any(ind.category == "IMPERSONATION" for ind in inspection.indicators):
            requested_action = "DECEPTIVE_AUTHORITY_ASSERTION"

        return InspectorEvaluation(
            evaluation_id=f"eval_{turn_index}_{int(now * 1000)}",
            turn_index=turn_index,
            timestamp=now,
            iso_time=inspection.iso_time,
            speaker=speaker,
            composite_risk_score=composite_score,
            threat_velocity=threat_velocity,
            active_threat_level=threat_level,
            severity=inspection.severity,
            requested_action=requested_action,
            suspicious_indicators=[
                f"[{ind.category}] {ind.matched_signal}" for ind in inspection.indicators
            ],
            risk_factors=inspection.risk_factors,
            relevant_metadata={
                "turn_index": turn_index,
                "speaker": speaker,
                "word_count": len(text.split()),
                "timestamp": now,
            },
            vectors=vectors,
            highlighted_phrases=[ind.matched_signal for ind in inspection.indicators],
            critical_triggers=critical_triggers,
            dialogue_snippet=text[:160] + "..." if len(text) > 160 else text,
            indicators=inspection.indicators,
            normalized_text=inspection.normalized_text,
            event_type="INSPECTION_EVALUATION",
            source=self.agent_name,
        )

    def _score_to_severity(self, score: float) -> str:
        if score >= 80.0:
            return "CRITICAL"
        if score >= 50.0:
            return "HIGH"
        if score >= 25.0:
            return "MEDIUM"
        return "LOW"

    async def handle_transcript_turn(self, message: A2AMessage) -> None:
        """Handle incoming turn and publish analysis."""
        payload = message.payload
        segment = payload.get("segment", {})
        speaker = segment.get("speaker", "CALLER")
        text = segment.get("text", "")
        turn_index = segment.get("turn_index", len(self._history_scores))
        session_id = payload.get("session_id", message.conversation_id)
        correlation_id = message.correlation_id or f"corr_{int(time.time() * 1000)}"

        evaluation = self.evaluate_text(text, speaker, turn_index)

        priority = (
            "CRITICAL"
            if evaluation.active_threat_level == "RED"
            else "HIGH"
            if evaluation.active_threat_level == "ORANGE"
            else "NORMAL"
        )

        await event_bus.send(
            A2AMessage(
                sender=self.agent_name,
                receiver="DecisionEngine",
                recipient="DecisionEngine",
                correlation_id=correlation_id,
                conversation_id=session_id,
                message_type="INSPECTION_RESULT",
                priority=priority,
                payload={
                    "evaluation": evaluation.model_dump(),
                    "session_id": session_id,
                    "correlation_id": correlation_id,
                },
            )
        )


# Global Inspector Agent instance
inspector_agent = InspectorAgent()
