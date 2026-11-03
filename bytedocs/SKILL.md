---
name: bytedocs
description: Create, read and change ByteDocs (.bdoc) documents — PRDs, specs, RFCs, design docs, reports and proposals — with real headings, lists, tables, style presets and page setup, and ByteCanvas drawings embedded as editable figures, plus .docx export. Use when the user asks for anything "in .bdoc format", "for ByteDocs" or "in ByteDocs", a PRD or spec with embedded diagrams, to turn Markdown into a .bdoc, to export a .bdoc to Word (.docx), or to read/inspect/modify an existing .bdoc file. For the drawings themselves, use the bytecanvas skill and place the result here.
---

# ByteDocs documents

ByteDocs is the document editor beside ByteCanvas: the same site, at `/doc`.
`.bdoc` is its file: a ZIP of `document.json` (title, page setup, paragraph
styles, blocks), and per figure a PNG and, for a drawing, the `.bcanvas` project
behind it. See `reference/format.md`.

The scripts write what the app writes: `scripts/doc-lib.mjs` is the app's own
document code, bundled from its source, not a port.

## Tools (all in `scripts/`, Node ≥ 22, no npm install; only `preview.mjs` needs Chrome)

| Script | Does |
|---|---|
| `build.mjs <doc.md\|doc.mjs> [--out f.bdoc] [--docx f.docx]` | Builds a `.bdoc`, and a Word file if asked. |
| `validate.mjs <f.bdoc>` | Opens it with the app's reader, tries the Word export, checks figures, prints the outline, warns about writing problems. |
| `read.mjs <f.bdoc> [--out doc.md] [--media dir] [--docx f.docx]` | Markdown of a document; `--media` saves pictures and writes figure lines `build.mjs` reads back. |
| `preview.mjs <f.bdoc> [--url …/doc] [--out dir] [--shots n]` | Opens it in the real app, prints what the app says, screenshots it. |
| `sync-doc.mjs [--repo path]` | Regenerates `doc-lib.mjs` from a ByteCanvas checkout after the app's document code changes. |

`D=~/.claude/skills/bytedocs/scripts`, `S=~/.claude/skills/bytecanvas/scripts` below.

## Writing a document

### 1. Write from the real source, not from imagination

A PRD or spec about a codebase reads the code first: real states, limits, roles
and copy. Mark what is unknown as an open question rather than inventing it.
Use the language the user or project works in.

### 2. Write it as Markdown

Put it in the project, for example `docs/<name>.md`; the user handles git, so
don't commit.

```markdown
---
title: Checkout v2
preset: modern
paper: a4
margins: 1
---

# Goals

Text with **bold**, *italic*, `code` and [links](https://example.com).

- A list
  - nested with two spaces
- [ ] a to-do
- [x] a done one

1. Numbered

| Metric | Target |
| --- | --- |
| p95 | 300ms |

> A quote

---
```

Everything is optional except some content. **Headings:** with a `title:`, `# `
is Heading 1. With no `title:`, a document opening with its only `# ` takes it
as the title and moves the other headings up a level. Only three levels exist:
`####` and deeper become Heading 3. Start at `# `: `## ` first is a skipped level,
and `validate.mjs` says so. A table's first row is its header.

| Front matter | Values |
|---|---|
| `preset` | `default`, `modern`, `classic`, `editorial`, `technical`, `minimal`, `corporate`, `friendly`, `compact`, `report` |
| `format` | `pages`, `pageless` |
| `paper` | `a4`, `letter`, `legal`, `a5` |
| `orientation` | `portrait`, `landscape` |
| `margins` | inches: `1`, or `top bottom left right` |
| `width` | pageless text width: `narrow`, `medium`, `wide`, `full` |
| `header`, `footer` | text on every page; lines split on a literal `\n`, `**bold**`, `{page}` and `{pages}` for page numbers |
| `header-align`, `footer-align` | `left`, `center` (default), `right` |
| `header-rule`, `footer-rule` | `true` for a line under the header / over the footer |

Pick the preset for the reader: `default` or `modern` for a working PRD,
`technical` for an engineering spec, `corporate` for something going to a
client, `classic`, `editorial` or `report` for long reads, `compact` when pages
are tight. Use `pageless` for a doc only read on screen, with wide tables or
drawings; `pages` when it will be printed or sent as Word.

### 3. Add drawings

Diagrams belong in the document as editable drawings, not as pasted pictures.
Draw with the **bytecanvas** skill, then name both files on a line of their own:

```bash
node $S/build.mjs checkout-flow.mjs --png exports
```

```markdown
![Checkout flow](exports/checkout-flow.png "width=Full project=checkout-flow.bcanvas")
```

The caption is the alt text. `width` is `S`, `M`, `L`, `Full` or a percentage of
the column; left out, the picture keeps its pixel size up to the column. `scale=2`
says the PNG has two pixels per display pixel. `project=` is what makes a
double-click in the app open real shapes; without it the figure opens as pixels,
and `validate.mjs` warns.

Each diagram needs its own page in the scene, cropped to the drawing: a tall page
with a small diagram in it arrives with blank bands. **Draw at the size it will
be read.** A figure is scaled to the text column, which is 602px on A4 with inch
margins, so 14px labels on a 1120px page arrive at about 7.5px and cannot be
read. Draw a full-width figure 650–800px wide, or raise the label size to match.
Text in a drawing should match the document's language.

For a split layout, a tall or complex diagram, or a document only read on a
screen, prefer `format: pageless` over shrinking the drawing.

### 4. Build, validate, look

```bash
node $D/build.mjs docs/checkout.md --out docs/checkout.bdoc --docx docs/checkout.docx
node $D/validate.mjs docs/checkout.bdoc
node $D/preview.mjs docs/checkout.bdoc --out docs/preview
```

**Look at the screenshots before reporting.** A document can validate and still
have a wrong-sized figure or a table too wide for its page. If `preview.mjs`
says ByteDocs did not load, it is not deployed at the hosted URL yet: run the
app (`npm run dev` in the checkout) and pass `--url http://localhost:5173/doc`.

## Reading a document

```bash
node $D/validate.mjs f.bdoc                  # what is in it, and its outline
node $D/read.mjs f.bdoc                      # the words, as Markdown
node $D/read.mjs f.bdoc --docx f.docx        # to Word, with no other change
```

Word export is one-way: there is no reading `.docx` here, and the `.bcanvas`
behind a figure does not travel in the Word file. The `.bdoc` stays the source.

## Changing a document

**Words and structure only**, in a document with no manual formatting to keep:

```bash
node $D/read.mjs f.bdoc --out doc.md --media media
# edit doc.md
node $D/build.mjs doc.md --out f.bdoc
```

Markdown has no place for colours, fonts or sizes set by hand, an edited style
set, or a paragraph's own alignment and spacing, and these are lost that way.
**When any of that must survive**, change the blocks:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
const { unpackDoc, packDoc, markdownToBlocks } = await import(`${homedir()}/.claude/skills/bytedocs/scripts/doc-lib.mjs`);

const doc = unpackDoc(readFileSync('f.bdoc'));
const at = doc.blocks.findIndex((b) => b.type === 'h1' && b.runs[0]?.text === 'Risks');
doc.blocks.splice(at + 1, 0, ...markdownToBlocks('New text with **bold**.'));
doc.styles.roles.h1.color = '#1e3a8a';
writeFileSync('f.bdoc', packDoc(doc));
```

`reference/format.md` lists every block and style field. `packDoc` writes only
media a block still uses. To replace a drawing, rebuild its scene and overwrite
the media's `png` and `project` (and `width`, `height` if its size changed).

## Styles and spacing

`.mjs` documents can adjust a preset, or set the page, without leaving a script:

```js
export default {
	title: 'Checkout v2',
	preset: 'modern',
	styles: (s) => { s.roles.h1.color = '#0f766e'; s.roles.p.after = 8; s.listGap = 3; },
	setup: { format: 'pageless', width: 'wide' },
	body: `# Goals\n\nText, or an array of blocks.`
};
```

A letterhead, or anything that needs sizes and colours per line, is a band
object (`reference/format.md`) in the `.mjs`, with a top margin to hold it:

```js
	header: {
		rule: true,
		lines: [
			{ align: 'center', runs: [{ text: 'ACME LTD', b: true, size: 14 }] },
			{ align: 'center', runs: [{ text: '1 Main Street, Springfield', size: 8.5, color: '#4b5563' }] }
		]
	},
	footer: 'Page {page} of {pages}', footerAlign: 'right',
	setup: { margins: { top: 1.35, bottom: 0.9, left: 1, right: 1 } },
```

Each of `title`, `p`, `h1`, `h2`, `h3`, `quote`, `code` has `font`, `size`, `bold`,
`italic`, `color`, `before`, `after`, `line`, `align`, `firstLine`, `keepNext`,
`pageBreak`. Fonts are a fixed list, so documents read the same elsewhere: Arial,
Calibri, Consolas, Courier New, Georgia, Tahoma, Times New Roman, Trebuchet MS,
Verdana. Values the app would refuse fall back to the preset's.

## Things not to do

- Don't hand-write `document.json` or the ZIP; `packDoc` validates and stores
  things as the app expects.
- Don't edit `doc-lib.mjs`; it is generated.
- Don't describe a flow in prose when the user asked for a diagram: draw it.
- Don't report success from `validate.mjs` alone; look at the preview.
