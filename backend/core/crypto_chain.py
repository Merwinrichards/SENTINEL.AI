import hashlib
import json
import time
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel


class EvidenceBlock(BaseModel):
    index: int
    timestamp: float
    iso_time: str
    event_type: str
    agent_source: str
    payload: dict[str, Any]
    prev_hash: str
    block_hash: str
    nonce: int = 0
    signature: str = ""

    def calculate_hash(self) -> str:
        """Calculate canonical SHA-256 hash of this block's contents."""
        payload_json = json.dumps(self.payload, sort_keys=True, separators=(",", ":"))
        raw_string = f"{self.index}|{self.timestamp:.6f}|{self.prev_hash}|{self.event_type}|{self.agent_source}|{payload_json}|{self.nonce}"
        return hashlib.sha256(raw_string.encode("utf-8")).hexdigest()

    def generate_signature(self, salt: str = "SENTINEL-SIG-2026") -> str:
        """Create cryptographic HMAC-like integrity signature."""
        sig_data = f"{self.block_hash}:{salt}:{self.agent_source}"
        return f"SIG_{hashlib.sha256(sig_data.encode('utf-8')).hexdigest()[:24].upper()}"


class EvidenceChain:
    def __init__(self, salt: str = "SENTINEL-CHAIN-SECURE-FORENSIC-SALT-2026"):
        self.salt = salt
        self.chain: list[EvidenceBlock] = []
        self.create_genesis_block()

    def create_genesis_block(self) -> EvidenceBlock:
        """Create the immutable Genesis Block (Block #0)."""
        now = time.time()
        genesis_payload = {
            "title": "SENTINEL FORENSIC EVIDENCE CHAIN INITIALIZATION",
            "protocol_version": "2.4.0",
            "security_clearance": "CLASS-IV-AUDIT",
            "active_agents": [
                "InspectorAgent",
                "DecisionEngine",
                "EvidenceAgent",
                "InterventionAgent",
            ],
            "hash_algorithm": "SHA-256",
            "status": "INITIALIZED",
        }

        block = EvidenceBlock(
            index=0,
            timestamp=now,
            iso_time=datetime.now(UTC).isoformat(),
            event_type="GENESIS",
            agent_source="system",
            payload=genesis_payload,
            prev_hash="0" * 64,
            block_hash="",
            nonce=0,
        )
        block.block_hash = block.calculate_hash()
        block.signature = block.generate_signature(self.salt)
        self.chain = [block]
        return block

    @property
    def latest_block(self) -> EvidenceBlock:
        return self.chain[-1]

    def add_block(
        self, event_type: str, agent_source: str, payload: dict[str, Any]
    ) -> EvidenceBlock:
        """Add a newly signed evidence block to the chain."""
        now = time.time()
        prev_block = self.latest_block

        new_block = EvidenceBlock(
            index=len(self.chain),
            timestamp=now,
            iso_time=datetime.now(UTC).isoformat(),
            event_type=event_type,
            agent_source=agent_source,
            payload=payload,
            prev_hash=prev_block.block_hash,
            block_hash="",
            nonce=0,
        )
        new_block.block_hash = new_block.calculate_hash()
        new_block.signature = new_block.generate_signature(self.salt)
        self.chain.append(new_block)
        return new_block

    def verify_integrity(self) -> tuple[bool, int | None, str | None]:
        """
        Full cryptographic verification of the evidence chain.
        Returns (is_valid, failing_block_index, failure_reason)
        """
        if not self.chain:
            return False, 0, "Chain is empty"

        # 1. Verify Genesis
        genesis = self.chain[0]
        if genesis.index != 0:
            return False, 0, "Genesis block index is not 0"
        if genesis.prev_hash != "0" * 64:
            return (
                False,
                0,
                f"Genesis previous hash is invalid: expected {'0' * 64}, got {genesis.prev_hash}",
            )
        computed_genesis_hash = genesis.calculate_hash()
        if genesis.block_hash != computed_genesis_hash:
            return (
                False,
                0,
                f"Genesis block internal hash mismatch. Computed: {computed_genesis_hash[:12]}..., Stored: {genesis.block_hash[:12]}...",
            )

        # 2. Verify Sequential Blocks & Links
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]

            if current.index != i:
                return (
                    False,
                    i,
                    f"Block index discontinuity: expected index {i}, found index {current.index}",
                )

            if current.prev_hash != previous.block_hash:
                return (
                    False,
                    i,
                    f"Hash link broken between block #{previous.index} and #{current.index}. PrevHash ({current.prev_hash[:12]}...) does not match Block #{previous.index} hash ({previous.block_hash[:12]}...)",
                )

            calculated_hash = current.calculate_hash()
            if current.block_hash != calculated_hash:
                return (
                    False,
                    i,
                    f"Block #{current.index} internal hash compromised! Data or metadata has been modified. Stored: {current.block_hash[:12]}..., Computed: {calculated_hash[:12]}...",
                )

            computed_sig = current.generate_signature(self.salt)
            if current.signature != computed_sig:
                return (
                    False,
                    i,
                    f"Block #{current.index} cryptographic signature verification failed. Stored: {current.signature[:12]}..., Computed: {computed_sig[:12]}...",
                )

        return True, None, None

    def tamper_block_for_test(
        self,
        block_index: int,
        field_to_alter: str = "dialogue_snippet",
        malicious_value: Any = "ALTERED_BY_ATTACKER_FRAUD_RECORD_DELETED",
        target_property: str = "payload",
    ) -> bool:
        """Tamper with a block's internal payload, hash, or prev_hash without re-mining."""
        if block_index < 0 or block_index >= len(self.chain):
            return False

        target = self.chain[block_index]
        if target_property == "payload":
            target.payload[field_to_alter] = malicious_value
        elif target_property == "block_hash":
            target.block_hash = str(malicious_value)
        elif target_property == "prev_hash":
            target.prev_hash = str(malicious_value)
        elif target_property == "timestamp":
            target.timestamp = float(malicious_value)
        elif hasattr(target, target_property):
            setattr(target, target_property, malicious_value)
        else:
            target.payload[field_to_alter] = malicious_value
        return True

    def repair_chain_recalculate(self) -> None:
        """Recalculate entire chain hashes for recovery after simulated tests."""
        for i in range(len(self.chain)):
            if i == 0:
                self.chain[i].prev_hash = "0" * 64
            else:
                self.chain[i].prev_hash = self.chain[i - 1].block_hash
            self.chain[i].block_hash = self.chain[i].calculate_hash()
            self.chain[i].signature = self.chain[i].generate_signature(self.salt)

    def export_audit_package(self) -> dict[str, Any]:
        """Export signed forensic evidence package for compliance/legal evidentiary record."""
        is_valid, fail_idx, fail_reason = self.verify_integrity()

        chain_hashes = [b.block_hash for b in self.chain]
        seal_digest = hashlib.sha256("->".join(chain_hashes).encode("utf-8")).hexdigest()

        return {
            "metadata": {
                "system": "SENTINEL AI Real-Time Defense Platform",
                "export_timestamp": datetime.now(UTC).isoformat(),
                "total_blocks": len(self.chain),
                "is_cryptographically_valid": is_valid,
                "chain_seal_root_hash": seal_digest,
                "integrity_status": "VERIFIED_TAMPER_FREE"
                if is_valid
                else f"INTEGRITY_VIOLATION_AT_BLOCK_{fail_idx}",
                "integrity_error": fail_reason,
            },
            "chain": [b.model_dump() for b in self.chain],
        }
