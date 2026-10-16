# Embed runtimes (lab.stan.vision/embed/)

Website runtimes built from lab experiments and client handoffs. Made for Primer. No iframes, no dependencies.
Served by Vercel from this repo's `main` branch at `https://lab.stan.vision/embed/…`, never indexed.

| Runtime | Global | Mounts on | Versioned file (load this) | Size (min / gzip) |
|---|---|---|---|---|
| Murmuration v2 (handoff flock) | `PrimerMurmuration` | `[data-murmuration-v2]` | `primer-murmuration.2.0.1.min.js` | 45.1 KB / 17.7 KB |
| SV motion (core + GSAP effects library) | `SV.motion` | `[data-motion]` (needs Webflow's GSAP) | `sv-motion.1.0.0.min.js` | 18.4 KB / 6.5 KB |
| CTA texture | `PrimerCtaTexture` | `[data-cta-texture="auto"]` or `mount()` | `cta-texture.1.1.0.min.js` | 14.5 KB / 6.4 KB |
| Murmuration v1 (WebGL shader) | `Murmuration` | `[data-murmuration]` | `murmuration.1.0.0.min.js` | 19.2 KB / 7.4 KB |

## Hosting rules

- **Versioned files** `embed/<name>.<semver>.min.js` never change once published: `Cache-Control: public, max-age=31536000, immutable`. A change ships as a new version file; old versions stay so pages that pin them keep working.
- **Unversioned files** (`<name>.js` readable source, `<name>.min.js` latest build) are for the lab and for reading: `max-age=300`. Sites always load a versioned file.
- Every `/embed/` response: `X-Robots-Tag: noindex, nofollow`, `Access-Control-Allow-Origin: *`, `Cross-Origin-Resource-Policy: cross-origin`, `Timing-Allow-Origin: *`, `X-Content-Type-Options: nosniff`; `.js` is `text/javascript; charset=utf-8` (`vercel.json`). `robots.txt` disallows `/embed/`.
- Use SRI with `crossorigin="anonymous"`:

| File | SRI |
|---|---|
| `primer-murmuration.2.0.1.min.js` | `sha384-SeTbO9msdyfO2OKlxwRr6ya9Nokqxyd0TAOZFpPbHKyCaRtSwxM6I7b9uu4NO+Nt` |
| `sv-motion.1.0.0.min.js` | `sha384-FQDLbPFswVS5aEItOMOmKY4ViwsQspHBSXI3IMiFrklWF+Td1Pb3Yp1QpU5zQSDM` |
| `primer-murmuration.2.0.0.min.js` (pause button throws: use 2.0.1) | `sha384-SnAOD4cnuX+OecjJyz56AVMX5t3ndFThnjmKERIR6kkgf3nw8DkHhWHxbPMh5xiZ` |
| `cta-texture.1.1.0.min.js` | `sha384-m3apBjluA1TbjaYDw4vYpjr2NtIkroFV4MCd7BxEQ2o5hahAR1r9A/PjRhXvbSny` |
| `cta-texture.1.0.0.min.js` | `sha384-vz5U9w29U4WQlduF/8zmEnND5boHMCEAkmpkAXbPiOQfD2rMGQLQMrgZJuhIJY4z` |
| `murmuration.1.0.0.min.js` | `sha384-1KTJfG7KR98ReNp9J1mtXF1Dj9uuhFEZETqd1LVQeQl6q4wIZagL/FmVsp+3It1w` |

- Release: build, `cp <name>.min.js <name>.<new semver>.min.js`, add its SRI here, commit to `main`. Never edit a published version file.

## Murmuration v2 — `primer-murmuration.*`

Inline runtime of the client handoff `primer-murmuration.html` (Primer Texture Motion export: canvas-2D boids flock, Bayer 8×8 dither in two colours, 20 s seamless loop). The handoff code runs **verbatim** inside the runtime; the build adds two marked lines (settings overrides; an absolute `primer-bg-set` message) and replaces the iframe with a host that mounts on an element. Same look: the first frame is pixel-identical to the handoff's at 1440×900.

**Why a new attribute, not a version switch on `[data-murmuration]`:** v1 (WebGL shader, presets, cursor) and v2 (handoff flock) share no settings, so one attribute with a switch would carry two unrelated contracts. `[data-murmuration-v2]` + `PrimerMurmuration` can sit on the same page as v1 while instances migrate, and a v1 loader never picks up a v2 element.

```html
<div class="hero__bg" data-murmuration-v2 aria-hidden="true"
     style="position:absolute;inset:0;background:var(--murmuration-bg)"></div>
<button data-murmuration-pause hidden>Pause</button>   <!-- optional, sibling of the element -->
<script src="https://lab.stan.vision/embed/primer-murmuration.2.0.1.min.js"
        integrity="sha384-SeTbO9msdyfO2OKlxwRr6ya9Nokqxyd0TAOZFpPbHKyCaRtSwxM6I7b9uu4NO+Nt" crossorigin="anonymous" defer></script>
```

| Attribute / CSS | Values |
|---|---|
| `data-murmuration-v2` | marks the element; a canvas (`aria-hidden`, `pointer-events:none`) is added inside, sized to it. A `position: static` element becomes `relative`. |
| `--murmuration-bg`, `--murmuration-fg` (CSS custom properties on the element or inherited) | background and dot colours; any CSS colour or `var(--…)`, so it follows the site palette. Default `#ff540a` / `#fbfaf7` (handoff). Keep the same colour as the element's CSS background so nothing flashes before the first frame. |
| `data-bg`, `data-fg` | same, as attributes (win over the CSS properties) |
| `data-pan-x`, `data-pan-y` | the flock's framing (handoff `panX` −0.46, `panY` 0.914; lower Pan Y = higher on screen) |
| `data-scale` | flock size (`gen.scale`, 1.45) |
| `data-speed` | starting speed factor (1 = handoff speed; multiplies `gen.murmurTimeScale` 0.4) |
| `data-pixel` | dither cell size (`effect.pixel`, 2) |
| `data-settings` | JSON deep-merged over the handoff `CONFIG` (any key: `adjust.stabilize`, `period`, `gen.murmurPreset.*` …) |
| `data-max-dpr` | device-pixel-ratio cap (2, as the handoff) |
| `data-worker="off"` | force the main thread |
| `data-lazy="off"` | start at once instead of when the element is within 200 px of the viewport |
| `data-paused` (`"1"`, or present) | holds the current frame; remove it (or `"0"`) to resume |
| `data-murmuration-v2-state` (set by the runtime) | `idle`, `starting`, `running`, `paused`, `still` |

### API

```js
const m = PrimerMurmuration.get(el);     // or get('#hero-bg'); mounts the element if it is not mounted yet
m.on('ready', fn);                        // first frame drawn (~1-2 s after start: warm-up, off the main thread)
// eased, relative: the handoff's postMessage API, unchanged
m.pan(dy, ms);                            // primer-bg-pan: Pan Y units, negative = up
m.panPx(px, ms);                          // same in CSS px for this element's height (-250 = 250 px up)
m.speed(to, ms);                          // primer-bg-speed: speed factor 0.01-4
m.tween(key, to, ms, { from, ease });     // primer-bg-tween: any numeric CONFIG.gen key; ease 'out' or in-out
// absolute, immediate: for GSAP (one message per microtask, however many props change)
m.panY = -0.43;  m.panYPx = -250;  m.panX = 0.1;  m.rate = 0.5;  m.scale = 1.2;
m.set('pixel', 3);  m.set({ panYPx: -250, rate: 0.6 });  m.refreshPalette();   // re-read the CSS colours (theme change)
m.pause(); m.play(); m.isPaused(); m.state(); m.destroy();
PrimerMurmuration.mount(el, { panY, scale, palette: [bg, fg], worker, lazy, settings });
PrimerMurmuration.mountAll(root);         // elements added later
```

`panY`, `panX` are offsets from the configured framing (0 = as configured). One Pan Y unit is `0.35 × scale × 1.28 × element height` px. The handoff's hero rise ("`dy -0.428` over 900 ms at 1440 × 900") is `m.panPx(-250, 900)`, or scroll-linked:

```js
gsap.to(PrimerMurmuration.get(bg), { panYPx: -250, ease: 'none',
  scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
```

The runtime has **no scroll listeners**; GSAP (or the page) drives it. Events: `primer-murmuration:ready` (bubbles from the element, `detail.handle`), `primer-murmuration:loaded` on `document`.

### Behaviour

- Draws in a **Web Worker** (blob URL, `OffscreenCanvas`): the simulation and the dither never touch the main thread. Falls back to the main thread on its own when there is no `OffscreenCanvas`, or a CSP blocks `blob:` workers (allow with `worker-src blob:`), or the worker errors before its first frame.
- Pauses when the tab is hidden, the element is off screen, or it has `data-paused`; the clock holds still, so it resumes where it stopped.
- `prefers-reduced-motion: reduce`: runs to the first frame and holds it (one still frame); a resize redraws the held frame. The pause button is hidden.
- Optional pause control: a `button[data-murmuration-pause]` next to the element is shown once it runs, toggles play/pause and keeps `aria-pressed` and `aria-label` in sync (WCAG 2.2.2, motion > 5 s). Keep `aria-hidden="true"` on the element.
- Cost: the worker moves the work, it doesn't remove it (same CPU/battery). Measured (headless Chromium, software raster, 2 cores, 1440 × 900): worker main thread ~2% busy, 60 fps, 0 frames over 50 ms, no long task at start; main-thread fallback 100% busy, ~11 fps, a ~2 s long task before the first frame. On phones consider `data-max-dpr="1"` or the MP4 loop.
- Rebuild: `build.mjs` (Primer workspace `claude/scripts/murmuration-v2/`) extracts the handoff's code block verbatim into `host.js`; then terser 5.31.6 `-c passes=2 -m --comments '/^!/'`.

### Versions

- 2.0.1: the optional pause button called `play()`/`pause()` on the internal instance (they live on the handle) and threw `TypeError: n.pause is not a function`; it now toggles. Nothing else changed.
- 2.0.0: first release (kept in place for pages that pin it; don't use it for new pages).

## SV motion — `sv-motion.*`

The StanVision motion core (`SV.motion`: tokens, eases, effect registry, debounced refresh, idle queue, `pauseWhenHidden`) and the GSAP effects library (`data-motion="btn-hover | nav-hover | menu-open | intro | lines | marquee | media-scale | modal-open | reveal"`), as one cached file instead of inline embeds. Source: Primer workspace `claude/scripts/sv-motion/sv-motion.src.js` (`build.sh <version> <embed dir> <terser>`, terser 5.31.6 `-c passes=2 -m`); `sv-motion.js` here is the readable build.

- Needs GSAP + ScrollTrigger + CustomEase (+ SplitText, ScrollToPlugin) as globals (Webflow's GSAP integration). Load it `defer` after them; if it runs earlier it waits for the globals until `load`.
- A page's inline widget code waits on `SV.motion.booted`. Put a stub before the widgets so the promise exists before the file runs, and fail open (minimal form below; Primer's js__motion stub also starts each `then` callback in its own task):

```html
<script>(function(w){w.SV=w.SV||{};if(w.SV.motion)return;var r,M=w.SV.motion={booted:new Promise(function(f){r=f;})};
M.__boot=function(p){M.__boot=null;r(p);};M.__fail=function(){if(M.__boot)M.__boot(false);};w.addEventListener('load',M.__fail);})(window);</script>
<script src="https://lab.stan.vision/embed/sv-motion.1.0.0.min.js" integrity="…" crossorigin="anonymous" defer onerror="SV.motion.__fail()"></script>
```

- Page-load work stays out of the DOMContentLoaded and load tasks: ScrollTrigger's `autoRefreshEvents` drop DOMContentLoaded and load; the file refreshes once after boot and once after load, each after the next frame in idle time. The library starts in its own task; menus, the modal and the nav pill initialise in idle slices (`SV.motion.idle`).
- File fails to load (host down, SRI mismatch): `booted` resolves `false`, widgets run without motion, nothing is hidden (the CSS fallbacks key off `html.sv-motion`).

## Murmuration v1 (WebGL shader) — `murmuration.*`

Lean runtime of [`murmuration.html`](../murmuration.html) for websites: the same shader, settings model (`S`), `PRESETS` and triggers, without the control panel, handles or keyboard shortcuts. Made for Primer.

- `murmuration.js`: readable source. `murmuration.min.js`: what sites load (about 19 KB, 7.4 KB gzipped). Both are generated from the lab's shader; when `murmuration.html` changes its shader or presets, rebuild both.
- Load the versioned file: `https://lab.stan.vision/embed/murmuration.1.0.0.min.js` (same bytes as jsDelivr `@ba1bf85`).

### Usage

```html
<div data-murmuration data-preset="Murmuration 1" data-cursor="Attract" aria-hidden="true"
     style="position:relative;background:#FF540A;height:60vh"></div>
<button data-murmuration-pause hidden>Pause</button> <!-- optional, sibling of the element -->
<script src="https://lab.stan.vision/embed/murmuration.1.0.0.min.js" defer></script>
```

| Attribute | Values |
|---|---|
| `data-murmuration` | marks the element; a canvas is added inside, sized to it |
| `data-preset` | `Murmuration 1` (default), `Murmuration 2`, `Bars`, `Cover`, `Night`, `Lime` |
| `data-settings` | JSON from the lab's COPY SETTINGS; overrides the preset key by key |
| `data-cursor` | `Attract`, `Repel` or `Off`; overrides both |

Behaviour:
- Pointer position is read relative to the element; with no pointer over it the cursor field follows the lab's idle figure-eight.
- The WebGL context is created when the element comes within 200 px of the viewport; the render loop runs only while the element is on screen and the tab is visible.
- Device pixel ratio capped at 2 (1.5 on small or touch screens). Canvas follows the element size (ResizeObserver).
- `prefers-reduced-motion: reduce`: one static frame, no pointer follow.
- No WebGL: nothing is added and the element keeps its CSS background; it gets `data-murmuration-state="fallback"` (`"ready"` when running).
- Optional pause control: a `button[data-murmuration-pause]` next to the element is shown once the effect runs, toggles play/pause and keeps `aria-pressed` and `aria-label` in sync (WCAG 2.2.2). Hidden under reduced motion.

### API

```js
const m = Murmuration.get(el);        // or Murmuration.get('#hero-band')
m.trigger('sweep');                   // sweep, burst, reveal, collapse, morph
m.set('speed', 0.6);
m.settings({ bg: '#A098FD', fg: '#F9FAF7' });
m.preset('Night');
m.get();                              // current settings (same shape as COPY SETTINGS)
m.pause(); m.play(); m.state(); m.destroy();
Murmuration.mountAll();               // mount elements added later
```

`document` receives a `murmuration:ready` event when the script has run.

### Lazy loading (Webflow)

Sites load the file only after `window.load` + `requestIdleCallback`, and only once an element is within about 200 px of the viewport; the loader guards against loading twice when a page has several instances. The Primer Webflow component "Visual - Murmuration" holds that loader.

## CTA texture — `cta-texture.*`

`cta-texture.js` / `cta-texture.min.js` (about 11 KB, 5.3 KB gzipped): port of Primer's prototype background "primer-vignette-background" (Primer Texture Motion export used on the CTA + footer prototype): a looping corner-vignette swirl (top right + bottom left), Bayer 8x8 ordered dither in two colours, a split line below which the colours swap, and an optional strip above the frame in a second palette. Canvas 2D, no iframe; draws in a Web Worker through an OffscreenCanvas when the browser can (main thread fallback capped at 20 fps). Stops when the tab is hidden or the element is off screen.

```html
<div data-cta-texture aria-hidden="true" style="position:absolute;inset:auto 0 0 0;height:calc(100% + 700px)"></div>
<script>
  var t = PrimerCtaTexture.mount(el, { palette: [bg, fg], abovePalette: [aboveBg, aboveFg], extendTop: 700, paused: false });
  t.setSplit(px);        // CSS px from the canvas top; below it the colours swap
  t.setExtendTop(px); t.pause(); t.play(); t.destroy();
</script>
```

Colours are CSS colour strings (hex, `rgb()`, `var(--x)`, resolved in the element's context) or `[r,g,b]`. Paused = one frame, redrawn only when the split, size or colours change (use it for `prefers-reduced-motion`).

### 1.1.0: GSAP-drivable, footer stage on every page (D-232)

- No scroll listener (never had one): the page sets the split. `t.split` and `t.extendTop` are properties, so GSAP tweens them directly: `gsap.to(t, { split: 0, ease: 'none', scrollTrigger: { trigger: footer, start: 'top bottom', end: 'top top', scrub: true } })`. `t.setSplit(px)` / `t.setExtendTop(px)` still work.
- `t.on('ready', fn)`, event `primer-cta-texture:ready` (bubbles, `detail.handle`), `PrimerCtaTexture.get(el)`, `PrimerCtaTexture.mountAll(root)`.
- Declarative mount for the footer's top stage on every page: `<div data-cta-texture="auto" aria-hidden="true">`, colours from the CSS custom properties `--cta-tex-bg`, `--cta-tex-fg`, `--cta-tex-above-bg`, `--cta-tex-above-fg` on the element (Webflow variables), `data-split` (px, default 100000 = no swap), `data-extend-top`, `data-start-at`, `data-max-dpr`, `data-worker="off"`, `data-paused`; `prefers-reduced-motion` = paused (one still frame); `t.refreshColours()` re-reads the variables. An element with `data-cta-texture` and no value (Home's `css__cta`) is left for its own `mount()` call.
- Same look: the core is unchanged (first frame pixel-identical to 1.0.0).
