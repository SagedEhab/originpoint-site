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


/* ---- The hook: a marker mark around one word, and the two lines drifting ---- */
(function () {
  "use strict";

  var hook = document.querySelector(".hook");
  if (!hook) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var word = hook.querySelector(".hook__word");
  var svg = hook.querySelector(".hook__oval");
  var a = hook.querySelector(".hook__line--a");
  var b = hook.querySelector(".hook__line--b");
  var NS = "http://www.w3.org/2000/svg";
  var drawn = false;
  var parts = [];                      // { mask: path element, len, delay, time }

  function rnd(seed) {                 // small seeded random, so the mark is the same every visit
    var s = seed >>> 0;
    return function () {
      s += 0x6D2B79F5;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* A loose loop around the word: wobbling radius, drifting inward, slightly tilted */
  function loopPts(cx, cy, rx, ry, rot, th0, turns, drift, seed) {
    var r = rnd(seed), p1 = r() * 6, p2 = r() * 6, N = 150, pts = [];
    var cr = Math.cos(rot), sr = Math.sin(rot);
    for (var i = 0; i <= N; i++) {
      var t = i / N, th = th0 + t * Math.PI * 2 * turns;
      var wob = 1 + 0.035 * Math.sin(3 * th + p1) + 0.025 * Math.sin(5 * th + p2) - drift * t;
      var x = rx * wob * Math.cos(th), y = ry * wob * Math.sin(th);
      pts.push([cx + x * cr - y * sr, cy + x * sr + y * cr]);
    }
    return pts;
  }

  /* Turn a centre line into a marker stroke: thick in the middle, tapered at the
     ends, with the pressure wavering as it goes. Returns the outline and the line. */
  function brush(pts, wMax, seed) {
    var n = pts.length, ph = rnd(seed)() * 6, L = [], R = [], i;
    for (i = 0; i < n; i++) {
      var t = i / (n - 1);
      var p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(n - 1, i + 1)];
      var dx = p1[0] - p0[0], dy = p1[1] - p0[1], len = Math.hypot(dx, dy) || 1;
      var nx = -dy / len, ny = dx / len;
      var w = wMax * (0.16 + 0.84 * Math.pow(Math.sin(Math.PI * t), 0.5)) * (1 + 0.22 * Math.sin(t * 11 + ph) + 0.1 * Math.sin(t * 27 + ph * 2));
      L.push([pts[i][0] + nx * w / 2, pts[i][1] + ny * w / 2]);
      R.push([pts[i][0] - nx * w / 2, pts[i][1] - ny * w / 2]);
    }
    var d = "M" + L.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("L");
    for (i = n - 1; i >= 0; i--) d += "L" + R[i][0].toFixed(1) + " " + R[i][1].toFixed(1);
    var center = "M" + pts.map(function (q) { return q[0].toFixed(1) + " " + q[1].toFixed(1); }).join("L");
    return { d: d + "Z", center: center };
  }

  function el(name, attrs) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function build() {
    if (!word || !svg) return;
    var w = word.offsetWidth, h = word.offsetHeight;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    parts = [];

    var defs = el("defs", {});
    var filter = el("filter", { id: "hook-rough", x: "-6%", y: "-12%", width: "112%", height: "124%" });
    filter.appendChild(el("feTurbulence", { type: "fractalNoise", baseFrequency: "0.04", numOctaves: "2", seed: "7", result: "n" }));
    filter.appendChild(el("feDisplacementMap", { "in": "SourceGraphic", in2: "n", scale: "3.5", xChannelSelector: "R", yChannelSelector: "G" }));
    defs.appendChild(filter);
    svg.appendChild(defs);

    var g = el("g", { filter: "url(#hook-rough)" });
    svg.appendChild(g);

    var wMax = Math.max(8, Math.min(22, h * 0.085));
    var cx = w / 2, cy = h / 2;
    var shapes = [
      // the big loop, then a looser second pass over it
      { pts: loopPts(cx, cy, w / 2 * 1.14 + 8, h / 2 * 1.04 + 4, -0.045, -2.5, 1.16, 0.08, 3), wMax: wMax, seed: 11, delay: 350, time: 1150 },
      { pts: loopPts(cx + w * 0.012, cy - h * 0.025, w / 2 * 1.08 + 4, h / 2 * 0.95, 0.05, 0.4, 1.06, 0.05, 9), wMax: wMax * 0.55, seed: 23, delay: 1150, time: 950 }
    ];
    // three quick burst strokes at the top right of the word
    [-72, -48, -24].forEach(function (deg, i) {
      var th = deg * Math.PI / 180, ox = w * 0.9, oy = h * 0.1;
      var r0 = h * 0.15, r1 = h * (0.36 + i * 0.02), pts = [];
      for (var s = 0; s <= 8; s++) { var r = r0 + (r1 - r0) * s / 8; pts.push([ox + r * Math.cos(th), oy + r * Math.sin(th)]); }
      shapes.push({ pts: pts, wMax: wMax * 0.62, seed: 31 + i, delay: 1950 + i * 170, time: 280 });
    });

    shapes.forEach(function (s, i) {
      var br = brush(s.pts, s.wMax, s.seed);
      var m = el("mask", { id: "hook-m" + i, maskUnits: "userSpaceOnUse", x: "-400", y: "-400", width: "6000", height: "3000" });
      var mp = el("path", { d: br.center, fill: "none", stroke: "#fff", "stroke-width": String(Math.max(40, s.wMax * 3)), "stroke-linecap": "round", "stroke-linejoin": "round" });
      m.appendChild(mp);
      defs.appendChild(m);
      g.appendChild(el("path", { d: br.d, fill: "#E9F056", mask: "url(#hook-m" + i + ")" }));
      var len = mp.getTotalLength();
      mp.style.strokeDasharray = len;
      mp.style.strokeDashoffset = (drawn || reduced.matches) ? 0 : len;
      parts.push({ mask: mp, len: len, delay: s.delay, time: s.time });
    });
  }

  function draw() {
    if (drawn) return;
    drawn = true;
    parts.forEach(function (p) {
      p.mask.style.transition = "stroke-dashoffset " + p.time + "ms cubic-bezier(0.5, 0, 0.2, 1) " + p.delay + "ms";
      p.mask.style.strokeDashoffset = 0;
    });
  }

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    build();
    if (reduced.matches || !("IntersectionObserver" in window)) { drawn = true; build(); return; }
    new IntersectionObserver(function (entries, io) {
      if (entries[0].isIntersecting) { draw(); io.disconnect(); }
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
