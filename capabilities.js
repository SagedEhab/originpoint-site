/* ==========================================================================
   OriginPoint — capabilities.js
   Services page "What we do" binder. Picking an index entry turns the bottom
   leaf to it; on scroll the two leaves drift together onto the rings.
   Without this script all four entries stay readable, stacked. Under
   prefers-reduced-motion the picking still works but nothing moves.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.querySelector("[data-spread]");
  if (!root) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var items = Array.prototype.slice.call(root.querySelectorAll("[data-entry-link]"));
  var entries = Array.prototype.slice.call(root.querySelectorAll(".entry"));
  var plates = Array.prototype.slice.call(root.querySelectorAll(".plate"));
  var folio = root.querySelector("[data-folio]");
  var detail = root.querySelector(".leaf--detail");
  var current = -1;

  function select(i, animate) {
    if (i === current) return;
    current = i;
    items.forEach(function (a, j) { a.setAttribute("aria-current", j === i ? "true" : "false"); });
    entries.forEach(function (e, j) {
      e.hidden = j !== i;
      e.classList.remove("is-turning");
    });
    plates.forEach(function (p, j) {
      p.hidden = j !== i;
      p.classList.remove("is-turning");
    });
    if (animate && !reduced.matches) {
      void entries[i].offsetWidth;   // restart the animation
      entries[i].classList.add("is-turning");
      plates[i].classList.add("is-turning");
    }
    if (folio) folio.textContent = "Page " + (i + 1) + " of " + entries.length;
  }

  root.classList.add("is-live");
  if (detail) detail.setAttribute("aria-live", "polite");

  var start = 0;
  items.forEach(function (a, i) {
    if (location.hash && a.getAttribute("href") === location.hash) start = i;
  });
  select(start, false);

  items.forEach(function (a, i) {
    a.addEventListener("click", function (e) { e.preventDefault(); select(i, true); });
    a.addEventListener("keydown", function (e) {
      var d = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      var n = (i + d + items.length) % items.length;
      items[n].focus();
      select(n, true);
    });
  });

  /* ---- The leaves drift together onto the rings as the section arrives --- */
  if (reduced.matches || !("IntersectionObserver" in window)) return;

  var split = 1, target = 1, ticking = false, inView = false;

  function measure() {
    var r = root.getBoundingClientRect();
    var vh = window.innerHeight;
    // 1 while the spread is still below the fold, 0 once it is well inside
    var p = (r.top - vh * 0.25) / (vh * 0.6);
    target = Math.min(1, Math.max(0, p));
  }

  function frame() {
    ticking = false;
    measure();
    split += (target - split) * 0.14;
    if (Math.abs(target - split) < 0.002) split = target;
    root.style.setProperty("--split", split.toFixed(3));
    if (split !== target && inView) request();
  }

  function request() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(frame);
  }

  new IntersectionObserver(function (entriesIO) {
    inView = entriesIO[0].isIntersecting;
    if (inView) request();
  }, { rootMargin: "20% 0px" }).observe(root);

  window.addEventListener("scroll", function () { if (inView) request(); }, { passive: true });
  window.addEventListener("resize", request);
  measure();
  split = target;
  root.style.setProperty("--split", split.toFixed(3));
})();
