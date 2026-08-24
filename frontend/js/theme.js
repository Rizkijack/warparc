// WarpArc theme bootstrap — MUST load synchronously in <head> BEFORE any stylesheet to prevent FOUC.
(function () {
	'use strict';

	var STORAGE_KEY = 'warparc:theme';
	var THEMES = {
		light: { meta: '#F5F7FA' },
		dark: { meta: '#0B111E' }
	};

	function normalize(value) {
		return (value === 'light' || value === 'dark') ? value : 'light';
	}

	function apply(theme) {
		theme = normalize(theme);
		if (theme === 'dark') {
			document.documentElement.dataset.theme = 'dark';
		} else {
			delete document.documentElement.dataset.theme;
		}
		var meta = document.querySelector('meta[name="theme-color"]');
		if (meta) {
			meta.setAttribute('content', THEMES[theme].meta);
		}
		var toggle = document.getElementById('theme-toggle');
		if (toggle) {
			toggle.setAttribute('aria-label', theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme');
		}
		document.documentElement.dispatchEvent(new CustomEvent('warparc:themechange', { detail: { theme: theme } }));
		return theme;
	}

	function get() {
		try {
			return normalize(window.localStorage.getItem(STORAGE_KEY));
		} catch (e) {
			return 'light';
		}
	}

	function set(theme) {
		theme = normalize(theme);
		try {
			window.localStorage.setItem(STORAGE_KEY, theme);
		} catch (e) {
			/* storage unavailable — theme applies for this tab only */
		}
		return apply(theme);
	}

	function toggle() {
		return set(get() === 'light' ? 'dark' : 'light');
	}

	// Anti-FOUC: apply stored theme immediately, synchronously, before CSS paints.
	apply(get());

	window.WarparcTheme = { get: get, set: set, toggle: toggle };

	document.addEventListener('DOMContentLoaded', function () {
		document.addEventListener('click', function (e) {
			if (e.target && e.target.closest('#theme-toggle')) {
				toggle();
			}
		});
	});

	window.addEventListener('storage', function (e) {
		if (e.key === STORAGE_KEY) {
			apply(e.newValue === 'light' || e.newValue === 'dark' ? e.newValue : 'light');
		}
	});
})();
