// WarpArc — EIP-6963 multi-wallet discovery.
// Listens for "eip6963:announceProvider" events and collects wallet providers
// into a deduplicated registry (keyed by info.rdns). app.js reads
// window.WalletRegistry.discovered to build the connect-wallet picker.
// See https://eips.ethereum.org/EIPS/eip-6963. No DOM access here — the UI
// layer owns all rendering; this file only maintains the registry state.
"use strict";

const WalletRegistry = (() => {
	const discovered = [];

	// EIP-6963: wallets dispatch announceProvider with { info, provider }.
	window.addEventListener("eip6963:announceProvider", (event) => {
		const detail = event.detail;
		if (!detail || typeof detail !== "object") return;
		const info = detail.info;
		const provider = detail.provider;
		if (!info || typeof info !== "object") return;
		if (typeof info.name !== "string" || !info.name) return;
		if (typeof info.rdns !== "string" || !info.rdns) return;
		if (!provider) return;
		// Dedupe by rdns so re-announcements are ignored, never duplicated.
		if (discovered.some((entry) => entry.info.rdns === info.rdns)) return;
		discovered.push({ info: info, provider: provider });
	});

	return {
		discovered: discovered,
		start() {
			// Ask every installed wallet to announce itself.
			window.dispatchEvent(new Event("eip6963:requestProvider"));
			// Fallback for legacy injected wallets that never adopted EIP-6963:
			// after a short grace period, expose window.ethereum as a synthetic
			// entry — but only when no EIP-6963 wallet showed up.
			setTimeout(() => {
				if (discovered.length === 0 && window.ethereum) {
					discovered.push({
						info: { name: "Browser Wallet", rdns: "legacy.window.ethereum", icon: null },
						provider: window.ethereum
					});
				}
			}, 400);
		}
	};
})();

window.WalletRegistry = WalletRegistry;
