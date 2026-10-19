/*!
 * sv-motion 1.3.0 (StanVision, made for Primer): SV.motion core + GSAP effects library (motion.md §5, motion-library.md).
 * GSAP comes from Webflow's integration (Site settings > GSAP: Core, ScrollTrigger, CustomEase, ScrollToPlugin, SplitText).
 * Load it deferred after Webflow's GSAP scripts; it also waits for the GSAP globals if it runs earlier.
 */
;(function () {

  var w = window, d = document
  if (w.__svMotion) return
  w.__svMotion = true
  w.SV = w.SV || {}
  /* the inline stub (Webflow js__motion embed) may already hold SV.motion.booted for the page's widget embeds */
  var M = (SV.motion = SV.motion || {})
  M.version = '1.3.0'

  /* ---- SV.motion core (D-234/D-246, D-249): eases, tokens, effect registry, one deferred ScrollTrigger refresh,
     pauseWhenHidden for loops. Under prefers-reduced-motion each effect sets its end state instead of moving. ---- */
  var dom = new Promise(function (r) { d.readyState === 'loading' ? d.addEventListener('DOMContentLoaded', r) : r() })
  var loaded = new Promise(function (r) { d.readyState === 'complete' ? r() : w.addEventListener('load', r, { once: true }) })
  var fontsReady = (d.fonts && d.fonts.ready) || Promise.resolve()
  var reg = {}, refreshT
  M.dur = { micro: 0.25, hover: 0.4, reveal: 0.65, move: 0.45, wipe: 0.77, texture: 1.6, stagger: 0.045, items: 0.08,
    labelOut: 0.18, labelGap: 0.04, labelIn: 0.38 } // D-288 label slide: exit, empty beat, entry
  M.ease = { house: 'power3.inOut', arrive: 'power3.out', cross: 'power2.inOut', wipe: 'power2.inOut', wipePhoto: 'power3.inOut', flock: 'expo.out', labelOut: 'power2.in', labelIn: 'expo.out' }
  M.reduce = w.matchMedia('(prefers-reduced-motion: reduce)').matches
  M.ready = Promise.all([dom, fontsReady])
  M.register = function (name, fn) { reg[name] = fn }
  M.effect = function (name) { return reg[name] }
  /* every layout change (tabs, accordions, CMS filters) calls this, never ScrollTrigger.refresh() directly */
  M.refresh = function () { clearTimeout(refreshT); refreshT = setTimeout(function () { if (w.ScrollTrigger) ScrollTrigger.refresh() }, 120) }
  /* idle work queue (F-07): non-critical inits run in small idle slices, never inside the load task */
  var idleQ = [], idleOn = false
  var ric = w.requestIdleCallback ? function (f, t) { w.requestIdleCallback(f, { timeout: t || 300 }) } : function (f) { setTimeout(function () { f({ timeRemaining: function () { return 8 }, didTimeout: true }) }, 16) }
  function drain(dl) {
    var t0 = performance.now()
    while (idleQ.length && (dl.timeRemaining() > 3 || (dl.didTimeout && performance.now() - t0 < 12))) { try { idleQ.shift()() } catch (e) { setTimeout(function () { throw e }) } }
    if (idleQ.length) ric(drain); else idleOn = false
  }
  M.idle = function (fn) { idleQ.push(fn); if (!idleOn) { idleOn = true; ric(drain) } }
  /* 1.2.0 (Primer D-412): one site-wide pause (window.svPause, Footer "Pause animations"): M.paused holds every loop that runs
     through pauseWhenHidden; the state arrives as the document event 'sv:motion-pause' {detail:{paused}} */
  M.paused = !!(w.svPause && w.svPause.paused())
  var syncs = []
  M.setPaused = function (v) { M.paused = !!v; syncs.forEach(function (f) { f() }) }
  d.addEventListener('sv:motion-pause', function (e) { M.setPaused(e.detail && e.detail.paused) })
  /* loops and canvases: play only while on screen, with the tab visible and not paused site-wide; a local pause (tl.__user) wins */
  M.pauseWhenHidden = function (tl, trigger) {
    tl.__vis = !w.ScrollTrigger
    function sync() { (tl.__vis && !d.hidden && !tl.__user && !M.paused) ? tl.play() : tl.pause(); if (tl.__onSync) tl.__onSync(!tl.paused()) }
    syncs.push(sync)
    function vis(st) { tl.__vis = st.isActive; sync() } // onRefresh too: onToggle never fires for a trigger that starts off screen
    if (w.ScrollTrigger) vis(ScrollTrigger.create({ trigger: trigger, start: 'top bottom', end: 'bottom top', onToggle: vis, onRefresh: vis }))
    d.addEventListener('visibilitychange', sync)
    return sync
  }
  /* GSAP globals: Webflow adds them at the end of body; a deferred file runs after them, an early one waits for load */
  function gsapReady() { return w.gsap ? Promise.resolve(true) : loaded.then(function () { return !!w.gsap }) }
  /* F-07: ScrollTrigger refreshes on our schedule, not inside the DOMContentLoaded / load event tasks (its own refreshes there
     were 36-51 ms of the 100-190 ms DOMContentLoaded task); set before DOMContentLoaded when this file runs deferred */
  var ST_EVENTS = 'visibilitychange,resize'
  if (w.ScrollTrigger) ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: ST_EVENTS })
  function nextTask(v) { return new Promise(function (r) { setTimeout(function () { r(v) }, 0) }) }
  var booted = dom.then(gsapReady).then(nextTask).then(function (ok) {
    if (!ok) return false
    var plugins = [w.ScrollTrigger, w.CustomEase, w.SplitText, w.ScrollToPlugin].filter(Boolean)
    if (plugins.length) gsap.registerPlugin.apply(gsap, plugins)
    if (w.ScrollTrigger) ScrollTrigger.config({ ignoreMobileResize: true, autoRefreshEvents: ST_EVENTS })
    if (w.CustomEase) {
      CustomEase.create('customEase', 'M0,0 C0.77,0 0.175,1 1,1')
      CustomEase.create('sv-arrive', '0.22,1,0.36,1')
      CustomEase.create('sv-cross', '0.76,0,0.24,1')
      CustomEase.create('sv-wipe', '0.7,0,0.3,1')
      CustomEase.create('sv-wipe-photo', '0.7,0,0.1,1')
      CustomEase.create('sv-flock', '0.16,1,0.3,1')
      /* D-288 label slide: the exit leans back ~7 % (anticipation) then accelerates away; the entry arrives fast and settles
         with a 1.5 % overshoot (soft landing), so the label never stops dead */
      CustomEase.create('sv-label-out', 'M0,0 C0.45,-0.25 0.7,0.15 1,1')
      CustomEase.create('sv-label-in', 'M0,0 C0.16,0.7 0.3,1.03 0.55,1.015 C0.75,1.005 0.85,1 1,1')
      M.ease = { house: 'customEase', arrive: 'sv-arrive', cross: 'sv-cross', wipe: 'sv-wipe', wipePhoto: 'sv-wipe-photo', flock: 'sv-flock', labelOut: 'sv-label-out', labelIn: 'sv-label-in' }
    }
    M.mm = gsap.matchMedia()
    gsap.defaults({ ease: M.ease.arrive, duration: M.dur.reveal })
    return true
  })
  /* with the inline stub, keep its booted (it starts each subscriber in its own task); without it, the plain promise */
  if (typeof M.__boot === 'function') M.__boot(booted)
  else M.booted = booted
  /* the page-load refreshes (motion.md §6.1): once the effects exist and once images and fonts have settled, each after the
     next frame in idle time */
  function lateRefresh() { if (w.ScrollTrigger) requestAnimationFrame(function () { ric(function () { ScrollTrigger.refresh() }, 600) }) }
  booted.then(function (ok) { if (ok) lateRefresh() })
  loaded.then(lateRefresh)

  /* the effects library starts in its own task, after the widget embeds' booted callbacks */
  booted.then(function (ok) { if (ok) setTimeout(function () { init(M) }, 0) })

    function init(M) {
      var E = M.ease, eager = { intro: 1, 'nav-hover': 1, 'btn-hover': 1, 'menu-open': 1, 'modal-open': 1 };
      document.documentElement.classList.add('sv-motion');
      function touch(e) { return e.pointerType === 'touch'; }
      function fv(el) { try { return el.matches(':focus-visible') || el.matches(':has(:focus-visible)'); } catch (x) { return false; } }

      /* ---- btn-hover: one delegated listener set, so Silktide's late buttons work too; built on first hover/focus.
         D-274: nav text links (.nav__links__child) take the label slide too, without the fill (the nav pill is their fill).
         D-275/D-288: hover-in = label exits left and re-enters from the right. D-498 (Stan D-492, sv-motion 1.3.0): hover-out has
         no swipe back: the label stays where it is (a running hover-in slide just finishes), the in-timeline re-arms from 0 on
         the next hover-in / keyboard focus (label at rest at both ends, so the restart is invisible); the fill leaves with a
         0.2 s fade (a colour change, like the text colour) and resets to scaleX 0 unseen. ---- */
      var BTN = '.button:not([data-wf--button--button---variant="link"]):not([icon-only="yes"]):not([icon-only="true"]),' +
                '#silktide-wrapper .st-button, .footer__newsletter-submit';
      function btnOf(t) { return (t && t.closest && t.closest(BTN)) || null; }
      function wrapIn(host) { // the host becomes the mask, its content moves into span.sv-label
        var s = host.querySelector(':scope > .sv-label');
        if (s) return s;
        s = document.createElement('span');
        s.className = 'sv-label';
        while (host.firstChild) s.appendChild(host.firstChild);
        host.appendChild(s);
        host.classList.add('sv-mask');
        return s;
      }
      function labelOf(el) {
        var arrow = el.querySelector('.footer__newsletter-arrow');
        if (arrow) { // icon only: a mask span around the arrow
          if (!arrow.parentNode.classList.contains('sv-mask')) { var m = document.createElement('span'); m.className = 'sv-mask'; arrow.parentNode.insertBefore(m, arrow); m.appendChild(arrow); }
          return arrow;
        }
        var host = el.querySelector('.st-button__label, .btn-link');
        return host && host.firstChild ? wrapIn(host) : null;
      }
      function setup(el) {
        if (el.__svh) return el.__svh;
        el.setAttribute('data-motion', 'btn-hover');
        el.setAttribute('data-motion-init', 'on');
        var h = { on: false, label: labelOf(el) }, label = h.label;
        if (!el.matches('.footer__newsletter-submit') && !el.closest('.nav__links__child')) {
          var fill = document.createElement('span');
          fill.className = 'sv-fill';
          fill.setAttribute('aria-hidden', 'true');
          el.insertBefore(fill, el.firstChild);
          h.fillEl = fill;
          h.fill = M.reduce
            ? gsap.fromTo(fill, { scaleX: 1, autoAlpha: 0 }, { autoAlpha: 1, duration: 0.2, ease: 'none', paused: true })
            : gsap.fromTo(fill, { scaleX: 0 }, { scaleX: 1, duration: M.dur.hover, ease: E.arrive, paused: true });
        }
        return (el.__svh = h);
      }
      /* hover-in only (D-498): out to the left, in from the right; one timeline, reused, never reversed */
      function slide(h) {
        if (!h.label || M.reduce) return;
        if (h.tIn && h.tIn.isActive()) return;
        if (!h.tIn) h.tIn = gsap.timeline({ paused: true })
          .to(h.label, { xPercent: -110, duration: M.dur.labelOut, ease: E.labelOut })
          .set(h.label, { xPercent: 110 }, '+=' + M.dur.labelGap)
          .to(h.label, { xPercent: 0, duration: M.dur.labelIn, ease: E.labelIn });
        h.tIn.restart();
      }
      function enter(el) {
        if (el.disabled || el.hasAttribute('data-cc-autofocus')) return;
        var h = setup(el);
        if (h.on) return;
        h.on = true;
        if (h.fill) {
          if (h.fade) { h.fade.kill(); h.fade = null; gsap.set(h.fillEl, { autoAlpha: 1 }); }
          h.fill.play();
        }
        slide(h);
      }
      function leave(el) {
        var h = el.__svh;
        if (!h || !h.on) return;
        h.on = false;
        if (!h.fill) return;
        if (M.reduce) { h.fill.reverse(); return; }
        h.fill.pause();
        h.fade = gsap.to(h.fillEl, { autoAlpha: 0, duration: 0.2, ease: 'none', onComplete: function () {
          h.fade = null; h.fill.pause(0); gsap.set(h.fillEl, { autoAlpha: 1 });
        } });
      }
      document.addEventListener('pointerover', function (e) {
        if (touch(e)) return;
        var el = btnOf(e.target);
        if (el && !el.contains(e.relatedTarget)) enter(el);
      });
      document.addEventListener('pointerout', function (e) {
        var el = btnOf(e.target);
        if (el && !el.contains(e.relatedTarget) && !fv(el)) leave(el);
      });
      document.addEventListener('focusin', function (e) {
        var el = btnOf(e.target);
        if (el && fv(el)) enter(el);
      });
      document.addEventListener('focusout', function (e) {
        var el = btnOf(e.target);
        if (el && !el.contains(e.relatedTarget) && !el.matches(':hover')) leave(el);
      });

      /* ---- nav-hover (D-240 option A): one pill glides to the hovered / focused item; the labels slide with btn-hover (D-274) ---- */
      M.register('nav-hover', function (root) {
        M.mm.add({ desk: '(min-width: 992px) and (hover: hover) and (pointer: fine)', rm: '(prefers-reduced-motion: reduce)' }, function (ctx) {
          if (!ctx.conditions.desk) return;
          var rm = ctx.conditions.rm, d = rm ? 0 : 0.35, cur = null, shown = false, offs = [];
          var pill = document.createElement('span');
          pill.className = 'sv-pill';
          pill.setAttribute('aria-hidden', 'true');
          root.insertBefore(pill, root.firstChild);
          gsap.set(pill, { autoAlpha: 0, x: 0, width: 0 });
          var toX = gsap.quickTo(pill, 'x', { duration: d, ease: E.arrive }), toW = gsap.quickTo(pill, 'width', { duration: d, ease: E.arrive });
          var items = [].slice.call(root.children).map(function (c) { return c.matches('.nav__dropdown') ? c.querySelector('.nav__dropdown-toggle') : c.matches('.button') ? c : null; }).filter(Boolean);
          function show(el) {
            if (cur === el && shown) return;
            var r = el.getBoundingClientRect(), b = root.getBoundingClientRect(), x = r.left - b.left; // one read per item change, never per frame
            if (rm || !shown) gsap.set(pill, { x: x, width: r.width }); else { toX(x); toW(r.width); }
            cur = el;
            if (!shown) { shown = true; gsap.to(pill, { autoAlpha: 1, duration: rm ? 0 : 0.2, overwrite: 'auto' }); }
          }
          function hide() {
            var open = root.querySelector('.nav__dropdown-menu[data-sv-open="true"]');
            if (open) { show(open.closest('.nav__dropdown').querySelector('.nav__dropdown-toggle')); return; }
            if (root.matches(':hover')) return;
            shown = false;
            gsap.to(pill, { autoAlpha: 0, duration: rm ? 0 : 0.25, overwrite: 'auto' });
          }
          function on(t, type, fn) { t.addEventListener(type, fn); offs.push(function () { t.removeEventListener(type, fn); }); }
          items.forEach(function (el) {
            on(el, 'pointerenter', function (e) { if (!touch(e)) show(el); });
            on(el, 'focusin', function () { if (fv(el)) show(el); });
          });
          on(root, 'pointerleave', function () { setTimeout(hide, 0); });
          on(root, 'focusout', function (e) { if (!root.contains(e.relatedTarget)) hide(); });
          on(document, 'sv:menu', function (e) { if (e.detail.open) show(e.detail.dd.querySelector('.nav__dropdown-toggle')); else hide(); });
          return function () { offs.forEach(function (f) { f(); }); pill.remove(); };
        });
      });

      /* ---- menu-open: mega-menus (desktop: hover, click, Enter; Escape dismisses), accordion + drawer + burger (<= 991) ---- */
      M.register('menu-open', function (nav) {
        var dds = [].slice.call(nav.querySelectorAll('.nav__dropdown'));
        var burger = nav.querySelector('.hamburger__menu'), drawer = nav.querySelector('.nav__links-wrapper');
        M.mm.add({ desk: '(min-width: 992px)', fine: '(hover: hover) and (pointer: fine)', rm: '(prefers-reduced-motion: reduce)' }, function (ctx) {
          var c = ctx.conditions, offs = [];
          function on(t, type, fn) { t.addEventListener(type, fn); offs.push(function () { t.removeEventListener(type, fn); }); }
          function watch(t, fn) { var mo = new MutationObserver(fn); mo.observe(t, { attributes: true, attributeFilter: ['class'] }); offs.push(function () { mo.disconnect(); }); }
          dds.forEach(function (dd) {
            var tg = dd.querySelector('.w-dropdown-toggle'), menu = dd.querySelector('.w-dropdown-list');
            if (!tg || !menu) return;
            if (!c.desk) { // accordion in the drawer: Webflow shows the panel (w--open); its columns rise in
              watch(tg, function () {
                if (!tg.classList.contains('w--open') || c.rm) return;
                gsap.fromTo(menu.children, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.3, ease: E.arrive, stagger: 0.04, overwrite: true, clearProps: 'opacity,visibility,transform' });
              });
              return;
            }
            var st = { hover: false, dismissed: false, open: false };
            gsap.set(menu, { autoAlpha: 0 });
            function sync() {
              var want = tg.classList.contains('w--open') || (st.hover && !st.dismissed);
              if (want === st.open) return;
              st.open = want;
              menu.setAttribute('data-sv-open', String(want));
              if (want) gsap.fromTo(menu, { autoAlpha: 0, y: c.rm ? 0 : 8 }, { autoAlpha: 1, y: 0, duration: c.rm ? 0 : 0.3, ease: E.arrive, overwrite: true });
              else gsap.to(menu, { autoAlpha: 0, y: c.rm ? 0 : 8, duration: c.rm ? 0 : 0.2, ease: 'power2.in', overwrite: true });
              document.dispatchEvent(new CustomEvent('sv:menu', { detail: { dd: dd, open: want } }));
            }
            watch(tg, sync);
            if (c.fine) {
              on(dd, 'pointerenter', function (e) { if (touch(e)) return; st.hover = true; st.dismissed = false; sync(); });
              on(dd, 'pointerleave', function () { st.hover = false; st.dismissed = false; sync(); });
            }
            /* F-06: one Escape closes any open menu (capture: Webflow's dropdown stops the event inside the panel), and the
               panel closes when focus moves outside trigger + panel (Webflow's own focusout handler never closes) */
            function close() {
              st.dismissed = st.hover; // a hover-opened panel stays shut until the pointer leaves
              if (tg.classList.contains('w--open')) { if (window.jQuery) jQuery(dd).triggerHandler('w-close'); if (tg.classList.contains('w--open')) tg.click(); }
              sync();
            }
            document.addEventListener('keydown', esc, true);
            offs.push(function () { document.removeEventListener('keydown', esc, true); });
            function esc(e) { if (e.key === 'Escape' && st.open) { var inside = dd.contains(document.activeElement); close(); if (inside) tg.focus(); } }
            on(dd, 'focusout', function (e) { var t = e.relatedTarget; if (st.open && t && !dd.contains(t)) close(); });
            offs.push(function () { menu.removeAttribute('data-sv-open'); });
          });
          if (!c.desk && burger && drawer) {
            var ln = { t: burger.querySelector('.top'), m: burger.querySelector('.middle'), b: burger.querySelector('.bottom') }, d = c.rm ? 0 : 0.25;
            watch(burger, function () {
              var open = burger.classList.contains('is--open');
              if (open === burger.__svOpen) return;
              burger.__svOpen = open;
              if (open) {
                gsap.to([ln.t, ln.b], { y: 0, yPercent: -50, rotation: function (i) { return i ? -45 : 45; }, duration: d, ease: E.arrive, overwrite: true });
                gsap.to(ln.m, { autoAlpha: 0, duration: d * 0.6, overwrite: true });
                if (!c.rm) gsap.fromTo(drawer.querySelectorAll('.nav-mobile__btns-wrap > *, .nav__links__child > *'), { autoAlpha: 0, x: -16 },
                  { autoAlpha: 1, x: 0, duration: 0.45, ease: E.arrive, stagger: 0.04, overwrite: true, clearProps: 'opacity,visibility,transform' });
              } else {
                gsap.to([ln.t, ln.b], { y: function (i) { return i ? 4 : -4; }, yPercent: 0, rotation: 0, duration: d, ease: E.arrive, overwrite: true, clearProps: 'transform' });
                gsap.to(ln.m, { autoAlpha: 1, duration: d, overwrite: true, clearProps: 'opacity,visibility' });
              }
            });
          }
          return function () { offs.forEach(function (f) { f(); }); };
        });
      });

      /* ---- B2 helpers ---- */
      function split(el) { return SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'sv-line', aria: 'auto' }); }

      /* ---- intro (D-251): hero 9 page-load entrance. Starts at fonts.ready; skipped when the hero has already been on
         screen for more than data-motion-late ms (default 400) or the page is scrolled, so painted content never vanishes. ---- */
      /* murmuration v2 (D-233/D-245, B4): fn(handle) once the runtime (lazy, after window load + idle) has mounted el */
      function murm(el, fn) {
        function go() { var h = window.PrimerMurmuration && PrimerMurmuration.get(el); if (h) fn(h); return !!h; }
        if (!go()) document.addEventListener('primer-murmuration:loaded', go, { once: true });
      }
      /* D-276: the js__motion stub sets html.sv-intro-pending before the hero is parsed (css__animations hides the hero bar's
         label, icon and fill while it is set), so the bar never shows before its wipe. Every path below ends it: intro built
         (the from-states take over in the same task), intro skipped, reduced motion, no bar; the stub also ends it on load
         failure and after 4 s. */
      function unpend() { document.documentElement.classList.remove('sv-intro-pending'); }
      M.register('intro', function (root, p, q, rm) {
        if (rm) return unpend(); // everything at rest; the murmuration runtime holds its still frame
        var tex = q('[data-murmuration-v2]')[0], LATE = +p.late || 400, t0 = null;
        if (tex) murm(tex, function (h) {
          /* flock-in: the runtime's canvas (not the observed element, so its lazy start still sees it) rises from the band bottom at
             max(0.6 s, first frame); skipped if the frame is already up or the hero is out of view */
          var cv = tex.querySelector(':scope > canvas');
          if (cv && !h.state().ready && window.scrollY < root.offsetHeight) {
            gsap.set(cv, { yPercent: 100 });
            h.on('ready', function () {
              var at = t0 == null ? 0 : Math.max(0, (+p.texture || 0.6) - (performance.now() - t0) / 1000);
              gsap.to(cv, { yPercent: 0, duration: M.dur.texture, ease: E.flock, delay: at, clearProps: 'transform' });
            });
          }
          /* hero-leave: the flock rises 250 px as the hero scrolls out (handoff dy -0.428 at 1440x900 = panPx(-250)), scrubbed. GSAP tweens the
             handle's panY; the px -> Pan Y unit (0.35 x scale x 1.28 x band height) is read on refresh, never per frame */
          gsap.to(h, { panY: function () { return -250 / (0.35 * h.scale * 1.28 * (tex.clientHeight || 1)); }, ease: 'none',
            scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
        });
        M.ready.then(function () {
          var now = t0 = performance.now(), fcp = (performance.getEntriesByType ? performance.getEntriesByType('paint') : []).filter(function (e) { return e.name === 'first-contentful-paint'; })[0];
          if ((fcp && now - fcp.startTime > LATE) || window.scrollY > 40 || !window.SplitText) return unpend(); // skipped: final state at once
          var nav = document.querySelector('.navigation'), h1 = q('h1')[0], eyebrow = q('.hero__eyebrow .button')[0], lead = q('.hero__lead')[0];
          var bar = q('.hero__cta .button')[0], ST = +p.stagger || M.dur.stagger;
          /* label + icon move inside their button (the mask); the label text moves in span.sv-label so the .btn-link::after hit area keeps its box */
          function inner(btn) { var l = btn.querySelector('.btn-link'); return [l && l.firstChild ? wrapIn(l) : null, btn.querySelector('.button__trailing-icon')].filter(Boolean); }
          var barIn = bar && inner(bar);
          var tl = gsap.timeline({ defaults: { ease: E.arrive, duration: M.dur.reveal } }), splits = [], tidy = [];
          if (nav) tl.from(nav, { yPercent: -100, y: -16, duration: M.dur.move, clearProps: 'transform' }, +p.nav || 0.25);
          if (h1) { var s1 = split(h1); splits.push(s1); tl.from(s1.lines, { yPercent: 100, y: '0.7em', stagger: ST }, +p.headline || 0.25); }
          var at = +p.rest || 0.65;
          if (eyebrow) { gsap.set(eyebrow, { clipPath: 'inset(0px)' }); tidy.push([eyebrow, 'clipPath']); /* static mask, never animated */ tl.from(inner(eyebrow), { yPercent: 100, y: '0.7em', clearProps: 'transform' }, at); at += ST; }
          if (lead) { var s2 = split(lead); splits.push(s2); tl.from(s2.lines, { yPercent: 100, y: '0.7em', stagger: ST }, at); }
          unpend(); // same task as the from-states below: no frame shows the bar between the two
          if (bar && barIn.length) { // wipe-solo: the bar colour grows from the left edge across the viewport and settles on the bar (prototype keyframes)
            var cta = bar.closest('.hero__cta'), wipe = document.createElement('div');
            wipe.className = 'sv-intro-wipe';
            wipe.setAttribute('aria-hidden', 'true');
            wipe.style.backgroundColor = getComputedStyle(bar).backgroundColor; // the bar's own colour, read once
            cta.appendChild(wipe);
            var L = Math.max(0, 1 - bar.offsetWidth / wipe.offsetWidth) * 100 / 66.46; // one read, before the timeline plays
            var T = [0, 0, 0, 0, 0, 0, 0.214, 0.949, 2.407, 4.947, 9.3, 17.296, 33.23, 49.164, 57.16, 61.513, 64.053, 65.511, 66.246, 66.46];
            var S = [0, 0.0032, 0.0143, 0.0362, 0.0744, 0.1399, 0.2581, 0.4905, 0.7157, 0.8106, 0.8326, 0.7908, 0.6534, 0.5051, 0.4284, 0.3849, 0.3595, 0.3449, 0.3375, 0.3354];
            var X = T.map(function (v) { return v * L; }), SX = T.map(function (v, i) { return Math.min(1, (v + S[i] * 100 - v * L) / 100); });
            SX[SX.length - 1] = 1 - X[X.length - 1] / 100;
            gsap.set(wipe, { xPercent: 0, scaleX: 0, transformOrigin: 'left center' });
            gsap.set(bar, { backgroundColor: 'transparent', zIndex: 1 });
            tl.to(wipe, { keyframes: { xPercent: X, scaleX: SX, easeEach: 'none' }, duration: 0.95, ease: 'none' }, +p.wipe || 0.8)
              .call(function () { gsap.set(bar, { clearProps: 'backgroundColor,zIndex' }); wipe.remove(); });
            /* D-276: below the bar's bottom edge from this frame on (the bar is the mask: the label's own mask clips sideways only,
               so the label must travel its height + 2 rem to leave the 4 rem bar); rises once the block has reached the right */
            var BAR0 = { yPercent: 100, y: '2rem' };
            gsap.set(barIn, BAR0);
            tl.fromTo(barIn, BAR0, { yPercent: 0, y: 0, immediateRender: false, clearProps: 'transform' }, +p.bar || 1.55);
          }
          tl.eventCallback('onComplete', function () {
            splits.forEach(function (s) { s.revert(); });
            tidy.forEach(function (x) { gsap.set(x[0], { clearProps: x[1] }); });
          });
        });
      });

      /* ---- lines: each line rises out of its own mask once at 85 %; split restored afterwards ---- */
      M.register('lines', function (root, p, q, rm) {
        if (rm || !window.SplitText) return; // visible, unsplit
        M.ready.then(function () {
          var done = false, s = SplitText.create(root, { type: 'lines', mask: 'lines', linesClass: 'sv-line', aria: 'auto', autoSplit: true,
            onSplit: function (self) {
              if (done) return;
              return gsap.from(self.lines, { yPercent: 100, y: '0.7em', duration: +p.dur || M.dur.reveal, ease: E.arrive, stagger: +p.stagger || M.dur.stagger, delay: +p.delay || 0,
                scrollTrigger: { trigger: root, start: p.start || 'top 85%', once: true },
                onComplete: function () { done = true; s.revert(); } });
            } });
        });
      });

      /* ---- marquee (D-252, F-03): the two tracks sit in one wrapper that moves one loop distance per cycle; --marquee-duration (s) on
         the root sets the speed per breakpoint (default data-motion-speed or 30). Pauses off screen, tab hidden, hover (>= 992 fine
         pointer), focus inside and with the site-wide pause (M.paused, 1.2.0: no per-marquee button). Reduced motion: static row. ---- */
      M.register('marquee', function (root, p, q, rm) {
        var tracks = q(':scope > .marquee__container');
        if (!tracks.length) return;
        if (rm) return;
        /* F-03: both tracks move inside one wrapper, so each frame writes one transform on one element; the loop distance is
           the second track's offset (track + gap), read at init and on resize, never per frame */
        var wrap = document.createElement('div');
        wrap.className = 'sv-marquee-track';
        wrap.style.cssText = 'display:flex;flex:none;column-gap:inherit;align-items:inherit';
        tracks[0].parentNode.insertBefore(wrap, tracks[0]);
        tracks.forEach(function (t) { wrap.appendChild(t); });
        var dist = 0;
        function measure() { dist = tracks.length > 1 ? tracks[1].offsetLeft - tracks[0].offsetLeft : tracks[0].offsetWidth; }
        measure();
        var tl = gsap.timeline({ repeat: -1, paused: true }).fromTo(wrap, { x: 0 }, { x: function () { return -dist; }, duration: 1, ease: 'none', force3D: true });
        /* compositor hint only while it runs; paused = plain 2D transform, no layer kept */
        tl.__onSync = function (running) {
          wrap.style.willChange = running ? 'transform' : 'auto';
          if (!running) wrap.style.transform = 'translate(' + gsap.getProperty(wrap, 'x') + 'px, 0px)';
        };
        function speed() { var v = parseFloat(getComputedStyle(root).getPropertyValue('--marquee-duration')); tl.timeScale(1 / (v > 0 ? v : (+p.speed || 30))); }
        speed();
        /* re-measure when a track changes size (lazy logos arrive, breakpoint gap) or the row does; the old distance stays until then */
        var rt;
        function remeasure() { clearTimeout(rt); rt = setTimeout(function () { var old = dist; measure(); speed(); if (dist !== old) { var pr = tl.progress(); tl.invalidate().progress(pr); } }, 100); }
        if ('ResizeObserver' in window) { var ro = new ResizeObserver(remeasure); ro.observe(tracks[0]); ro.observe(root); }
        else window.addEventListener('resize', remeasure);
        var st = { hover: false, focus: false }, fine = window.matchMedia('(min-width: 992px) and (hover: hover) and (pointer: fine)');
        var sync = M.pauseWhenHidden(tl, root);
        function upd() { tl.__user = st.hover || st.focus; sync(); }
        root.addEventListener('pointerenter', function (e) { if (!touch(e) && fine.matches) { st.hover = true; upd(); } });
        root.addEventListener('pointerleave', function () { st.hover = false; upd(); });
        root.addEventListener('focusin', function () { st.focus = true; upd(); });
        root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget)) { st.focus = false; upd(); } });
        upd();
      });

      /* ---- media-scale: media layer scales to 1.04 on hover / keyboard focus (data-motion-when filters instances) ---- */
      M.register('media-scale', function (root, p, q, rm) {
        if (rm || (p.when && !root.matches(p.when))) return;
        var media = q(p.target || ':scope > *')[0];
        if (!media) return;
        var tw = gsap.to(media, { scale: +p.scale || 1.04, duration: M.dur.hover, ease: E.arrive, paused: true });
        root.addEventListener('pointerenter', function (e) { if (!touch(e)) tw.play(); });
        root.addEventListener('pointerleave', function () { if (!fv(root)) tw.reverse(); });
        root.addEventListener('focusin', function () { if (fv(root)) tw.play(); });
        root.addEventListener('focusout', function (e) { if (!root.contains(e.relatedTarget) && !root.matches(':hover')) tw.reverse(); });
      });

      /* ---- modal-open: js__modal owns state (is--open), focus and video; motion follows the class ---- */
      M.register('modal-open', function (root, p, q, rm) {
        var box = q('.modal__container')[0], d = rm ? 0 : 1, open = root.classList.contains('is--open');
        gsap.set(root, { autoAlpha: open ? 1 : 0 });
        new MutationObserver(function () {
          var o = root.classList.contains('is--open');
          if (o === open) return;
          open = o;
          if (o) {
            gsap.to(root, { autoAlpha: 1, duration: 0.3 * d, ease: 'none', overwrite: true });
            if (box) gsap.fromTo(box, { y: 24, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45 * d, ease: E.cross, overwrite: true });
          } else {
            gsap.to(root, { autoAlpha: 0, duration: 0.25 * d, ease: 'power2.in', overwrite: true });
            if (box) gsap.to(box, { y: 24, duration: 0.25 * d, ease: 'power2.in', overwrite: true });
          }
        }).observe(root, { attributes: true, attributeFilter: ['class'] });
      });

      /* ---- stats-in (D-277, prototype hero=3 "Billions move through Primer"): the boxes stay put; their texts rise out of
         masks and the figures count up. Box k starts at order[k] x 0.11 s (default orders 0,1,2 / 1,2,3: a diagonal), its
         lines 0.25 s later, 0.045 s apart, 0.65 s sv-arrive from yPercent 100 + 0.7 em; figures count from 0 over 1.4 s
         (power3.out = 1-(1-t)^4) from the same moment. >= 992 one trigger for the grid (top 85 %), below that each box on its
         own. Figures use tabular digits at rest too and the counting box keeps the final width (no width jitter); screen readers get the final value only
         (visually hidden copy, the counting copy is aria-hidden); the original text is restored when the box is done. ---- */
      function sr(text) { var s = document.createElement('span'); s.className = 'sv-sr'; s.textContent = text; return s; }
      function maskAround(el) { // block mask around an element; returns the undo
        var m = document.createElement('div');
        m.className = 'sv-mask';
        el.parentNode.insertBefore(m, el);
        m.appendChild(el);
        return function () { if (m.parentNode) { m.parentNode.insertBefore(el, m); m.remove(); } };
      }
      function counter(el) {
        var txt = el.textContent.trim(), m = txt.match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
        if (!m) return null;
        var dec = (m[2].split('.')[1] || '').length, to = parseFloat(m[2]), o = { v: 0 };
        var wrap = document.createElement('span'), num = document.createElement('span');
        wrap.className = 'sv-count-mask';
        wrap.setAttribute('aria-hidden', 'true');
        num.className = 'sv-count';
        function show() { num.textContent = m[1] + o.v.toFixed(dec) + m[3]; }
        num.textContent = txt;
        wrap.appendChild(num);
        el.textContent = '';
        el.appendChild(sr(txt));
        el.appendChild(wrap);
        num.style.minWidth = Math.ceil(num.getBoundingClientRect().width) + 'px'; // one read: the box keeps the final width while digits are added
        show();
        return { inner: num, tween: function () { return gsap.to(o, { v: to, duration: 1.4, ease: 'power3.out', onUpdate: show }); },
          restore: function () { el.textContent = txt; } };
      }
      M.register('stats-in', function (root, p, q, rm) {
        var cards = q('.grid__items > *');
        q('.stat__value').forEach(function (v) { v.style.fontVariantNumeric = 'tabular-nums'; });
        if (rm || !cards.length || !window.SplitText) return; // static, final figures
        M.ready.then(function () {
          var ORD = (p.order || '0,1,2,1,2,3').split(',').map(Number), desk = window.matchMedia('(min-width: 992px)').matches;
          var master = desk ? gsap.timeline({ paused: true }) : null;
          cards.forEach(function (card, i) {
            var lines = [], undo = [], counts = [];
            card.querySelectorAll('.stat__label, .card-quote__text').forEach(function (el) {
              var s = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'sv-line', aria: 'auto' });
              lines.push.apply(lines, s.lines);
              undo.push(function () { s.revert(); });
            });
            card.querySelectorAll('.card-quote__footer, .card-video__badge > *').forEach(function (el) { undo.push(maskAround(el)); lines.push(el); });
            card.querySelectorAll('.stat__value').forEach(function (el) { var c = counter(el); if (c) { counts.push(c); lines.push(c.inner); undo.push(c.restore); } });
            if (!lines.length) return;
            gsap.set(lines, { yPercent: 100, y: '0.7em' });
            var at = desk ? (ORD[i] != null ? ORD[i] : i) * 0.11 : 0, tl = gsap.timeline({ paused: !desk,
              onComplete: function () { undo.forEach(function (f) { f(); }); gsap.set(lines, { clearProps: 'transform' }); } });
            tl.to(lines, { yPercent: 0, y: 0, duration: M.dur.reveal, ease: E.arrive, stagger: M.dur.stagger }, 0.25);
            counts.forEach(function (c) { tl.add(c.tween(), 0.25); });
            if (desk) master.add(tl, at);
            else ScrollTrigger.create({ trigger: card, start: p.start || 'top 85%', once: true, onEnter: function () { tl.play(); } });
          });
          if (desk) ScrollTrigger.create({ trigger: root, start: p.start || 'top 85%', once: true, onEnter: function () { master.play(); } });
        });
      });

      /* ---- reveal: items rise 24 px and fade in once at 85 %, batched (data-motion-items / -from / -stagger / -start) ---- */
      M.register('reveal', function (root, p, q, rm) {
        var items = p.items ? q(p.items) : [root];
        if (rm || !items.length) return; // nothing was hidden: content stays as laid out
        var from = {}, to = {};
        (p.from || 'y:24').split(/[;,]/).forEach(function (kv) { var m = kv.split(':'); if (m.length === 2) { var k = m[0].trim(), v = parseFloat(m[1]); from[k] = v; to[k] = k === 'scale' ? 1 : 0; } });
        gsap.set(items, Object.assign({ autoAlpha: 0 }, from));
        ScrollTrigger.batch(items, { start: p.start || 'top 85%', once: true, interval: 0.1,
          onEnter: function (batch) {
            gsap.to(batch, Object.assign({ autoAlpha: 1, duration: +p.dur || M.dur.reveal, ease: E.house, stagger: { each: +p.stagger || M.dur.items, from: 'start' },
              overwrite: 'auto', clearProps: 'transform,opacity,visibility' }, to));
          } });
      });

      /* ---- runner: [data-motion] roots, once each; eager effects now, the rest when within one viewport ---- */
      var io = 'IntersectionObserver' in window && new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); run(e.target); } }); // at once: from-states must exist before the user arrives
      }, { rootMargin: '100% 0px' });
      function run(root) {
        var fn = M.effect(root.getAttribute('data-motion'));
        if (!fn || root.getAttribute('data-motion-init') === 'on') return;
        root.setAttribute('data-motion-init', 'on');
        var p = {};
        Object.keys(root.dataset).forEach(function (k) { if (/^motion[A-Z]/.test(k)) p[k.charAt(6).toLowerCase() + k.slice(7)] = root.dataset[k]; });
        fn(root, p, gsap.utils.selector(root), M.reduce ? (p.rm || 'static') : false);
      }
      /* DS 3.0 instances can't carry attributes: these hook classes (Custom style) name their effect (D-251) */
      var HOOKS = { '.section.hero__primer': 'intro', '.sv-lines': 'lines', '.section__trusted .stats__grid': 'stats-in' };
      if (!document.querySelector('.section.hero__primer')) unpend(); // D-276: pages without the hero intro
      Object.keys(HOOKS).forEach(function (s) { document.querySelectorAll(s).forEach(function (el) { if (!el.hasAttribute('data-motion')) el.setAttribute('data-motion', HOOKS[s]); }); });
      document.querySelectorAll('[data-motion]').forEach(function (root) {
        if (root.getAttribute('data-motion-init') === 'on') return;
        var k = root.getAttribute('data-motion');
        if (k === 'intro') run(root); // timing-critical: starts with fonts.ready
        else if (eager[k] || !io) M.idle(function () { run(root); }); // F-07: menus, modal, nav pill in idle slices
        else io.observe(root);
      });
    }
})()
