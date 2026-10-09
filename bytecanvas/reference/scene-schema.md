# Scene schema (input to `build.mjs`)

A scene is a `.json` file, or a `.mjs` module whose `default` export is the
scene object (or a function / async function returning it). A function is
called with `tools`, backed by the same Chrome that renders:

```js
export default async function (tools) {
  await tools.fonts([{ font: 'Inter', weight: 400 }, { font: 'Inter', weight: 700 }]); // load + measure once
  tools.width('Halo', { font: 'Inter', size: 10, weight: 700 });                       // sync, exact advances
  const { text, lines } = tools.wrap(longString, 300, { font: 'Inter', size: 9.5 });   // '\n'-broken, line count
  …
}
```

Text layers never wrap, so paragraphs must be broken with `tools.wrap` (and
stacked using `lines * size * lineHeight`). Relative paths
(`src`, `output`, `pngDir`) resolve against the scene file's directory.

```jsonc
{
  "output": "my-guideline.bcanvas",   // default: scene name + .bcanvas
  "pngDir": "exports",                // write PNGs of every page (+ slices); omit for none
  "activeIndex": 0,                   // page shown when the file opens
  "defaults": {                       // fallbacks for text/icon layers
    "font": "Roboto", "size": 16, "color": "#000000", "lineHeight": 1.25,
    "iconStyle": "filled"             // filled | outlined | round | sharp | two-tone
  },
  "cmyk": {                           // optional: brand colours' exact print values
    "#E30613": { "c": 0, "m": 100, "y": 100, "k": 0 },   // or [0, 100, 100, 0]
    "#1D1D1B": [0, 0, 0, 100]
  },                                  // keyed by the hex the layers use; see "Printing" in SKILL.md
  "pages": [Page, ...],
  "slices": [                         // extra crops, written to <pngDir>/slices/<name>.png
    { "name": "home-header", "page": "Screen / Home", "x": 0, "y": 0, "w": 390, "h": 120, "scale": 1 }
  ]                                   // x/y/w/h in the page's logical units
}
```

## Page

```jsonc
{
  "name": "Screen / Home",            // unique; also the PNG file name (slugified)
  "width": 390, "height": 844,        // logical units
  "scale": 3,                         // px per unit — 1170 × 2532 px here. Default 1.
  "background": "#F7F8FA",            // or null/omitted for transparent
  "export": true,                     // false = don't write this page's PNG
  "guides": { "v": [16, 374], "h": [] },
  "layers": [Layer, ...]              // first = bottom
}
```

With `scale`, **every geometric value in the page's layers is in logical
units** (x, y, w, h, size, radius, strokeWidth, dash, letterSpacing, shadow
blur/distance) — so Flutter dp values copy across unchanged.

## Layers

Common to all: `name`, `opacity` (0..1), `visible`, `locked`, `blendMode`,
`rotation` (degrees, about the centre), `bleed: true` (meant to run off the page — skips the builder's overflow warning), `clip` (`{x,y,w,h}` in page units —
the bitmap is cropped to it, the layer dropped if nothing is left; `kit.place`
moves/scales it with the layer, so `place(screen, { x, y, scale, clip: {x:0,y:0,w:390,h:844} })`
keeps a scrolled phone screen inside its frame), `shadow`:

```jsonc
"shadow": { "color": "#000000", "opacity": 0.25, "blur": 8, "distance": 4, "angle": 90 }
// angle: degrees clockwise from east, so 90 = straight down.
// kit.boxShadow({ color, opacity, blur, dx, dy }) converts a Flutter BoxShadow.
```

Colours are `#RGB`, `#RRGGBB` or `#RRGGBBAA` (`kit.alpha(hex, a)` for
`withValues(alpha:)` / `withOpacity`).

| type | fields |
|---|---|
| `rect` | `x y w h`, `fill`, `gradient`, `radius` (number or `[tl,tr,br,bl]`), `stroke`, `strokeWidth`, `dash` |
| `ellipse` | as rect (kit: `circle(cx, cy, r, o)`) |
| `line` | `x1 y1 x2 y2`, `color`, `strokeWidth`, `dash`, `cap` |
| `text` | `text` (`\n` for lines — no wrapping), `x y` = top-left of the first line box, `font`, `size`, `weight`, `italic`, `color`, `align`, `lineHeight`, `letterSpacing`, `underline`, `strike`; optional `width` + `align: center/right` aligns the block inside `[x, x+width]` |
| `icon` | `icon` (Material Icons ligature name, e.g. `local_laundry_service`), `x y` top-left, `size`, `color`, `style` |
| `image` | `src` (file path, data URL or https), `x y w h`, `fit` (`cover` default, `contain`, `fill`), `radius`, `tint` (recolour all opaque pixels) |
| `svg` | `src` or `markup` (inline SVG string), `x y w h`, `fit` (`contain` default), `tint` |
| `page` | `page` (name of an EARLIER page), `x y w h`, `radius` — a thumbnail of that page's composite |

`gradient`: `{ "type": "linear", "angle": 135, "stops": [["#062A44", 0], ["#0A3D62", 1]] }`
— CSS convention (0° = up, 90° = right, 180° = down); `type: "radial"` too.

Text becomes an editable ByteCanvas text layer (2x raster + `text` spec);
everything else becomes a plain raster layer. Strokes are drawn *inside* the
box, so a stroked rect is exactly `w × h`.

## Kit cheatsheet (`scripts/kit.mjs`)

```js
import { homedir } from 'node:os';
const k = await import(`${homedir()}/.claude/skills/bytecanvas/scripts/kit.mjs`);

k.rect(x, y, w, h, o)   k.circle(cx, cy, r, o)   k.line(x1, y1, x2, y2, o)
k.text(t, x, y, o)      k.textMid(t, x, cy, o)   k.textIn(t, {x,y,w,h}, o)   // centred both ways
k.textBox(tools, t, x, y, w, o)  // → { layer, lines, h }: wrapped with real metrics (needs o.font; tools.fonts() first)
k.icon(name, x, y, size, color, o)   k.iconAt(name, cx, cy, size, color, o)
k.image(src, x, y, w, h, o)   k.svg(srcOrMarkup, x, y, w, h, o)   k.pageRef(page, x, y, w, h, o)
k.place(layers, { x, y, scale, prefix })     // move/scale a component drawn at (0,0)
k.approxWidth(text, size, weight)  k.lineBox(size, lh, lines)  k.alpha(hex, a)  k.flutterColor('0xFF0A3D62')
k.boxShadow({ color, opacity, blur, dx, dy })  k.contrast(hexA, hexB)
k.statusBar(w, { color, font })  k.homeIndicator(w, h, color)  k.phone(page, x, y, w, h, { label })

// guideline sheets (1600 px wide, grow to fit); theme = k.defaultTheme({ font, accent, ink, coverFrom, coverTo })
k.coverPage({ product, subtitle, version, date, theme, logo, logoW, logoH, logoBg })
k.colorsPage({ groups: [{ title, swatches: [{ name, hex, token }] }], theme, intro })
k.typographyPage({ styles: [{ name, size, weight, sample, usage }], appFont, theme })
k.spacingPage({ spacing: [{ value, usage }], radii: [{ value, usage }], theme, accent })
k.iconsPage({ icons: [{ name, label?, style? }], style, color, tile, theme })
k.flowPage({ screens: [{ page, label }], theme, name, title, intro })
const s = k.sheet(name, { title, intro, theme }); s.add(...layers); k.fit(s, bottomY)   // custom sheet
k.assetPage(name, w, h, layers, { background, scale })   // one exportable component per page
```
