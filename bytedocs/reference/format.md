# The `.bdoc` format

A ZIP with stored (uncompressed) entries. Rename one to `.zip` and its pictures
are right there.

    document.json            title, page setup, styles, blocks, media index
    media/<id>.png           the picture a figure or table cell shows
    media/<id>.bcanvas       the drawing behind it, when there is one

Build and read it with `packDoc` and `unpackDoc` from `scripts/doc-lib.mjs`.
`unpackDoc` validates: a missing picture or a newer format is refused with a
message, an unknown block keeps its words as a paragraph, unknown marks are
dropped, unusable style values take the preset's, and only `http(s):` and
`mailto:` links survive.

## `document.json`

```js
{
  app: 'ByteCanvas', kind: 'document', version: 2, savedAt: '…',
  title: 'Checkout v2',
  setup: { … },
  styles: { … },
  blocks: [ … ],
  media: { '<id>': { width, height, project: true } }   // width, height: display px
}
```

`unpackDoc` returns `{ title, blocks, setup, styles, media }`, with `media` a
`Map` of id to `{ png, project?, width, height }` (bytes as `Uint8Array`).

## Blocks

Every block has an `id`, unique in the document (`newId()`).

| `type` | Fields |
|---|---|
| `p`, `h1`, `h2`, `h3`, `quote`, `code` | `runs` |
| `bullet`, `number`, `todo` | `runs`, `indent` (0–4, also on `p`), `checked` (to-do) |
| `divider` | none |
| `pagebreak` | none — what follows starts a new page; Word's own page break in `.docx`, absent from Markdown (`read.mjs` writes `<!-- pagebreak -->`) |
| `figure` | `media` (id), `width`, `caption` (plain text) |
| `table` | `rows`: `rows[r][c]` is the runs of a cell; the first row is the header. Optional `widths`, `heights`, `pictures` (below) |
| `timeline` | `title`, `items` (below), optional `scale` (`day`, `week`, `month`, `quarter`, `year`; absent picks one), `workdays` (true), `display` (below) |

Text blocks may override their style with `align` (`left`, `center`, `right`,
`justify`), `spacing` (line multiple, 0.8–3), `before`, `after` (points, 0–72)
and `keepNext` (boolean).

A figure's `width` is in a 720-unit column whatever the page: 360 is half the
text column on any paper, and in Word.

A table's optional sizes follow the same rule. `widths` has one number per
column, in that 720-unit column, and 0 means the column fits its content;
absent, the columns share the text column equally. `heights` has one number per
row, in CSS pixels, each the row's height at least; 0 fits the content.
`pictures[r][c]` is laid out like `rows` and lists the pictures under that
cell's text, each `{ id, media, width }` with `width` in the 720-unit column;
the media is in the same index as a figure's, drawings included.

A timeline's `items` are a flat list in display order, each
`{ id, title, start, end, level, color?, progress?, milestone?, after? }`:

- `start` and `end` are `YYYY-MM-DD` calendar days, the end included, so a
  one-day task has `start === end`.
- `level` is 0, 1 or 2. A row's children are the deeper rows after it, up to
  the next row at its own depth or shallower. No row is more than one deeper
  than the row above it, and `unpackDoc` repairs any that are.
- A row with children is drawn spanning them (`spans(items)` gives what is
  drawn); its own `start` and `end` are kept but not shown.
- `color` is `#rrggbb`. Absent, a row takes its top-level row's colour from the
  palette.
- `progress` is 1–100 per cent done; absent is not started.
- `milestone: true` makes a one-day point (`start === end`), drawn as a diamond.
- `after` lists the ids of rows this one starts after (finish-to-start).
  `reschedule(items, workdays)` pushes rows that start too early: only later,
  keeping their length, onto a working day when `workdays`. A link to a row
  the row contains or is in, or one that loops, is refused by `canDepend` and
  dropped by `unpackDoc`.
- `unpackDoc` drops rows without readable dates and puts reversed dates in order.

`display` is how the page shows the timeline, and print and PDF are the page:
`{ detail?: 'tasks' | 'phases', density?: 'compact', labels?: true }`. Absent
is every row, comfortable rows, and names only in the names column. Word
follows `detail` too.

Build one from text with `timelineFromText(text)`, which returns
`{ block, errors }` and reads the ```` ```timeline ```` fence format in SKILL.md.
`timelineToText(block)` writes it back.

## Runs

`{ text, b?, i?, u?, s?, code?, link?, font?, size?, color?, bg? }`. `size` is in
points; `color` and `bg` are `#rrggbb`; `font` is from the list in SKILL.md.
Line breaks are `\n` in `text`. Marks that are off are absent, not `false`.

## `setup`

`{ format, paper, orientation, margins: { top, bottom, left, right }, width, header?, footer? }`.
Margins are in inches. `width` is the pageless text width. A pageless document
exports to Word and prints on default A4.

`header` and `footer` are bands repeated on every page: `{ lines: [{ runs, align }], rule }`.
`align` is `left`, `center` or `right`; `rule` draws a line under the header or
over the footer. At most six lines; an empty band is dropped. `{page}` and
`{pages}` in the text are page numbers: filled per sheet in the app, Word's own
PAGE and NUMPAGES fields in the `.docx`, `counter(page)` in print. A band sits
0.5in from the paper's edge, so the margin must be tall enough to hold it (a
three-line letterhead wants about 1.35in at the top); `validate.mjs` warns.
A document with a header or footer is written as format version 3; one without
stays version 2. A document holding a timeline is version 4, so a ByteCanvas
from before timelines refuses it rather than dropping the chart. One whose
timeline uses progress, milestones, links, working days, `display`, or the
quarter or year scale is version 5, since a reader of 4 would drop those.

## `styles`

`{ id, name, roles, listGap }`. `id` is the preset it started from, `listGap` the
points between list items. `roles` has `title`, `p`, `h1`, `h2`, `h3`, `quote`,
`code`, each:

| Field | Meaning |
|---|---|
| `font`, `size` | From the font list; points |
| `bold`, `italic` | Booleans |
| `color` | `#rrggbb` |
| `before`, `after` | Points of space |
| `line` | Line spacing, as a Word multiple |
| `align` | `left`, `center`, `right`, `justify` |
| `firstLine` | Points the first line is set in |
| `keepNext` | Stays on the page of the next block |
| `pageBreak` | Always starts a new page |

## Word

`buildDocx({ title, blocks, media, setup, styles })` returns the bytes. Headings
are Word's own `Heading 1`–`3`, the style set becomes Word's styles, lists are
real numbering and pictures are inline at their share of the page's text width.
A timeline is a table whose bars are shaded cells, one column per day, week or
month (moving to a coarser scale past 26 columns), with phases in a darker
shade of their colour.
