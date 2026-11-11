/* ==========================================================================
   OriginPoint — Version B landing page (landing-b/b.js)
   - Hero: the landscape layers lean with the pointer and drift on scroll.
   - Route: a road is drawn through the five stages as you scroll, with a
     "you are here" marker riding it; stages arrive as the marker nears them.
   All motion is off under prefers-reduced-motion: the hero is still, the road
   is fully drawn, and every stage is visible.
   ========================================================================== */
(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  var yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();

  /* ---- Menu ----------------------------------------------------------- */
  var toggle = document.querySelector(".bh__toggle");
  var nav = document.getElementById("bnav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); } });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { nav.classList.remove("is-open"); toggle.setAttribute("aria-expanded", "false"); } });
  }

  /* ---- Hero parallax --------------------------------------------------- */
  var hero = document.querySelector(".bhero");
  if (hero && !reduced.matches) {
    var layers = hero.querySelectorAll(".lyr");
    layers.forEach(function (l) { l.style.setProperty("--d", l.getAttribute("data-depth") || "1"); });
    var tx = 0, ty = 0, px = 0, py = 0, sy = 0, ticking = false, heroIn = true;

    var frame = function () {
      ticking = false;
      px += (tx - px) * 0.08;
      py += (ty - py) * 0.08;
      var h = hero.offsetHeight || 1;
      var s = clamp(window.scrollY / h, 0, 1);
      sy += (s - sy) * 0.15;
      hero.style.setProperty("--mx", px.toFixed(3));
      hero.style.setProperty("--my", py.toFixed(3));
      hero.style.setProperty("--sy", sy.toFixed(3));
      if (Math.abs(tx - px) + Math.abs(ty - py) + Math.abs(s - sy) > 0.002 && heroIn) request();
    };
    var request = function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } };

    if (fine.matches) {
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
        ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
        request();
      });
      hero.addEventListener("pointerleave", function () { tx = 0; ty = 0; request(); });
    }
    window.addEventListener("scroll", function () { if (heroIn) request(); }, { passive: true });
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) { heroIn = en[0].isIntersecting; if (heroIn) request(); }).observe(hero);
    request();
  }

  /* ---- The route -------------------------------------------------------- */
  var track = document.querySelector("[data-route]");
  if (!track) return;
  var svg = track.querySelector(".route__svg");
  var ghost = svg.querySelector(".route__ghost");
  var line = svg.querySelector(".route__line");
  var you = svg.querySelector(".route__you");
  var stops = Array.prototype.slice.call(track.querySelectorAll("[data-stop]"));
  var L = 0, stopLen = [], cur = 0, ticking2 = false, trackIn = false;

  function build() {
    var W = track.offsetWidth, H = track.offsetHeight;
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var mobile = W < 640;
    var pts = [[mobile ? 18 : W * 0.5, 0]];
    stops.forEach(function (li, i) {
      var y = li.offsetTop + li.offsetHeight / 2;
      var x = mobile ? 18 : W * (i % 2 === 0 ? 0.445 : 0.555);
      var dot = li.querySelector(".stop__dot");
      dot.style.left = x + "px";                       // the dot sits inside its stop, so measure from the stop
      dot.style.top = (li.offsetHeight / 2) + "px";
      pts.push([x, y]);
    });
    pts.push([mobile ? 18 : W * 0.5, H]);

    var d = "M" + pts[0][0].toFixed(1) + " " + pts[0][1].toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], ym = (a[1] + b[1]) / 2;
      d += "C" + a[0].toFixed(1) + " " + ym.toFixed(1) + " " + b[0].toFixed(1) + " " + ym.toFixed(1) + " " + b[0].toFixed(1) + " " + b[1].toFixed(1);
    }
    ghost.setAttribute("d", d);
    line.setAttribute("d", d);
    L = line.getTotalLength();
    line.style.strokeDasharray = L;

    // how far along the road each stop sits
    stopLen = pts.slice(1, -1).map(function (p) {
      var best = 0, bd = 1e9;
      for (var s = 0; s <= L; s += 6) {
        var q = line.getPointAtLength(s), dd = Math.hypot(q.x - p[0], q.y - p[1]);
        if (dd < bd) { bd = dd; best = s; }
      }
      return best;
    });
    if (reduced.matches) { cur = L; }
    paint();
  }

  function target() {
    var r = track.getBoundingClientRect();
    var p = clamp((window.innerHeight * 0.6 - r.top) / r.height, 0, 1);
    return p * L;
  }

  function paint() {
    line.style.strokeDashoffset = L - cur;
    var q = line.getPointAtLength(clamp(cur, 0, L));
    you.setAttribute("transform", "translate(" + q.x.toFixed(1) + " " + q.y.toFixed(1) + ")");
    var vh = window.innerHeight;
    stops.forEach(function (li, i) {
      li.classList.toggle("is-passed", cur >= stopLen[i] - 2);
      if (cur >= stopLen[i] - vh * 0.45 || reduced.matches) li.classList.add("is-seen");
    });
  }

  function frame2() {
    ticking2 = false;
    var t = reduced.matches ? L : target();
    cur += (t - cur) * (reduced.matches ? 1 : 0.14);
    if (Math.abs(t - cur) < 0.5) cur = t;
    paint();
    if (cur !== t && trackIn) request2();
  }
  function request2() { if (!ticking2) { ticking2 = true; requestAnimationFrame(frame2); } }

  function start() {
    build();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (en) { trackIn = en[0].isIntersecting; if (trackIn) request2(); }, { rootMargin: "30% 0px" }).observe(track);
    } else { trackIn = true; }
    window.addEventListener("scroll", function () { if (trackIn) request2(); }, { passive: true });
    var rt = 0;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { build(); request2(); }, 140); });
    cur = reduced.matches ? L : target();
    paint();
  }

  var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(start);
})();
