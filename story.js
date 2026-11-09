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

  var cur = { open: 0, t: 0 };
  var primed = false;
  var EASE = 0.14;       // share of the remaining distance covered each frame

  function apply(open, t) {
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

  // Scroll sets the target; the binder eases toward it, so a jerky wheel
  // still turns pages smoothly and each one settles softly.
  function render() {
    ticking = false;
    var p = progress();
    var tOpen = clamp(p / OPEN_END, 0, 1);
    var tT = stepped(clamp((p - OPEN_END) / (1 - OPEN_END), 0, 1));
    if (!primed) { cur.open = tOpen; cur.t = tT; primed = true; apply(cur.open, cur.t); return; }

    cur.open += (tOpen - cur.open) * EASE;
    cur.t += (tT - cur.t) * EASE;
    var settled = Math.abs(tOpen - cur.open) < 0.0006 && Math.abs(tT - cur.t) < 0.0006;
    if (settled) { cur.open = tOpen; cur.t = tT; }
    apply(cur.open, cur.t);
    if (!settled) request();
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
    primed = false;
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
  window.addEventListener("resize", function () { measure(); request(); });

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


/* ---- The hook: a hand-drawn oval around one word, and the two lines drifting --- */
(function () {
  "use strict";

  var hook = document.querySelector(".hook");
  if (!hook) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var word = hook.querySelector(".hook__word");
  var svg = hook.querySelector(".hook__oval");
  var path = svg && svg.querySelector("path");
  var a = hook.querySelector(".hook__line--a");
  var b = hook.querySelector(".hook__line--b");
  var drawn = false;

  /* A loose oval around the word: a bit more than one full turn, with the radius
     wobbling and drifting inward so the ends overlap like a marker would. */
  function ovalPath(w, h) {
    var cx = w / 2, cy = h / 2;
    var rx = w / 2 * 1.14 + 8, ry = h / 2 * 1.04 + 4;
    var n = 120, d = "";
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var th = -2.5 + t * Math.PI * 2 * 1.12;
      var wob = 1 + 0.03 * Math.sin(3 * th + 1) + 0.02 * Math.sin(5 * th + 2) - 0.07 * t;
      var x = cx + rx * wob * Math.cos(th);
      var y = cy + ry * wob * Math.sin(th) - 0.05 * h * t;
      d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    }
    return d;
  }

  function build() {
    if (!word || !path) return;
    var w = word.offsetWidth, h = word.offsetHeight;
    path.setAttribute("d", ovalPath(w, h));
    path.style.strokeWidth = Math.max(4, Math.min(10, h * 0.05)).toFixed(1) + "px";
    var len = path.getTotalLength();
    path.style.strokeDasharray = len;
    path.style.transition = "none";
    path.style.strokeDashoffset = (drawn || reduced.matches) ? 0 : len;
  }

  function draw() {
    if (drawn || !path) return;
    drawn = true;
    var len = path.getTotalLength();
    path.style.transition = "stroke-dashoffset 1500ms cubic-bezier(0.5, 0, 0.2, 1)";
    path.style.strokeDashoffset = 0;
    void len;
  }

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    build();
    if (reduced.matches || !("IntersectionObserver" in window)) { drawn = true; build(); return; }
    new IntersectionObserver(function (entries, io) {
      if (entries[0].isIntersecting) { setTimeout(draw, 350); io.disconnect(); }
    }, { threshold: 0.45 }).observe(hook);
  });

  var rt = 0;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(build, 150); });

  /* The two lines slide against each other as you scroll */
  if (reduced.matches || !("IntersectionObserver" in window) || !a || !b) return;
  var cur = 0, ticking = false, inView = false;

  function target() {
    var r = hook.getBoundingClientRect();
    var vh = window.innerHeight;
    return Math.max(-1, Math.min(1, (r.top + r.height / 2 - vh / 2) / vh));
  }

  function frame() {
    ticking = false;
    var t = target();
    cur += (t - cur) * 0.12;
    if (Math.abs(t - cur) < 0.001) cur = t;
    a.style.setProperty("--tx", (cur * -9).toFixed(2) + "vw");
    b.style.setProperty("--tx", (cur * 9).toFixed(2) + "vw");
    if (cur !== t && inView) request();
  }

  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    if (inView) request();
  }, { rootMargin: "20% 0px" }).observe(hook);

  window.addEventListener("scroll", function () { if (inView) request(); }, { passive: true });
  window.addEventListener("resize", request);
  cur = target();
  frame();
})();
