# The `.bcanvas` file format (version 1)

Source of truth: `~/Documents/projects/js/bytecanvas/src/lib/project/format.ts`
(layout, validation) and `io.ts` (PNG encode/decode). This is a summary.

## Container

```
offset  size  contents
0       8     magic: ASCII "BYTECNVS"
8       4     format version, uint32 LE (= 1)
12      4     manifest length N, uint32 LE
16      N     manifest, UTF-8 JSON
16+N    …     image section: PNG files back to back
```

No ZIP, no base64. Images are deduplicated by bitmap identity — several layers
may point at the same image index.

## Manifest

```jsonc
{
  "app": "ByteCanvas",            // required, exact
  "version": 1,
  "savedAt": "2026-10-02T06:00:00.000Z",
  "activeIndex": 0,               // page shown on open
  "pages": [ManifestPage, ...],   // at least one
  "images": [{ "offset": 0, "length": 1234, "type": "image/png", "width": 300, "height": 120 }],
  //            ^ into the image section (not the file)
  "cmyk": { "#cccccc": { "c": 20, "m": 20, "y": 20, "k": 0 } }   // optional, see below
}
```

`cmyk` (optional, added without a version bump — older files and older
readers are unaffected) records CMYK values typed in the colour picker, keyed
by lower-case `#rrggbb` (alpha dropped), each ink 0..100. The colours on
layers stay hex; this only says how a colour should *print*. The picker shows
these values for that colour and a CMYK PDF export writes them exactly; any
colour not listed is separated by formula (K = 1 − max(R,G,B), full black
generation, no ICC profile). Absent when empty. On open, malformed entries are
dropped and inks clamped to 0..100.

Not in the file, on purpose: zoom and pan. Each page remembers its own view
while the app is open (a page never visited is fitted to the screen), but that
is how a page is being looked at, not part of it.

### Page

```jsonc
{
  "id": "page_1_ab12cd",          // any unique string
  "name": "Screen / Home",
  "width": 1170, "height": 2532,  // document pixels, >= 1
  "guides": { "v": [], "h": [] }, // ruler guides, document px
  "background": "#F7F8FA" | null, // page colour; null = transparent
  "selectedLayerId": null,
  "selectedLayerIds": [],
  "layers": [ManifestLayer, ...], // index 0 = BOTTOM of the stack
  "groups": [LayerGroup, ...]     // optional; absent when the page has none
}
```

### Layer

```jsonc
{
  "id": "layer_7_x9y8z7",         // unique in the file; connectors refer to these
  "name": "icon/home",
  "visible": true, "locked": false,
  "opacity": 1,                   // 0..1
  "blendMode": "normal",          // normal|multiply|screen|overlay|darken|lighten
  "transform": {
    "x": 48, "y": 120,            // document position of the layer's unrotated top-left
    "scaleX": 0.5, "scaleY": 0.5, // drawn size = width*scaleX × height*scaleY
    "rotation": 0                 // radians, clockwise, about the layer centre
  },
  "width": 288, "height": 96,     // the image's pixel size (must match images[i])
  "image": 3,                     // index into images
  // optional:
  "text": TextSpec,               // makes it an editable text layer
  "renamed": true,                // text layer whose name was set by hand
  "effects": { "dropShadow": {...}, "colorOverlay": {...}, "gradientOverlay": {...}, "stroke": {...} },
  "diagram": DiagramSpec,         // diagram-mode shape
  "connector": ConnectorSpec,     // diagram-mode line
  "vector": VectorSpec,           // a vector layer: shape or paths, fill and stroke
  "groupId": "group_1_ab12cd",    // the group it sits in
  "clip": true,                   // clipped to the layer below (a clipping mask)
  "mask": VectorMask              // shown only inside these paths
}
```

**Pixels are the source of truth on open** — for the screen, image export and
the flattened PDF. `text`/`diagram`/`vector` specs are used to re-render when
the user edits the layer, **and by the editable PDF and SVG exports**, which
write text layers as real text and diagram shapes, connectors and vectors as
paths, all from their specs rather than their pixels. A spec that disagrees with its pixels shows up
there, so keep them consistent (`build.mjs` does).

### Vector layers

```jsonc
"vector": {
  "width": 120, "height": 80,               // geometry box, document px, origin at its top-left
  "paths": [],                              // used when there is no `shape`
  "shape": { "kind": "rect", "radii": [20, 0, 20, 0] },   // or ellipse | polygon {sides} | star {points, inner}
  "fill": "#F5A623",  "stroke": "#1A1A1A",  // null for none
  "strokeWidth": 4, "strokeAlign": "inside",// center | inside | outside
  "lineCap": "butt", "lineJoin": "miter", "miterLimit": 4,
  "dash": [], "fillRule": "nonzero"
}
// a path: { "closed": true, "nodes": [{ "x": 0, "y": 0, "out": {x,y} }, { "x": 10, "y": 0, "in": {x,y}, "mode": "smooth" }] }
// handles are absolute points; a segment with no handle at either end is straight
```

The bitmap covers the geometry box plus the stroke's reach on every side —
`pad = 0` for no stroke or an inside one; otherwise `ceil(reach * 100) / 100 + 0.5`,
where reach is half the width (centre) or the width (outside), times √2 for
square caps, or the sharpest mitre ratio the path has for mitred joins
(corners past `miterLimit` are bevelled and do not count). It is drawn at 2x,
and `scaleX/Y = (box + 2·pad) / bitmap`, so `transform.x/y` is the geometry's
top-left minus `pad`. `scripts/vector.mjs` and `build.mjs` reproduce this
exactly; a spec whose padding disagrees makes the shape jump on its first edit.
On open every node is checked and one with a non-numeric coordinate dropped.

### Groups, clipping and masks

```jsonc
"groups": [{ "id": "group_1_ab12cd", "name": "Button / Primary", "parentId": null,
             "visible": true, "opacity": 1, "collapsed": false }]
```

A group is metadata beside the flat stack: its layers name it in `groupId`,
a subgroup names its parent. A group's layers must **sit together** in the
stack (subgroups together inside it); a file that splits one is regrouped on
open, which reorders the stack, and an empty group is dropped. A hidden group
hides its layers; its opacity fades it as one picture.

`clip: true` clips a layer to the nearest unclipped layer — or group — below
it in the same group. `mask` is a vector mask in the layer's **local pixel**
space (`0..width × 0..height` of its bitmap):

```jsonc
"mask": { "fillRule": "nonzero", "paths": [{ "closed": true, "nodes": [...] }] }
```

### Text layers

```jsonc
"text": {
  "content": "Masuk Akun", "fontFamily": "Roboto", "fontSize": 20, "fontWeight": 700,
  "italic": false, "align": "left", "lineHeight": 1.25, "color": "#1A1A1A",
  "runs": [{ "text": "Masuk Akun", "style": {} }]   // per-character overrides
}
```

ByteCanvas rasterises text at **2x** and sets the layer scale to **0.5**. The
bitmap is the text block plus a padding `pad = ceil(maxFontSize * 0.12)`
(+ `ceil(size * 0.2)` if italic) on every side, so the layer's `transform.x/y`
is the visible text's top-left minus `pad`. Each line box is
`fontSize * lineHeight` tall; the baseline sits at
`top + (lineBox - (ascent + descent)) / 2 + ascent` using the font's
`fontBoundingBox` metrics. `build.mjs` reproduces this exactly, so editing a
generated text layer in the app does not make it jump. Text never wraps; lines
come from `\n`.

### Effects

Sizes in document pixels, applied at draw time (non-destructive). Any effect
left out is filled with its disabled default on open, so writing only
`dropShadow` is valid:

```jsonc
"effects": { "dropShadow": { "enabled": true, "color": "#000000", "opacity": 0.25,
                             "blur": 24, "distance": 9, "angle": 90 } }  // degrees clockwise from east
```

## Validation on open (what gets a file rejected)

Bad magic; manifest not `app: "ByteCanvas"`; no pages; a page without size or
layers; a layer without transform / numeric x,y,scale; a layer whose `image`
index is missing; any image extending past the end of the file ("truncated").
Softer problems are repaired: unknown blend mode → normal, selection naming a
missing layer → dropped.

## Re-packing after a manifest edit

```js
import { readFileSync, writeFileSync } from 'node:fs';
const b = readFileSync('in.bcanvas');
const n = b.readUInt32LE(12);
const m = JSON.parse(b.subarray(16, 16 + n));
const images = b.subarray(16 + n);
// … edit m.pages (names, order, transforms, visibility) — keep image indices …
const json = Buffer.from(JSON.stringify(m));
const head = Buffer.alloc(16); head.write('BYTECNVS', 0, 'ascii'); head.writeUInt32LE(1, 8); head.writeUInt32LE(json.length, 12);
writeFileSync('out.bcanvas', Buffer.concat([head, json, images]));
```
