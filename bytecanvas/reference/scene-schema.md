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
| `polygon` | `x y w h`, `sides` (3–64), and the shape fields below — fills its box |
| `star` | `x y w h`, `points` (3–64), `inner` (inner radius as a fraction, 0..1) |
| `path` | `d` (SVG path data — every command, arcs included) or `nodes` (ByteCanvas nodes), drawn at `scale` with its origin at `x y`; `fill` defaults to black when there is no stroke |
| `line` | `x1 y1 x2 y2`, `color`, `strokeWidth`, `dash`, `cap` |
| `group` | `name`, `layers: [...]` (nested), `opacity`, `visible`, `collapsed` — not drawn itself |
| `text` | `text` (`\n` for lines — no wrapping), `x y` = top-left of the first line box, `font`, `size`, `weight`, `italic`, `color`, `align`, `lineHeight`, `letterSpacing`, `underline`, `strike`; optional `width` + `align: center/right` aligns the block inside `[x, x+width]` |
| `icon` | `icon` (Material Icons ligature name, e.g. `local_laundry_service`), `x y` top-left, `size`, `color`, `style` |
| `image` | `src` (file path, data URL or https), `x y w h`, `fit` (`cover` default, `contain`, `fill`), `radius`, `tint` (recolour all opaque pixels) |
| `svg` | `src` or `markup` (inline SVG string), `x y w h`, `fit` (`contain` default), `tint`, `density` (pixels per page pixel, default 2 — use 1 for textures, 0.5 for soft gradients to keep files small) |
| `page` | `page` (name of an EARLIER page), `x y w h`, `radius` — a thumbnail of that page's composite |
| `diagram` | `shape` (library id), `id` (for connectors), `x y w h` (default: the shape's own size), `label` (`\n` breaks; wraps inside the shape), `fill`, `stroke`, `strokeWidth`, `labelColor`, `fontSize`, `font`, `weight`, `labelPosition` (`inside` / `below` / `above`), `labelAlign`, `lineHeight`, `lineStyle` (`solid` / `dashed` / `dotted` / `none`), `rotation` — see **Diagrams** |
| `connector` | `from`, `to` (each `'id'`, `'id.anchor'`, `{ shape, anchor }` or a loose `{ x, y }`), `style` (`orthogonal` / `straight`), `arrow` (`end` / `both` / `none`), `label`, `labelT`, `labelOffset`, `stroke`, `strokeWidth`, `lineStyle`, `corner` (`sharp` / `rounded` / `curved`), `bends: [{x,y}]`, `labelColor`, `fontSize`, `font`, `weight` |

`gradient`: `{ "type": "linear", "angle": 135, "stops": [["#062A44", 0], ["#0A3D62", 1]] }`
— CSS convention (0° = up, 90° = right, 180° = down); `type: "radial"` too.

Text becomes an editable ByteCanvas text layer (2x raster + `text` spec).
`rect`, `ellipse`, `polygon`, `star`, `line` and `path` become **vector
layers** (2x raster + `vector` spec): live shapes the app redraws sharp at any
size, whose corners, sides and points stay editable in its shape panel, and
which its SVG and editable-PDF exports write as real paths. A rect or ellipse
with a `gradient` stays a picture — a vector's fill is one colour. Icons,
images, SVGs and page thumbnails are pictures.

Strokes on rects and ellipses are drawn *inside* the box, so a stroked rect is
exactly `w × h`. Paths, polygons, stars and lines are stroked on their centre
line. Shape fields, all optional:

| field | |
|---|---|
| `fill` / `stroke` | colours; omit for none |
| `strokeWidth`, `dash` | as above |
| `strokeAlign` | `center`, `inside`, `outside` (rect/ellipse default `inside`) |
| `cap` / `join` | `butt round square` / `miter round bevel` |
| `fillRule` | `nonzero` (default) or `evenodd` — punch a hole with a second subpath |

Two more layer fields:

- `clipBelow: true` — a clipping mask: the layer shows only where the layer
  (or group) beneath it in the same group has pixels. `kit.clipped(base, layers)`
  sets it for you.
- `clip` (the crop above) on a vector layer becomes a rectangular vector mask
  rather than a cut bitmap, so the shape stays editable.

## Diagrams

`diagram` and `connector` layers are ByteCanvas's own diagram objects, not
drawings: a shape carries a `diagram` spec (its label is drawn by the app over
the shape and edited on double-click) and a connector a `connector` spec whose
ends are **attached** to shapes' anchors, so moving a box in the app re-routes
its lines. Shape geometry, anchors and routing are the app's own
(`scripts/diagram-lib.mjs`).

- **Shape ids** — flow: `process alt-process decision terminator data document
  manual-input preparation delay connector-dot`; use case: `actor use-case
  boundary`; architecture: `server database warehouse cache storage queue
  load-balancer api gateway compute memory container pod function cdn dns cloud
  monitoring vault firewall client mobile`; network: `modem router switch hub
  access-point patch-panel rack internet workstation laptop printer`; devices:
  `iphone-15 iphone-max iphone-se android-phone … ipad-pro-13`. An unknown id
  fails the build with the full list. `kit.SHAPES` has them by category.
- **Labels** wrap to the shape's width less 10px a side and centre vertically.
  Architecture, network and actor shapes put their label `below`; a
  `boundary`'s sits in its top band; an inside label in a band narrower than
  60px and 1.6x taller than wide runs up it (swimlane headers). The build
  warns when a label does not fit its shape.
- **Anchors**: `n e s w ne se sw nw` (a decision's are its own corners). An end
  without one takes the side facing the other shape — e/w when they sit more
  side by side, s/n when more above one another — except that a line never
  leaves through an outside label (actors, icons): stacked shapes like that
  join on their sides instead. `kit.node` rounds sizes to even pixels so
  centred shapes on one row have anchors on exactly one line (half a pixel off
  and the router draws a jog).
- **Routing**: `orthogonal` (default) aims for a single elbow, leaving and
  arriving along each anchor's outward direction (18px stubs when it must turn
  back); `straight` is a direct line through any `bends`. Labels sit at
  `labelT` (0..1, default 0.5) along the route, just above a horizontal run or
  right of a vertical one, unless `labelOffset` (signed px to the side) is set.
- **Ids**: a connector names a shape by its `id`, or by its label when that is
  unique on the page. Ids are per page; connectors may come before or after
  the shapes they join in the stack.
- **Defaults** (light page): shapes `#EEF2FF` fill, `#4338CA` stroke 2px,
  `#1E1B4B` label (outside labels `#1E293B`), 14px weight 500 in
  `defaults.font`; connectors orthogonal, end arrow, `#64748B` 2px, labels
  12px `#334155`. Override per layer or scene-wide with
  `defaults.diagram: { fill, stroke, strokeWidth, labelColor, outsideLabelColor, fontSize, font, weight }`
  and `defaults.connector: { …any connector field }`.
- Keep diagram pages at `scale: 1`: sizes are page pixels, and the app's
  label and stub rules are in pixels.

## Kit cheatsheet (`scripts/kit.mjs`)

```js
import { homedir } from 'node:os';
const k = await import(`${homedir()}/.claude/skills/bytecanvas/scripts/kit.mjs`);

k.rect(x, y, w, h, o)   k.circle(cx, cy, r, o)   k.line(x1, y1, x2, y2, o)
k.text(t, x, y, o)      k.textMid(t, x, cy, o)   k.textIn(t, {x,y,w,h}, o)   // centred both ways
k.textBox(tools, t, x, y, w, o)  // → { layer, lines, h }: wrapped with real metrics (needs o.font; tools.fonts() first)
k.icon(name, x, y, size, color, o)   k.iconAt(name, cx, cy, size, color, o)
k.image(src, x, y, w, h, o)   k.svg(srcOrMarkup, x, y, w, h, o)   k.pageRef(page, x, y, w, h, o)
k.polygon(x, y, w, h, sides, o)   k.star(x, y, w, h, points, inner, o)   k.path(d, x, y, { scale, fill, ... })
k.group(name, layers, o)            // a named, foldable group in the layer panel
k.clipped(base, layers)             // layers clipped to base (photo in a circle)
k.place(layers, { x, y, scale, prefix, group })  // move/scale a component drawn at (0,0); `group` wraps it
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

// diagrams
k.node(id, shapeId, label, cx, cy, { w, h, fill, stroke, labelColor, fontSize, … })   // centred, with an id
k.shape(shapeId, x, y, w, h, label, o)                                               // top-left placed
k.connect(from, to, { label, style, arrow, lineStyle, corner, bends, labelT, … })   // 'id', 'id.s', {x,y}
const lanes = k.swimlanes({ x, y, lanes: ['A', 'B'], length, size: 170, header: 44, orientation, title })
lanes.layers; lanes.lane('A') /* {x,y,w,h,cx,cy} */; lanes.at('A', along) /* {x,y} centre */
k.diagramPage(name, { width, height, title, subtitle, background, font }, layers)
k.SHAPES   // { flow: [...], architecture: [...], network: [...], usecase: [...], device: [...] }
```
