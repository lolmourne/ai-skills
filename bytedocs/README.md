# bytedocs

A [Claude Code](https://claude.com/claude-code) skill that writes, reads and changes
[ByteDocs](https://bytecanvas.adrianuskevinkusuma.com/doc) `.bdoc` documents: PRDs, specs and reports with real
headings, lists, tables, timelines (Gantt charts), style presets and page setup, with ByteCanvas drawings
embedded as figures you can double-click to edit, and `.docx` export.

Ask Claude for "a PRD for guest checkout in .bdoc, with a flow diagram" and it reads the code, writes the document,
draws the flow with the [`bytecanvas`](../bytecanvas/) skill, places it, builds the file and checks it in the real app.

## Install

```bash
git clone https://github.com/lolmourne/ai-skills.git ~/ai-skills   # or your fork
mkdir -p ~/.claude/skills
ln -s ~/ai-skills/bytedocs ~/.claude/skills/bytedocs
ln -s ~/ai-skills/bytecanvas ~/.claude/skills/bytecanvas           # for drawings
```

The folder must be called `bytedocs`. Requirements: **Node.js ≥ 22**; **Chrome or Chromium** for `preview.mjs` only.
There is no `npm install`. Check the install from the `examples` folder (the drawing needs `bytecanvas`):

```bash
cd ~/.claude/skills/bytedocs/examples
node ../../bytecanvas/scripts/build.mjs checkout-flow.mjs --png exports
node ../scripts/build.mjs checkout-prd.md --out /tmp/prd.bdoc --docx /tmp/prd.docx
node ../scripts/validate.mjs /tmp/prd.bdoc
```

## What is in here

| | |
|---|---|
| `SKILL.md` | What Claude follows. |
| `scripts/` | `build`, `validate`, `read`, `preview`, and `doc-lib.mjs`. |
| `reference/format.md` | The `.bdoc` file, every block and style field. |
| `examples/` | A PRD and the drawing in it. |

## Keeping up with the app

`scripts/doc-lib.mjs` is generated from the app's `src/lib/doc/`, so its output is the app's own. After the app's
document code changes:

```bash
node ~/.claude/skills/bytedocs/scripts/sync-doc.mjs --repo /path/to/bytecanvas
```
