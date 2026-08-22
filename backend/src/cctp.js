/**
 * CCTP V2 message parsing — offsets verified against Circle's official
 * contracts (circlefin/evm-cctp-contracts, src/messages/v2/):
 *
 * MessageV2._formatMessageForRelay header (abi.encodePacked, byte offsets):
 *   0   version uint32            4
 *   4   sourceDomain uint32       4
 *   8   destinationDomain uint32  4
 *   12  nonce bytes32            32
 *   44  sender bytes32           32
 *   76  recipient bytes32        32
 *   108 destinationCaller bytes32 32
 *   140 minFinalityThreshold uint32 4
 *   144 finalityThresholdExecuted uint32 4
 *   148 messageBody …
 *
 * BurnMessageV2 body (byte offsets within the body):
 *   0 version uint32 | 4 burnToken bytes32 | 36 mintRecipient bytes32
 *   68 amount uint256 | 100 messageSender bytes32 | 132 maxFee uint256
 *   164 feeExecuted uint256 | 196 expirationBlock uint256 | 228 hookData …
 *
 * event MessageSent(bytes message) — topic0 keccak256("MessageSent(bytes)")
 *   = 0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036
 *   (identical for V1/V2 — same signature; MessageTransmitterV2.sol:38)
 */
"use strict";

const MESSAGE_SENT_TOPIC = "0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036";
const MIN_HEADER_LEN = 148;

const hexSlice = (bytes, start, len) => "0x" + bytes.substr(start * 2, len * 2);
const readUint32 = (bytes, off) => parseInt(bytes.substr(off * 2, 8), 16);
const readUint256 = (bytes, off) => BigInt("0x" + bytes.substr(off * 2, 64)).toString();

function bytes32ToAddress(bytes32Hex) {
	return "0x" + bytes32Hex.slice(-40).toLowerCase();
}

/**
 * Parse a CCTP V2 relay message header + burn body.
 * @param {string} messageHex 0x-prefixed message bytes as returned by Iris.
 * @returns {{ version, sourceDomain, destinationDomain, nonce, sender, recipient,
 *            destinationCaller, minFinalityThreshold, burnToken, mintRecipient,
 *            amount, maxFee, expirationBlock, hasHook }}
 */
function parseCctpV2Message(messageHex) {
	if (typeof messageHex !== "string" || !/^0x[0-9a-fA-F]+$/.test(messageHex)) {
		throw new Error("message must be a 0x-prefixed hex string");
	}
	const b = messageHex.slice(2);
	if (b.length < MIN_HEADER_LEN * 2) throw new Error(`message too short (${b.length / 2}B < ${MIN_HEADER_LEN}B)`);

	const body = b.slice(MIN_HEADER_LEN * 2);
	if (body.length < 228 * 2) throw new Error(`burn message body too short (${body.length / 2}B < 228B)`);

	return {
		version: readUint32(b, 0),
		sourceDomain: readUint32(b, 4),
		destinationDomain: readUint32(b, 8),
		nonce: hexSlice(b, 12, 32),
		sender: bytes32ToAddress(hexSlice(b, 44, 32)),
		recipient: bytes32ToAddress(hexSlice(b, 76, 32)),
		destinationCaller: hexSlice(b, 108, 32), // keep full bytes32 — zero check only
		minFinalityThreshold: readUint32(b, 140),
		burnToken: bytes32ToAddress(hexSlice(body, 4, 32)),
		mintRecipient: bytes32ToAddress(hexSlice(body, 36, 32)),
		amount: readUint256(body, 68),
		maxFee: readUint256(body, 132),
		expirationBlock: readUint256(body, 196),
		// The receiver treats ANY non-empty hookData as "hook present" — decide
		// by length, not content (all-zero bytes still count as a hook).
		hasHook: body.length > 228 * 2
	};
}

const isZeroBytes32 = (hex) => /^0x0+$/.test(hex);

module.exports = { parseCctpV2Message, MESSAGE_SENT_TOPIC, isZeroBytes32, MIN_HEADER_LEN };
