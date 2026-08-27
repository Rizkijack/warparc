/**
 * Shared structured JSON logging helper.
 * LOG_JSON=true switches to JSON lines on stderr.
 * @param {string} tag - Log prefix (e.g., "server", "indexer")
 */
function createLogger(tag) {
	const useJson = process.env.LOG_JSON === "true";
	function out(level, msg, extra) {
		if (useJson) {
			const rec = { ts: new Date().toISOString(), level, msg, ...extra };
			console.error(JSON.stringify(rec));
		} else {
			const prefixed = `[${tag}] ${msg}`;
			const suffix = extra && Object.keys(extra).length ? ` ${JSON.stringify(extra)}` : "";
			const line = prefixed + suffix;
			if (level === "info" && console.info) console.info(line);
			else if (level === "warn" && console.warn) console.warn(line);
			else console.error(line);
		}
	}
	return {
		info: (msg, extra) => out("info", msg, extra),
		warn: (msg, extra) => out("warn", msg, extra),
		error: (msg, extra) => out("error", msg, extra)
	};
}

module.exports = { createLogger };
