/* ==========================================================================
   OriginPoint — flow.js
   Reveals below-the-fold sections as they arrive. Anything already on screen
   when the page opens is left alone (the page transition handles it). No-op
   under prefers-reduced-motion or without IntersectionObserver.
   ========================================================================== */
(function () {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!("IntersectionObserver" in window)) return;

  var selector = [
    ".section-head", ".contact__intro", ".contact__panel", ".faq-layout > *",
    ".cap-layout > *", ".system-layout > *", ".reason", ".service",
    ".principles article", ".stage-picker", ".plan-result", ".hero-directory a",
    ".about .container > *", ".next-step .container > *", ".site-footer .container"
  ].join(",");

  var vh = window.innerHeight;
  var targets = Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (el) {
    if (el.matches(".pullquote, .stage, .magnetic, .hero-directory")) return false;
    if (el.closest(".hero, .story, .page-intro, .site-header")) return false;
    if (el.querySelector(".stage, .pullquote")) return false;
    return el.getBoundingClientRect().top > vh * 0.9;
  });
  if (!targets.length) return;

  // Stagger siblings that arrive together
  var seen = new Map();
  targets.forEach(function (el) {
    var n = seen.get(el.parentElement) || 0;
    seen.set(el.parentElement, n + 1);
    el.style.setProperty("--flow-delay", Math.min(n, 4) * 90 + "ms");
    el.classList.add("flow");
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });

  targets.forEach(function (el) { io.observe(el); });
})();
