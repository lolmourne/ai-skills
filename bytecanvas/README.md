# bytecanvas

A [Claude Code](https://claude.com/claude-code) skill that turns an app's real design code (Flutter, web, …) into
[ByteCanvas](https://bytecanvas.adrianuskevinkusuma.com) `.bcanvas` files: design guidelines, style guides,
UI kits, brand guidelines, logos, mock screens — and diagrams of a codebase's logic (flowcharts, use case diagrams,
swimlanes, architecture). Every element is a separate, editable layer — shapes and logo paths as live vectors,
components as named groups, photos clipped to their shapes, diagram boxes as ByteCanvas diagram shapes joined by
connectors attached to them — and each page is also exported as a PNG.

Ask Claude for "a design guideline for this app in .bcanvas format" and it will read the theme, type scale,
spacing, icons, components and screens out of the code, lay them out as a scene, build the file and check
the result by looking at the exports. Ask for "a flow diagram, use case diagram and swimlane of the payment approval
flow using .bcanvas" and it reads the states, guards and roles out of the code and draws them with real diagram
shapes and connectors.

## Install

The skill is one folder. Claude Code picks up any skill folder in `~/.claude/skills/`, so installing it means
putting this folder there under the name **`bytecanvas`**. The scripts, the examples and the scenes Claude writes
all import from `~/.claude/skills/bytecanvas/scripts/…`, so the name and location are fixed.

### Requirements

| | |
|---|---|
| **Claude Code** | The CLI, desktop app or IDE extension. See the [docs](https://docs.claude.com/en/docs/claude-code). |
| **Node.js ≥ 22** | Check with `node --version`. Node 22 adds the built-in `WebSocket` the scripts use to drive Chrome. |
| **Chrome or Chromium** | Found automatically at the usual macOS/Linux paths (Google Chrome, Chromium, Microsoft Edge). Anywhere else: `export CHROME=/path/to/chrome`. |
| **Network access** | Fonts and Material Icons come from Google Fonts at build time, and `preview.mjs` opens the hosted ByteCanvas app. |
| **OS** | macOS or Linux. On Windows, install Node, Chrome and the skill inside **WSL**. The scripts build file paths in a way native Windows Node doesn't accept. |

There is no `npm install`: the scripts use only Node's standard library.

### Option A — clone and link (recommended; `git pull` updates it)

```bash
git clone https://github.com/lolmourne/ai-skills.git ~/ai-skills   # or your fork
mkdir -p ~/.claude/skills
ln -s ~/ai-skills/bytecanvas ~/.claude/skills/bytecanvas
```

### Option B — copy (no git, no link)

```bash
mkdir -p ~/.claude/skills
cp -R /path/to/ai-skills/bytecanvas ~/.claude/skills/bytecanvas
```

To update later, replace the folder with a newer copy.

### Option C — already have a `bytecanvas` folder there?

Check what it is before replacing it:

```bash
ls -la ~/.claude/skills/ | grep bytecanvas      # "->" means it is a link
```

Move an old copy aside (`mv ~/.claude/skills/bytecanvas ~/.claude/skills/bytecanvas.old`), then install with A or B.

> Per-project install (`<project>/.claude/skills/bytecanvas`) is **not** supported: the import paths point at
> `~/.claude/skills/bytecanvas`. Install it once per machine; it works in every project.

### Check the install

```bash
S=~/.claude/skills/bytecanvas/scripts
node --version                                   # v22 or newer
node $S/build.mjs ~/.claude/skills/bytecanvas/examples/payment-approval-diagrams.mjs \
  --out /tmp/bcanvas-check/check.bcanvas --png /tmp/bcanvas-check/exports
node $S/validate.mjs /tmp/bcanvas-check/check.bcanvas    # ends with "valid"
open /tmp/bcanvas-check/exports                          # macOS; xdg-open on Linux
```

Expect `wrote …check.bcanvas — 3 pages` and three PNGs: a flowchart, a use case diagram and a swimlane. Pass
`--out`/`--png` as shown, or the build writes into the skill folder itself.

Then start a **new** Claude Code session (skills are read when a session starts) and ask for something:

> draw flow diagram, use case diagram, swimlane diagram of the payment approval flow using .bcanvas

To open a result, drop the `.bcanvas` file onto [ByteCanvas](https://bytecanvas.adrianuskevinkusuma.com).

### Optional: a ByteCanvas checkout

Two features use the app's source code when it is on disk. They look in `~/Documents/projects/js/bytecanvas`, or
wherever `BYTECANVAS_REPO` points:

- `validate.mjs` also runs the file through the app's own reader (otherwise it prints "skipped the app-reader check"
  and does the structural checks only).
- `sync-diagram.mjs` regenerates `scripts/diagram-lib.mjs` after the app's diagram shapes change. This needs
  `npm install` in the checkout for its esbuild. Without a checkout, the bundled `diagram-lib.mjs` is used as it is.

```bash
export BYTECANVAS_REPO=~/code/bytecanvas         # add to ~/.zshrc or ~/.bashrc
```

Other overrides: `CHROME` (browser binary), `BYTECANVAS_URL` (the app `preview.mjs` opens; defaults to the public one).

### Update / uninstall

```bash
git -C ~/ai-skills pull                          # option A
rm ~/.claude/skills/bytecanvas                   # uninstall a link (leaves ~/ai-skills alone)
rm -rf ~/.claude/skills/bytecanvas               # uninstall a copy
```

### Troubleshooting

| Symptom | Fix |
|---|---|
| Claude doesn't use the skill | Start a new session; check the folder is named exactly `bytecanvas` and contains `SKILL.md`; if it is a link, check it resolves (`ls ~/.claude/skills/bytecanvas/`). |
| `Chrome not found` | Install Chrome/Chromium, or `export CHROME=/path/to/binary`. |
| `WebSocket is not defined` / syntax errors | Node is older than 22, so upgrade it (`nvm install 22`). |
| `Cannot find module …/.claude/skills/bytecanvas/scripts/kit.mjs` | The skill isn't at that exact path (wrong folder name, or a per-project install). |
| `warning: fonts not loaded` | No network, or the font isn't on Google Fonts. Text falls back to another face. |

## What's inside

| Path | |
|---|---|
| `SKILL.md` | The workflow Claude follows: extract tokens from the code, write a scene, build, validate, look. |
| `scripts/build.mjs` | Rasterises a scene (`.mjs` or JSON) in headless Chrome and packs the `.bcanvas`, plus PNGs of every page. Warns when layers run off a page or text overflows its box. |
| `scripts/kit.mjs` | Authoring helpers: primitives, vector shapes (`polygon`, `star`, `path` from SVG path data), `group()` and `place(…, { group })` for components, `clipped()` for clipping masks, `textBox()` for wrapped paragraphs, phone chrome, ready-made guideline sheets, and diagrams (`node()`, `connect()`, `swimlanes()`, `diagramPage()`). |
| `scripts/diagram-lib.mjs` | The app's diagram shape library, anchors and connector router, bundled from its source by `scripts/sync-diagram.mjs` (generated; re-run that script when the app's shapes change). |
| `scripts/vector.mjs` | Shape geometry, an SVG path parser (arcs included) and stroke padding, matching the app's own vector layers to the pixel. |
| `scripts/validate.mjs` | Structural checks on a `.bcanvas` — images, layers, vector specs, groups kept together; also runs ByteCanvas's own reader when a checkout is found (`--repo` or `BYTECANVAS_REPO`). |
| `scripts/preview.mjs` | Opens a file in the live web app and screenshots chosen pages (`--url` / `BYTECANVAS_URL` to point elsewhere). |
| `reference/` | The `.bcanvas` file format and the scene schema. |
| `examples/flutter-guideline.mjs` | A complete guideline for a Flutter POS app: tokens, components, screens, flow and asset pages. |
| `examples/payment-approval-diagrams.mjs` | A payment approval flow as a flowchart, a use case diagram and a swimlane. |

## Use without Claude

```bash
S=~/.claude/skills/bytecanvas/scripts
node $S/build.mjs examples/flutter-guideline.mjs --out /tmp/example.bcanvas --png /tmp/example
node $S/validate.mjs /tmp/example.bcanvas
```

Open the `.bcanvas` in ByteCanvas by dropping it on the page.
