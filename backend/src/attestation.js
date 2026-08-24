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
 *
 * Every lookup is bounded by an AbortController deadline (opts.timeoutMs,
 * default 15s): a hung Iris socket surfaces as a thrown Error instead of
 * freezing the caller forever (the relayer additionally races its own shorter
 * per-tick deadline on top — see relayer.js).
 */
"use strict";

const DEFAULT_TIMEOUT_MS = 15_000;

function createIrisClient({ baseUrl, fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
	const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS;

	/**
	 * Latest Iris state for a burn tx. Returns null when the tx is not (yet)
	 * indexed. A complete message carries `message` + `attestation` bytes.
	 */
	async function getMessage(srcDomain, txHash) {
		const url = `${baseUrl}/v2/messages/${srcDomain}?transactionHash=${txHash}`;
		const ctrl = new AbortController();
		let timer;
		try {
			timer = setTimeout(() => ctrl.abort(), timeout);
			if (timer.unref) timer.unref();
			const res = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: ctrl.signal });
			if (res.status === 404) return null; // burn tx not indexed (yet)
			if (!res.ok) throw new Error(`Iris HTTP ${res.status} for ${txHash}`);
			const data = await res.json();
			const messages = data && Array.isArray(data.messages) ? data.messages : [];
			if (!messages.length) return null;
			// A tx CAN batch several burns; v1 relays the first only — surface the count.
			return { ...messages[0], messageCount: messages.length };
		} catch (e) {
			if (ctrl.signal.aborted || e.name === "AbortError") {
				throw new Error(`Iris request timed out after ${timeout}ms for ${txHash}`);
			}
			throw e;
		} finally {
			clearTimeout(timer);
		}
	}

	return { getMessage };
}

module.exports = { createIrisClient };
