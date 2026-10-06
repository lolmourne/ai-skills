# bytecanvas

A [Claude Code](https://claude.com/claude-code) skill that turns an app's real design code (Flutter, web, …) into
[ByteCanvas](https://bytecanvas.adrianuskevinkusuma.com) `.bcanvas` files: design guidelines, style guides,
UI kits and mock screens. Every element is a separate, editable layer, and each page is also exported as a PNG.

Ask Claude for "a design guideline for this app in .bcanvas format" and it will read the theme, type scale,
spacing, icons, components and screens out of the code, lay them out as a scene, build the file and check
the result by looking at the exports.

## Install

```bash
git clone https://github.com/<you>/ai-skills ~/ai-skills
ln -s ~/ai-skills/bytecanvas ~/.claude/skills/bytecanvas
```

The link must be named `bytecanvas`, since the scripts and docs import from `~/.claude/skills/bytecanvas/scripts`.

Requirements: Node ≥ 22 and Google Chrome (or pass `--chrome <path>` / set `CHROME`). There are no npm dependencies.
Fonts and icons are loaded from Google Fonts at build time, so building needs network access.

## What's inside

| Path | |
|---|---|
| `SKILL.md` | The workflow Claude follows: extract tokens from the code, write a scene, build, validate, look. |
| `scripts/build.mjs` | Rasterises a scene (`.mjs` or JSON) in headless Chrome and packs the `.bcanvas`, plus PNGs of every page. Warns when layers run off a page or text overflows its box. |
| `scripts/kit.mjs` | Authoring helpers: primitives, `place()` for reusable components, `textBox()` for wrapped paragraphs, phone chrome, ready-made guideline sheets. |
| `scripts/validate.mjs` | Structural checks on a `.bcanvas`; also runs ByteCanvas's own reader when a checkout is found (`--repo` or `BYTECANVAS_REPO`). |
| `scripts/preview.mjs` | Opens a file in the live web app and screenshots chosen pages (`--url` / `BYTECANVAS_URL` to point elsewhere). |
| `reference/` | The `.bcanvas` file format and the scene schema. |
| `examples/flutter-guideline.mjs` | A complete guideline for a Flutter POS app: tokens, components, screens, flow and asset pages. |

## Use without Claude

```bash
S=~/.claude/skills/bytecanvas/scripts
node $S/build.mjs examples/flutter-guideline.mjs --out /tmp/example.bcanvas --png /tmp/example
node $S/validate.mjs /tmp/example.bcanvas
```

Open the `.bcanvas` in ByteCanvas by dropping it on the page.
