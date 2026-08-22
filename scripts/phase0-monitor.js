/**
 * Phase 0 Monitor — pre-launch source watcher menuju mainnet Arc (target 16 Sep 2026).
 *
 * Sesuai MAINNET-CHECKLIST.md Phase 0: cek berkala sumber-sumber publik (RPC testnet,
 * docs.arc.io, community blog) untuk mendeteksi munculnya info mainnet. Script HANYA
 * MENDETEKSI perubahan — tidak pernah menebak nilai (?TBD? di checklist tetap diisi
 * manual dari sumber resmi saat launch).
 *
 * Hasil tiap cek disimpan sebagai snapshot ke cache/phase0-state.json (git-ignored).
 * Bila state lama ada, output mencetak `CHANGED: <key>` untuk setiap perbedaan antar
 * run (mis. halaman mainnet baru muncul, chain id berubah, kata kunci muncul/hilang,
 * halaman docs berubah struktur/404). Stale key yang hilang otomatis terbuang karena
 * file state di-overwrite dengan snapshot terbaru.
 *
 * Penggunaan: node scripts/phase0-monitor.js   (Node 18+, global fetch, tanpa dependency)
 * Jalankan manual atau via `npm run monitor:phase0` (jadwalkan tiap beberapa hari).
 */

"use strict";

const crypto = require("crypto");
const path = require("path");

const TIMEOUT_MS = 10_000; // timeout per fetch via AbortController
const TESTNET_CHAIN_ID = 5042002; // Arc testnet chain id (desimal — banding pakai parseInt, bukan hardcode hex)
const RPC_URL = "https://rpc.testnet.arc.io";
const LLMS_URL = "https://docs.arc.io/llms.txt";
const BLOG_URL = "https://community.arc.io/public/blogs/arc-public-mainnet-launches-september-16-2026-2026-08-06";
const STATE_FILE = path.join(__dirname, "..", "cache", "phase0-state.json");

// Halaman referensi docs.arc.io yang dipantau: setiap fetch + cek kata kunci.
// Kata kunci HARUS flip-capable: jenuh sekarang = tidak akan pernah melaporkan
// CHANGED saat launch. Karena itu marker "mainnet" polos TIDAK dipakai di connect-to-arc
// (ia sudah FOUND lewat contoh kode Ethereum-mainnet viem).
// Yang dipakai: frasa penyangkalan / absentKeywords (FOUND -> absent saat launch),
// pola spesifik kemunculan mainnet Arc (absent -> FOUND saat launch), dan snapshot sha256.
const REF_PAGES = [
	{
		key: "docs/connect-to-arc",
		url: "https://docs.arc.io/arc/references/connect-to-arc.md",
		keywords: ["mainnet RPC", "rpc.mainnet"], // section "mainnet RPC" / RPC mainnet Arc muncul
		// NB: kata "mainnet" polos tidak dipantau — contoh viem di halaman ini selalu
		// mengimpor `mainnet` dari viem/chains, jadi selalu FOUND (noise permanen).
	},
	{
		key: "docs/contract-addresses",
		url: "https://docs.arc.io/arc/references/contract-addresses.md",
		// Section "Mainnet addresses" dianggap muncul HANYA bila disclaimer pre-launch
		// "not yet available" sudah hilang dari halaman; atau "rpc.mainnet" muncul.
		keywords: ["Mainnet addresses", "rpc.mainnet"],
		absentKeywords: ["not yet available"],
	},
	{
		key: "docs/bridges",
		url: "https://docs.arc.io/integrate/infrastructure/bridges.md",
		keywords: ["CCTP domain", "mainnet"], // CCTP domain mainnet dipublikasikan? (masih absent — sehat)
	},
	{
		key: "docs/supported-blockchains",
		url: "https://docs.arc.io/app-kit/references/supported-blockchains.md",
		keywords: ["Arc_Mainnet", "Arc Mainnet", "Robinhood"], // Arc muncul/dipindah ke tabel MAINNET? Robinhood Chain masuk tabel CCTP/App Kit? (checklist Phase 0)
	},
	{
		key: "docs/gas-and-fees",
		url: "https://docs.arc.io/arc/references/gas-and-fees.md",
		mode: "snapshot", // checklist: "Note any change to fee parameters" — diff per-key
		                 // otomatis CHANGED bila sha256 body halaman berubah sedikit pun.
	},
];

// --- helpers -----------------------------------------------------------------

// fetch + AbortController timeout; selalu resolve objek, tidak pernah throw.
async function fetchText(url, options = {}) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const res = await fetch(url, { ...options, signal: controller.signal });
		if (!res.ok) return { ok: false, status: res.status, text: "", error: `HTTP ${res.status}` };
		return { ok: true, status: res.status, text: await res.text(), error: null };
	} catch (e) {
		const msg = e.name === "AbortError" ? `timeout >${TIMEOUT_MS / 1000}s` : e.message;
		return { ok: false, status: null, text: "", error: msg };
	} finally {
		clearTimeout(timer);
	}
}

// cek kehadiran kata kunci (case-insensitive). Whitespace dinormalisasi karena
// markdown sering memotong frasa di tengah baris (mis. disclaimer dalam <Note>).
function has(text, keyword) {
	const norm = (s) => s.toLowerCase().replace(/\s+/g, " ");
	return norm(text).includes(norm(keyword));
}

// temuan standar untuk satu kata kunci: `"<kw>": FOUND | absent`.
// Bila absentKeywords diberikan, FOUND mensyaratkan keyword ADA dan SEMUA
// absentKeywords TIDAK ADA (mis. disclaimer "not yet available" masih menutupi section).
function keywordFinding(keyword, text, absentKeywords = []) {
	const found = has(text, keyword) && !absentKeywords.some((kw) => has(text, kw));
	return `"${keyword}": ${found ? "FOUND" : "absent"}`;
}

// sha256 hex dari body halaman — dipakai mode snapshot untuk mendeteksi perubahan apa pun.
function sha256Hex(text) {
	return crypto.createHash("sha256").update(text).digest("hex");
}

// --- cek per sumber -----------------------------------------------------------

// 1. Liveness RPC testnet Arc: eth_chainId harus = 5042002 (hex -> desimal via parseInt).
async function checkRpc() {
	const res = await fetchText(RPC_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", method: "eth_chainId", params: [], id: 1 }),
	});
	if (!res.ok) {
		return { key: "rpc.testnet.arc.io", ok: false, findings: [`error: ${res.error}`], error: res.error };
	}
	let data;
	try {
		data = JSON.parse(res.text);
	} catch (e) {
		return { key: "rpc.testnet.arc.io", ok: false, findings: ["error: response bukan JSON valid"], error: "invalid JSON response" };
	}
	const hex = data && data.result;
	if (typeof hex !== "string" || !/^0x[0-9a-fA-F]+$/.test(hex)) {
		return {
			key: "rpc.testnet.arc.io",
			ok: false,
			findings: [`error: unexpected JSON-RPC response ${JSON.stringify(data).slice(0, 120)}`],
			error: "unexpected JSON-RPC response",
		};
	}
	const chainId = parseInt(hex, 16); // penting: parseInt(hex, 16), bukan hardcode hex
	const match = chainId === TESTNET_CHAIN_ID;
	return {
		key: "rpc.testnet.arc.io",
		ok: true,
		findings: [`chainId=${chainId}`, match ? "MATCH" : `MISMATCH (expect ${TESTNET_CHAIN_ID})`],
	};
}

// 2. Scan docs.arc.io/llms.txt — kumpulkan URL halaman yang menyebut "mainnet".
//    Baris baru ber-"mainnet" mulai muncul menjelang launch.
async function checkDocsScan() {
	const res = await fetchText(LLMS_URL);
	if (!res.ok) {
		return { key: "docs.arc.io/llms.txt", ok: false, findings: [`error: ${res.error}`], error: res.error };
	}
	const urls = [];
	for (const line of res.text.split(/\r?\n/)) {
		if (!has(line, "mainnet")) continue;
		// format llms.txt: `- [Title](https://docs.arc.io/xxx.md): desc` atau URL polos
		const m = line.match(/https?:\/\/[^\s)\]]+/g);
		if (m) urls.push(...m.map((u) => u.replace(/[.,;:]+$/, "")));
	}
	const unique = [...new Set(urls)];
	return {
		key: "docs.arc.io/llms.txt",
		ok: true,
		findings: unique.length > 0 ? [`mainnet pages: ${unique.length}`, ...unique.slice(0, 10)] : ["mainnet pages: 0"],
	};
}

// 3. Cek 1 halaman referensi: fetch + cek setiap kata kunci (atau snapshot sha256).
async function checkPage(page) {
	const res = await fetchText(page.url);
	if (!res.ok) {
		return { key: page.key, ok: false, findings: [`error: ${res.error}`], error: res.error };
	}
	if (page.mode === "snapshot") {
		// Tanpa kata kunci: simpan hash body — diff per-key melapor CHANGED bila
		// konten halaman (parameter fee, dst.) berubah sedikit pun.
		return { key: page.key, ok: true, findings: [`sha256=${sha256Hex(res.text)}`] };
	}
	return {
		key: page.key,
		ok: true,
		findings: page.keywords.map((kw) => keywordFinding(kw, res.text, page.absentKeywords)),
	};
}

// 4. Blog announcement mainnet — cek kata "mainnet" & "September 16" (deteksi perubahan tanggal).
async function checkBlog() {
	const res = await fetchText(BLOG_URL);
	if (!res.ok) {
		return { key: "community.arc.io blog", ok: false, findings: [`error: ${res.error}`], error: res.error };
	}
	return {
		key: "community.arc.io blog",
		ok: true,
		findings: [keywordFinding("mainnet", res.text), keywordFinding("September 16", res.text)],
	};
}

// --- state & diff --------------------------------------------------------------

function loadOldState() {
	try {
		return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
	} catch (e) {
		return null; // belum ada / corrupt -> anggap baseline pertama
	}
}

function saveState(checks) {
	fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
	const state = { updatedAt: new Date().toISOString(), checks };
	fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, "\t") + "\n");
}

// Entri pembanding (tanpa key): {ok, findings, error}; undefined di-drop JSON.stringify.
function comparable(c) {
	return { ok: c.ok, findings: c.findings, error: c.error };
}

// Bandingkan per-key dgn state lama; kembalikan daftar key yang berubah.
function diffKeys(oldChecks, newChecks) {
	const oldByKey = new Map((oldChecks || []).map((c) => [c.key, c]));
	const changed = [];
	for (const c of newChecks) {
		const old = oldByKey.get(c.key);
		if (old && JSON.stringify(comparable(old)) !== JSON.stringify(comparable(c))) changed.push(c.key);
	}
	// stale key yang ada di state lama tapi hilang di run ini: terbuang otomatis
	// karena saveState() meng-overwrite file dgn snapshot terbaru.
	return changed;
}

// --- output --------------------------------------------------------------------

// status tampilan: error fetch -> ERR; chain id beda -> mismatch; else ok
function displayStatus(c) {
	if (c.error) return "ERR";
	if (c.findings.some((f) => f.startsWith("MISMATCH"))) return "mismatch";
	return "ok";
}

function fmtCheck(c) {
	const detail = c.findings.length ? c.findings.join(" | ") : c.error || "";
	return `[${displayStatus(c)}] ${c.key.padEnd(28)} ${detail}`;
}

// --- main ----------------------------------------------------------------------

async function main() {
	console.log(`[phase0-monitor] ${new Date().toISOString()} — cek sumber menuju mainnet Arc (16 Sep 2026)`);

	// Semua cek independen -> jalankan paralel agar total ~max timeout (10s), jauh di
	// bawah batas ~60s. Setiap fetch sudah menangkap error sendiri (tidak ada rejection).
	const checks = await Promise.all([
		checkRpc(),
		checkDocsScan(),
		...REF_PAGES.map(checkPage),
		checkBlog(),
	]);

	for (const c of checks) console.log(fmtCheck(c));

	const oldState = loadOldState();
	const changed = oldState ? diffKeys(oldState.checks, checks) : [];
	for (const key of changed) console.log(`CHANGED: ${key}`);
	console.log(`CHANGES: ${changed.length}`);
	if (changed.length === 0) console.log("Baseline up-to-date.");

	// Monitor bukan gate: exit 0 selalu, KECUALI semua fetch gagal (network down total).
	const allFailed = checks.length > 0 && checks.every((c) => c.error);

	// Jangan timpa baseline bagus dengan snapshot all-error saat outage —
	// run berikutnya yang sehat tidak boleh melaporkan CHANGED semu.
	if (!allFailed) saveState(checks);

	return allFailed ? 1 : 0;
}

main()
	.then((code) => process.exit(code))
	.catch((e) => {
		console.error(`[phase0-monitor] fatal: ${e.message}`);
		process.exit(1);
	});
