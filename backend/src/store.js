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
    this._eventsSizeWarned = false;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
    } catch (e) {
      throw new Error(`Store: ${dir} is not writable: ${e.message}`);
    }
  }

  /** Append one event object as a JSON line. No dedupe here. */
  appendEvent(entry) {
    fs.appendFileSync(this.eventsPath, JSON.stringify(entry) + "\n");
    if (this._events !== null) {
      this._events.push(entry);
      this._eventsMtimeMs = this._statEventsMtime();
    }
  }

  /**
   * Reload the cache when another process (split-role mode: indexer writes,
   * server reads) has appended to events.jsonl since we last read it.
   */
  _refreshEventsIfChanged() {
    const mtime = this._statEventsMtime();
    if (mtime !== null && mtime !== this._eventsMtimeMs) {
      this._events = this._readEvents();
      this._eventsMtimeMs = mtime;
    }
    if (!this._eventsSizeWarned && this._events !== null) {
      let size = 0;
      try {
        size = fs.statSync(this.eventsPath).size;
      } catch (_) {
        /* file may not exist yet */
      }
      if (size > 50 * 1024 * 1024) {
        console.error(`[store] events.jsonl is ${(size / 1048576).toFixed(1)} MB — consider rotation (see backend/README.md)`);
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
   * @param {{ chain?: string, address?: string, kind?: string, limit?: number }} q
   *        chain   — exact match on entry.chain
   *        address — lowercase match against entry.from OR entry.to
   *        kind    — exact match on entry.kind ("erc20" | "system"); without it
   *                  both dual-emitter views are returned and amounts double-count
   *        limit   — keep only the newest N (default 100)
   * @returns {object[]} matching entries, newest first
   */
  queryEvents({ chain, address, kind, limit = 100 } = {}) {
    if (this._events === null) {
      this._events = this._readEvents();
      this._eventsMtimeMs = this._statEventsMtime();
    } else {
      this._refreshEventsIfChanged();
    }
    const want = address ? address.toLowerCase() : null;
    const seen = new Set();
    const filtered = [];
    // Scan is append-ordered, so the first occurrence of a composite key wins —
    // a crash between appending a chunk and advancing its watermark replays the
    // chunk on restart; skipping already-yielded keys keeps queries duplicate-proof.
    for (let i = this._events.length - 1; i >= 0; i--) {
      const e = this._events[i];
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
      filtered.push(e);
    }
    const n = Math.max(0, limit | 0);
    return n === 0 ? [] : filtered.slice(0, n);
  }

  /** Total indexed events, optionally per chain — cheap view over the cache. */
  countEvents(chain = null) {
    this.queryEvents({ limit: 1 }); // ensures the cache is loaded/fresh
    if (chain == null) return this._events.length;
    return this._events.filter((e) => e.chain === chain).length;
  }

  /** Value stored under key in state.json, or fallback when absent. */
  getState(key, fallback = null) {
    // Read fresh every call — split-role processes (indexer/relayer/server)
    // share this file and must see each other's writes.
    const state = this._readState();
    return Object.prototype.hasOwnProperty.call(state, key) ? state[key] : fallback;
  }

  /** Read-modify-write one key of state.json, atomically (tmp + rename). */
  setState(key, value) {
    // Merge against the CURRENT file, not a cache — a stale cache would let
    // one process silently erase another process's keys (last-writer-wins).
    const state = this._readState();
    state[key] = value;
    fs.mkdirSync(this.dir, { recursive: true });
    // pid-unique tmp name: a fixed name lets two interleaved processes corrupt
    // each other's tmp file before the rename lands.
    const tmp = `${this.statePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n");
    fs.renameSync(tmp, this.statePath);
  }

  /** Read + parse events.jsonl once; corrupt lines are skipped silently. */
  _readEvents() {
    let raw;
    try {
      raw = fs.readFileSync(this.eventsPath, "utf8");
    } catch (e) {
      if (e.code === "ENOENT") return [];
      throw e;
    }
    const out = [];
    for (const line of raw.split("\n")) {
      const text = line.trim();
      if (text === "") continue;
      try {
        out.push(JSON.parse(text));
      } catch (_) {
        // corrupt line — skip silently per corruption policy
      }
    }
    return out;
  }

  /** Read + parse state.json fresh; corrupt content resets to {}. */
  _readState() {
    let raw = null;
    try {
      raw = fs.readFileSync(this.statePath, "utf8");
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
        console.error(`[store] state.json corrupt (${this.statePath}) — resetting`);
      }
      parsed = {};
    }
    return parsed;
  }
}

module.exports = { Store };
