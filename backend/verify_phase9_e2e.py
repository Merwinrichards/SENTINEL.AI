import json

from fastapi.testclient import TestClient

from backend.main import app


def test_phase9_pipeline():
    client = TestClient(app)

    print("\n=======================================================")
    print("DEMO: PHASE 9 END-TO-END PIPELINE (POST /api/analyze)")
    print("=======================================================")

    # Reset kill-switch before test run
    client.post("/api/killswitch/reset")

    # TEST 1 — BENIGN
    print("\n--- [TEST 1: BENIGN CUSTOMER SUPPORT CONVERSATION] ---")
    req_benign = {
        "text": "Thank you for contacting customer support. How may I help you today?",
        "speaker": "CALLER",
        "session_id": "e2e-demo-benign-001",
        "turn_index": 1,
    }
    res_benign = client.post("/api/analyze", json=req_benign)
    print(f"Status Code: {res_benign.status_code}")
    data_benign = res_benign.json()
    print("Response:")
    print(json.dumps(data_benign, indent=2))

    # TEST 2 — SUSPICIOUS
    print("\n--- [TEST 2: SUSPICIOUS ACCOUNT TRANSACTION INQUIRY] ---")
    req_suspicious = {
        "text": "Your account has an unusual transaction. Please verify some information.",
        "speaker": "CALLER",
        "session_id": "e2e-demo-suspicious-002",
        "turn_index": 1,
    }
    res_suspicious = client.post("/api/analyze", json=req_suspicious)
    print(f"Status Code: {res_suspicious.status_code}")
    data_suspicious = res_suspicious.json()
    print("Response:")
    print(json.dumps(data_suspicious, indent=2))

    # TEST 3 — HIGH-RISK SCAM
    print("\n--- [TEST 3: HIGH-RISK BANK FRAUD & OTP EXTORTION SCAM] ---")
    req_scam = {
        "text": "Hello, I am calling from your bank security department. We detected suspicious activity on your account. You must immediately share your OTP and confirm your account details, otherwise your account will be blocked within 10 minutes.",
        "speaker": "CALLER",
        "session_id": "e2e-demo-scam-003",
        "turn_index": 1,
        "auto_intervene": True,
    }
    res_scam = client.post("/api/analyze", json=req_scam)
    print(f"Status Code: {res_scam.status_code}")
    data_scam = res_scam.json()
    print("Response:")
    print(json.dumps(data_scam, indent=2))

    # Verify Evidence Chain
    print("\n--- [EVIDENCE INTEGRITY AFTER SCAM INTERVENTION] ---")
    res_ev = client.post("/api/evidence/verify")
    print(f"Status Code: {res_ev.status_code}")
    print(json.dumps(res_ev.json(), indent=2))

    # Reset
    client.post("/api/killswitch/reset")
    print("\n=======================================================\n")


if __name__ == "__main__":
    test_phase9_pipeline()
