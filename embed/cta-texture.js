/*!
 * Primer CTA texture runtime (StanVision lab, made for Primer).
 * Port of the client prototype's "primer-vignette-background" (Primer Texture Motion export,
 * /backgrounds/cta-footer.html): a looping corner-vignette swirl, ordered (Bayer 8x8) dither in two
 * colours, a moving split line below which the two colours swap, and an optional strip above the frame
 * drawn in a second palette. Canvas 2D, no dependencies, no iframe.
 *
 * Usage:
 *   <div data-cta-texture aria-hidden="true" style="position:absolute;inset:auto 0 0 0;height:calc(100% + 700px)"></div>
 *   var t = PrimerCtaTexture.mount(el, { palette: [bg, fg], abovePalette: [bg, fg], extendTop: 700 });
 *   t.setSplit(px);   // CSS px from the canvas top: below it the colours swap
 *   t.setExtendTop(px); t.pause(); t.play(); t.destroy();
 *   t.split = px; t.extendTop = px;   // same, as properties GSAP can tween: gsap.to(t, { split: 0, scrollTrigger: {...} })
 *   t.on('ready', fn); PrimerCtaTexture.get(el);
 * Declarative (footer top stage on every page): <div data-cta-texture="auto" data-extend-top="0" data-split="100000">,
 * colours from --cta-tex-bg / --cta-tex-fg / --cta-tex-above-bg / --cta-tex-above-fg on the element, data-paused,
 * prefers-reduced-motion = one still frame. No scroll listener: the page (GSAP) sets the split.
 * Colours are [r,g,b] arrays or any CSS colour string (hex, rgb(), var(--x)), resolved in the element's context.
 * Draws in a Web Worker through an OffscreenCanvas when the browser can, else on the main thread.
 * Stops drawing when the tab is hidden or the element is off screen; paused / still = one frame,
 * redrawn only when the split, size or colours change.
 * 1.2.0: the split edge is composited from cached tiles (a split move repaints only the band it crossed) and
 * the field is computed over several frames within a time budget, so the edge follows scroll at the frame rate.
 * Main thread fallback: mount option mainThreadBudget (ms per frame, default 4); mainThreadMs (min ms between frames) now defaults to 0.
 * 1.2.1: the visible canvas is drawn on the main thread from tiles the worker sends (ImageBitmaps); setSplit paints
 * synchronously, so the split edge moves in the same frame as the page instead of one frame behind.
 */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.PrimerCtaTexture) return;

  /* ------------------------------------------------------------------ core
     Self-contained (no closures over this file): its source is also shipped to the worker. */
  function core(env) {
    var C = {
      speed: 1, scale: 0.45, vigTL: false, vigTR: true, vigBL: true, vigBR: false,
      vigSize: 0.6, vigSoft: 0.8, vigEdge: 0.11, pixel: 2, matrix: 8, strength: 1,
      exposure: 0.55, brightness: 0, contrast: -0.01, gamma: 1, black: 0, white: 1, stabilize: 0.92,
      period: 20, loop: true, startAt: 0,
      palette: [[255, 233, 214], [255, 84, 10]], abovePalette: [[249, 250, 247], [255, 233, 214]],
      splitAt: 100000, extendTop: 0
    };
    var k0;
    for (k0 in env.cfg) if (env.cfg[k0] != null) C[k0] = env.cfg[k0];

    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
    function loopedPhase(t, freq, period, on) {
      if (!on || !period || period <= 0.01) return t * freq;
      var cycles = Math.max(1, Math.round((freq * period) / (2 * Math.PI)));
      var u = (((t % period) + period) % period) / period;
      return u * 2 * Math.PI * cycles;
    }
    /* Bayer 8x8 thresholds */
    var MAT = (function () {
      var m = [[0, 2], [3, 1]];
      while (m.length < 8) {
        var s = m.length, q = [], y, x;
        for (y = 0; y < s * 2; y++) {
          q.push([]);
          for (x = 0; x < s * 2; x++) q[y].push(m[y % s][x % s] * 4 + [[0, 2], [3, 1]][Math.floor(y / s)][Math.floor(x / s)]);
        }
        m = q;
      }
      var arr = new Float32Array(64);
      for (var yy = 0; yy < 8; yy++) for (var xx = 0; xx < 8; xx++) arr[yy * 8 + xx] = (m[yy][xx] + 0.5) / 64;
      return arr;
    })();

    var genC = env.mk(8, 8), genX = genC.getContext('2d', { willReadFrequently: true });
    var GW = 0, GH = 0, genImg = null;
    function ensureGen(w, h) {
      var AR = w / h, base = 320 * 180, gw, gh;
      if (AR >= 1) { gw = Math.round(Math.sqrt(base * AR)); gh = Math.round(gw / AR); }
      else { gh = Math.round(Math.sqrt(base / AR)); gw = Math.round(gh * AR); }
      gw = Math.max(8, gw); gh = Math.max(8, gh);
      if (gw !== GW || gh !== GH) { GW = gw; GH = gh; genC.width = GW; genC.height = GH; genImg = genX.createImageData(GW, GH); return true; }
      return false;
    }
    var ss = function (x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); };
    function hash2(x, y) {
      var n = (x * 374761393 + y * 668265263) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
    }
    function tileNoise(x, y, P) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var x0 = ((xi % P) + P) % P, x1 = (x0 + 1) % P;
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      var a = hash2(x0, yi), b = hash2(x1, yi), c = hash2(x0, yi + 1), d = hash2(x1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function tileFbm(x, y, P, oct) {
      var sum = 0, amp = 0.5, norm = 0;
      for (var k = 0; k < oct; k++) { sum += amp * tileNoise(x, y, P); norm += amp; x *= 2; y = y * 2.03 + 3.7; P *= 2; amp *= 0.5; }
      return sum / norm;
    }
    function swirl(dx, dy, sc, flow, twist) {
      var r = Math.hypot(dx, dy) / sc, u = Math.atan2(dy, dx) / (Math.PI * 2);
      u += r * (0.35 + 0.12 * Math.sin(twist));
      var w = tileFbm(u * 5 + flow, r * 2.5 + 9, 5, 3) - 0.5, w2 = tileFbm(u * 9 - flow * 2, r * 3.5 + 2, 9, 2) - 0.5;
      var Rr = r + w * 0.4;
      u += w2 * 0.12;
      var bd = tileFbm(u * 7 + flow * 2, Rr * 4.5, 7, 4), ct = tileFbm(u * 11 - flow * 3, Rr * 7 + 5, 11, 3);
      var fb = 1 - Math.abs(2 * tileFbm(u * 14 + flow * 4, Rr * 13, 14, 3) - 1);
      fb = fb * fb;
      var pt = ss((bd * 0.65 + ct * 0.35 - 0.36) / 0.24);
      return clamp(pt * (0.6 + 0.5 * fb) + 0.15 * pt * pt, 0, 1);
    }
    /* the vignette generator: luminance into genC (white = paper, dark = ink).
       1.2.0: rows j0..j1-1 only (all when omitted), so a field can be spread over frames; genC is updated
       once the last row is done */
    function vignette(t, j0, j1) {
      if (j0 == null) { j0 = 0; j1 = GH; }
      var ext = Math.max(0, C.extendTop * dpr), top = H > ext ? ext / (H - ext) : 0;
      var d = genImg.data, sp = C.speed * 0.25, AR = (GW / GH) * (1 + top);
      var reach = clamp(C.vigSize, 0, 1), soft = clamp(C.vigSoft, 0.05, 1), wob = clamp(C.vigEdge, 0, 0.5);
      var breath = loopedPhase(t, sp, C.period, C.loop), drift = loopedPhase(t, sp * 4.5, C.period, C.loop);
      var sc = Math.max(0.3, C.scale);
      var flow = loopedPhase(t, sp * 1.05, C.period, C.loop) / (Math.PI * 2);
      var flowPrev = null, fade = 0;
      if (C.loop && C.period > 0.01) {
        var F = Math.min(3, C.period / 3), uu = ((t % C.period) + C.period) % C.period;
        if (uu > C.period - F) {
          flowPrev = flow - Math.max(1, Math.round((sp * 1.05 * C.period) / (2 * Math.PI)));
          var ff = (uu - (C.period - F)) / F;
          fade = ff * ff * (3 - 2 * ff);
        }
      }
      var on = [C.vigTL, C.vigTR, C.vigBL, C.vigBR], TAU = Math.PI * 2, k;
      var cAng = [Math.atan2(-0.5, -AR / 2), Math.atan2(-0.5, AR / 2), Math.atan2(0.5, -AR / 2), Math.atan2(0.5, AR / 2)];
      var RING = [0, 1, 3, 2], sFrom = [], sGap = [], sA = [], sB = [];
      for (k = 0; k < 4; k++) {
        var a = RING[k], b = RING[(k + 1) % 4], gap = cAng[b] - cAng[a];
        while (gap <= 0) gap += TAU;
        sFrom.push(cAng[a]); sGap.push(gap); sA.push(a); sB.push(b);
      }
      var maxR = Math.hypot(AR / 2, 0.5);
      var hole = Math.max(0, (1 - reach) * maxR * 1.13), band = Math.max(0.03, soft * 0.45);
      var pulse = 1 + 0.07 * Math.sin(breath);
      for (var j = j0; j < j1; j++) {
        var ny = (j / GH) * (1 + top) - top, dy = ny - 0.5;
        for (var i = 0; i < GW; i++) {
          var nx = i / GW, dx = (nx - 0.5) * AR, ang = Math.atan2(dy, dx), p = (j * GW + i) * 4, inf = 0;
          for (k = 0; k < 4; k++) {
            var rel = ang - sFrom[k];
            if (rel < 0) rel += TAU;
            if (rel >= sGap[k]) continue;
            var f = rel / sGap[k];
            if (on[sA[k]]) inf += ss(1 - f);
            if (on[sB[k]]) inf += ss(f);
            break;
          }
          var v;
          if (inf <= 0) v = 1;
          else {
            var w = 1 + wob * Math.sin(ang * 3.1 + breath) + wob * 0.5 * Math.sin(ang * 3.1 * 2.3 - drift);
            var R = Math.max(0.02, hole * w * pulse);
            var e = clamp((Math.hypot(dx, dy) - R) / band, 0, 1);
            var m = e * e * (3 - 2 * e) * Math.min(1, inf);
            v = m <= 0 ? 1 : 1 - m * (flowPrev === null ? swirl(dx, dy, sc, flow, breath)
              : swirl(dx, dy, sc, flow, breath) * (1 - fade) + swirl(dx, dy, sc, flowPrev, breath) * fade);
          }
          var c = Math.round(clamp(v, 0, 1) * 255);
          d[p] = d[p + 1] = d[p + 2] = c; d[p + 3] = 255;
        }
      }
      if (j1 >= GH) genX.putImageData(genImg, 0, 0);
    }

    var gridC = env.mk(8, 8), gridX = gridC.getContext('2d', { willReadFrequently: true });
    var prevL = null, frameDt = 1 / 60;
    function lumaGrid(cols, rows) {
      gridC.width = cols; gridC.height = rows;
      gridX.imageSmoothingEnabled = true; gridX.imageSmoothingQuality = 'high';
      gridX.drawImage(genC, 0, 0, cols, rows);
      var d = gridX.getImageData(0, 0, cols, rows).data;
      var expo = Math.pow(2, C.exposure), cf = Math.tan(((clamp(C.contrast, -0.98, 0.98) + 1) * Math.PI) / 4);
      var bp = C.black, wp = Math.max(C.white, bp + 0.01), span = wp - bp, ig = 1 / Math.max(0.05, C.gamma);
      var L = new Float32Array(cols * rows), i, p;
      for (i = 0, p = 0; i < L.length; i++, p += 4) {
        var v = (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) / 255;
        v = v * expo + C.brightness; v = (v - 0.5) * cf + 0.5; v = clamp((v - bp) / span, 0, 1);
        L[i] = Math.pow(v, ig);
      }
      var a = clamp(C.stabilize || 0, 0, 0.95);
      if (a > 0 && prevL && prevL.length === L.length) {
        var k = Math.pow(a, clamp(frameDt * 60, 0.25, 4));
        for (i = 0; i < L.length; i++) L[i] = L[i] * (1 - k) + prevL[i] * k;
      }
      prevL = L;
      return L;
    }
    function indexMap(L, cols, rows) {
      var n = L.length, idx = new Uint8Array(n), st = C.strength;
      for (var y = 0; y < rows; y++) {
        var my = (y % 8) * 8;
        for (var x = 0; x < cols; x++) {
          var q = y * cols + x, t = 1 - L[q], b = Math.floor(t), f = t - b;
          idx[q] = clamp(f > 0.5 + (MAT[my + (x % 8)] - 0.5) * st ? b + 1 : b, 0, 1);
        }
      }
      return idx;
    }
    function paint(img, idx, pal) {
      for (var i = 0, p = 0; i < idx.length; i++, p += 4) {
        var c = pal[idx[i]];
        img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = 255;
      }
    }

    /* 1.2.0: the field (vignette + tone + dither, slow) is computed over several frames within a time budget.
       1.2.1: the core no longer draws the visible canvas. Each finished grid goes out as three tiny tiles
       (palette, swapped palette, above palette) to env.sink; the page draws the canvas from them on the main
       thread, so a split change is painted in the same frame as the scroll update that set it (with the
       worker, 1.2.0 painted it a frame later, and the edge trailed the page). */
    var tileP = env.mk(8, 8), tilePX = tileP.getContext('2d');
    var tileS = env.mk(8, 8), tileSX = tileS.getContext('2d');
    var tileA = env.mk(8, 8), tileAX = tileA.getContext('2d');
    var cols = 0, rows = 0, cellPx = 1;      /* dither grid of the current layout */
    var idx = null, tilesDirty = false;     /* last finished grid; tiles need a rebuild (colours changed) */
    var job = null, lastField = 0;
    var clock = typeof performance !== 'undefined' && performance.now ? function () { return performance.now(); } : function () { return Date.now(); };

    var W = 0, H = 0, dpr = 1, cssW = 1, cssH = 1, rawDpr = 1;
    /* canvas, field and grid sizes; true when any changed: compute a full field now */
    function layout() {
      dpr = Math.min(env.maxDpr || 2, rawDpr || 1);
      var w = Math.max(16, Math.round(cssW * dpr)), h = Math.max(16, Math.round(cssH * dpr));
      var changed = false;
      if (w !== W || h !== H) { W = w; H = h; prevL = null; changed = true; }
      if (ensureGen(W, H)) changed = true;
      var px = Math.max(1, C.pixel * (W / 1000));
      var cs = clamp(Math.ceil(W / px), 2, 900), rs = clamp(Math.ceil(H / px), 2, 1400);
      var needed = Math.max(W / cs, H / rs);
      if (needed > px) { px = needed; cs = clamp(Math.ceil(W / px), 2, 900); rs = clamp(Math.ceil(H / px), 2, 1400); }
      if (cs !== cols || rs !== rows || px !== cellPx) { cols = cs; rows = rs; cellPx = px; changed = true; }
      if (changed) job = null;
      return changed;
    }
    function buildTiles() {
      if (!idx) return;
      tilesDirty = false;
      var P = C.palette, A = C.abovePalette, above = !!(A && A.length === 2);
      tileP.width = tileS.width = tileA.width = cols; tileP.height = tileS.height = tileA.height = rows;
      var im = tilePX.createImageData(cols, rows);
      paint(im, idx, P); tilePX.putImageData(im, 0, 0);
      paint(im, idx, [P[1], P[0]]); tileSX.putImageData(im, 0, 0);
      if (above) { paint(im, idx, A); tileAX.putImageData(im, 0, 0); }
      env.sink({ P: tileP, S: tileS, A: above ? tileA : null, cols: cols, rows: rows, cellPx: cellPx, W: W, H: H, dpr: dpr });
    }
    /* the rows in genC are done: tone (stabilize uses the real time between fields), dither, tiles */
    function finish() {
      var n = clock();
      frameDt = lastField ? clamp((n - lastField) / 1000, 1 / 120, 0.5) : 1 / 60;
      lastField = n;
      idx = indexMap(lumaGrid(cols, rows), cols, rows);
      buildTiles();
    }
    /* whole field at once: first frame, after a resize, while paused. Stabilize pre-roll as in 1.1.0 */
    function fullField(t) {
      job = null;
      if (!warmed || !prevL) {
        warmed = true;
        var sa = clamp(C.stabilize || 0, 0, 0.95);
        if (sa > 0) {
          var STRIDE = 3, K = Math.min(120, Math.ceil(Math.log(0.05) / Math.log(sa)));
          frameDt = STRIDE / 60; prevL = null;
          for (var w = Math.ceil(K / STRIDE) * STRIDE; w >= STRIDE; w -= STRIDE) {
            var tw = t - w / 60;
            if (C.loop && C.period > 0.01) tw = ((tw % C.period) + C.period) % C.period;
            vignette(tw); lumaGrid(cols, rows);
          }
          frameDt = 1 / 60;
        }
        lastField = 0;
      }
      vignette(t);
      finish();
    }
    /* part of the next field within `budget` ms; true when it finished in this call.
       Rows and the finishing pass run in different frames, so no frame does both. */
    function stepField(t, budget) {
      if (job && job.row >= GH) { job = null; finish(); return true; }
      var start = clock();
      if (!job) job = { t: t, row: 0 };
      while (job.row < GH) {
        var r1 = Math.min(GH, job.row + 4);
        vignette(job.t, job.row, r1); job.row = r1;
        if (clock() - start > budget) break;
      }
      return false;
    }

    var hidden = false, paused = false, dirty = true, t0 = 0, held = 0, frozenT = C.startAt, warmed = false, alive = true;
    var lastRender = 0;
    function frame(now) {
      if (!alive) return;
      env.raf(frame);
      if (env.minMs && now - lastRender < env.minMs) return;
      lastRender = now;
      if (hidden) { if (!held) held = now; return; }
      if (paused) {
        if (!held) held = now;
        if (dirty) {
          dirty = false;
          if (layout() || !idx || !prevL) { lastField = 0; fullField(frozenT); }
          else if (tilesDirty) buildTiles();
        }
        return;
      }
      if (held) { if (t0) t0 += now - held; held = 0; }
      if (!t0) t0 = now;
      var t = C.startAt + (now - t0) / 1000;
      if (C.loop && C.period > 0.01) t = t % C.period;
      frozenT = t;
      if (layout() || !idx || !warmed || !prevL) { dirty = false; fullField(t); return; }
      if (tilesDirty) buildTiles();
      dirty = false;
      stepField(t, env.budget || 6);
    }
    env.raf(frame);
    return {
      size: function (w, h, r) { cssW = w; cssH = h; rawDpr = r; dirty = true; },
      hidden: function (v) { hidden = !!v; dirty = true; },
      paused: function (v) { paused = !!v; dirty = true; },
      ext: function (px) { if (px !== C.extendTop) { C.extendTop = px; dirty = true; prevL = null; } },
      colours: function (p, a) { if (p) C.palette = p; if (a) C.abovePalette = a; dirty = true; tilesDirty = true; },
      stop: function () { alive = false; }
    };
  }

  /* ------------------------------------------------------------------ view
     Draws the visible canvas on the main thread from the core's tiles: palette; swapped palette below the
     split; above palette over the extended strip (same picture as 1.1.0 / 1.2.0). A split change repaints
     only the band between the old and the new split, synchronously, inside the caller's update. */
  function view(canvas, onFirst) {
    var ctx = canvas.getContext('2d'), t = null, splitAt = 100000, extendTop = 0, last = -1, first = true;
    function band(src, a0, a1, y0, y1) {
      a0 = Math.max(a0, y0); a1 = Math.min(a1, y1);
      if (a1 <= a0) return;
      ctx.save(); ctx.beginPath(); ctx.rect(0, a0, t.W, a1 - a0); ctx.clip();
      ctx.drawImage(src, 0, 0, t.cols * t.cellPx, t.rows * t.cellPx); ctx.restore();
    }
    function draw(y0, y1) {
      if (!t) return;
      if (y0 == null) { y0 = 0; y1 = t.H; }
      y0 = Math.max(0, y0); y1 = Math.min(t.H, y1);
      var sy = Math.max(0, Math.round(splitAt * t.dpr)), ty = Math.round(extendTop * t.dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      band(t.P, 0, Math.min(sy, t.H), y0, y1);
      band(t.S, sy, t.H, y0, y1);
      if (ty > 0 && t.A) band(t.A, 0, Math.min(ty, sy), y0, y1);
      last = sy;
      if (first) { first = false; onFirst(); }
    }
    function free(o) { if (!o) return; ['P', 'S', 'A'].forEach(function (k) { if (o[k] && o[k].close && (!t || o[k] !== t[k])) o[k].close(); }); }
    return {
      tiles: function (m) {
        var old = t; t = m; free(old);
        if (canvas.width !== m.W || canvas.height !== m.H) { canvas.width = m.W; canvas.height = m.H; }
        draw();
      },
      split: function (px) {
        splitAt = px;
        if (!t) return;
        var sy = Math.max(0, Math.round(px * t.dpr));
        if (last < 0) draw(); else if (sy !== last) draw(Math.min(last, sy), Math.max(last, sy));
      },
      ext: function (px) { extendTop = px; draw(); },
      free: function () { var o = t; t = null; free(o); }
    };
  }

  /* ------------------------------------------------------------------ host */
  function toRgb(c, el) {
    if (Array.isArray(c)) return c.slice(0, 3);
    c = String(c || '').trim();
    if (!c) return null;
    var m = c.match(/^#([0-9a-f]{6})$/i);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = c.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
    if (m) return [Math.round(+m[1]), Math.round(+m[2]), Math.round(+m[3])];
    /* anything else (a name, #rgb, var(--x)): let the browser resolve it in the element's context */
    if (/^--/.test(c)) c = 'var(' + c + ')';
    var probe = document.createElement('i');
    probe.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;visibility:hidden';
    probe.style.color = c;
    if (!probe.style.color) return null;
    (el || document.body).appendChild(probe);
    var rgb = getComputedStyle(probe).color; probe.remove();
    return /^rgba?\(/i.test(rgb) ? toRgb(rgb) : null;
  }
  function pal(p, el) { if (!p) return null; var a = toRgb(p[0], el), b = toRgb(p[1], el); return a && b ? [a, b] : null; }

  var WORKER_SRC = null;
  function workerUrl() {
    if (WORKER_SRC) return WORKER_SRC;
    /* the worker sends each set of tiles as ImageBitmaps (transferred, no copy) */
    var src = 'var core=' + core.toString() + ';var api=null;' +
      'var raf=typeof requestAnimationFrame==="function"?function(f){return requestAnimationFrame(f)}:function(f){return setTimeout(function(){f(performance.now())},1000/60)};' +
      'function sink(m){var P=m.P.transferToImageBitmap(),S=m.S.transferToImageBitmap(),A=m.A?m.A.transferToImageBitmap():null,tr=A?[P,S,A]:[P,S];' +
      'self.postMessage({k:"tiles",m:{P:P,S:S,A:A,cols:m.cols,rows:m.rows,cellPx:m.cellPx,W:m.W,H:m.H,dpr:m.dpr}},tr)}' +
      'self.onmessage=function(e){var m=e.data;if(m.k==="init"){api=core({cfg:m.cfg,maxDpr:m.maxDpr,mk:function(w,h){return new OffscreenCanvas(w,h)},raf:raf,budget:8,sink:sink});' +
      'api.size(m.w,m.h,m.dpr);api.hidden(m.hidden);api.paused(m.paused);return}if(!api)return;if(m.k==="stop"){api.stop();self.close();return}api[m.k].apply(null,m.a)};';
    WORKER_SRC = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    return WORKER_SRC;
  }

  function mount(el, opts) {
    opts = opts || {};
    if (el.__ctaTexture) return el.__ctaTexture;
    var cfg = {};
    if (opts.palette) cfg.palette = pal(opts.palette, el);
    if (opts.abovePalette) cfg.abovePalette = pal(opts.abovePalette, el);
    if (opts.extendTop != null) cfg.extendTop = +opts.extendTop || 0;
    if (opts.splitAt != null) cfg.splitAt = +opts.splitAt;
    if (opts.startAt != null) cfg.startAt = +opts.startAt;
    var maxDpr = opts.maxDpr || 2;
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'display:block;position:absolute;inset:0;width:100%;height:100%';
    el.appendChild(canvas);

    var send, worker = null, api = null, onScreen = true, pausedState = !!opts.paused;
    function size() { return [el.clientWidth || 1, el.clientHeight || 1, window.devicePixelRatio || 1]; }
    function isHidden() { return document.hidden || !onScreen; }
    var isReady = false, readyFns = [];
    function ready() {
      if (isReady) return; isReady = true;
      el.setAttribute('data-cta-texture-state', 'ready'); if (opts.onReady) opts.onReady();
      for (var i = 0; i < readyFns.length; i++) try { readyFns[i].call(ctl, ctl); } catch (e) { setTimeout(function () { throw e; }); }
      readyFns = [];
      try { el.dispatchEvent(new CustomEvent('primer-cta-texture:ready', { bubbles: true, detail: { handle: ctl } })); } catch (e) {}
    }

    var vw = view(canvas, ready), splitState = cfg.splitAt != null ? cfg.splitAt : 100000;
    vw.split(splitState); vw.ext(cfg.extendTop || 0);
    var canWorker = opts.worker !== false && typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' &&
      typeof OffscreenCanvas.prototype.transferToImageBitmap === 'function';
    function runHere() {
      api = core({ cfg: cfg, maxDpr: maxDpr, mk: function (w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
        raf: function (f) { return requestAnimationFrame(f); }, sink: vw.tiles,
        minMs: opts.mainThreadMs || 0, budget: opts.mainThreadBudget || 4 });
      var s = size(); api.size(s[0], s[1], s[2]); api.hidden(isHidden()); api.paused(pausedState);
      send = function (k, a) { api[k].apply(null, a); };
    }
    if (canWorker) {
      try {
        worker = new Worker(workerUrl());
        var s0 = size();
        worker.postMessage({ k: 'init', cfg: cfg, maxDpr: maxDpr, w: s0[0], h: s0[1], dpr: s0[2], hidden: isHidden(), paused: pausedState });
        var gotTiles = false;
        worker.onmessage = function (e) { if (e.data && e.data.k === 'tiles') { gotTiles = true; vw.tiles(e.data.m); } };
        worker.onerror = function () {
          if (gotTiles) return;
          worker.terminate(); worker = null; runHere();
        };
        send = function (k, a) { if (worker) worker.postMessage({ k: k, a: a }); else if (api) api[k].apply(null, a); };
      } catch (err) { worker = null; runHere(); }
    } else runHere();
    el.setAttribute('data-cta-texture-state', 'running');

    var ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(function () { send('size', size()); }) : null;
    if (ro) ro.observe(el); else window.addEventListener('resize', function () { send('size', size()); });
    var io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver(function (es) {
      onScreen = es[es.length - 1].isIntersecting; send('hidden', [isHidden()]);
    }) : null;
    if (io) io.observe(el);
    function vis() { send('hidden', [isHidden()]); }
    document.addEventListener('visibilitychange', vis);

    var lastSplit = null, ctl = {
      setSplit: function (px) { px = Math.round(px * 2) / 2; if (px !== lastSplit) { lastSplit = px; vw.split(px); } },
      setExtendTop: function (px) { extState = Math.max(0, +px || 0); vw.ext(extState); send('ext', [extState]); },
      setColours: function (p, a) { send('colours', [pal(p, el), pal(a, el)]); },
      pause: function () { pausedState = true; send('paused', [true]); },
      play: function () { pausedState = false; send('paused', [false]); },
      isPaused: function () { return pausedState; },
      on: function (ev, fn) {
        if (ev === 'ready' && typeof fn === 'function') { if (isReady) setTimeout(function () { fn.call(ctl, ctl); }); else readyFns.push(fn); }
        return ctl;
      },
      destroy: function () {
        send('stop', []); if (worker) worker.terminate(); if (ro) ro.disconnect(); if (io) io.disconnect();
        document.removeEventListener('visibilitychange', vis); vw.free(); canvas.remove(); el.__ctaTexture = null;
      }
    };
    /* properties for a per-frame driver (GSAP tweens plain object properties) */
    var extState = cfg.extendTop || 0;
    Object.defineProperty(ctl, 'split', { enumerable: true,
      get: function () { return lastSplit == null ? (cfg.splitAt != null ? cfg.splitAt : 100000) : lastSplit; },
      set: function (v) { ctl.setSplit(+v || 0); } });
    Object.defineProperty(ctl, 'extendTop', { enumerable: true,
      get: function () { return extState; },
      set: function (v) { ctl.setExtendTop(v); } });
    el.__ctaTexture = ctl;
    return ctl;
  }

  /* ------------------------------------------------------------------ declarative mount
     <div data-cta-texture="auto"> (the footer's top stage on every page, D-232). Hosts that mount by
     hand (Home css__cta) keep data-cta-texture with no value and are left alone. */
  var mqReduce = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function attrNum(el, a) { var v = el.getAttribute(a); if (v == null || v === '') return undefined; v = parseFloat(v); return isFinite(v) ? v : undefined; }
  function cssVar(el, n) { return getComputedStyle(el).getPropertyValue(n).trim(); }
  function attrPaused(el) { var v = el.getAttribute('data-paused'); return v != null && v !== '0' && v !== 'false'; }
  function autoMount(el) {
    if (el.__ctaTexture) return el.__ctaTexture;
    var bg = cssVar(el, '--cta-tex-bg'), fg = cssVar(el, '--cta-tex-fg'),
      abg = cssVar(el, '--cta-tex-above-bg'), afg = cssVar(el, '--cta-tex-above-fg');
    var o = { extendTop: attrNum(el, 'data-extend-top'), splitAt: attrNum(el, 'data-split'), startAt: attrNum(el, 'data-start-at'),
      maxDpr: attrNum(el, 'data-max-dpr'), worker: el.getAttribute('data-worker') !== 'off',
      paused: attrPaused(el) || !!mqReduce.matches };
    if (bg && fg) o.palette = [bg, fg];
    if (abg && afg) o.abovePalette = [abg, afg];
    var t = mount(el, o);
    function sync() { if (attrPaused(el) || mqReduce.matches) t.pause(); else t.play(); }
    new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ['data-paused'] });
    if (mqReduce.addEventListener) mqReduce.addEventListener('change', sync); else if (mqReduce.addListener) mqReduce.addListener(sync);
    t.refreshColours = function () {
      var p = [cssVar(el, '--cta-tex-bg'), cssVar(el, '--cta-tex-fg')], a = [cssVar(el, '--cta-tex-above-bg'), cssVar(el, '--cta-tex-above-fg')];
      t.setColours(p[0] && p[1] ? p : null, a[0] && a[1] ? a : null); return t;
    };
    return t;
  }
  function mountAll(root) {
    var els = (root || document).querySelectorAll('[data-cta-texture="auto"]'), out = [];
    for (var i = 0; i < els.length; i++) out.push(autoMount(els[i]));
    return out;
  }
  function get(el) {
    if (typeof el === 'string') el = document.querySelector(el);
    if (!el) return null;
    if (el.__ctaTexture) return el.__ctaTexture;
    return el.getAttribute('data-cta-texture') === 'auto' ? autoMount(el) : null;
  }

  window.PrimerCtaTexture = { mount: mount, get: get, mountAll: mountAll, version: '1.2.1' };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mountAll(); }, { once: true });
  else mountAll();
  try { window.dispatchEvent(new CustomEvent('primer-cta-texture-ready')); } catch (e) {}
})();
