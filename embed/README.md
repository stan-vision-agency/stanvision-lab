# Murmuration embed

Lean runtime of [`murmuration.html`](../murmuration.html) for websites: the same shader, settings model (`S`), `PRESETS` and triggers, without the control panel, handles or keyboard shortcuts. Made for Primer.

- `murmuration.js`: readable source. `murmuration.min.js`: what sites load (about 19 KB, 7.4 KB gzipped). Both are generated from the lab's shader; when `murmuration.html` changes its shader or presets, rebuild both.
- Load it from a pinned commit, never `@main`:
  `https://cdn.jsdelivr.net/gh/stan-vision-agency/stanvision-lab@<commit-sha>/embed/murmuration.min.js`

## Usage

```html
<div data-murmuration data-preset="Murmuration 1" data-cursor="Attract" aria-hidden="true"
     style="position:relative;background:#FF540A;height:60vh"></div>
<button data-murmuration-pause hidden>Pause</button> <!-- optional, sibling of the element -->
<script src="https://cdn.jsdelivr.net/gh/stan-vision-agency/stanvision-lab@<sha>/embed/murmuration.min.js" defer></script>
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

## API

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

## Lazy loading (Webflow)

Sites load the file only after `window.load` + `requestIdleCallback`, and only once an element is within about 200 px of the viewport; the loader guards against loading twice when a page has several instances. The Primer Webflow component "Visual - Murmuration" holds that loader.

# CTA texture embed

`cta-texture.js` / `cta-texture.min.js` (about 11 KB, 5.3 KB gzipped): port of Primer's prototype background "primer-vignette-background" (Primer Texture Motion export used on the CTA + footer prototype): a looping corner-vignette swirl (top right + bottom left), Bayer 8x8 ordered dither in two colours, a split line below which the colours swap, and an optional strip above the frame in a second palette. Canvas 2D, no iframe; draws in a Web Worker through an OffscreenCanvas when the browser can (main thread fallback capped at 20 fps). Stops when the tab is hidden or the element is off screen.

```html
<div data-cta-texture aria-hidden="true" style="position:absolute;inset:auto 0 0 0;height:calc(100% + 700px)"></div>
<script>
  var t = PrimerCtaTexture.mount(el, { palette: [bg, fg], abovePalette: [aboveBg, aboveFg], extendTop: 700, paused: false });
  t.setSplit(px);        // CSS px from the canvas top; below it the colours swap
  t.setExtendTop(px); t.pause(); t.play(); t.destroy();
</script>
```

Colours are CSS colour strings or `[r,g,b]`; the host resolves them from its own variables. Paused = one frame, redrawn only when the split, size or colours change (use it for `prefers-reduced-motion`). Load from a pinned commit with SRI, like the Murmuration runtime.
