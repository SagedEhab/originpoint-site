/* ==========================================================================
   OriginPoint — cine.js
   The Living Ecosystem: scroll-controlled cinematic hero.

   One progress value p (0..1) drives everything: the camera, the lighting
   states, the light that travels along the model's paths, the headlines and
   the final logo reveal. Scrolling back reverses all of it.

   - Stills of one miniature model (re-lit / re-staged) are cross-faded and
     wiped in a single <canvas>; the finale uses a short image sequence.
   - The camera may travel past the image edge: the edge pixels are extended,
     which keeps the subject on one side and the copy on plain backdrop, and
     lets portrait phones frame the model without cropping it away.
   - The final logo is the real SVG (inline in index.html), traced then filled.
   - No inline styles anywhere (CSP): styles are set through the CSSOM.
   - Fallbacks: no canvas / failed load / reduced motion -> the static hero
     defined in cine.css. Data-saver skips the image sequence.
   ========================================================================== */
(function () {
  'use strict';

  var reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var root = document.querySelector('[data-cine]');

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lin(p, a, b) { return clamp((p - a) / (b - a), 0, 1); }
  function sstep(p, a, b) { var t = clamp((p - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }


  /* ---------- Scroll reveals for the sections after the hero ---------- */
  (function () {
    var els = [].slice.call(document.querySelectorAll('[data-cine-reveal]'));
    if (!els.length) return;
    els.forEach(function (el) {
      el.style.setProperty('--i', [].indexOf.call(el.parentElement.children, el));
    });
    if (reducedMq.matches || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  })();

  if (!root) return;


  /* ---------- Engine setup ---------- */
  var canvas = root.querySelector('.cine__canvas');
  var ctx = canvas && canvas.getContext ? canvas.getContext('2d', { alpha: false }) : null;
  var logoEl = root.querySelector('.cine__logo-img');
  if (!ctx || !logoEl) { root.classList.add('cine--static'); return; }

  var tallMq = window.matchMedia('(max-aspect-ratio: 1/1)');
  var conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  var saveData = !!(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '')));

  var pin = root.querySelector('.cine__pin');
  var poster = root.querySelector('.cine__poster');
  var veil = root.querySelector('.cine__veil');
  var header = document.querySelector('.site-header');
  var countEl = root.querySelector('.cine__count');
  var scrollEl = root.querySelector('.cine__scroll');
  var barEl = root.querySelector('.cine__bar i');
  var skipEl = root.querySelector('.cine__skip');

  var scenes = [].slice.call(root.querySelectorAll('.cine__scene')).map(function (li) {
    return {
      el: li,
      kids: [].slice.call(li.querySelectorAll('.cine__eyebrow, .cine__h, .cine__sub')),
      zones: [].slice.call(li.querySelectorAll('.cine__zones li'))
    };
  });
  var fin = root.querySelector('.cine__final');
  var finLogo = fin.querySelector('.cine__logo');
  var finImg = fin.querySelector('.cine__logo-img');
  var finU = fin.querySelector('.cine__ripple .u'), finL = fin.querySelector('.cine__ripple .l');
  var finEye = fin.querySelector('.cine__eyebrow'), finH = fin.querySelector('.cine__h');
  var finAct = fin.querySelector('.cine__actions');

  var IW = 1920, IH = 1080, AR = IW / IH;
  var NF = 48;
  // The official logo, for the engraving on the plinth (loaded when the engine starts)
  var logoImg = new Image();
  var logoLight = null;     // the same lockup in warm ivory, for the engraved highlight
  logoImg.decoding = 'async';
  logoImg.onload = function () {
    try {
      logoLight = document.createElement('canvas');
      logoLight.width = logoImg.naturalWidth; logoLight.height = logoImg.naturalHeight;
      var lc = logoLight.getContext('2d');
      lc.drawImage(logoImg, 0, 0);
      lc.globalCompositeOperation = 'source-in';
      lc.fillStyle = '#fff4e8'; lc.fillRect(0, 0, logoLight.width, logoLight.height);
    } catch (e) { logoLight = null; }
    dirtyKick();
  };

  var mask = document.createElement('canvas');
  var mctx = mask.getContext('2d');

  var W = 1, H = 1, ac = 1.7778, tall = false;
  var topPx = 0, cineTop = 0, runway = 1, logoDy = 0;
  var target = 0, cur = 0, raf = 0, lastT = 0, inView = true, failed = false, started = false, drawn = false;
  var sized = false, sizeTries = 0;


  /* ---------- Camera ----------
     keys: [p, focusX, focusY, visibleWidth, screenX, screenY]
     The focus point (image coordinates, 0..1) is placed at (screenX, screenY)
     of the canvas; visibleWidth is the share of the image width in view. */
  var WIDE = [
    [0.000, 0.579, 0.649, 0.70, 0.66, 0.60],
    [0.035, 0.579, 0.649, 0.30, 0.62, 0.56],
    [0.065, 0.579, 0.649, 0.20, 0.60, 0.55],
    [0.120, 0.530, 0.700, 1.15, 0.68, 0.64],
    [0.200, 0.360, 0.520, 0.70, 0.66, 0.54],
    [0.280, 0.360, 0.520, 0.56, 0.67, 0.54],
    [0.340, 0.430, 0.470, 0.44, 0.72, 0.52],
    [0.440, 0.430, 0.460, 0.36, 0.74, 0.52],
    [0.520, 0.580, 0.500, 0.50, 0.70, 0.54],
    [0.600, 0.620, 0.560, 0.62, 0.68, 0.60],
    [0.700, 0.550, 0.580, 0.95, 0.62, 0.62],
    [0.780, 0.500, 0.500, 1.00, 0.50, 0.50],
    [0.895, 0.500, 0.500, 1.00, 0.50, 0.50],
    [0.940, 0.500, 0.500, 0.62, 0.50, 0.50],
    [1.000, 0.500, 0.500, 0.62, 0.50, 0.50]
  ];
  var TALL = [
    [0.000, 0.579, 0.649, 0.40, 0.50, 0.32],
    [0.035, 0.579, 0.649, 0.24, 0.50, 0.32],
    [0.065, 0.579, 0.649, 0.17, 0.50, 0.32],
    [0.120, 0.530, 0.700, 1.00, 0.50, 0.36],
    [0.200, 0.360, 0.520, 0.62, 0.50, 0.34],
    [0.280, 0.360, 0.520, 0.50, 0.50, 0.34],
    [0.340, 0.430, 0.470, 0.42, 0.50, 0.33],
    [0.440, 0.430, 0.460, 0.36, 0.50, 0.33],
    [0.520, 0.580, 0.500, 0.50, 0.50, 0.33],
    [0.600, 0.620, 0.560, 0.62, 0.50, 0.34],
    [0.700, 0.550, 0.580, 0.95, 0.50, 0.34],
    [0.780, 0.500, 0.500, 0.95, 0.50, 0.36],
    [0.895, 0.500, 0.500, 0.95, 0.50, 0.36],
    [0.940, 0.500, 0.500, 0.58, 0.50, 0.40],
    [1.000, 0.500, 0.500, 0.58, 0.50, 0.40]
  ];

  function tangents(T, v) {
    var n = T.length, d = [], m = [], i;
    for (i = 0; i < n - 1; i++) d[i] = (v[i + 1] - v[i]) / (T[i + 1] - T[i]);
    m[0] = 0; m[n - 1] = 0;
    for (i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (i = 0; i < n - 1; i++) {
      if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
      var a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
      if (s > 9) { var t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
    }
    return m;
  }

  function makeSpline(keys) {
    var T = [], V = [[], [], [], [], []];
    keys.forEach(function (k) {
      T.push(k[0]); V[0].push(k[1]); V[1].push(k[2]); V[2].push(Math.log(k[3])); V[3].push(k[4]); V[4].push(k[5]);
    });
    var M = V.map(function (v) { return tangents(T, v); });
    return function (p) {
      var i = 0, n = T.length;
      while (i < n - 2 && p > T[i + 1]) i++;
      var h = T[i + 1] - T[i], t = clamp((p - T[i]) / h, 0, 1);
      var t2 = t * t, t3 = t2 * t;
      var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      return V.map(function (v, j) {
        return h00 * v[i] + h10 * h * M[j][i] + h01 * v[i + 1] + h11 * h * M[j][i + 1];
      });
    };
  }

  var splineWide = makeSpline(WIDE), splineTall = makeSpline(TALL);

  function camAt(p) {
    var c = (tall ? splineTall : splineWide)(p);
    var w = Math.exp(c[2]), h = w * AR / ac;
    var cx = c[0] - (c[3] - 0.5) * w, cy = c[1] - (c[4] - 0.5) * h;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }


  /* ---------- Images ---------- */
  var imgs = {};
  var frames = [];
  var framesReady = 0;
  var useSmall = false;

  function ok(im) { return !!im && im.complete && im.naturalWidth > 0; }

  function loadImg(src, done) {
    var im = new Image();
    im.decoding = 'async';
    im.onload = function () { if (done) done(); dirtyKick(); };
    im.onerror = function () { if (done) done(true); };
    im.src = src;
    return im;
  }

  function loadAll() {
    var base = useSmall ? 'assets/hero/m/' : 'assets/hero/';
    // The poster uses srcset, whose naturalWidth is density-corrected; the canvas needs a plain image.
    imgs.k0 = loadImg(poster.currentSrc || poster.src);
    ['k1', 'k2', 'k3', 'k4', 'k6'].forEach(function (k) { imgs[k] = loadImg(base + k + '.webp'); });
    if (saveData) return;
    var seq = 'assets/hero/seq/' + (useSmall ? 'm' : 'd') + '/f';
    var i = 1;
    (function batch() {
      for (var n = 0; n < 5 && i <= NF; n++, i++) {
        (function (idx) {
          frames[idx - 1] = loadImg(seq + pad2(idx) + '.webp', function (err) { if (!err) framesReady++; });
        })(i);
      }
      if (i <= NF) setTimeout(batch, 120);
    })();
  }

  /* Draw `img` through camera rect r, extending the edge pixels where the
     camera looks past the image. */
  function paint(c, img, r, alpha) {
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var kx = W / r.w, ky = H / r.h;
    var ix0 = clamp(r.x, 0, 1), iy0 = clamp(r.y, 0, 1), ix1 = clamp(r.x + r.w, 0, 1), iy1 = clamp(r.y + r.h, 0, 1);
    if (ix1 - ix0 < 1e-4 || iy1 - iy0 < 1e-4) return;
    // Whole-pixel destination edges: the picture and its edge strips then meet
    // exactly, so nothing needs to overlap (overlap double-blends at alpha < 1).
    var dx0 = Math.round((ix0 - r.x) * kx), dx1 = Math.round((ix1 - r.x) * kx);
    var dy0 = Math.round((iy0 - r.y) * ky), dy1 = Math.round((iy1 - r.y) * ky);
    var sx = ix0 * nw, sy = iy0 * nh, sw = (ix1 - ix0) * nw, sh = (iy1 - iy0) * nh;
    var dw = dx1 - dx0, dh = dy1 - dy0;
    if (dw < 1 || dh < 1) return;
    var left = dx0 > 0, right = dx1 < W, top = dy0 > 0, bottom = dy1 < H;
    c.globalAlpha = alpha;
    if (left) c.drawImage(img, 0, sy, 1, sh, 0, dy0, dx0, dh);
    if (right) c.drawImage(img, nw - 1, sy, 1, sh, dx1, dy0, W - dx1, dh);
    if (top) c.drawImage(img, sx, 0, sw, 1, dx0, 0, dw, dy0);
    if (bottom) c.drawImage(img, sx, nh - 1, sw, 1, dx0, dy1, dw, H - dy1);
    if (left && top) c.drawImage(img, 0, 0, 1, 1, 0, 0, dx0, dy0);
    if (right && top) c.drawImage(img, nw - 1, 0, 1, 1, dx1, 0, W - dx1, dy0);
    if (left && bottom) c.drawImage(img, 0, nh - 1, 1, 1, 0, dy1, dx0, H - dy1);
    if (right && bottom) c.drawImage(img, nw - 1, nh - 1, 1, 1, dx1, dy1, W - dx1, H - dy1);
    c.drawImage(img, sx, sy, sw, sh, dx0, dy0, dw, dh);
    c.globalAlpha = 1;
  }

  function paintMasked(img, r, alpha, maskFn) {
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, W, H);
    paint(mctx, img, r, 1);
    mctx.globalCompositeOperation = 'destination-in';
    maskFn(mctx);
    mctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.drawImage(mask, 0, 0);
    ctx.globalAlpha = 1;
  }

  function sX(x, r) { return (x - r.x) / r.w * W; }
  function sY(y, r) { return (y - r.y) / r.h * H; }


  /* ---------- Geometry of the model (image-normalised) ---------- */
  function M(x, y) { return [x / 1376 * IW, y / 768 * IH]; }
  var J = M(772, 443), L0 = M(415, 544), R0 = M(1170, 518);
  var jStudio = M(490, 523), jStore = M(690, 466), jOps = M(890, 465), jExt = M(1040, 493);
  var dStudio = M(442, 490), dStore = M(668, 452), dRecep = M(845, 419), dOps = M(905, 446), dExt = M(1062, 475);

  function route(pts) {
    var len = [0], t = 0;
    for (var i = 1; i < pts.length; i++) {
      t += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      len.push(t);
    }
    return { pts: pts, len: len, total: t };
  }
  function pointOn(rt, d) {
    d = clamp(d, 0, rt.total);
    for (var i = 1; i < rt.pts.length; i++) {
      if (d <= rt.len[i]) {
        var u = (d - rt.len[i - 1]) / (rt.len[i] - rt.len[i - 1] || 1);
        return [lerp(rt.pts[i - 1][0], rt.pts[i][0], u), lerp(rt.pts[i - 1][1], rt.pts[i][1], u)];
      }
    }
    return rt.pts[rt.pts.length - 1];
  }
  function strokeSpan(rt, t0, t1) {
    if (t1 - t0 < 0.002) return;
    var d0 = t0 * rt.total, d1 = t1 * rt.total, a = pointOn(rt, d0);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]);
    for (var i = 1; i < rt.pts.length; i++) {
      if (rt.len[i] > d0 && rt.len[i] < d1) ctx.lineTo(rt.pts[i][0], rt.pts[i][1]);
    }
    var b = pointOn(rt, d1); ctx.lineTo(b[0], b[1]); ctx.stroke();
  }

  var R_armL = route([L0, J]), R_armR = route([J, R0]);
  var R_studio = route([jStudio, [jStudio[0] - 2, jStudio[1] - 24], dStudio]);
  var R_store = route([jStore, dStore]);
  var R_recep = route([J, dRecep]);
  var R_ops = route([jOps, dOps]);
  var R_ext = route([jExt, dExt]);
  var R_inquiry = route([dStore, jStore, J, dRecep]);
  var R_flow = route([dRecep, J, jOps, dOps]);
  var R_spine = route([L0, J, R0]);

  var SKY = '233,240,86', IVORY = '247,243,236';   // Wasabi light, Soft Ivory

  function glowSpan(rt, t0, t1, a) {
    if (a < 0.01) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(' + SKY + ',' + (0.2 * a) + ')'; ctx.lineWidth = 9;
    strokeSpan(rt, t0, t1);
    ctx.strokeStyle = 'rgba(' + SKY + ',' + (0.95 * a) + ')'; ctx.lineWidth = 3;
    strokeSpan(rt, t0, t1);
  }

  function pulse(rt, t, a, tail) {
    if (t <= 0.001 || t >= 0.999 || a < 0.01) return;
    glowSpan(rt, Math.max(0, t - tail), t, a);
    var q = pointOn(rt, t * rt.total);
    ctx.fillStyle = 'rgba(' + IVORY + ',' + a + ')';
    ctx.strokeStyle = 'rgba(' + SKY + ',' + a + ')'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, 6.2832); ctx.fill(); ctx.stroke();
  }

  function ping(pt, t, a) {
    if (t <= 0 || t >= 1 || a < 0.01) return;
    var rx = lerp(8, 70, 1 - Math.pow(1 - t, 2)), al = (1 - t) * 0.9 * a;
    ctx.strokeStyle = 'rgba(' + SKY + ',' + al + ')'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(pt[0], pt[1], rx, rx * 0.38, 0, 0, 6.2832); ctx.stroke();
  }

  function node(pt, a) {
    if (a < 0.01) return;
    ctx.fillStyle = 'rgba(' + IVORY + ',' + a + ')';
    ctx.strokeStyle = 'rgba(' + SKY + ',' + a + ')'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(pt[0], pt[1], 13, 5, 0, 0, 6.2832); ctx.stroke();
    ctx.beginPath(); ctx.arc(pt[0], pt[1], 3.4, 0, 6.2832); ctx.fill();
  }

  // The blank square on the plinth (3/4 view), image px: TL, TR, BR, BL of the logo box
  var SQ = { B: [0.5625 * IW, 0.604 * IH], C: [0.690 * IW, 0.648 * IH], A: [0.470 * IW, 0.643 * IH] };

  function drawEngraving(p, a) {
    if (a < 0.01 || !logoImg.naturalWidth) return;
    var iw = logoImg.naturalWidth, ih = logoImg.naturalHeight;
    var B = SQ.B, U = [SQ.C[0] - B[0], SQ.C[1] - B[1]], V = [SQ.A[0] - B[0], SQ.A[1] - B[1]];
    var s = 0.80 / iw, ox = 0.10, oy = 0.5 - (ih * s) / 2;     // 80 % of the square's width, centred
    ctx.save();
    ctx.transform(U[0] * s, U[1] * s, V[0] * s, V[1] * s, B[0] + U[0] * ox + V[0] * oy, B[1] + U[1] * ox + V[1] * oy);
    ctx.globalAlpha = 0.4 * a;                                  // the lockup, pressed into the stone
    ctx.drawImage(logoImg, 0, 0);
    if (logoLight) {                                            // a soft lit edge, as if cut
      ctx.globalAlpha = 0.22 * a;
      ctx.drawImage(logoLight, -9, -12);
    }
    ctx.restore();
  }


  /* ---------- Frame render ---------- */
  function render(p) {
    var r = camAt(p);
    var s = W / (r.w * IW);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0c0c0c'; ctx.fillRect(0, 0, W, H);

    var k0 = imgs.k0, k1 = imgs.k1, k2 = imgs.k2, k3 = imgs.k3, k4 = imgs.k4, k6 = imgs.k6;

    // Once the rise sequence is fully opaque, the bare plinth becomes the base
    // and the sequence fades away over it (nothing older shows through).
    var haveSeq = framesReady >= NF - 3 && ok(k6);
    var late = haveSeq && p > 0.88;
    if (late) paint(ctx, k6, r, 1);

    // Act I: darkness, a point of light, the foundation emerging
    if (!late && ok(k0)) {
      paint(ctx, k0, r, 1);
      var lift = sstep(p, 0.05, 0.12) * (1 - sstep(p, 0.12, 0.2)) * 0.6;
      if (lift > 0.01) {
        ctx.globalCompositeOperation = 'lighter'; paint(ctx, k0, r, lift); ctx.globalCompositeOperation = 'source-over';
      }
    }

    // Act II: structures rise from their bases (wipe from below)
    var rv1 = sstep(p, 0.125, 0.235);
    if (!late && rv1 > 0.002 && ok(k1)) {
      if (rv1 > 0.999) paint(ctx, k1, r, 1);
      else paintMasked(k1, r, 1, function (c) {
        var yL = lerp(1.08, 0.14, rv1);
        var g = c.createLinearGradient(0, sY(yL, r), 0, sY(yL + 0.14, r));
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      });
    }

    // Act II/III: the display unfolds (radial reveal around the storefront)
    var rv2 = sstep(p, 0.30, 0.41);
    if (!late && rv2 > 0.002 && ok(k2)) {
      if (rv2 > 0.999) paint(ctx, k2, r, 1);
      else paintMasked(k2, r, 1, function (c) {
        var cx = sX(0.43, r), cy = sY(0.38, r), R = lerp(0.02, 1.7, rv2) * (W / r.w);
        var g = c.createRadialGradient(cx, cy, R * 0.5, cx, cy, R);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      });
    }

    // Act III: interior lights switch on, sweeping left to right
    var rv3 = sstep(p, 0.455, 0.585);
    if (!late && rv3 > 0.002 && ok(k3)) {
      if (rv3 > 0.999) paint(ctx, k3, r, 1);
      else paintMasked(k3, r, 1, function (c) {
        var xL = lerp(0.12, 1.2, rv3), soft = 0.16;
        var g = c.createLinearGradient(sX(xL - soft, r), 0, sX(xL, r), 0);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
      });
    }

    // Act IV: soft daylight
    var a4 = sstep(p, 0.60, 0.69);
    if (!late && a4 > 0.002 && ok(k4)) paint(ctx, k4, r, a4);

    // Finale: the crane rise, buildings sinking into the plinth
    if (haveSeq) {
      var env = late ? 1 - sstep(p, 0.925, 0.95) : sstep(p, 0.865, 0.88);
      if (env > 0.002) {
        var f = (NF - 1) * lin(p, 0.875, 0.94), fi = Math.min(NF - 2, Math.floor(f)), ft = f - fi;
        var fa = frames[fi], fb = frames[fi + 1];
        if (ok(fa)) paint(ctx, fa, r, env);
        if (ok(fb)) paint(ctx, fb, r, env * ft);
      }
    } else {
      // No sequence (data saver, slow network): a plain dissolve to the bare plinth
      var a6 = sstep(p, 0.865, 0.94);
      if (a6 > 0.002 && ok(k6)) paint(ctx, k6, r, a6);
    }

    // Keep the lighter backdrop of the storefront stills readable under ivory type
    var ga = 0.26 * sstep(p, 0.26, 0.32) * (1 - sstep(p, 0.50, 0.60));
    if (ga > 0.005) { ctx.fillStyle = 'rgba(8,12,18,' + ga + ')'; ctx.fillRect(0, 0, W, H); }

    // A soft falloff on the copy side, so type stays legible over bright glass (scenes 2-4)
    var sa = 0.52 * sstep(p, 0.125, 0.18) * (1 - sstep(p, 0.60, 0.645));
    if (sa > 0.005) {
      var sg = tall ? ctx.createLinearGradient(0, H, 0, H * 0.5) : ctx.createLinearGradient(0, 0, W * 0.62, 0);
      sg.addColorStop(0, 'rgba(8,10,14,' + sa + ')'); sg.addColorStop(1, 'rgba(8,10,14,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
    }

    // Light, in image pixels
    ctx.setTransform(s, 0, 0, s, -r.x * IW * s, -r.y * IH * s);
    var fx = 1 - sstep(p, 0.865, 0.885);

    drawEngraving(p, sstep(p, 0.07, 0.115) * fx);

    if (fx > 0.01) {
      glowSpan(R_armL, 0, sstep(p, 0.39, 0.47), fx);
      glowSpan(R_armR, 0, sstep(p, 0.47, 0.57), fx);
      glowSpan(R_recep, 0, sstep(p, 0.50, 0.54), fx);
      glowSpan(R_ops, 0, sstep(p, 0.55, 0.59), fx);
      glowSpan(R_ext, 0, sstep(p, 0.58, 0.62), fx);

      // Scene 4: an enquiry leaves the website and reaches the automation workspace
      pulse(R_inquiry, sstep(p, 0.465, 0.53), fx, 0.2);
      ping(dRecep, lin(p, 0.53, 0.58), fx);
      pulse(R_flow, sstep(p, 0.545, 0.605), fx, 0.2);
      ping(dOps, lin(p, 0.605, 0.65), fx);

      // Scene 5: everything synchronises
      var nodeA = sstep(p, 0.64, 0.68) * fx;
      [jStudio, jStore, J, jOps, jExt].forEach(function (pt) { node(pt, nodeA); });
      var sy1 = sstep(p, 0.68, 0.74);
      pulse(R_spine, sy1, fx, 0.16);
      [dStudio, dStore, dRecep, dOps, dExt].forEach(function (pt) { ping(pt, lin(p, 0.69, 0.745), fx); });
      [dStudio, dStore, dRecep, dOps, dExt].forEach(function (pt) { ping(pt, lin(p, 0.74, 0.775), fx * 0.7); });
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }


  /* ---------- DOM: copy, HUD, logo ---------- */
  var SCENE_WIN = [[-0.05, 0.118], [0.138, 0.325], [0.345, 0.455], [0.475, 0.585], [0.605, 0.710], [0.730, 0.865]];

  function setKid(el, o, dy) {
    el.style.opacity = o < 0.003 ? '0' : o.toFixed(3);
    el.style.transform = 'translate3d(0,' + dy.toFixed(1) + 'px,0)';
  }

  function updateDom(p) {
    var i, j;
    for (i = 0; i < scenes.length; i++) {
      var sc = scenes[i], a = SCENE_WIN[i][0], b = SCENE_WIN[i][1], any = 0;
      for (j = 0; j < sc.kids.length; j++) {
        var off = j * 0.006;
        var tin = sstep(p, a + off, a + off + 0.028), tout = sstep(p, b - 0.026 + off * 0.4, b + off * 0.4);
        var o = tin * (1 - tout);
        setKid(sc.kids[j], o, (1 - tin) * 28 - tout * 20);
        if (o > any) any = o;
      }
      sc.el.style.opacity = any > 0.003 ? '1' : '0';
      if (sc.zones.length) {
        var zi = sstep(p, 0.665, 0.74) * 5;
        for (j = 0; j < sc.zones.length; j++) {
          sc.zones[j].classList.toggle('is-on', zi > j + 0.5 || p > 0.745);
        }
        var zo = tin * (1 - tout);
        sc.zones.forEach(function (z) { z.parentNode.style.opacity = zo < 0.003 ? '0' : zo.toFixed(3); });
      }
    }

    // Tone: ivory type on the dark stills, ink type once daylight arrives
    var tone = p < 0.595 ? 'light' : 'dark';
    if (root.getAttribute('data-tone') !== (tone === 'dark' ? 'dark' : null)) {
      if (tone === 'dark') root.setAttribute('data-tone', 'dark'); else root.removeAttribute('data-tone');
    }

    // Final: the pathways become the real logo. The ripple rings are traced as light,
    // then the official lockup is revealed left to right over them.
    var tr = sstep(p, 0.895, 0.945);
    finU.style.strokeDashoffset = (1 - tr).toFixed(4);
    finL.style.strokeDashoffset = (1 - tr).toFixed(4);
    var strokeA = 1 - sstep(p, 0.965, 0.99);
    finU.style.opacity = strokeA.toFixed(3); finL.style.opacity = strokeA.toFixed(3);
    var rev = sstep(p, 0.925, 0.972);
    finImg.style.opacity = rev > 0 ? '1' : '0';
    finImg.style.clipPath = 'inset(-2% ' + ((1 - rev) * 104).toFixed(2) + '% -2% 0)';
    finLogo.style.opacity = sstep(p, 0.888, 0.905).toFixed(3);
    finLogo.style.transform = 'translate3d(0,' + (logoDy * (1 - sstep(p, 0.94, 0.985))).toFixed(1) + 'px,0)';
    veil.style.opacity = sstep(p, 0.925, 0.965).toFixed(3);

    var e1 = sstep(p, 0.965, 0.985), e2 = sstep(p, 0.972, 0.992), e3 = sstep(p, 0.98, 1.0);
    setKid(finEye, e1, (1 - e1) * 16);
    setKid(finH, e2, (1 - e2) * 22);
    setKid(finAct, e3, (1 - e3) * 18);
    if (p < 0.975) finAct.setAttribute('data-off', ''); else finAct.removeAttribute('data-off');

    // HUD
    var idx = p < 0.13 ? 1 : p < 0.335 ? 2 : p < 0.465 ? 3 : p < 0.595 ? 4 : p < 0.72 ? 5 : p < 0.9 ? 6 : 7;
    var txt = '0' + idx + ' / 07';
    if (countEl && countEl.textContent !== txt) countEl.textContent = txt;
    if (scrollEl) scrollEl.style.opacity = p < 0.012 ? '1' : '0';
    if (barEl) barEl.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    if (skipEl) skipEl.style.opacity = p > 0.93 ? '0' : '1';
    if (skipEl) skipEl.style.pointerEvents = p > 0.93 ? 'none' : 'auto';
    if (skipEl) skipEl.tabIndex = p > 0.93 ? -1 : 0;
  }


  /* ---------- Layout, scroll and the frame loop ---------- */
  function layout() {
    tall = tallMq.matches;
    var stageBox = root.querySelector('.cine__stage');
    var pw = stageBox.clientWidth, ph = stageBox.clientHeight;
    if (pw < 16 || ph < 16) {
      // Not laid out yet (a hidden or still-opening pane): render nothing until it has a real size.
      sized = false;
      if (++sizeTries < 60) setTimeout(function () { if (started && !failed) layout(); }, 250);
      return;
    }
    sized = true; sizeTries = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, tall ? 2 : 1.75);
    var scale = Math.min(dpr, (tall ? 1400 : 2400) / pw);
    W = Math.max(2, Math.round(pw * scale)); H = Math.max(2, Math.round(ph * scale));
    canvas.width = W; canvas.height = H; mask.width = W; mask.height = H;
    ac = W / H;

    topPx = parseFloat(getComputedStyle(pin).top) || 0;
    cineTop = root.getBoundingClientRect().top + window.pageYOffset;
    runway = Math.max(1, root.offsetHeight - ph);

    // Where the logo sits at the end vs. the centre of the stage (it is drawn from the centre)
    var prev = finLogo.style.transform; finLogo.style.transform = 'none';
    var lr = finLogo.getBoundingClientRect(), pr = pin.getBoundingClientRect();
    logoDy = (pr.top + pr.height / 2) - (lr.top + lr.height / 2);
    finLogo.style.transform = prev;

    readTarget();
    cur = target;
    drawn = false;
    kick();
  }

  function readTarget() { target = clamp((window.pageYOffset + topPx - cineTop) / runway, 0, 1); }

  function dirtyKick() { drawn = false; kick(); }

  function kick() { if (!raf && inView && !failed && !reducedMq.matches) raf = requestAnimationFrame(tick); }

  /* Give up on the animation and leave the static hero fully readable:
     clear every inline style the engine may already have set. */
  function fallback(err) {
    failed = true;
    if (err && window.console) console.error('cine: falling back to the static hero', err);
    [].forEach.call(root.querySelectorAll('[style]'), function (el) { el.removeAttribute('style'); });
    root.removeAttribute('data-tone');
    root.classList.remove('cine--ready');
    root.classList.add('cine--static');
  }

  function tick(t) {
    raf = 0;
    if (!sized) return;
    var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0.016;
    lastT = t;
    var k = 1 - Math.exp(-dt * 10);
    cur += (target - cur) * k;
    if (Math.abs(target - cur) < 0.0004) cur = target;
    try {
      if (ok(imgs.k0)) { render(cur); if (!drawn) { drawn = true; root.classList.add('cine--ready'); } }
      updateDom(cur);
    } catch (e) {
      fallback(e); return;
    }
    if (cur !== target) raf = requestAnimationFrame(tick); else lastT = 0;
  }

  function begin() {
    if (started || failed) return;
    started = true;
    useSmall = tallMq.matches || window.innerWidth < 900;
    logoImg.src = logoEl.currentSrc || logoEl.getAttribute('src');
    layout();
    loadAll();
    kick();
  }

  function init() {
    if (reducedMq.matches) return;
    if (ok(poster)) begin();
    else {
      poster.addEventListener('load', begin, { once: true });
      poster.addEventListener('error', function () { fallback(); }, { once: true });
      setTimeout(function () { if (!started) fallback(); }, 8000);
    }
  }

  window.addEventListener('scroll', function () { if (!started) return; readTarget(); kick(); }, { passive: true });

  var rz = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () { if (started) layout(); }, 120);
  });

  // Panel expansion and fullscreen can resize the stage without a window resize.
  function queueLayout() {
    clearTimeout(rz);
    rz = setTimeout(function () { if (started) layout(); }, 80);
  }
  if ('ResizeObserver' in window) new ResizeObserver(queueLayout).observe(pin);
  document.addEventListener('fullscreenchange', queueLayout);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', queueLayout);

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { inView = e[0].isIntersecting; if (inView) { readTarget(); kick(); } }, { rootMargin: '200px 0px' }).observe(root);
  }

  // Keyboard users who tab to the final links get the final scene
  fin.addEventListener('focusin', function () {
    if (!started || cur > 0.97) return;
    window.scrollTo(0, cineTop - topPx + runway);
  });

  reducedMq.addEventListener && reducedMq.addEventListener('change', function () {
    if (reducedMq.matches) return;
    if (!started) init(); else { layout(); }
  });

  window.__cineDebug = { renderAt: function (p) { cur = target = p; render(p); updateDom(p); }, state: function () { return { fr: framesReady, k: Object.keys(imgs).filter(function (k) { return ok(imgs[k]); }).join(','), cur: cur, W: W, H: H, tall: tall }; } };

  init();
})();
