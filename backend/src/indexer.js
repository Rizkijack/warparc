/**
 * USDC Transfer indexer service (DEPLOY.md §6; design per
 * docs.arc.io/integrate/infrastructure/indexing-events).
 *
 * Arc's USDC emits TWO Transfer logs for one movement:
 *   - ERC-20 emitter 0x3600…0000 (6 decimals, CANONICAL view)
 *   - EIP-7708 system emitter 0xffff…fffe (18 decimals, MIRROR = canonical × 1e12)
 * Both are recorded but tagged (`kind`), so consumers never double-count.
 * Non-Arc chains have no system emitter — ERC-20 stream only.
 *
 * Confirmations = 1 (deterministic finality — bridges integration checklist).
 * Transport: HTTPS eth_getLogs polling; an optional per-chain WebSocket
 * (eth_subscribe newHeads) accelerates polls when available (Node 22+ exposes
 * a global WebSocket; otherwise polling still works).
 *
 * Watermarks persist via the injected getState/setState (Store), keyed
 * `indexer:<chain>` — a restart resumes exactly where it stopped.
 */
"use strict";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const LOOKBACK_DEFAULT = 2000;
const ZERO_ADDRESS = "0x" + "0".repeat(40);

// Per-RPC-call deadline: a hung socket (silent TCP black hole) previously
// stalled the whole pollAll loop for every chain (undici's default timeouts
// stretch to minutes). 15s bounds one HTTP attempt; an abort is classified
// like a transient HTTP failure so the existing polite-retry/backoff path
// applies. Mirrors the relayer's IRIS_FETCH_TIMEOUT_MS guard.
const RPC_FETCH_TIMEOUT_MS = parseInt(process.env.INDEXER_RPC_TIMEOUT_MS, 10) || 15_000;
// docs.arc.io/arc/references/usdc-system-events — mint/burn are the only 0x0
// paths (via precompile): Transfer(0x0→to) = mint, Transfer(from→0x0) = burn.
function directionOf(from, to) {
	if (from === ZERO_ADDRESS) return "mint";
	if (to === ZERO_ADDRESS) return "burn";
	return "transfer";
}

function classify(chain, emitter) {
	const e = emitter.toLowerCase();
	if (chain.usdcEmitters.includes(e)) return { kind: "erc20", divide: false };
	if (chain.systemEmitter && e === chain.systemEmitter) return { kind: "system", divide: true };
	return null;
}

/**
 * One chain's poller. rpcCall is a (method, params) → Promise<result> wrapper,
 * injected so tests can stub the transport. When `persist` is provided, each
 * entry is persisted BEFORE the watermark advances — a failed append (disk
 * full) leaves the range unfetched, never silently lost.
 */
function createChainIndexer({ chain, rpcCall, getState, setState, persist, log = console }) {
	const watermarkKey = `indexer:${chain.key}`;
	const seen = new Set(); // "block:txHash:logIndex" dedupe, pruned below watermark
	// Arc's RPC caps getLogs result size (~860 blocks × dual emitters today);
	// chunk well below the cap and advance the watermark per completed chunk so
	// a failure mid-sweep only replays the unfinished tail.
	const chunkBlocks = chain.maxBlockRange || 1000;
	const address = [...chain.usdcEmitters, ...(chain.systemEmitter ? [chain.systemEmitter] : [])];
	// Distinct-block cap for timestamp enrichment — busy stretches (every block
	// has events, e.g. Arc testnet) exceed it and are skipped honestly: the
	// per-block eth_getBlockByNumber cost would dwarf the getLogs sweep itself.
	const tsCap = chain.maxTimestampBlocksPerChunk || 100;
	let tsWarned = false;
	// One sweep at a time per chain: interval + WSS wakeups can otherwise race
	// (overlapping fetches of the same range duplicate appends after the faster
	// sweep prunes the dedupe set). A busy poll returns empty — the next tick
	// picks the range up.
	let sweeping = false;

	async function pollOnce() {
		if (sweeping) return { entries: [], safeHead: -1, nextBlock: getState(watermarkKey, null) ?? 0, busy: true };
		sweeping = true;
		try {
			return await sweep();
		} finally {
			sweeping = false;
		}
	}

	async function sweep() {
		const head = parseInt(await rpcCall("eth_blockNumber", []), 16);
		const safeHead = Math.max(0, head - (chain.confirmations ?? 1));
		const watermark = getState(watermarkKey, null);
		let fromBlock =
			watermark != null ? watermark : chain.startBlock != null ? chain.startBlock : Math.max(0, safeHead - LOOKBACK_DEFAULT);
		if (fromBlock > safeHead) return { entries: [], safeHead, nextBlock: fromBlock };

		const entries = [];
		let processedTo = fromBlock - 1;
		for (; fromBlock <= safeHead; fromBlock += chunkBlocks) {
			const toBlock = Math.min(fromBlock + chunkBlocks - 1, safeHead);
			let chunkEntries = [];
			try {
				const logs = await rpcCall("eth_getLogs", [
					{
						fromBlock: "0x" + fromBlock.toString(16),
						toBlock: "0x" + toBlock.toString(16),
						address,
						topics: [TRANSFER_TOPIC]
					}
				]);

				for (const lg of Array.isArray(logs) ? logs : []) {
					let entry;
					try {
						const block = parseInt(lg.blockNumber, 16);
						const logIndex = parseInt(lg.logIndex, 16);
						const key = `${block}:${lg.transactionHash}:${logIndex}`;
						if (seen.has(key)) continue;
						seen.add(key);
						const info = classify(chain, lg.address);
						if (!info) continue; // unknown emitter — not a USDC stream we track
						const raw = BigInt(lg.data);
						const amount6 = info.divide ? raw / 10n ** 12n : raw;
						const from = "0x" + lg.topics[1].slice(-40).toLowerCase();
						const to = "0x" + lg.topics[2].slice(-40).toLowerCase();
						entry = {
							chain: chain.key,
							block,
							txHash: lg.transactionHash,
							logIndex,
							emitter: lg.address.toLowerCase(),
							kind: info.kind,
							direction: directionOf(from, to),
							from,
							to,
							amountRaw: raw.toString(),
							amount6: amount6.toString(),
							ts: new Date().toISOString()
						};
					} catch (e) {
						// One malformed log must not poison the whole chain —
						// skip it and keep sweeping.
						log.warn(`[indexer:${chain.key}] malformed log skipped in ${lg.transactionHash}: ${e.message}`);
						continue;
					}
					entries.push(entry);
					chunkEntries.push(entry);
				}

				// Enrich with block timestamps (docs: an indexer view should be
				// time-addressable). Only the blocks that produced entries —
				// exact values or none; busy chunks skip (warned once per chain).
				// Runs BEFORE persist so the enriched fields reach events.jsonl.
				const distinctBlocks = [...new Set(chunkEntries.map((e) => e.block))];
				if (distinctBlocks.length > 0 && distinctBlocks.length <= tsCap) {
					const stamps = new Map();
					for (const b of distinctBlocks) {
						try {
							const blk = await rpcCall("eth_getBlockByNumber", ["0x" + b.toString(16), false]);
							if (blk && blk.timestamp) stamps.set(b, parseInt(blk.timestamp, 16));
						} catch (e) {
							log.warn(`[indexer:${chain.key}] block timestamp fetch failed for ${b}: ${e.message}`);
						}
					}
					for (const e of chunkEntries) {
						const sec = stamps.get(e.block);
						if (sec) e.blockTimestamp = new Date(sec * 1000).toISOString();
					}
				} else if (distinctBlocks.length > tsCap && !tsWarned) {
					tsWarned = true;
					log.warn(
						`[indexer:${chain.key}] chunks exceed ${tsCap} event-blocks — timestamp enrichment stays off while this load persists (ingest-time ts still recorded)`
					);
				}

				// Persist only after enrichment — a throw here aborts the chunk
				// below the watermark (unpersisted range refetches next poll).
				if (persist) for (const e of chunkEntries) persist(e);
			} catch (e) {
				// Keep progress made so far; the failed chunk retries next poll.
				if (processedTo >= getState(watermarkKey, -1)) setState(watermarkKey, processedTo + 1);
				if (entries.length === 0) throw e;
				return { entries, safeHead, nextBlock: processedTo + 1 };
			}
				processedTo = toBlock;
				// Crash-safe watermark: advance after EVERY completed chunk (its
				// events are already persisted above) — a crash mid-sweep then
				// refetches only the unfinished chunk, never duplicating completed
				// chunks (the in-process dedupe Set dies with the process).
				setState(watermarkKey, processedTo + 1);
				if (fromBlock + chunkBlocks <= safeHead) {
					// Inter-chunk pacing — public RPCs 429 on back-to-back sweeps.
					await new Promise((r) => setTimeout(r, 150));
				}
			}

		entries.sort((a, b) => a.block - b.block || a.logIndex - b.logIndex);
		// Ranges at or below the watermark can never be re-fetched — prune.
		for (const k of seen.keys()) if (Number(k.split(":")[0]) <= processedTo) seen.delete(k);
		return { entries, safeHead, nextBlock: processedTo + 1 };
	}

	return { key: chain.key, pollOnce };
}

/** fetch() with a hard deadline: aborts the request once ms elapse so a hung
 *  socket surfaces as a rejection instead of freezing the caller. */
async function fetchWithTimeout(url, opts, ms) {
	const ac = new AbortController();
	const timer = setTimeout(() => ac.abort(), ms);
	try {
		return await fetch(url, { ...opts, signal: ac.signal });
	} finally {
		clearTimeout(timer);
	}
}

/** Plain JSON-RPC-over-HTTP wrapper (no deps) with one polite retry on
 *  rate-limit/transient-server errors (public RPCs 429 on bursts). */
function makeRpcCall(rpcUrl) {
	let id = 0;
	async function once(method, params) {
		let res;
		try {
			res = await fetchWithTimeout(
				rpcUrl,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params })
				},
				RPC_FETCH_TIMEOUT_MS
			);
		} catch (e) {
			if (e && e.name === "AbortError") {
				// Deadline hit — classify like the transient HTTP failures below so
				// the existing retry/backoff path handles it (never surfaces raw).
				const err = new Error(`RPC timeout after ${RPC_FETCH_TIMEOUT_MS}ms`);
				err.httpStatus = 503;
				err.retryAfterMs = 0;
				throw err;
			}
			throw e;
		}
		if (res.status === 429 || res.status === 503) {
			const err = new Error(`RPC HTTP ${res.status}`);
			err.httpStatus = res.status;
			err.retryAfterMs = (parseInt(res.headers.get("retry-after"), 10) || 0) * 1000;
			throw err;
		}
		if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
		const data = await res.json();
		if (data.error) throw new Error(`RPC error ${JSON.stringify(data.error)}`);
		return data.result;
	}
	return async function rpcCall(method, params) {
		try {
			return await once(method, params);
		} catch (e) {
			if (!e.httpStatus) throw e; // only rate-limit/transient get a retry
			await new Promise((r) => setTimeout(r, e.retryAfterMs || 600));
			return once(method, params);
		}
	};
}

/**
 * Run all configured chains in one polling loop. Returns { stop() }.
 * Optionally opens a newHeads WebSocket per chain that provides wsUrl —
 * a new head triggers that chain's poll immediately instead of waiting
 * for the next interval tick.
 */
function runIndexer({ chains, store, log = console, pollMs = 5000, useWs = true }) {
	const pollers = chains.map((chain) =>
		createChainIndexer({
			chain,
			rpcCall: makeRpcCall(chain.rpcUrl),
			getState: (k, f) => store.getState(k, f),
			setState: (k, v) => store.setState(k, v),
			// Entries are appended inside pollOnce, BEFORE the watermark moves —
			// pollAll must not append them a second time.
			persist: (e) => store.appendEvent(e),
			log
		})
	);

	const sockets = [];
	const wakeups = new Map(pollers.map((p) => [p.key, () => {}]));
	let stopped = false;

	async function pollAll() {
		for (const p of pollers) {
			try {
				const { entries, safeHead } = await p.pollOnce();
				if (entries.length > 0) log.info(`[indexer:${p.key}] block ${safeHead} +${entries.length} event(s)`);
			} catch (e) {
				log.error(`[indexer:${p.key}] error (continuing): ${e.message}`);
			}
		}
	}

	function openSocket(chain) {
		if (!useWs || !chain.wsUrl || typeof WebSocket === "undefined") return;
		try {
			const ws = new WebSocket(chain.wsUrl);
			let chainKey = chain.key;
			ws.onopen = () => ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_subscribe", params: ["newHeads"] }));
			ws.onmessage = (ev) => {
				try {
					const data = JSON.parse(String(ev.data));
					if (data.method === "eth_subscription") wakeups.get(chainKey)?.();
				} catch (_) {
					/* ignore malformed frames */
				}
			};
			ws.onerror = () => log.warn(`[indexer:${chain.key}] ws error — falling back to polling`);
			ws.onclose = () => {
				if (!stopped) log.warn(`[indexer:${chain.key}] ws closed — polling only`);
			};
			sockets.push(ws);
		} catch (e) {
			log.warn(`[indexer:${chain.key}] ws unavailable (${e.message}) — polling only`);
		}
	}

	for (const chain of chains) {
		const poller = pollers.find((p) => p.key === chain.key);
		wakeups.set(
			chain.key,
			debounce(() => {
				if (stopped) return;
				// Track WSS-triggered sweeps too — stop() must await every path
				// that can still append events / advance the watermark.
				runSweep(async () => {
					try {
						const { entries, safeHead } = await poller.pollOnce();
						if (entries.length > 0) log.info(`[indexer:${chain.key}] block ${safeHead} +${entries.length} event(s)`);
					} catch (e) {
						log.error(`[indexer:${chain.key}] error (continuing): ${e.message}`);
					}
				});
			}, 250)
		);
		openSocket(chain);
	}

	let inFlight = Promise.resolve(); // ALL in-progress sweeps — stop() awaits them
	const runSweep = (fn) => {
		// Chain onto everything already running so stop() can't miss a sweep.
		inFlight = Promise.allSettled([inFlight, fn()]).then(() => {});
	};
	const timer = setInterval(() => runSweep(pollAll), pollMs);
	runSweep(pollAll);

	function stop() {
		stopped = true;
		clearInterval(timer);
		for (const ws of sockets) {
			try {
				ws.close();
			} catch (_) {
				/* already closed */
			}
		}
		// Callers that clean up behind the indexer (tests, shutdown) should
		// await this — an in-flight sweep may still be about to append events.
		return inFlight;
	}

	if (!process.env.BACKEND_NO_SIGINT) {
		process.on("SIGINT", () => {
			stop();
			process.exit(0);
		});
	}
	return { stop };
}

function debounce(fn, ms) {
	let t = null;
	return () => {
		if (t) clearTimeout(t);
		t = setTimeout(fn, ms);
	};
}

module.exports = { createChainIndexer, runIndexer, makeRpcCall, TRANSFER_TOPIC };
