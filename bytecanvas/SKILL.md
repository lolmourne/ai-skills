---
name: bytecanvas
description: Create ByteCanvas (.bcanvas) files — design guidelines, style guides, UI kits and mock app screens — from a codebase (Flutter, web, etc.), with every element as a separate editable layer and PNG exports of each screen and asset. Use when the user asks for anything "in .bcanvas format", "for ByteCanvas", a "guideline app" / design guideline / style guide / UI kit / mockup for a project, mock screens to export assets from, or to read/inspect/modify an existing .bcanvas file.
---

# ByteCanvas guidelines & mock apps

ByteCanvas is a browser image editor and diagram tool, live at
https://bytecanvas.adrianuskevinkusuma.com (`validate.mjs` also runs the app's
own reader when a checkout is found via `--repo` or `BYTECANVAS_REPO`). `.bcanvas` is its project format:
pages, each holding layers, each layer a PNG plus optional metadata (text spec,
effects). This skill produces those files from a project's real design code.

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
| `kit.mjs` | Authoring helpers: primitives, `place()` for reusable components, phone chrome, and ready-made guideline sheets. |

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
- screens as `{ name: 'Screen / Home', width: W, height: H, scale: S, background, layers }` — with `scale`, every coordinate is in dp, so values copy straight from Dart;
- guideline sheets from the kit (`coverPage`, `colorsPage`, `typographyPage`, `spacingPage`, `iconsPage`, `flowPage`, `sheet`+`fit` for custom ones);
- **screen pages must come before any page that thumbnails them** (`flowPage`, `phone`, `pageRef`).

Schema details: `reference/scene-schema.md`. Kit API: top of `scripts/kit.mjs`.

Text layers do **not** wrap. For anything longer than a label, make the scene's default export `async (tools) => …`, `await tools.fonts([{ font, weight }])`, and set it with `k.textBox(tools, text, x, y, w, { font, size, … })` — it breaks lines with the real font metrics and returns `{ layer, lines, h }`, so the next block starts at `y + h + gap`. Short labels: `textMid`/`textIn` to centre on a row or in a box; `approxWidth` to place things after a label.

Mark decorative shapes that are meant to run off the page (glows, orbs, notches) with `bleed: true`.

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

Moving or copying layers between pages is also a manifest edit: give each copy a new unique `id`, and re-point any `connector.from/to.layerId` at the copies (or set it to `null` with `anchor: null` when the shape it joined was not copied) — the same rule the app's own paste follows. Anything that changes pixels (text content, colours) is easier to regenerate from the scene.

## Gotchas

- Fonts and icons come from Google Fonts at build time — needs network. A family not on Google Fonts renders in a fallback (warned).
- `.bcanvas` layers are raster. Text layers also carry a `text` spec, so double-clicking one in ByteCanvas edits it — and so the editable PDF export writes it as real text; shapes are plain pixels (resize = resample) and stay images in any PDF.
- Shadows are stored as ByteCanvas drop-shadow **effects** (editable), not baked in.
- Big documents are fine (a 27-page guideline is ~9 MB / ~800 layers, ~5 s to build). Photos keep their own resolution up to 4x the box.
- Only one ByteCanvas e2e run at a time in the repo — `preview.mjs` uses the public URL and its own Chrome, so it doesn't collide.
