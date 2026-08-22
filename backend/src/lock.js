/**
 * Per-role single-instance locks (backend/data/lock-<role>.json).
 *
 * The indexer's in-process dedupe cannot protect against a second indexer
 * process sweeping the same ranges — both would append every event twice.
 * Each active role therefore takes an exclusive lock at boot; a live holder
 * blocks boot with a clear error, a stale lock (dead PID) is taken over.
 */
"use strict";

const fs = require("fs");
const path = require("path");

/** Throws when a live holder owns the lock; returns a release() fn otherwise. */
function acquireLock({ dir, role }) {
	fs.mkdirSync(dir, { recursive: true });
	const lockPath = path.join(dir, `lock-${role}.json`);
	if (fs.existsSync(lockPath)) {
		let holder = null;
		try {
			holder = JSON.parse(fs.readFileSync(lockPath, "utf8"));
		} catch (_) {
			holder = null; // corrupt lock file — treat as stale
		}
		if (holder && Number.isInteger(holder.pid) && processAlive(holder.pid)) {
			throw new Error(
				`role "${role}" is already running (PID ${holder.pid}, started ${holder.startedAt || "?"}). ` +
					`Stop it first or remove ${lockPath} if that PID is wrong.`
			);
		}
		// stale lock — dead holder, take over
	}
	fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, role, startedAt: new Date().toISOString() }, null, 2) + "\n");
	let released = false;
	return function release() {
		if (released) return;
		released = true;
		try {
			const current = JSON.parse(fs.readFileSync(lockPath, "utf8"));
			if (current && current.pid === process.pid) fs.unlinkSync(lockPath);
		} catch (_) {
			/* already gone / corrupt — nothing to release */
		}
	};
}

function processAlive(pid) {
	try {
		process.kill(pid, 0);
		return true;
	} catch (e) {
		// EPERM = process exists but is owned by another user — still alive.
		return e.code === "EPERM";
	}
}

module.exports = { acquireLock };
