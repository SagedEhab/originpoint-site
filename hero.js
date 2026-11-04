/* ==========================================================================
   OriginPoint — hero.js
   Scroll and pointer depth for the hero layers. Translate only; one rAF
   throttled reader. Does nothing under prefers-reduced-motion. Stops when the
   hero is out of view.
   ========================================================================== */
(function () {
  "use strict";

  var hero = document.querySelector(".hero");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (!hero || reduced.matches || !("IntersectionObserver" in window)) return;

  var layers = Array.prototype.slice.call(hero.querySelectorAll("[data-depth]"));
  var content = hero.querySelector(".hero__content");
  var inView = true;
  var ticking = false;
  var px = 0, py = 0;     // pointer, -1..1, eased
  var tx = 0, ty = 0;     // pointer target
  var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function render() {
    ticking = false;
    var h = hero.offsetHeight || 1;
    var s = clamp(window.scrollY, 0, h * 1.2);
    var easing = Math.abs(tx - px) + Math.abs(ty - py) > 0.001;
    px += (tx - px) * 0.08;
    py += (ty - py) * 0.08;

    layers.forEach(function (el) {
      var k = parseFloat(el.getAttribute("data-depth"));
      var lean = parseFloat(el.getAttribute("data-lean") || "0");
      el.style.translate = (px * lean).toFixed(1) + "px " + (s * k + py * lean * 0.6).toFixed(1) + "px";
    });

    // The text barely travels (the ripple mask is measured where it rests) and
    // fades only once the hero is mostly gone.
    if (content) {
      var fade = clamp((s / h - 0.35) / 0.5, 0, 1);
      content.style.translate = "0 " + (Math.min(s, h) * 0.08).toFixed(1) + "px";
      content.style.opacity = (1 - fade * 0.85).toFixed(3);
    }

    if (easing && inView) request();
  }

  function request() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(render);
  }

  new IntersectionObserver(function (entries) {
    inView = entries[0].isIntersecting;
    hero.classList.toggle("hero--offscreen", !inView);
    if (inView) request();
  }).observe(hero);

  window.addEventListener("scroll", function () { if (inView) request(); }, { passive: true });
  window.addEventListener("resize", request);

  if (fine) {
    hero.addEventListener("pointermove", function (e) {
      var r = hero.getBoundingClientRect();
      tx = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
      ty = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
      request();
    });
    hero.addEventListener("pointerleave", function () { tx = 0; ty = 0; request(); });
  }

  render();
})();
