// WarpArc UI polish — reveal-on-scroll via IntersectionObserver only
// (transform/opacity, staggered). Falls back to fully visible when JS is
// missing or the API is unavailable: `.js` is only added when this runs.
"use strict";

(function () {
	document.addEventListener("DOMContentLoaded", function () {
		document.documentElement.classList.add("js");
		var items = document.querySelectorAll(".reveal");
		if (items.length === 0 || !("IntersectionObserver" in window)) return;

		items.forEach(function (el, i) {
			el.style.setProperty("--i", String(i));
		});

		var io = new IntersectionObserver(
			function (entries) {
				entries.forEach(function (entry) {
					if (!entry.isIntersecting) return;
					entry.target.classList.add("is-in");
					io.unobserve(entry.target);
				});
			},
			{ threshold: 0.05 }
		);
		items.forEach(function (el) {
			io.observe(el);
		});
	});
})();
