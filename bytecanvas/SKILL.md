---
name: bytecanvas
description: Create ByteCanvas (.bcanvas) files — design guidelines, style guides, brand boards, logos, UI kits, mock app screens, and diagrams (flowcharts, use case diagrams, swimlanes, architecture/network diagrams) of a codebase's logic — from code (Flutter, web, backend, etc.) or a brief, with every element a separate editable layer (shapes as live vectors, components as named groups, diagram boxes as real ByteCanvas diagram shapes joined by attached connectors) and PNG exports of each page. Use when the user asks for anything "in .bcanvas format", "using .bcanvas", "for ByteCanvas", a "guideline app" / design guideline / style guide / brand guideline / logo / UI kit / mockup for a project, a flow diagram / flowchart / use case / swimlane / activity / architecture diagram of some code or process, mock screens to export assets from, or to read/inspect/modify an existing .bcanvas file.
---

# ByteCanvas guidelines, mock apps & diagrams

ByteCanvas is a browser image editor and diagram tool, live at
https://bytecanvas.adrianuskevinkusuma.com (`validate.mjs` also runs the app's
own reader when a checkout is found via `--repo` or `BYTECANVAS_REPO`). `.bcanvas` is its project format:
pages, each holding layers, each layer a PNG plus optional metadata (text spec,
effects, diagram shape, connector). This skill produces those files from a project's real design code —
or, for diagrams, from its real logic (see **Diagrams** below).

**Deliverables of a guideline request** (adapt to the project):

1. `00 Cover` — product name, logo, version
2. `01 Colors` — every token, its hex, its code name, contrast on white
3. `02 Typography` — the type scale actually used in the code
4. `03 Spacing & Radius` — recurring paddings and corner radii
5. `04 Icons` — the icon set the app uses
6. `05 Components` — buttons (all variants/sizes/states), inputs, tiles, chips, cards, nav
7. `Screen / …` — mock screens rebuilt from the real widget code, one page each at device resolution
8. `06 Screen Flow` — the screens side by side in phone frames
9. `Asset / …` — one page per exportable component, sized to it (transparent background)

Pages are the unit of export in ByteCanvas (File › Export exports the current
page as an image; PDF can take every page), so **anything the user may want as a PNG gets its own page**.
Each page keeps its own zoom in the app and a page opened for the first time is
fitted, so pages of very different sizes (a phone screen next to an A4 sheet)
are fine side by side. The builder
also writes every page to PNG directly (`exports/`), plus optional crops
(`slices`), so assets exist without opening the app at all.

## Tools (all in `scripts/`, Node ≥ 22 + Chrome, no npm install)

| Script | Does |
|---|---|
| `build.mjs <scene.mjs\|json> [--out f.bcanvas] [--png dir]` | Rasterises every layer in headless Chrome (Canvas 2D + Google Fonts + Material Icons — the same engine ByteCanvas draws with), packs the `.bcanvas`, writes PNGs of every page and slice. |
| `validate.mjs <f.bcanvas>` | Structural checks, plus ByteCanvas's own `unpackProject`/`restoreDocument` when the repo is on disk. |
| `preview.mjs <f.bcanvas> [--page n\|name]… [--out dir]` | Opens the file in the real web app (drop, as Finder does), prints the page tabs, screenshots chosen pages. |
| `kit.mjs` | Authoring helpers: primitives, vector shapes (`polygon`, `star`, `path`), `group()` / `place(…, { group })` for components, `clipped()` for clipping masks, phone chrome, ready-made guideline sheets, and diagrams (`node`, `connect`, `swimlanes`, `diagramPage`). |
| `vector.mjs` | Shape geometry, SVG path parsing (arcs included) and stroke padding, ported from the app so its vector layers match the app's own to the pixel. |
| `diagram-lib.mjs` | The app's own diagram shape library (59 shapes), anchors and connector router, bundled from its source — generated, don't edit. |
| `sync-diagram.mjs` | Regenerates `diagram-lib.mjs` from a ByteCanvas checkout (after the app's shapes or routing change). |

`S=~/.claude/skills/bytecanvas/scripts` below.

## Workflow

### 1. Extract the design system from the code — never invent it

Read before drawing. For **Flutter**:

- **Colors**: `grep -rn "Color(0x" lib | sort | uniq -c | sort -rn | head -50`; the theme file (`ThemeData`, `ColorScheme`, an `AppColors` class, `ThemeExtension`s). Record token names — the colours page shows them next to the hex.
- **Fonts**: `pubspec.yaml` `fonts:` / `google_fonts` usage. None declared → `Roboto` (Material default).
- **Type scale**: `grep -rhn "fontSize:" lib | sed 's/.*fontSize: *//' | sort | uniq -c | sort -rn` and the weight beside each. Name each style by where it is used.
- **Spacing/radius**: `grep -rhoE "EdgeInsets[^)]*\)|circular\([0-9.]+\)" lib | sort | uniq -c | sort -rn | head -40`.
- **Icons**: `grep -rhoE "Icons\.[a-z0-9_]+" lib | sort | uniq -c | sort -rn`. Suffix `_rounded`/`_outlined`/`_sharp` → icon `style` `round`/`outlined`/`sharp`, and drop the suffix from the name. The icon font is Google's Material Icons, so Flutter names work as-is.
- **Components**: the shared widget files (`lib/ui`, `lib/widgets`, `lib/components`). Read their build methods for exact sizes, paddings, radii, shadows (`BoxShadow` → `k.boxShadow({ color, opacity, blur, dy })`), and variants (enums of colour types/sizes).
- **Screens**: routes in `main.dart` / the router; pick the 3–6 that matter most (login, home/dashboard, the core list and detail, a form). Read each page's `build` top-down and translate the widget tree to absolute dp positions: `Padding`/`SizedBox` gaps add up, `Expanded` splits the remaining width, `Row`/`Column` alignment decides centring.
- **Assets**: `pubspec.yaml` `assets:`; use real logos/images via `image`/`svg` layers (paths relative to the scene file). Check what a logo looks like before placing it (a white logo vanishes on white).
- **Content**: use the app's own strings (its language, e.g. Indonesian), plausible realistic data, the app's currency/date formats.

For other stacks the same list applies (CSS variables / Tailwind config / theme objects; component files; routes).

### 2. Write the scene as a JS module

Put it in the project: `design/bytecanvas/<name>-guideline.mjs` (the user handles git; don't commit). Start from `examples/flutter-guideline.mjs` — a complete, verified scene for a real Flutter app — and follow its structure:

- a `C` token object copied from the theme, `F` the app font, `W/H/S` the viewport (390×844 dp at 3x by default);
- **components as functions that draw at (0,0) in dp and return layers**, so one definition serves the screen, the components sheet (`place(..., { scale: 2 })`) and the asset page;
- **every placed component a named group** — `place(button(), { x, y, group: 'Button / Primary' })` — so the file opens as foldable, named components that a click on the canvas picks up whole, not a heap of loose rectangles; group a screen's regions too (`k.group('Header', [...])`);
- shapes (`rect`, `circle`, `polygon`, `star`, `line`, `path`) are **live vectors** in the app — corners, sides and stroke stay editable and resizing stays sharp — so prefer them over SVG/image layers for anything flat; a gradient fill is the exception (stays a picture);
- screens as `{ name: 'Screen / Home', width: W, height: H, scale: S, background, layers }` — with `scale`, every coordinate is in dp, so values copy straight from Dart;
- guideline sheets from the kit (`coverPage`, `colorsPage`, `typographyPage`, `spacingPage`, `iconsPage`, `flowPage`, `sheet`+`fit` for custom ones);
- **screen pages must come before any page that thumbnails them** (`flowPage`, `phone`, `pageRef`).

Schema details: `reference/scene-schema.md`. Kit API: top of `scripts/kit.mjs`.

Text layers do **not** wrap. For anything longer than a label, make the scene's default export `async (tools) => …`, `await tools.fonts([{ font, weight }])`, and set it with `k.textBox(tools, text, x, y, w, { font, size, … })` — it breaks lines with the real font metrics and returns `{ layer, lines, h }`, so the next block starts at `y + h + gap`. Short labels: `textMid`/`textIn` to centre on a row or in a box; `approxWidth` to place things after a label.

Mark decorative shapes that are meant to run off the page (glows, orbs, notches) with `bleed: true`.

A photo or pattern inside a shape is a clipping mask: `k.clipped(k.circle(cx, cy, r, { fill: '#000' }), [k.image(src, …)])` — the picture shows only where the circle is, and stays movable inside it in the app.

### 3. Build, validate, look

```bash
node $S/build.mjs design/bytecanvas/<name>-guideline.mjs        # writes .bcanvas + exports/
node $S/validate.mjs design/bytecanvas/<name>-guideline.bcanvas
```

The build prints `warning: overflow on "<page>"` for layers past the page edge and for text wider than its own `width` — treat each as a bug to fix (or a `bleed: true` to add), not noise. "N layer(s) continue past the bottom" means the page is too short for its content unless the fold is deliberate. The check only sees page edges, not a card's edges, so it does not replace looking.

Then **look at the PNGs** (downscale first: `sips -Z 1000 in.png --out /tmp/x.png`, then Read) — every screen, the components sheet, the flow. Compare against the Dart code; fix overlaps, clipped text, things bleeding outside their card (a Flutter parent clips; a layer doesn't), wrong icon names (render as text — a dead giveaway), fallback fonts (the builder warns). Iterate until it looks like the app.

Finally prove the app accepts it:

```bash
node $S/preview.mjs design/bytecanvas/<name>-guideline.bcanvas --page "Home" --out "$CLAUDE_JOB_DIR/tmp"
```

It must print `app says: Opened … — N pages, M layers`.

### 4. Report

Where the `.bcanvas` and `exports/` are, the page list, how to regenerate (`node $S/build.mjs …`), and anything noticed about the design system worth acting on (e.g. a colour pair failing contrast, inconsistent radii) — as observations, not changes to their code.

## Diagrams (flowcharts, use cases, swimlanes, architecture)

The scene format **has** diagram objects: `diagram` layers are ByteCanvas
library shapes (label inside the shape, editable on double-click) and
`connector` layers are lines **attached to a shape's anchor**, so in the app a
moved box drags its lines along and re-routes them. Never fake a diagram with
`rect` + `text` + `line`/`path` layers — that is a drawing of a diagram, and it
falls apart the moment someone moves a box. Shapes, anchors and routes come
from the app's own code (`diagram-lib.mjs`), so what the builder draws is what
the app would draw.

**Shapes** (`k.SHAPES`): flow — `process alt-process decision terminator data
document manual-input preparation delay connector-dot`; use case — `actor
use-case boundary`; architecture — `server database warehouse cache storage
queue load-balancer api gateway compute memory container pod function cdn dns
cloud monitoring vault firewall client mobile`; network — `modem router switch
hub access-point patch-panel rack internet workstation laptop printer`; plus
device frames. Architecture/network icons and actors put their name below.

### 1. Read the logic from the code — never invent it

The diagram is only worth having if it is the code's real behaviour. Find:

- **Entry points**: the route/handler/controller/screen that starts the flow (e.g. `POST /payments`, `PaymentRequestPage`).
- **States and transitions**: status enums (`PENDING → APPROVED/REJECTED → PAID`), state machines, workflow tables, migrations defining status columns. These become decisions and end states.
- **Guards and branches**: `if` thresholds (amount limits), validation, role/permission checks (`hasRole('FINANCE')`), feature flags. Quote the real threshold and role names.
- **Actors**: roles, user types, external systems the code calls (payment gateway client, email/notification service, queues, cron jobs). Actors → use case actors and swimlanes.
- **Side effects**: DB writes, events published, notifications sent — these are the steps in the system's lane.

Cite file:line for each step in your report so the user can check it.

### 2. Pick the diagram for the question

- **Flowchart** — one path through the logic with its decisions. `terminator` start/end, `process` steps, `decision` diamonds (label the outgoing lines `Yes`/`No` or the condition), `data`/`manual-input` for user input, `document` for records/reports.
- **Use case** — who can do what. `actor`s outside a `boundary` (the system; its name sits in the top band), `use-case` ellipses inside. Associations: `{ arrow: 'none', style: 'straight' }`. `«include»`/`«extend»`: `{ lineStyle: 'dashed', style: 'straight', label: '«include»' }` (arrow towards the included case; for «extend», from the extension to the base).
- **Swimlane** — the flow by who acts: `k.swimlanes({ lanes: ['Requester', 'System', 'Supervisor', 'Finance'], length, x, y })`, then place steps with `lanes.at(lane, along)`. Lines crossing lanes are ordinary connectors.
- **Architecture** — services and stores: `client api gateway server database queue cache function …` joined by connectors labelled with the protocol/call.
- **Sequence** — not a library shape: draw participants as `process` boxes, lifelines as dashed `k.line`s, and messages as `straight` connectors between loose points `{ x, y }` on the lifelines, labelled with the call.

One request for several diagram types → one `.bcanvas` with one page per diagram.

### 3. Write the scene

```js
const k = await import(`${homedir()}/.claude/skills/bytecanvas/scripts/kit.mjs`);
const page = k.diagramPage('Payment / Flowchart', { width: 1060, height: 1560, title: '…', subtitle: '…' }, [
  k.node('start', 'terminator', 'Start', 430, 170),            // id, shape, label, centre x, centre y, { w, h, fill, stroke, labelColor, fontSize }
  k.node('valid', 'decision', 'Valid?', 430, 530, { fill: '#FEF3C7', stroke: '#B45309' }),
  k.node('reject', 'process', 'Reject & notify', 860, 960, { w: 190 }),
  k.connect('start', 'valid'),                                   // anchors picked automatically: the facing sides
  k.connect('valid.e', 'reject.n', { label: 'No' }),             // or explicit: id.n|e|s|w|ne|se|sw|nw
]);
export default { output: 'payment-diagrams.bcanvas', pngDir: 'exports', defaults: { font: 'Inter' }, pages: [page] };
```

A complete, verified example of all three — `examples/payment-approval-diagrams.mjs`.

Layout rules that keep it readable:

- **Keep diagram pages at `scale: 1`** (`diagramPage` does) — label sizes, connector stubs and the < 60px swimlane-header rule are in pixels.
- **Lay out on a grid of centres**: one main column (or lane row) for the happy path; branches step sideways by a fixed amount; rows 110–150px apart, enough for a label between boxes.
- **Use explicit anchors on decisions** (`'d.s'` for Yes down, `'d.e'` for No sideways) and wherever two lines would meet the same side. Automatic anchors take the facing sides, never through an actor's or icon's name. Give shapes on one row the same centre `y` (and one column the same `x`) so the lines between them are straight.
- Orthogonal connectors aim for one elbow: from an `e`/`w` anchor to an `n`/`s` anchor gives a clean L; two `s`→`n` give a Z through the middle. If a route still crosses something, move the boxes or add `bends: [{ x, y }]`.
- Size boxes to their words (`w`), or break the label with `\n` — the builder warns when a label doesn't fit its shape.
- Connectors may come before the shapes they join in the layer list (lines under boxes); a connector's ends are looked up by shape `id` (or a unique label) on the same page.
- Colour by meaning and say so in the subtitle or a legend: one colour for steps, one for decisions, green start/end, red rejection paths.

### 4. Build, look, open in the app

Same as below (`build.mjs`, `validate.mjs` — it reports shapes/connectors and checks every attachment —, look at the PNGs, `preview.mjs`). Check: no line through a box or a label, every decision has all its exits labelled, every path reaches an end.

Tell the user how to work with it in ByteCanvas: **Diagram Mode (`S`)** — drag a box and its lines follow; double-click a box or line to retype it; drag a line's diamonds to reshape it or its ends onto another shape; **File › Export › SVG** or **PDF › Editable** writes shapes and lines as vector paths and labels as real text.

## Logos and brand guidelines

ByteCanvas now has what a brand book needs: vector shapes, a pen and point editor, boolean Combine Shapes, groups, clipping and vector masks, text to outlines and SVG export. Build for it:

- **Logos as `path` layers**, from the brand's own SVG (`k.path(d, x, y, { scale, fill })` — paste each `<path d>`, arcs and all; a multi-colour mark is one path per colour inside a `k.group('Logo / Primary', [...])`). Never re-draw a logo from a PNG, and never fake one with text unless the brand *is* a wordmark in a Google font. Read the SVG's `viewBox` to set `scale` and position.
- **One group per lockup** (primary, stacked, icon only, mono, reversed), each also on an `assetPage` sized to it with `background: null`, so it exports as a transparent PNG.
- **Brand sheets** from the kit: `colorsPage` (with the scene's `cmyk` map when the brand book has print values), `typographyPage`, plus custom `sheet`s for clear space (draw the clearance as `rect`s with `dash`), minimum size, and do's & don'ts (a `group` per example, a red `line` cross through the don'ts).
- Tell the user what to do in the app afterwards: **Layer › Convert to Outlines** (`Cmd+Shift+O`) for wordmarks that must not depend on the font, **Export › SVG** (whole page or "Selected layers only") or **PDF › Editable** to hand the vectors on, and **Combine Shapes** to merge a symbol into one path.
- The app also has brand tools that a scene should not imitate — point the user at them with the logo selected: **Brand › Construction Grid** (golden ratio, icon keylines, square grid, as an editable group for the construction page), **Brand › Mockup** (business card, app icon, T-shirt, signage pages with the logo fitted), **Brand › Export Pack…** (one ZIP: SVG, PNG 1x/2x/3x, favicon set with `.ico`, iOS `AppIcon.appiconset`, Android launcher icons, social avatars), the **Shape Builder** (`Shift+M`) for building a mark from overlapping shapes, and **Layer › Put Text on Path** for badge-style lettering round a circle.

## Printed documents (SOPs, manuals, A4)

For staff guides, scenario walk-throughs and anything meant for paper:

- Lay pages out in **points**: A4 = `width: 595.2, height: 841.92, scale: 300/72` → 2480 × 3508 px, so ByteCanvas's PDF export at 300 DPI prints at exactly A4. Margins ~36 pt, body 8.5–10 pt.
- **Exporting for print** (tell the user; File › Export › PDF): 300 DPI; **Colour: CMYK** for a print shop (images go lossless — no CMYK JPEG); **Type: Editable** when someone will touch the file afterwards in Acrobat/Illustrator — each layer becomes a named PDF layer, text layers become real text with the font embedded (Google fonts are fetched from Fontsource at export, so it needs network), diagram shapes/connectors become vectors. Kit shapes, icons and screenshots are plain pixel layers, so they stay images; layers with effects (shadows) are placed as images with invisible text over them. **Flattened** is one picture per page — exactly what you see.
- **Brand print colours**: when the project has official CMYK values (brand book, `print` tokens), put them in the scene's top-level `cmyk` map keyed by the hex the layers use (`reference/scene-schema.md`). They land in the `.bcanvas`, show in ByteCanvas's colour picker, and a CMYK PDF prints them exactly instead of by formula. Never invent CMYK values — omit the map if the code/brand book has none.
- Make the scene a function and set paragraphs with `tools.wrap` (exact widths); stack blocks by the returned line counts. Print a warning when a page's content passes the footer.
- **Use real screenshots of the app, never redrawn screens** — staff compare the paper to the phone in their hand, and a reconstruction drifts from production. For Flutter, capture with `flutter test` (no device, no backend):
  - a fake `HttpOverrides` answers every API call from fixture JSON in the exact shape the models parse — **never point the app at production or create real data**; writes are answered locally;
  - one fake for the whole run (a static `http.Client` keeps the first override's HttpClient), seeded `SharedPreferences` (an unexpiring fake JWT, selected shop), real Roboto + MaterialIcons from `$FLUTTER_ROOT/bin/cache/artifacts/material_fonts`, `WidgetsApp.debugAllowBannerOverride = false`, a 390×844 @3x view with safe-area padding, and a drawn status bar;
  - drive the real UI (tap, `enterText`, dropdowns); tap only hit-testable matches (collapsed panels keep hidden copies) and scroll targets to the middle first (the bottom bar eats taps);
  - for each shot write `<name>.png` (RepaintBoundary → `toImage(pixelRatio: 3)`) and `<name>.json` with the dp boxes of the controls to call out (`tester.getRect`), and clear snackbars first;
  - native views (Google Maps) cannot render under test: stub `flutter/platform_views` + the plugin's method channel, filter only its errors, and label the empty area in the document.
- On the page, each phone is the PNG as an `image` layer (`radius` for the screen corners) under an SVG bezel ring, with orange numbered callouts drawn from the JSON boxes; warn when a box is off the visible screen. Numbered steps match the callouts.
- Lay each scenario out as frames (screenshot + caption + steps), three per page, as many pages as it needs; compute cross-references such as "pages 6–8" after layout.
- Keep content as data (scenario → frames → steps / cautions / results) so the user can reword and rebuild.
- Write in the language the staff use (the app's language).

When driving the real UI turns up an actual app bug (it happens), report it to the user; do not paper over it in the document.

## Editing an existing .bcanvas

Read the manifest without touching images:

```bash
node -e 'const b=require("fs").readFileSync(process.argv[1]);const n=b.readUInt32LE(12);const m=JSON.parse(b.subarray(16,16+n));for(const p of m.pages)console.log(p.name,p.width+"x"+p.height,p.layers.length+" layers")' file.bcanvas
```

Small metadata edits (rename pages/layers, reorder, move, hide, change opacity) can be done by rewriting the manifest and re-packing with the same image bytes — see `reference/format.md`. Keep the optional top-level `cmyk` map when re-packing; dropping it loses the user's typed print colours.

Moving or copying layers between pages is also a manifest edit: give each copy a new unique `id`, and re-point any `connector.from/to.layerId` at the copies (or set it to `null` with `anchor: null` when the shape it joined was not copied) — the same rule the app's own paste follows. Grouped layers take their groups along: copy each `groups` entry they name (and its parents) with a new id, re-point `groupId`/`parentId`, and keep a group's layers together in the stack. Anything that changes pixels (text content, colours) is easier to regenerate from the scene.

## Gotchas

- Fonts and icons come from Google Fonts at build time — needs network. A family not on Google Fonts renders in a fallback (warned).
- Diagram shape labels are drawn by the app over the shape from the spec (not stored in pixels), so use a Google font for them (`defaults.font`) — the app fetches it; a local-only font falls back in the app.
- Every `.bcanvas` layer has pixels; text and vector layers also carry their spec. Text is editable on double-click and becomes real text in the editable PDF; shapes and paths are live vectors (resize redraws them, the SVG and editable-PDF exports write them as paths). Icons, images, SVG layers, page thumbnails and gradient-filled shapes are plain pixels (resize = resample).
- A `clip` (crop) on a vector layer becomes a rectangular vector mask, not a cut bitmap; on any other layer it crops the bitmap as before.
- Shadows are stored as ByteCanvas drop-shadow **effects** (editable), not baked in.
- Big documents are fine (a 27-page guideline is ~9 MB / ~800 layers, ~5 s to build). Photos keep their own resolution up to 4x the box.
- Only one ByteCanvas e2e run at a time in the repo — `preview.mjs` uses the public URL and its own Chrome, so it doesn't collide.
