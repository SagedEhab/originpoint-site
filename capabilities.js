/* ==========================================================================
   OriginPoint — capabilities.js
   Builds the "What we do" stamp wall from the plain list in the page. Pick a
   capability with the index, the arrow keys, a click on a neighbouring stamp,
   or a swipe. The centre stamp leans a little with the pointer. Without this
   script (or if it fails) the plain list stays on the page.
   ========================================================================== */
(function () {
  "use strict";

  var section = document.getElementById("services");
  var list = section && section.querySelector(".caps__list");
  var h2 = document.getElementById("services-title");
  if (!list || !h2) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  var items = Array.prototype.slice.call(list.querySelectorAll(".caps__item"));
  var n = items.length;
  if (n < 2) return;

  var data = items.map(function (li, i) {
    var parts = (li.getAttribute("data-lines") || "").split("|");
    return {
      no: li.querySelector(".caps__no").textContent.trim(),
      title: li.querySelector(".caps__title").innerHTML,
      desc: li.querySelector(".caps__desc").innerHTML,
      stage: li.querySelector(".caps__stage").textContent.trim(),
      href: li.querySelector(".caps__foot a").getAttribute("href"),
      l1: parts[0] || "",
      l2: parts[1] || "",
      art: li.querySelector(".caps__art").innerHTML,
      plain: li.querySelector(".caps__title").textContent.replace(/\s+/g, " ").trim()
    };
  });

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---- Build ---------------------------------------------------------- */
  var wall = el("div", "wall");
  wall.setAttribute("role", "group");
  wall.setAttribute("aria-roledescription", "carousel");
  wall.setAttribute("aria-label", "What we do: four capabilities");
  wall.tabIndex = 0;

  var bar = el("div", "wall__bar");
  bar.appendChild(h2);                                  // the real heading moves into the bar
  var idx = el("div", "wall__idx");
  idx.setAttribute("role", "group");
  idx.setAttribute("aria-label", "Choose a capability");
  var buttons = data.map(function (d, i) {
    var b = el("button", null, d.no);
    b.type = "button";
    b.setAttribute("aria-label", "Show " + d.plain);
    b.addEventListener("click", function () { go(i); });
    idx.appendChild(b);
    return b;
  });
  bar.appendChild(idx);
  bar.appendChild(el("a", "wall__more", "Talk to us ↗")).setAttribute("href", "contact.html");

  var stage = el("div", "wall__stage");
  stage.appendChild(el("div", "wall__path",
    '<svg viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">' +
    '<path d="M-20 330C40 250 70 330 120 360S190 250 250 300S300 380 360 330"/></svg>'));

  var titles = data.map(function (d) {
    var h = el("h3", "wall__title", '<span class="l1">' + d.l1 + '</span><span class="l2">' + d.l2 + "</span>");
    h.setAttribute("aria-label", d.plain);
    h.style.setProperty("--chars", Math.max(d.l1.length, d.l2.length));
    stage.appendChild(h);
    return h;
  });

  var stamps = data.map(function (d, i) {
    var s = el("article", "stamp");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML =
      '<svg class="stamp__frame" viewBox="0 0 200 250" preserveAspectRatio="none" focusable="false"><use href="#stamp-frame"/></svg>' +
      '<div class="stamp__in"><div class="stamp__top"><span>Stage ' + d.stage.replace(/\D/g, "") + '</span><span class="stamp__no">' + d.no + '</span></div>' +
      '<div class="stamp__art"><svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice" focusable="false">' + d.art + '</svg></div>' +
      '<div class="stamp__name">' + d.title + "</div></div>";
    s.addEventListener("click", function () { if (!s.classList.contains("is-current")) go(i); });
    stage.appendChild(s);
    return s;
  });

  var caption = el("div", "wall__caption");
  caption.setAttribute("aria-live", "polite");
  var caps = data.map(function (d) {
    var c = el("div", "cap",
      '<p class="cap__desc">' + d.desc + '</p><p class="cap__foot"><span class="cap__stage">' + d.stage +
      '</span><a href="' + d.href + '">Talk about this ↗</a></p>');
    caption.appendChild(c);
    return c;
  });

  wall.appendChild(bar);
  wall.appendChild(stage);
  wall.appendChild(caption);
  section.appendChild(wall);
  section.classList.add("caps--live");

  /* ---- State ---------------------------------------------------------- */
  var cur = 0;

  function go(i) {
    cur = (i + n) % n;
    stamps.forEach(function (s, k) {
      var rel = (k - cur + n) % n;
      s.classList.toggle("is-current", rel === 0);
      s.classList.toggle("is-next", rel === 1);
      s.classList.toggle("is-prev", rel === n - 1);
      s.classList.toggle("is-far", rel !== 0 && rel !== 1 && rel !== n - 1);
    });
    titles.forEach(function (t, k) {
      t.classList.toggle("is-current", k === cur);
      if (k === cur) t.removeAttribute("aria-hidden"); else t.setAttribute("aria-hidden", "true");
    });
    caps.forEach(function (c, k) {
      c.classList.toggle("is-current", k === cur);
      c.inert = k !== cur;
      if (k === cur) c.removeAttribute("aria-hidden"); else c.setAttribute("aria-hidden", "true");
    });
    buttons.forEach(function (b, k) { b.setAttribute("aria-current", k === cur ? "true" : "false"); });
  }
  go(0);

  wall.addEventListener("keydown", function (e) {
    if (e.target !== wall) return;
    var d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (e.key === "Home") { e.preventDefault(); go(0); return; }
    if (e.key === "End") { e.preventDefault(); go(n - 1); return; }
    if (d) { e.preventDefault(); go(cur + d); }
  });

  /* ---- Swipe ---------------------------------------------------------- */
  var downX = null;
  wall.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") downX = e.clientX; });
  wall.addEventListener("pointerup", function (e) {
    if (downX == null) return;
    var dx = e.clientX - downX;
    downX = null;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
  });
  wall.addEventListener("pointercancel", function () { downX = null; });

  /* ---- The centre stamp leans toward the pointer ----------------------- */
  if (reduced.matches || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  var tx = 0, ty = 0, px = 0, py = 0, ticking = false;
  function frame() {
    ticking = false;
    px += (tx - px) * 0.1;
    py += (ty - py) * 0.1;
    if (Math.abs(tx - px) < 0.002) px = tx;
    if (Math.abs(ty - py) < 0.002) py = ty;
    wall.style.setProperty("--mx", px.toFixed(3));
    wall.style.setProperty("--my", py.toFixed(3));
    if (px !== tx || py !== ty) request();
  }
  function request() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }

  wall.addEventListener("pointermove", function (e) {
    var r = wall.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - r.left) / r.width * 2 - 1));
    ty = Math.max(-1, Math.min(1, (e.clientY - r.top) / r.height * 2 - 1));
    request();
  });
  wall.addEventListener("pointerleave", function () { tx = 0; ty = 0; request(); });
})();
