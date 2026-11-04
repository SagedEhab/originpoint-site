/* ==========================================================================
   OriginPoint — story.js
   Drives the home-page binder and a few parallax drifters. No libraries.

   - Only runs when motion is allowed. Under prefers-reduced-motion the page
     keeps its static, fully readable layout, and nothing here executes.
   - Scroll handling is one rAF-throttled reader. It writes custom properties
     only (--open, --o, --d, flex-grow); transforms and opacity do the rest.
   - Work stops when the section is off screen.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var story = document.getElementById("story");
  if (!story || reduced.matches || !("IntersectionObserver" in window)) return;

  var track = story.querySelector(".story__track");
  var stage = story.querySelector(".story__stage");
  var folds = Array.prototype.slice.call(story.querySelectorAll(".fold"));
  var tabs = folds.map(function (f) { return f.querySelector(".fold__tab"); });
  var bodies = folds.map(function (f) { return f.querySelector(".fold__body"); });
  var n = folds.length;
  var OPEN_END = 0.12;   // share of the scroll spent swinging the cover open
  var HOLD = 1;          // scroll weight a divider rests for
  var TURN = 0.55;       // scroll weight of the turn between two dividers
  var headerH = 0;
  var visible = false;
  var ticking = false;
  var last = { open: -1, t: -1 };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function measure() {
    var h = document.querySelector(".site-header");
    headerH = h ? h.getBoundingClientRect().height : 0;
  }

  // Maps scroll (0..1) to a position 0..n-1 that rests on every whole number,
  // so each divider holds still for a few scrolls before the next one turns.
  function stepped(s) {
    var u = s * (n * HOLD + (n - 1) * TURN);
    for (var i = 0; i < n; i++) {
      if (u <= HOLD) return i;
      u -= HOLD;
      if (i === n - 1) break;
      if (u <= TURN) { var k = u / TURN; return i + k * k * (3 - 2 * k); }
      u -= TURN;
    }
    return n - 1;
  }

  // Inverse of stepped() at a resting point, for the tab buttons
  function restAt(i) {
    var total = n * HOLD + (n - 1) * TURN;
    return (i * (HOLD + TURN) + HOLD / 2) / total;
  }

  function progress() {
    var rect = track.getBoundingClientRect();
    var span = rect.height - stage.offsetHeight;
    return span > 0 ? clamp((headerH - rect.top) / span, 0, 1) : 0;
  }

  function render() {
    ticking = false;
    var p = progress();
    var open = clamp(p / OPEN_END, 0, 1);
    var t = stepped(clamp((p - OPEN_END) / (1 - OPEN_END), 0, 1));
    if (Math.abs(open - last.open) < 0.0005 && Math.abs(t - last.t) < 0.0005) return;
    last.open = open;
    last.t = t;

    story.style.setProperty("--open", open.toFixed(4));
    if (open >= 0.995) story.setAttribute("data-opened", ""); else story.removeAttribute("data-opened");

    var active = Math.round(t);
    folds.forEach(function (fold, i) {
      var o = clamp(1 - Math.abs(t - i), 0, 1);
      fold.style.flexGrow = (o + 0.001).toFixed(4);
      fold.style.setProperty("--o", o.toFixed(4));
      fold.style.setProperty("--d", (t - i).toFixed(4));
      // Closed dividers must not be reachable by keyboard or screen reader
      var closed = o < 0.5 || open < 0.5;
      if (bodies[i].inert !== closed) bodies[i].inert = closed;
      var tab = tabs[i];
      if (i === active) tab.setAttribute("aria-current", "step"); else tab.removeAttribute("aria-current");
    });
  }

  function request() {
    if (!visible || ticking) return;
    ticking = true;
    window.requestAnimationFrame(render);
  }

  // Tabs jump to their stage. Only the divider body goes inert, so the tabs
  // stay clickable and keyboard-reachable on every closed divider.
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function (e) {
      e.preventDefault();
      var rect = track.getBoundingClientRect();
      var span = rect.height - stage.offsetHeight;
      var target = OPEN_END + (1 - OPEN_END) * restAt(i);
      var y = window.scrollY + rect.top - headerH + target * span + 2;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });

  function enable() {
    story.classList.add("story--binder");
    measure();
    last.open = last.t = -1;
    render();
  }

  function disable() {
    story.classList.remove("story--binder");
    story.removeAttribute("data-opened");
    story.style.removeProperty("--open");
    folds.forEach(function (f) {
      f.querySelector(".fold__body").inert = false;
      f.style.flexGrow = "";
      f.style.removeProperty("--o");
      f.style.removeProperty("--d");
    });
  }

  new IntersectionObserver(function (entries) {
    visible = entries[0].isIntersecting;
    if (visible) request();
  }, { rootMargin: "20% 0px" }).observe(story);

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("resize", function () { measure(); last.open = last.t = -1; request(); });

  enable();

  /* ---- Parallax drifters: decorative rings in other sections ------------ */
  var drifters = Array.prototype.slice.call(document.querySelectorAll("[data-drift]"));
  var dTick = false;
  function drift() {
    dTick = false;
    var vh = window.innerHeight;
    drifters.forEach(function (el) {
      var host = el.parentElement.getBoundingClientRect();
      if (host.bottom < -200 || host.top > vh + 200) return;
      var mid = host.top + host.height / 2 - vh / 2;
      el.style.translate = "0 " + (mid * parseFloat(el.getAttribute("data-drift"))).toFixed(1) + "px";
    });
  }
  if (drifters.length) {
    drifters.forEach(function (el) { el.parentElement.classList.add("has-drift"); });
    window.addEventListener("scroll", function () {
      if (!dTick) { dTick = true; window.requestAnimationFrame(drift); }
    }, { passive: true });
    drift();
  }

  function onMotionChange() {
    if (reduced.matches) { disable(); } else { enable(); }
  }
  if (reduced.addEventListener) reduced.addEventListener("change", onMotionChange);
})();
