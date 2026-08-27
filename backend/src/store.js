/**
 * Persistent store for the WarpArc backend (DEPLOY.md §6 — event indexing).
 *
 * Two files under <dir>, both created lazily:
 *   - events.jsonl : append-only JSONL event log (one JSON object per line)
 *   - state.json   : one plain JSON object { [key]: value }, rewritten
 *                    atomically (state.json.tmp + rename) on every setState
 *
 * Corruption policy (never throw on bad data):
 *   - a corrupt line in events.jsonl is skipped silently by queryEvents
 *   - a corrupt state.json is reported once via console.error; getState returns
 *     each caller's fallback and the next setState overwrites the file
 *
 * Usage:
 *   const { Store } = require("./src/store");
 *   const store = new Store({ dir: "backend/data" });
 *   store.appendEvent({ chain: "arc", from: "0x…", to: "0x…", amount6: "…" });
 *   store.setState("indexer:arc", 1234);
 *
 * No npm dependencies (Node 18+).
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { createLogger } = require("./logger");

const _log = createLogger("store");

function _eventsMaxMb() {
	const v = parseInt(process.env.BACKEND_EVENTS_MAX_MB, 10);
	return Number.isInteger(v) && v > 0 ? v : 50;
}

class Store {
  /**
   * @param {{ dir: string }} opts directory for events.jsonl + state.json
   *        (created recursively if missing). Throws Error if the directory
   *        cannot be created or is not writable.
   */
  constructor({ dir }) {
    if (typeof dir !== "string" || dir === "") {
      throw new Error(`Store: dir must be a non-empty string (got ${JSON.stringify(dir)})`);
    }
    this.dir = dir;
    this.eventsPath = path.join(dir, "events.jsonl");
    this.statePath = path.join(dir, "state.json");
    this._events = null; // parsed events cache (null = not loaded yet)
    this._eventsMtimeMs = null; // mtime of the file the cache was built from
    this._eventsRotatedCount = null;
    this._eventsSizeWarned = false;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
    } catch (e) {
      throw new Error(`Store: ${dir} is not writable: ${e.message}`);
    }
  }

  _eventsMaxMb() {
    return _eventsMaxMb();
  }

  _pathForKey(key) {
    if (typeof key !== "string") return this.statePath;
    if (key.startsWith("indexer:")) return path.join(this.dir, "state-indexer.json");
    if (key === "relayer" || key.startsWith("relayer:")) return path.join(this.dir, "state-relayer.json");
    return this.statePath;
  }

  _discoverEventFiles() {
    const files = [];
    // active file first (newest)
    try {
      if (fs.existsSync(this.eventsPath)) files.push(this.eventsPath);
    } catch (_) {}
    // rotated files reverse-lexicographic (newest date+seq first)
    try {
      const entries = fs.readdirSync(this.dir);
      const rotated = entries.filter((n) => /^events-\d{8}-\d{3}\.jsonl$/.test(n)).sort().reverse();
      for (const n of rotated) files.push(path.join(this.dir, n));
    } catch (_) {}
    // single-file fast path: if only active exists, files = [active]; if none, []
    return files;
  }

  _rotate() {
    const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let max = 0;
    try {
      const entries = fs.readdirSync(this.dir);
      const re = new RegExp(`^events-${yyyymmdd}-(\\d{3})\\.jsonl$`);
      for (const e of entries) {
        const m = e.match(re);
        if (m) {
          const n = parseInt(m[1], 10);
          if (Number.isInteger(n) && n > max) max = n;
        }
      }
    } catch (_) {}
    const next = String(max + 1).padStart(3, "0");
    const dest = path.join(this.dir, `events-${yyyymmdd}-${next}.jsonl`);
    try {
      fs.renameSync(this.eventsPath, dest);
      _log.info(`rotated events.jsonl → ${path.basename(dest)}`, { rotated: path.basename(dest) });
    } catch (e) {
      // if active missing, ignore; otherwise rethrow
      if (e.code !== "ENOENT") throw e;
    }
    // update rotated count cache if already initialized
    if (this._eventsRotatedCount !== null) {
      try {
        const entries = fs.readdirSync(this.dir);
        this._eventsRotatedCount = entries.filter((n) => /^events-\d{8}-\d{3}\.jsonl$/.test(n)).length;
      } catch (_) {}
    }
  }

  /** Append one event object as a JSON line. No dedupe here. */
  appendEvent(entry) {
    const line = JSON.stringify(entry) + "\n";
    const entryBytes = Buffer.byteLength(line, "utf8");
    // threshold rotation BEFORE append
    try {
      const st = fs.statSync(this.eventsPath);
      const threshold = this._eventsMaxMb() * 1024 * 1024;
      if (st.size + entryBytes > threshold) {
        this._rotate();
      }
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    fs.appendFileSync(this.eventsPath, line);
    if (this._events !== null) {
      this._events.push(entry);
      this._eventsMtimeMs = this._statEventsMtime();
      // keep rotated count in sync after successful append (in case rotate happened)
      try {
        const entries = fs.readdirSync(this.dir);
        this._eventsRotatedCount = entries.filter((n) => /^events-\d{8}-\d{3}\.jsonl$/.test(n)).length;
      } catch (_) {}
    }
  }

  /**
   * Reload the cache when another process (split-role mode: indexer writes,
   * server reads) has appended to events.jsonl since we last read it.
   * Also detects rotated file count changes via directory listing.
   */
  _refreshEventsIfChanged() {
    const mtime = this._statEventsMtime();
    let rotatedCount = 0;
    try {
      const entries = fs.readdirSync(this.dir);
      rotatedCount = entries.filter((n) => /^events-\d{8}-\d{3}\.jsonl$/.test(n)).length;
    } catch (_) {}
    if (this._eventsRotatedCount === null) this._eventsRotatedCount = rotatedCount;
    const mtimeDiff = mtime !== this._eventsMtimeMs;
    const countDiff = rotatedCount !== this._eventsRotatedCount;
    if ((mtimeDiff || countDiff) && this._events !== null) {
      this._events = this._readEvents();
      this._eventsMtimeMs = mtime;
      this._eventsRotatedCount = rotatedCount;
    } else if (mtimeDiff || countDiff) {
      // cache not yet loaded but tracking values changed — update trackers
      this._eventsMtimeMs = mtime;
      this._eventsRotatedCount = rotatedCount;
    }
    if (!this._eventsSizeWarned && this._events !== null) {
      let size = 0;
      try {
        size = fs.statSync(this.eventsPath).size;
      } catch (_) {
        /* file may not exist yet */
      }
      if (size > this._eventsMaxMb() * 1024 * 1024) {
        _log.error(`events.jsonl is ${(size / 1048576).toFixed(1)} MB — consider rotation (see backend/README.md)`);
        this._eventsSizeWarned = true;
      }
    }
  }

  _statEventsMtime() {
    try {
      return fs.statSync(this.eventsPath).mtimeMs;
    } catch (_) {
      return null;
    }
  }

  /**
   * Query the event log, newest first (reverse append order).
   * Iterates files newest-first with early-stop and global dedupe.
   * @param {{ chain?: string, address?: string, kind?: string, limit?: number }} q
   *        chain   — exact match on entry.chain
   *        address — lowercase match against entry.from OR entry.to
   *        kind    — exact match on entry.kind ("erc20" | "system"); without it
   *                  both dual-emitter views are returned and amounts double-count
   *        limit   — keep only the newest N (default 100)
   * @returns {object[]} matching entries, newest first
   */
  queryEvents({ chain, address, kind, limit = 100, offset = 0 } = {}) {
    // ensure cache freshness for getMetrics/countEvents reuse; file iteration is independent but we keep cache coherent
    if (this._events === null) {
      this._events = this._readEvents();
      this._eventsMtimeMs = this._statEventsMtime();
      try {
        const entries = fs.readdirSync(this.dir);
        this._eventsRotatedCount = entries.filter((n) => /^events-\d{8}-\d{3}\.jsonl$/.test(n)).length;
      } catch (_) {
        this._eventsRotatedCount = 0;
      }
    } else {
      this._refreshEventsIfChanged();
    }
    const want = address ? address.toLowerCase() : null;
    const n = Math.max(0, limit | 0);
    const skip = Math.max(0, offset | 0);
    if (n === 0) return { events: [], hasMore: false };
    // iterate files newest-first with early-stop and global dedupe Set
    // files = [active, ...rotated reverse-lexicographic] from _discoverEventFiles
    const files = this._discoverEventFiles();
    const seen = new Set();
    const out = [];
    let skipped = 0;
    for (const file of files) {
      let raw;
      try {
        raw = fs.readFileSync(file, "utf8");
      } catch (e) {
        if (e.code === "ENOENT") continue;
        throw e;
      }
      const lines = raw.split("\n");
      // scan file newest-first (reverse lines) for early-stop
      for (let i = lines.length - 1; i >= 0 && out.length < n; i--) {
        const text = lines[i].trim();
        if (text === "") continue;
        let e;
        try {
          e = JSON.parse(text);
        } catch (_) {
          continue;
        }
        if (chain != null && e.chain !== chain) continue;
        if (want !== null) {
          const from = typeof e.from === "string" ? e.from.toLowerCase() : null;
          const to = typeof e.to === "string" ? e.to.toLowerCase() : null;
          if (from !== want && to !== want) continue;
        }
        if (kind != null && e.kind !== kind) continue;
        const key = `${e.chain}|${e.txHash}|${e.logIndex}|${e.emitter}`;
        if (!key.includes("undefined")) {
          if (seen.has(key)) continue;
          seen.add(key);
        }
        if (skipped < skip) { skipped++; continue; }
        out.push(e);
        if (out.length >= n) break;
      }
      if (out.length >= n) break;
    }
    return { events: out, hasMore: out.length === n };
  }

  /** Total indexed events, optionally per chain — cheap view over the cache. */
  countEvents(chain = null) {
    this.queryEvents({ limit: 1 }); // ensures the cache is loaded/fresh (multi-file)
    if (chain == null) return this._events.length;
    return this._events.filter((e) => e.chain === chain).length;
  }

  /** Metrics helper: single scan for total + per-chain counts (avoids double-scan). */
  getMetrics() {
    this.queryEvents({ limit: 1 }); // ensure cache fresh
    const perChainCounts = {};
    for (const e of this._events) perChainCounts[e.chain] = (perChainCounts[e.chain] || 0) + 1;
    return { totalEvents: this._events.length, perChainCounts };
    // TODO: picks up dedup? Uses raw cache length like countEvents; queryEvents dedup is read-side only.
  }

  /** Value stored under key in state.json (sharded), or fallback when absent. */
  getState(key, fallback = null) {
    // Read fresh every call — split-role processes (indexer/relayer/server)
    // share this file and must see each other's writes.
    const target = this._pathForKey(key);
    let state = this._readState(target);
    // lazy migration: if shard missing/empty but legacy state.json contains key, copy prefix-keys to shard
    if (target !== this.statePath && Object.keys(state).length === 0) {
      const legacy = this._readState(this.statePath);
      if (Object.prototype.hasOwnProperty.call(legacy, key)) {
        const toMigrate = {};
        let found = false;
        for (const [k, v] of Object.entries(legacy)) {
          if (this._pathForKey(k) === target) {
            toMigrate[k] = v;
            found = true;
          }
        }
        if (found) {
          try {
            fs.mkdirSync(this.dir, { recursive: true });
            const tmp = `${target}.${process.pid}.tmp`;
            fs.writeFileSync(tmp, JSON.stringify(toMigrate, null, 2) + "\n");
            fs.renameSync(tmp, target);
            state = toMigrate;
          } catch (_) {}
        }
      }
    }
    return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback;
  }

  /** Read-modify-write one key of state (sharded), atomically (tmp + rename). */
  setState(key, value) {
    // Merge against the CURRENT file, not a cache — a stale cache would let
    // one process silently erase another process's keys (last-writer-wins).
    const target = this._pathForKey(key);
    let state = this._readState(target);
    // lazy migration: if shard empty, pre-populate with prefix keys from legacy
    if (target !== this.statePath && Object.keys(state).length === 0) {
      const legacy = this._readState(this.statePath);
      for (const [k, v] of Object.entries(legacy)) {
        if (this._pathForKey(k) === target && !Object.prototype.hasOwnProperty.call(state, k)) {
          state[k] = v;
        }
      }
    }
    state[key] = value;
    fs.mkdirSync(this.dir, { recursive: true });
    // pid-unique tmp name: a fixed name lets two interleaved processes corrupt
    // each other's tmp file before the rename lands.
    const tmp = `${target}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
    fs.renameSync(tmp, target);
  }

  /** Read + parse events.jsonl once (multi-file aggregate); corrupt lines are skipped silently. */
  _readEvents() {
    const files = this._discoverEventFiles();
    // chronological order = reverse(newest-first)
    const chronological = files.slice().reverse();
    if (chronological.length === 0) return [];
    const out = [];
    for (const file of chronological) {
      let raw;
      try {
        raw = fs.readFileSync(file, "utf8");
      } catch (e) {
        if (e.code === "ENOENT") continue;
        throw e;
      }
      for (const line of raw.split("\n")) {
        const text = line.trim();
        if (text === "") continue;
        try {
          out.push(JSON.parse(text));
        } catch (_) {
          // corrupt line — skip silently per corruption policy
        }
      }
    }
    return out;
  }

  /** Read + parse state file fresh; corrupt content resets to {}. */
  _readState(filePath = this.statePath) {
    let raw = null;
    try {
      raw = fs.readFileSync(filePath, "utf8");
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    let parsed = null;
    if (raw !== null) {
      try {
        parsed = JSON.parse(raw);
      } catch (_) {
        parsed = null;
      }
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      if (raw !== null) {
        _log.error(`state.json corrupt (${filePath}) — resetting`);
      }
      parsed = {};
    }
    return parsed;
  }
}

module.exports = { Store, createLogger };
