/* ==========================================================================
   OriginPoint — hero-ascii.js
   The hero background: the origin point and its rings, drawn as a field of
   characters (. : % # @). Rings spread outward from the origin, which follows
   the pointer; a click sends a new ring. Characters thin out to almost nothing
   behind the hero text so it stays legible.

   Rules kept from the old ripple canvas: pauses when the hero is hidden or
   scrolled out of view, caps the number of active rings, and under
   prefers-reduced-motion draws one still frame and never animates.
   ========================================================================== */
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  if (!hero) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  var RAMP = [".", ":", "%", "#", "@"];
  var MAX_RINGS = 12;
  var SPAWN_EVERY = 1.7;        // seconds between ambient rings
  var SPEED = 84;               // px per second
  var TAU = Math.PI * 2;

  var canvas = document.createElement("canvas");
  canvas.className = "hero__ascii";
  canvas.setAttribute("aria-hidden", "true");
  var depth = hero.querySelector(".hero__depth");
  if (depth && depth.nextSibling) hero.insertBefore(canvas, depth.nextSibling); else hero.insertBefore(canvas, hero.firstChild);
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var css = getComputedStyle(document.documentElement);
  var IVORY = (css.getPropertyValue("--color-ivory") || "#F7F3EC").trim();
  var SKY = (css.getPropertyValue("--color-sky") || "#E9F056").trim();
  var FAMILY = getComputedStyle(document.body).fontFamily;

  var W = 0, H = 0, dpr = 1, fs = 14, cw = 9, chh = 16, cols = 0, rows = 0;
  var mask = null;                         // 0..1 per cell: how much ink is allowed there
  var rings = [];
  var origin = { x: 0, y: 0, tx: 0, ty: 0 };
  var pointerIn = false;
  var clock = 0, spawnClock = 0, last = 0, raf = 0, inView = true;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // The origin lives on the orange disc; fall back to the right of the hero
  function home() {
    var disc = hero.querySelector(".depth--near");
    if (disc) {
      var r = disc.getBoundingClientRect(), hr = hero.getBoundingClientRect();
      if (r.width) return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height / 2 };
    }
    return { x: W * 0.8, y: H * 0.5 };
  }

  /* ---- Text-safe mask: thin the characters out behind the hero copy ----- */
  function buildMask() {
    mask = new Float32Array(cols * rows);
    var hr = hero.getBoundingClientRect();
    var boxes = [];
    hero.querySelectorAll("[data-quiet]").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width && r.height) boxes.push([r.left - hr.left - 24, r.top - hr.top - 18, r.right - hr.left + 24, r.bottom - hr.top + 18]);
    });
    var FEATHER = 130;
    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var px = (i + 0.5) * cw, py = (j + 0.5) * chh, d = 1e9;
        for (var b = 0; b < boxes.length; b++) {
          var bx = boxes[b];
          var dx = Math.max(bx[0] - px, 0, px - bx[2]);
          var dy = Math.max(bx[1] - py, 0, py - bx[3]);
          d = Math.min(d, Math.hypot(dx, dy));
        }
        var t = clamp(d / FEATHER, 0, 1);
        var s = t * t * (3 - 2 * t);
        mask[j * cols + i] = t < 0.12 ? 0 : s;
      }
    }
  }

  function resize() {
    var r = hero.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    fs = clamp(W / 82, 14, 20);
    cw = fs * 0.68;
    chh = fs * 1.18;
    cols = Math.ceil(W / cw);
    rows = Math.ceil(H / chh);
    buildMask();
    var h = home();
    if (!origin.x && !origin.y) { origin.x = origin.tx = h.x; origin.y = origin.ty = h.y; }
    if (reduced.matches) { seedStill(); draw(); }
  }

  /* ---- Rings ------------------------------------------------------------ */
  function addRing(x, y, a, width) {
    if (rings.length >= MAX_RINGS) rings.shift();
    rings.push({ x: x, y: y, r: 0, a: a, w: width || 30 });
  }

  // One still frame for reduced motion: the origin with concentric rings
  function seedStill() {
    rings = [];
    var h = home();
    for (var i = 1; i <= 6; i++) rings.push({ x: h.x, y: h.y, r: i * Math.min(W, H) * 0.12, a: 1 - i * 0.1, w: 30 });
    origin.x = origin.tx = h.x; origin.y = origin.ty = h.y;
  }

  /* ---- Draw ------------------------------------------------------------- */
  function hash(i, j, k) {
    var n = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = "600 " + fs.toFixed(1) + "px " + FAMILY;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    var maxR = Math.hypot(W, H) * 0.95;
    var tick = reduced.matches ? 0 : Math.floor(clock * 5);   // characters shimmer ~5 times a second
    var ox = origin.x, oy = origin.y;

    for (var j = 0; j < rows; j++) {
      var py = (j + 0.5) * chh;
      for (var i = 0; i < cols; i++) {
        var m = mask[j * cols + i];
        var px = (i + 0.5) * cw;
        var v = 0;
        // the origin point itself
        var d0 = Math.hypot(px - ox, py - oy);
        v += 1.35 * Math.exp(-(d0 * d0) / (2 * 70 * 70));
        // the rings
        for (var k = 0; k < rings.length; k++) {
          var rg = rings[k];
          var d = Math.hypot(px - rg.x, py - rg.y);
          var band = (d - rg.r) / rg.w;
          if (band > 3 || band < -3) continue;
          var life = 1 - rg.r / maxR;
          if (life <= 0) continue;
          v += rg.a * Math.sqrt(life) * Math.exp(-band * band);
        }
        v *= m;
        if (v < 0.07) continue;
        v *= 0.85 + 0.15 * hash(i, j, tick);                  // shimmer
        if (v < 0.07) continue;
        var idx = Math.min(RAMP.length - 1, Math.floor(Math.pow(clamp(v, 0, 0.999), 0.75) * RAMP.length));
        ctx.globalAlpha = clamp(0.55 + 0.45 * v, 0, 1);
        ctx.fillStyle = v > 0.9 ? SKY : IVORY;
        ctx.fillText(RAMP[idx], px, py);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ---- Loop ------------------------------------------------------------- */
  function frame(now) {
    raf = 0;
    if (!last) last = now;
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    spawnClock += dt;

    var maxR = Math.hypot(W, H) * 0.95;
    for (var k = rings.length - 1; k >= 0; k--) {
      rings[k].r += SPEED * dt;
      if (rings[k].r > maxR) rings.splice(k, 1);
    }
    if (spawnClock >= SPAWN_EVERY) { spawnClock = 0; addRing(origin.x, origin.y, 1, 30); }

    if (!pointerIn) { var h = home(); origin.tx = h.x + Math.sin(clock * 0.3) * W * 0.03; origin.ty = h.y + Math.cos(clock * 0.23) * H * 0.04; }
    origin.x += (origin.tx - origin.x) * 0.06;
    origin.y += (origin.ty - origin.y) * 0.06;

    draw();
    start();
  }

  function start() {
    if (raf || reduced.matches || document.hidden || !inView) return;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    last = 0;
  }

  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      inView = entries[0].isIntersecting;
      if (inView) start(); else stop();
    }).observe(hero);
  }

  /* ---- Pointer: the origin follows, a click sends a ring ----------------- */
  window.addEventListener("pointermove", function (e) {
    if (reduced.matches || e.pointerType !== "mouse") return;
    var r = hero.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) { pointerIn = false; return; }
    pointerIn = true;
    origin.tx = e.clientX - r.left;
    origin.ty = e.clientY - r.top;
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", function () { pointerIn = false; });

  hero.addEventListener("pointerdown", function (e) {
    if (reduced.matches || e.button > 0 || e.target.closest("a, button")) return;
    var r = hero.getBoundingClientRect();
    addRing(e.clientX - r.left, e.clientY - r.top, 1.1, 36);
    if (!raf) start();
  });

  /* ---- Resize and motion preference -------------------------------------- */
  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { resize(); if (reduced.matches) draw(); }, 120);
  });

  function onMotionChange() {
    if (reduced.matches) { stop(); seedStill(); draw(); } else { rings = []; start(); }
  }
  if (reduced.addEventListener) reduced.addEventListener("change", onMotionChange);

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(function () {
    resize();
    if (reduced.matches) { seedStill(); draw(); } else { rings = []; addRing(origin.x, origin.y, 1, 30); draw(); start(); }
  });
})();
