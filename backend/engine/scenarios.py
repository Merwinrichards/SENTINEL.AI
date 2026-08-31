from pydantic import BaseModel


class DialogueTurn(BaseModel):
    turn_id: int
    speaker: str  # "CALLER" (potential scammer) or "CALLEE" (victim)
    text: str
    delay_ms: int = 1800
    expected_threat_score: float = 0.0
    threat_indicators: list[str] = []


class CallScenario(BaseModel):
    id: str
    title: str
    category: str
    description: str
    target_risk_level: str  # "SAFE", "SUSPICIOUS", "ELEVATED", "CRITICAL"
    caller_id_spoof: str
    dialogue: list[DialogueTurn]


SCENARIOS: dict[str, CallScenario] = {
    "bank_otp_scam": CallScenario(
        id="bank_otp_scam",
        title="Bank OTP Scam (Synthetic Presentation Demo)",
        category="Banking & Credential Theft",
        description="Caller impersonates a bank security representative and attempts to obtain an OTP using urgency and account threats.",
        target_risk_level="CRITICAL",
        caller_id_spoof="+1 (800) 555-0199 [SIMULATED SPOOF // Global Bank Fraud Dept]",
        dialogue=[
            DialogueTurn(
                turn_id=1,
                speaker="CALLER",
                text="Hello, I am calling from your bank security department. We detected suspicious activity on your account.",
                delay_ms=2000,
                expected_threat_score=15.0,
                threat_indicators=["impersonation_authority"],
            ),
            DialogueTurn(
                turn_id=2,
                speaker="CALLER",
                text="To verify your identity, please tell me the OTP that was just sent to your phone.",
                delay_ms=2200,
                expected_threat_score=50.0,
                threat_indicators=["credential_request", "otp_solicitation"],
            ),
            DialogueTurn(
                turn_id=3,
                speaker="CALLER",
                text="You need to do it immediately, otherwise your account will be blocked within 10 minutes.",
                delay_ms=2400,
                expected_threat_score=85.0,
                threat_indicators=["urgency_pressure", "threat_intimidation"],
            ),
        ],
    ),
    "tech_support_remote_access": CallScenario(
        id="tech_support_remote_access",
        title="Tech Support: Urgent Ransomware Trojan Scam (Synthetic Demo)",
        category="Remote Access & Extortion",
        description="Scammer claims computer has critical Trojan virus and instructs victim to install AnyDesk/TeamViewer to access bank vault.",
        target_risk_level="CRITICAL",
        caller_id_spoof="+1 (800) 555-0176 [SIMULATED SPOOF // Tech Support Ops]",
        dialogue=[
            DialogueTurn(
                turn_id=1,
                speaker="CALLER",
                text="Hello, this is Agent Miller (Simulated) calling from Global OS Security Department. We have detected that your computer IP address is broadcasting multiple malicious Trojan viruses and foreign hacking signals.",
                delay_ms=2000,
                expected_threat_score=35.0,
                threat_indicators=["impersonation_authority", "false_technical_alarm"],
            ),
            DialogueTurn(
                turn_id=2,
                speaker="CALLEE",
                text="Oh my god, really? But I have antivirus installed on my laptop. Is my personal information at risk?",
                delay_ms=1800,
                expected_threat_score=35.0,
                threat_indicators=["victim_vulnerability"],
            ),
            DialogueTurn(
                turn_id=3,
                speaker="CALLER",
                text="Yes ma'am, your personal bank files and social security have been breached right now. Do not turn off your computer or your hard drive will be permanently locked under federal cyber laws. You must act immediately.",
                delay_ms=2200,
                expected_threat_score=68.0,
                threat_indicators=["urgency_coercion", "legal_threat", "fear_inducement"],
            ),
            DialogueTurn(
                turn_id=4,
                speaker="CALLEE",
                text="Please help me, what do I need to do to stop them?",
                delay_ms=1500,
                expected_threat_score=68.0,
                threat_indicators=["compliance_compliance"],
            ),
            DialogueTurn(
                turn_id=5,
                speaker="CALLER",
                text="Press Windows Key and R on your keyboard right now. Type 'www.anydesk.com' or 'teamviewer.com' and click Download. I need you to give me the 9-digit remote access ID so I can securely connect and purge the hackers from your system.",
                delay_ms=2400,
                expected_threat_score=94.0,
                threat_indicators=["remote_access_tool", "anydesk_download", "urgent_compliance"],
            ),
            DialogueTurn(
                turn_id=6,
                speaker="CALLEE",
                text="Okay, I downloaded AnyDesk. It says the remote address number is 555-019-391.",
                delay_ms=1800,
                expected_threat_score=96.0,
                threat_indicators=["remote_credential_provided"],
            ),
            DialogueTurn(
                turn_id=7,
                speaker="CALLER",
                text="Good. Now accept the incoming connection. Now open your online banking portal in the background so we can verify if your funds have been corrupted by the foreign server.",
                delay_ms=2500,
                expected_threat_score=99.0,
                threat_indicators=[
                    "financial_account_takeover",
                    "remote_screen_capture",
                    "critical_breach",
                ],
            ),
        ],
    ),
    "bank_fraud_otp_theft": CallScenario(
        id="bank_fraud_otp_theft",
        title="Bank Fraud Department Impersonation & 2FA/OTP Theft (Synthetic Demo)",
        category="Banking & Credential Theft",
        description="Scammer poses as Bank Fraud Prevention agent claiming unauthorized $2,450 Zelle transfer and requests 6-digit one-time passcode.",
        target_risk_level="CRITICAL",
        caller_id_spoof="+1 (800) 555-0142 [SIMULATED SPOOF // Bank Fraud Dept]",
        dialogue=[
            DialogueTurn(
                turn_id=1,
                speaker="CALLER",
                text="This is Representative Vance (Simulated) with Bank Fraud Department. We are contacting you regarding an urgent unauthorized transfer of $2,450.00 to an unknown account.",
                delay_ms=2000,
                expected_threat_score=45.0,
                threat_indicators=["financial_urgency", "bank_impersonation"],
            ),
            DialogueTurn(
                turn_id=2,
                speaker="CALLEE",
                text="No, I never authorized any wire transfer! That wasn't me, I am at home right now!",
                delay_ms=1800,
                expected_threat_score=45.0,
                threat_indicators=["victim_panic"],
            ),
            DialogueTurn(
                turn_id=3,
                speaker="CALLER",
                text="Understood. To reverse this fraudulent wire immediately before funds leave the federal clearinghouse, I am initiating a security reversal protocol on your checking account.",
                delay_ms=2000,
                expected_threat_score=62.0,
                threat_indicators=["false_protocol_claim", "urgency_pressure"],
            ),
            DialogueTurn(
                turn_id=4,
                speaker="CALLER",
                text="I have just pushed a 6-digit one-time verification passcode to your registered mobile phone. Do not read the text message, just read me the six digits to cancel the transaction right now.",
                delay_ms=2300,
                expected_threat_score=92.0,
                threat_indicators=["otp_theft", "2fa_interception", "bypass_warning"],
            ),
            DialogueTurn(
                turn_id=5,
                speaker="CALLEE",
                text="The text message says 'Bank Security: Never share this OTP with anyone, even bank employees'... are you sure I should read it to you?",
                delay_ms=2200,
                expected_threat_score=94.0,
                threat_indicators=["victim_hesitation", "security_warning_triggered"],
            ),
            DialogueTurn(
                turn_id=6,
                speaker="CALLER",
                text="Sir, that is an automated generic disclaimer! If you don't give me the 6-digit code in 10 seconds, the $2,450 will be completely unrecoverable and your account will be frozen by fraud operations!",
                delay_ms=2400,
                expected_threat_score=99.0,
                threat_indicators=["coercive_pressure", "critical_otp_theft", "deadline_threat"],
            ),
        ],
    ),
    "irs_federal_arrest_threat": CallScenario(
        id="irs_federal_arrest_threat",
        title="Tax Agency Impersonation: Arrest Threat & Retail Card Extortion (Synthetic Demo)",
        category="Government Impersonation & Extortion",
        description="Caller claims to be Tax Agent threatening arrest warrant unless unpaid taxes are settled immediately via retail gift cards or crypto.",
        target_risk_level="CRITICAL",
        caller_id_spoof="+1 (202) 555-0199 [SIMULATED SPOOF // Federal Tax Agency]",
        dialogue=[
            DialogueTurn(
                turn_id=1,
                speaker="CALLER",
                text="This is Agent Davis (Simulated) from the Federal Tax Investigation Bureau. There is an active federal arrest warrant issued under your identifier for felony tax fraud.",
                delay_ms=2200,
                expected_threat_score=55.0,
                threat_indicators=["law_enforcement_impersonation", "arrest_threat"],
            ),
            DialogueTurn(
                turn_id=2,
                speaker="CALLEE",
                text="An arrest warrant?! What are you talking about? I always pay my taxes every year!",
                delay_ms=1800,
                expected_threat_score=55.0,
                threat_indicators=["victim_shock"],
            ),
            DialogueTurn(
                turn_id=3,
                speaker="CALLER",
                text="Our audit found an unpaid balance of $4,890. Local county deputies are currently dispatched to your address to take you into custody unless this case is resolved before noon.",
                delay_ms=2400,
                expected_threat_score=80.0,
                threat_indicators=[
                    "physical_arrest_threat",
                    "artificial_deadline",
                    "police_dispatch_claim",
                ],
            ),
            DialogueTurn(
                turn_id=4,
                speaker="CALLEE",
                text="Please don't send the police! I have the money, can I pay with my credit card right now?",
                delay_ms=1800,
                expected_threat_score=80.0,
                threat_indicators=["victim_coerced"],
            ),
            DialogueTurn(
                turn_id=5,
                speaker="CALLER",
                text="Federal regulations do not accept standard cards for criminal discharge. You must drive immediately to the nearest retail store, purchase four $500 Apple or Google Play gift cards, and read the serial numbers on the back to me over this line.",
                delay_ms=2600,
                expected_threat_score=98.0,
                threat_indicators=["gift_card_demand", "retail_card_payment", "scam_hallmark"],
            ),
        ],
    ),
    "family_emergency_bail": CallScenario(
        id="family_emergency_bail",
        title="Family Emergency: Simulated Arrest & Urgent Bail Wire (Synthetic Demo)",
        category="Social Engineering & Distress Extortion",
        description="Impersonates family member who claims to have been arrested after an accident and urgently needs $3,500 wire transfer for cash bail.",
        target_risk_level="CRITICAL",
        caller_id_spoof="+1 (555) 014-9988 [SIMULATED SPOOF // Distress Emergency]",
        dialogue=[
            DialogueTurn(
                turn_id=1,
                speaker="CALLER",
                text="Grandma? Is that you? Please don't tell mom and dad, I am in terrible trouble and I didn't know who else to call...",
                delay_ms=2000,
                expected_threat_score=40.0,
                threat_indicators=["family_impersonation", "emotional_hook", "isolation_tactic"],
            ),
            DialogueTurn(
                turn_id=2,
                speaker="CALLEE",
                text="Tyler? Tyler is that you? You sound so strange, what happened sweetheart?",
                delay_ms=1800,
                expected_threat_score=40.0,
                threat_indicators=["vulnerable_elderly"],
            ),
            DialogueTurn(
                turn_id=3,
                speaker="CALLER",
                text="I got into a car accident and my nose is broken, that's why my voice sounds muffled. The other driver was hurt and the police have me in holding cells.",
                delay_ms=2300,
                expected_threat_score=65.0,
                threat_indicators=["urgency_fabrication", "jail_claim", "voice_distortion_excuse"],
            ),
            DialogueTurn(
                turn_id=4,
                speaker="CALLER",
                text="The public defender says if I can post $3,500 cash bail within two hours I can go home without criminal charges. You must go to Western Union or send a Bitcoin wire immediately. Please don't tell anyone, there is a gag order.",
                delay_ms=2500,
                expected_threat_score=93.0,
                threat_indicators=[
                    "bail_wire_transfer",
                    "crypto_demand",
                    "gag_order_isolation",
                    "extreme_pressure",
                ],
            ),
        ],
    ),
    "legitimate_bank_support": CallScenario(
        id="legitimate_bank_support",
        title="Legitimate Banking Inbound: Routine Maintenance Fee Inquiry (Synthetic Baseline)",
        category="Benign / Negative Control Baseline",
        description="Customer calling bank to ask about a monthly maintenance fee. No high-risk triggers, should remain GREEN/SAFE throughout.",
        target_risk_level="SAFE",
        caller_id_spoof="+1 (800) 555-0100 [SIMULATED BENIGN // Customer Care Service]",
        dialogue=[
            DialogueTurn(
                turn_id=1,
                speaker="CALLER",
                text="Thank you for calling Customer Care Support. My name is Sarah (Simulated). May I please have your full name to get started?",
                delay_ms=1800,
                expected_threat_score=5.0,
                threat_indicators=["standard_greeting"],
            ),
            DialogueTurn(
                turn_id=2,
                speaker="CALLEE",
                text="Hi Sarah, my name is Alex Morgan (Simulated). I saw a twelve dollar monthly maintenance fee on my statement and I'd like to understand why it was charged.",
                delay_ms=1800,
                expected_threat_score=5.0,
                threat_indicators=["standard_customer_inquiry"],
            ),
            DialogueTurn(
                turn_id=3,
                speaker="CALLER",
                text="I would be happy to review that for you, Alex. I see here that the minimum qualifying balance requirement was just below the threshold last month. If you'd like, we can enroll you in qualifying direct deposit to permanently waive that fee.",
                delay_ms=2200,
                expected_threat_score=8.0,
                threat_indicators=["helpful_guidance", "routine_banking"],
            ),
            DialogueTurn(
                turn_id=4,
                speaker="CALLEE",
                text="That sounds great. How do I set up direct deposit with my employer?",
                delay_ms=1700,
                expected_threat_score=8.0,
                threat_indicators=["routine_inquiry"],
            ),
            DialogueTurn(
                turn_id=5,
                speaker="CALLER",
                text="You can download the direct deposit authorization form directly from our secure website or mobile app under the Accounts menu whenever it is convenient for you. Is there anything else I can assist you with today?",
                delay_ms=2200,
                expected_threat_score=5.0,
                threat_indicators=["secure_advice", "no_coercion"],
            ),
            DialogueTurn(
                turn_id=6,
                speaker="CALLEE",
                text="No, that answered all my questions. Thank you very much Sarah!",
                delay_ms=1500,
                expected_threat_score=5.0,
                threat_indicators=["peaceful_closing"],
            ),
        ],
    ),
}
