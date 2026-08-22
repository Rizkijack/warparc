/**
 * Circle Iris attestation client for the relayer.
 *
 * API (developers.circle.com/cctp/attestation-api):
 *   GET {base}/v2/messages/{srcDomain}?transactionHash=0x…
 *     → { messages: [{ status, message, attestation, eventNonce, forwardTxHash? }] }
 *     status: "pending_confirmations" | "complete"
 *
 * Live-verified during the CCTP migration (2026-08-22): the transactionHash
 * query is the documented V2 lookup; "complete" carries full message+attestation
 * bytes ready for MessageTransmitterV2.receiveMessage(message, attestation).
 * Rate limit: 40 req/s — the relayer round-robins checks to stay well below.
 */
"use strict";

function createIrisClient({ baseUrl, fetchImpl = fetch }) {
	/**
	 * Latest Iris state for a burn tx. Returns null when the tx is not (yet)
	 * indexed. A complete message carries `message` + `attestation` bytes.
	 */
	async function getMessage(srcDomain, txHash) {
		const url = `${baseUrl}/v2/messages/${srcDomain}?transactionHash=${txHash}`;
		const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
		if (res.status === 404) return null; // burn tx not indexed (yet)
		if (!res.ok) throw new Error(`Iris HTTP ${res.status} for ${txHash}`);
		const data = await res.json();
		const messages = data && Array.isArray(data.messages) ? data.messages : [];
		if (!messages.length) return null;
		// A tx CAN batch several burns; v1 relays the first only — surface the count.
		return { ...messages[0], messageCount: messages.length };
	}

	return { getMessage };
}

module.exports = { createIrisClient };
