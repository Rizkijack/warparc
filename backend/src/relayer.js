/**
 * CCTP V2 relayer service (DEPLOY.md Path B — "custom flows / backend relayers";
 * workflow per docs.arc.io/integrate/exchanges/cctp-bridging).
 *
 * Job model (explicit by default, bounded by design):
 *   POST /relay {srcChain, burnTxHash}  →  queued
 *   queued → attestation_wait (Iris /v2/messages poll) → ready
 *   ready  → submitting → receiveMessage(message, attestation) on the
 *            destination MessageTransmitterV2 → relayed
 *
 * Safety (docs.arc.io/integrate/infrastructure/bridges — "relayer wallets funded
 * with USDC (not ETH)" on Arc):
 *   - Submission requires RELAYER_ENABLED=true AND RELAYER_DRY_RUN=false.
 *     Default boot is watch-only: jobs are tracked, submissions simulated.
 *   - destinationCaller != 0 → skipped (only that caller may complete it).
 *   - "already relayed"/nonce-replay errors count as success.
 *   - The relayer never moves user funds — receiveMessage mints to the burn's
 *     original mintRecipient; only relayer gas is spent.
 *   - Arc destination txs are type-2 with maxFeePerGas 30 Gwei (≥ the 20 Gwei
 *     floor, ARC-REFERENCE §9) and priority fee 0.
 *
 * BACKEND_AUTO_RELAY=true additionally watches MessageSent logs network-wide on
 * every configured source chain and enqueues burns matching the policy
 * (destination among our chains, destinationCaller zero, USDC burn token,
 * amount ≤ RELAYER_MAX_USDC_PER_TX). Off by default.
 */
"use strict";

const { ethers } = require("ethers");
const { createIrisClient } = require("./attestation");
const { parseCctpV2Message, MESSAGE_SENT_TOPIC, isZeroBytes32 } = require("./cctp");

const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ALREADY_RELAYED_RE = /already|replay|used|nonce/i;

const RECEIVE_MESSAGE_ABI = ["function receiveMessage(bytes message, bytes attestation) returns (bool)"];
const USED_NONCES_ABI = ["function usedNonces(bytes32 nonce) view returns (bool)"];

const ARC_MAX_FEE_PER_GAS_WEI = ethers.BigNumber.from(30).mul(1e9); // 30 Gwei ≥ 20 Gwei floor + margin
const ARC_PRIORITY_FEE_WEI = ethers.BigNumber.from(0);

function createRelayer({ backendCfg, chains, store, log = console }) {
	const { relayer: rcfg, network } = backendCfg;
	const iris = createIrisClient({ baseUrl: backendCfg.cfg.iris[network], log });
	const byDomain = new Map(chains.map((c) => [c.cctpDomain, c]));
	const byKey = new Map(chains.map((c) => [c.key, c]));

	// Boot guards — fail closed on impossible configurations.
	if (rcfg.enabled && !rcfg.dryRun && !rcfg.privateKey) {
		throw new Error("RELAYER_ENABLED=true + RELAYER_DRY_RUN=false requires RELAYER_PRIVATE_KEY (env)");
	}
	if (rcfg.privateKey && !/^(0x)?[0-9a-fA-F]{64}$/.test(rcfg.privateKey.trim())) {
		throw new Error("RELAYER_PRIVATE_KEY is not a valid 64-hex private key");
	}

	const providers = new Map();
	const wallets = new Map();
	function providerFor(chain) {
		if (!providers.has(chain.key)) {
			providers.set(
				chain.key,
				new ethers.providers.JsonRpcProvider(chain.rpcUrl, { chainId: chain.chainId, name: chain.key })
			);
		}
		return providers.get(chain.key);
	}
	function walletFor(chain) {
		if (!rcfg.privateKey) return null;
		if (!wallets.has(chain.key)) {
			wallets.set(chain.key, new ethers.Wallet(rcfg.privateKey.trim(), providerFor(chain)));
		}
		return wallets.get(chain.key);
	}

	// --- job store -----------------------------------------------------------

	function loadJobs() {
		const state = store.getState("relayer", { jobs: {} });
		return state && typeof state.jobs === "object" ? state.jobs : {};
	}
	function saveJobs(jobs) {
		// Cap growth: drop the OLDEST terminal jobs first when over maxJobs.
		const keys = Object.keys(jobs);
		if (keys.length > rcfg.maxJobs) {
			const terminal = (k) => ["relayed", "skipped", "failed"].includes(jobs[k].status);
			const droppable = keys.filter(terminal).sort((a, b) => String(jobs[a].updatedAt).localeCompare(String(jobs[b].updatedAt)));
			for (const k of droppable.slice(0, keys.length - rcfg.maxJobs)) delete jobs[k];
		}
		store.setState("relayer", { jobs });
	}
	function updateJob(txHash, patch) {
		const jobs = loadJobs();
		const prev = jobs[txHash] || {};
		// No-op guard: a job whose status (and payload) is unchanged must not
		// rewrite state.json — 500 pending jobs × every 5s tick = pure churn.
		const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
		const unchanged =
			prev.status === next.status &&
			prev.message === next.message &&
			prev.mintTxHash === next.mintTxHash &&
			prev.error === next.error &&
			prev.attempts === next.attempts;
		if (unchanged) return prev;
		jobs[txHash] = next;
		saveJobs(jobs);
		return next;
	}

	/**
	 * Queue a burn for relaying. Idempotent — re-queueing a finished job is a
	 * no-op unless it previously failed/skipped. Hash normalized to lowercase.
	 */
	function enqueue(srcChainKey, burnTxHash) {
		if (!TX_HASH_RE.test(burnTxHash)) throw new Error(`invalid tx hash "${burnTxHash}"`);
		const txHash = burnTxHash.toLowerCase();
		const chain = byKey.get(srcChainKey);
		if (!chain) throw new Error(`unknown src chain "${srcChainKey}" (have: ${[...byKey.keys()].join(", ")})`);
		const jobs = loadJobs();
		const existing = jobs[txHash];
		if (existing && !["failed", "skipped"].includes(existing.status)) return existing;
		const job = {
			txHash,
			srcChain: srcChainKey,
			srcDomain: chain.cctpDomain,
			status: "queued",
			attempts: 0,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		};
		jobs[txHash] = job;
		saveJobs(jobs);
		log.info(`[relayer] queued ${srcChainKey} ${txHash}`);
		return job;
	}

	/**
	 * POST /relay pre-check: the tx must exist AND actually be a CCTP burn
	 * (a MessageSent log from the chain's MessageTransmitterV2), so junk jobs
	 * fail fast with a clear error instead of timing out 10 minutes later.
	 */
	async function validateBurnTx(srcChainKey, burnTxHash) {
		if (!TX_HASH_RE.test(burnTxHash)) throw new Error(`invalid tx hash "${burnTxHash}"`);
		const chain = byKey.get(srcChainKey);
		if (!chain) throw new Error(`unknown src chain "${srcChainKey}"`);
		const receipt = await providerFor(chain).getTransactionReceipt(burnTxHash.toLowerCase());
		if (!receipt) throw new Error("tx not found on source chain (not mined yet? retry shortly)");
		const isBurn = receipt.logs.some(
			(l) => l.address && l.address.toLowerCase() === chain.messageTransmitterV2.toLowerCase() && l.topics && l.topics[0] === MESSAGE_SENT_TOPIC
		);
		if (!isBurn) throw new Error("tx is not a CCTP burn (no MessageSent event from MessageTransmitterV2)");
		return true;
	}

	// --- processing ----------------------------------------------------------

	const inFlight = new Set(); // txHashes with a submit promise open
	// All open submit promises — stop() awaits them so shutdown can't cut a
	// broadcast mid-flight (a killed "submitting" job re-broadcasts on reboot).
	const submitPromises = new Set();
	// Submissions are serialized per destination chain — concurrent sends from
	// one wallet race on nonce and can false-positive as "already used".
	const chainQueues = new Map();
	function serialize(chainKey, fn) {
		const prev = chainQueues.get(chainKey) || Promise.resolve();
		const next = prev.then(fn, fn);
		chainQueues.set(chainKey, next.catch(() => {}));
		return next;
	}

	async function processJob(job) {
		// Crash recovery: a job left "submitting" by a dead process is not
		// actually in flight here — send it back to ready.
		if (job.status === "submitting" && !inFlight.has(job.txHash)) {
			job = updateJob(job.txHash, { status: "ready" });
		}

		if (job.status === "queued" || job.status === "attestation_wait") {
			// Bounded wait: a burn that never attests must not occupy the store forever.
			if (Date.now() - Date.parse(job.createdAt) > rcfg.attestationTimeoutMs) {
				updateJob(job.txHash, { status: "failed", error: "attestation timeout" });
				log.warn(`[relayer] fail ${job.txHash}: attestation timeout`);
				return;
			}
			try {
				const msg = await iris.getMessage(job.srcDomain, job.txHash);
				if (msg && (msg.messageCount || 1) > 1) {
					log.warn(`[relayer] ${job.txHash} contains ${msg.messageCount} burns — only the first message is relayed (known limitation)`);
				}
				if (!msg) {
					updateJob(job.txHash, { status: "attestation_wait" });
					return;
				}
				if (msg.status !== "complete" || !msg.message || !msg.attestation) {
					updateJob(job.txHash, { status: "attestation_wait" });
					return;
				}
				const parsed = parseCctpV2Message(msg.message);
				const dst = byDomain.get(parsed.destinationDomain);
				if (!dst) {
					updateJob(job.txHash, {
						status: "skipped",
						error: `destination domain ${parsed.destinationDomain} not configured`
					});
					log.warn(`[relayer] skip ${job.txHash}: dst domain ${parsed.destinationDomain} unknown`);
					return;
				}
				if (!isZeroBytes32(parsed.destinationCaller)) {
					updateJob(job.txHash, {
						status: "skipped",
						error: "destinationCaller restricted — not relayable by this relayer"
					});
					log.warn(`[relayer] skip ${job.txHash}: destinationCaller set`);
					return;
				}
				if (parsed.hasHook && !rcfg.allowHooks) {
					// A hook executes arbitrary logic at the destination — this
					// relayer only handles plain burn-and-mint (the project's own
					// forward flow runs on Circle's infrastructure).
					updateJob(job.txHash, {
						status: "skipped",
						error: "hook burn — set RELAYER_ALLOW_HOOKS=true to relay these"
					});
					log.warn(`[relayer] skip ${job.txHash}: hookData present`);
					return;
				}
				updateJob(job.txHash, {
					status: "ready",
					message: msg.message,
					attestation: msg.attestation,
					dstChain: dst.key,
					parsed: {
						recipient: parsed.mintRecipient,
						burnToken: parsed.burnToken,
						amount: parsed.amount,
						maxFee: parsed.maxFee,
						minFinalityThreshold: parsed.minFinalityThreshold,
						hasHook: parsed.hasHook
					}
				});
			} catch (e) {
				updateJob(job.txHash, { status: "attestation_wait", error: e.message });
			}
			return;
		}

		if (job.status === "ready") {
			if (inFlight.has(job.txHash)) return;
			if (!rcfg.enabled || rcfg.dryRun || !rcfg.privateKey) {
				// Watch-only: stay ready, surfaced via /jobs.
				return;
			}
			inFlight.add(job.txHash);
			const p = serialize(job.dstChain, () => submit(job))
				.catch((e) => log.error(`[relayer] submit ${job.txHash}: ${e.message}`))
				.finally(() => inFlight.delete(job.txHash));
			submitPromises.add(p);
			p.finally(() => submitPromises.delete(p));
		}
	}

	/**
	 * Confirm on-chain that a message nonce was consumed — the honest witness
	 * for "someone already relayed this" (error text alone can false-positive
	 * on nonce races that never mined).
	 */
	async function nonceUsed(dst, nonceBytes32) {
		try {
			const mt = new ethers.Contract(dst.messageTransmitterV2, USED_NONCES_ABI, providerFor(dst));
			return await mt.usedNonces(nonceBytes32);
		} catch (e) {
			log.warn(`[relayer] usedNonces check failed: ${e.message}`);
			return false;
		}
	}

	/**
	 * Daily gas budget per destination chain (state key "relayer:budget").
	 * Arc native gas is USDC (18-dec); EVM chains pay ETH. When a chain's
	 * daily budget is exhausted, submissions to it pause for the rest of the
	 * UTC day — ready jobs stay ready and resume next day (or after a budget
	 * bump). Bounds worst-case live-mode spend even with auto-relay on.
	 */
	const BUDGET_KEY = "relayer:budget";
	const todayUtc = () => new Date().toISOString().slice(0, 10);
	function budgetState() {
		const st = store.getState(BUDGET_KEY, null);
		if (!st || st.date !== todayUtc()) return { date: todayUtc(), perChain: {} };
		return st;
	}
	function budgetLimit(chain) {
		return chain.isArc ? rcfg.dailyUsdcBudget : rcfg.dailyEthBudget;
	}
	function budgetSpentNative(chainKey) {
		const st = budgetState();
		return BigInt(st.perChain[chainKey] || "0");
	}
	function budgetPaused(chain) {
		// Arc gas is 18-dec native USDC; EVM gas is ETH (18-dec too).
		const limitNative = ethers.utils.parseUnits(String(budgetLimit(chain)), chain.isArc ? 18 : 18);
		return budgetSpentNative(chain.key) >= limitNative;
	}
	function recordGas(chain, receipt) {
		try {
			const price = receipt.effectiveGasPrice || receipt.gasPrice || 0;
			const cost = ethers.BigNumber.from(receipt.gasUsed).mul(price);
			const st = budgetState();
			st.perChain[chain.key] = (BigInt(st.perChain[chain.key] || "0") + cost.toBigInt()).toString();
			store.setState(BUDGET_KEY, st);
		} catch (e) {
			log.warn(`[relayer] budget accounting failed: ${e.message}`);
		}
	}
	const budgetWarned = new Set();
	function budgetGuard(dst) {
		if (!budgetPaused(dst)) {
			budgetWarned.delete(dst.key);
			return true;
		}
		if (!budgetWarned.has(dst.key)) {
			budgetWarned.add(dst.key);
			log.warn(`[relayer] daily gas budget for ${dst.key} exhausted — submissions paused until UTC day rolls over`);
		}
		return false;
	}

	async function submit(job) {
		const dst = byKey.get(job.dstChain);
		if (!budgetGuard(dst)) return; // stays "ready"; retried next tick
		updateJob(job.txHash, { status: "submitting" });
		try {
			const wallet = walletFor(dst);
			const mt = new ethers.Contract(dst.messageTransmitterV2, RECEIVE_MESSAGE_ABI, wallet);
			const overrides = dst.isArc
				? { type: 2, maxFeePerGas: ARC_MAX_FEE_PER_GAS_WEI, maxPriorityFeePerGas: ARC_PRIORITY_FEE_WEI }
				: {};
			const tx = await mt.receiveMessage(job.message, job.attestation, overrides);
			const receipt = await tx.wait();
			recordGas(dst, receipt); // reverted receipts cost gas too — always account
			if (receipt.status === 0) {
				throw new Error(`receiveMessage tx ${receipt.transactionHash} reverted on-chain`);
			}
			updateJob(job.txHash, { status: "relayed", mintTxHash: receipt.transactionHash, error: null });
			log.info(`[relayer] relayed ${job.txHash} → ${dst.key} mint ${receipt.transactionHash}`);
		} catch (e) {
			const msgText = String((e && (e.reason || e.message)) || e);
			if (ALREADY_RELAYED_RE.test(msgText)) {
				const parsed = parseCctpV2Message(job.message);
				const confirmed = await nonceUsed(dst, parsed.nonce);
				if (confirmed) {
					updateJob(job.txHash, { status: "relayed", error: `already relayed: ${msgText.slice(0, 200)}` });
					log.info(`[relayer] ${job.txHash} already relayed elsewhere (usedNonces ✓) — done`);
					return;
				}
				log.warn(`[relayer] ${job.txHash} looked relayed but usedNonces=false — will retry`);
			}
			const attempts = (job.attempts || 0) + 1;
			const failed = attempts >= rcfg.maxSubmitAttempts;
			updateJob(job.txHash, {
				status: failed ? "failed" : "ready",
				attempts,
				error: msgText.slice(0, 400)
			});
			log.error(`[relayer] submit ${job.txHash} attempt ${attempts} failed: ${msgText.slice(0, 200)}`);
		}
	}

	// --- optional auto watcher (BACKEND_AUTO_RELAY) ---------------------------

	async function watchOnce(chain) {
		const provider = providerFor(chain);
		const head = await provider.getBlockNumber();
		const safe = head - 1;
		const markKey = `relayer:watch:${chain.key}`;
		// Start at the current head — auto-relay watches NEW burns only, no
		// historical backfill (relaying strangers' old burns is not our call).
		const from0 = store.getState(markKey, safe);
		if (from0 > safe) return;
		// Chunk like the indexer — public RPCs cap getLogs result size and a
		// long gap after downtime would otherwise error every tick forever.
		const CHUNK = 500;
		let processed = from0 - 1;
		for (let from = from0; from <= safe; from += CHUNK) {
			const to = Math.min(from + CHUNK - 1, safe);
			const logs = await provider.getLogs({
				address: chain.messageTransmitterV2,
				topics: [MESSAGE_SENT_TOPIC],
				fromBlock: from,
				toBlock: to
			});
			for (const l of logs) {
				try {
					// MessageSent(bytes message) — data is abi-encoded bytes (offset+length+payload)
					const decoded = ethers.utils.defaultAbiCoder.decode(["bytes"], l.data);
					const parsed = parseCctpV2Message(decoded[0]);
					// V2 burns may carry an expiration source-block — skip burns that
					// already expired (the destination mint would revert).
					const expired = parsed.expirationBlock !== "0" && head > Number(parsed.expirationBlock);
					const dst = byDomain.get(parsed.destinationDomain);
					// Auto policy (strangers' burns — be conservative):
					//   destination must be Arc, plain burn only (no hooks),
					//   USDC burn token must be KNOWN on the source chain,
					//   destinationCaller zero, not expired, amount within cap.
					const burnTokenOk = !!chain.usdc && parsed.burnToken === chain.usdc.toLowerCase();
					const amountUsdc = Number(BigInt(parsed.amount)) / 1e6;
					if (
						dst &&
						dst.isArc &&
						!parsed.hasHook &&
						!expired &&
						isZeroBytes32(parsed.destinationCaller) &&
						burnTokenOk &&
						amountUsdc > 0 &&
						amountUsdc <= rcfg.maxRelayUsdc
					) {
						enqueue(chain.key, l.transactionHash);
					}
				} catch (e) {
					log.warn(`[relayer:watch] unparsable MessageSent in ${l.transactionHash}: ${e.message}`);
				}
			}
			processed = to;
			if (from + CHUNK <= safe) {
				await new Promise((r) => setTimeout(r, 150)); // same RPC pacing as the indexer
			}
		}
		store.setState(markKey, processed + 1);
	}

	// --- loop -----------------------------------------------------------------

	let timer = null;
	let ticking = Promise.resolve(); // in-flight tick — stop() awaits it
	let irisCursor = 0; // round-robin cursor over attestation polling
	async function tick() {
		const jobs = loadJobs();
		// Iris allows 40 req/s — polling every pending job every tick would blow
		// past that at a few hundred jobs. Round-robin: only the next
		// irisChecksPerTick pending jobs get an attestation check this tick.
		const all = Object.values(jobs);
		const pending = all.filter((j) => j.status === "queued" || j.status === "attestation_wait");
		const chosen = new Set();
		if (pending.length > 0) {
			const n = Math.min(rcfg.irisChecksPerTick, pending.length);
			for (let i = 0; i < n; i++) chosen.add(pending[(irisCursor + i) % pending.length].txHash);
			irisCursor = (irisCursor + n) % pending.length;
		}
		for (const job of all) {
			if ((job.status === "queued" || job.status === "attestation_wait") && !chosen.has(job.txHash)) continue;
			await processJob(job);
		}
		if (rcfg.autoRelay) {
			for (const chain of chains) {
				try {
					await watchOnce(chain);
				} catch (e) {
					log.error(`[relayer:watch] ${chain.key} error (continuing): ${e.message}`);
				}
			}
		}
	}

	function start() {
		if (timer) return;
		const mode = !rcfg.enabled || rcfg.dryRun ? "watch-only" : "LIVE";
		log.info(
			`[relayer] started (${mode}, network=${network}, sources=${chains.map((c) => c.key).join(",")}` +
				`${rcfg.autoRelay ? ", auto-relay ON" : ""})`
		);
		timer = setInterval(() => {
			ticking = tick().catch((e) => log.error(`[relayer] tick error (continuing): ${e.message}`));
		}, rcfg.pollMs);
	}
	function stop() {
		if (timer) clearInterval(timer);
		timer = null;
		// Await the in-flight tick AND any open submits — a killed submit stays
		// "submitting" on disk and re-broadcasts after restart (wasting gas).
		return Promise.allSettled([ticking, ...submitPromises]).then(() => {});
	}

	function getJobs() {
		return loadJobs();
	}
	function stats() {
		const jobs = Object.values(loadJobs());
		const byStatus = {};
		for (const j of jobs) byStatus[j.status] = (byStatus[j.status] || 0) + 1;
		const st = budgetState();
		const budgets = {};
		for (const chain of chains) {
			const limit = budgetLimit(chain);
			const spentNative = budgetSpentNative(chain.key);
			budgets[chain.key] = {
				unit: chain.isArc ? "USDC" : "ETH",
				budget: limit,
				spent: Number(spentNative) / 1e18,
				paused: budgetPaused(chain)
			};
		}
		return {
			mode: !rcfg.enabled || rcfg.dryRun ? "watch-only" : "live",
			autoRelay: rcfg.autoRelay,
			network,
			total: jobs.length,
			byStatus,
			budgetDate: st.date,
			budgets
		};
	}

	return { start, stop, enqueue, validateBurnTx, getJobs, stats, tick };
}

module.exports = { createRelayer, ALREADY_RELAYED_RE };
