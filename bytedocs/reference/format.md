# The `.bdoc` format

A ZIP with stored (uncompressed) entries. Rename one to `.zip` and its pictures
are right there.

    document.json            title, page setup, styles, blocks, media index
    media/<id>.png           the picture a figure shows
    media/<id>.bcanvas       the drawing behind it, when there is one

Build and read it with `packDoc` and `unpackDoc` from `scripts/doc-lib.mjs`.
`unpackDoc` validates: a missing picture or a newer format is refused with a
message, an unknown block keeps its words as a paragraph, unknown marks are
dropped, unusable style values take the preset's, and only `http(s):` and
`mailto:` links survive.

## `document.json`

```js
{
  app: 'ByteCanvas', kind: 'document', version: 1, savedAt: '…',
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
| `figure` | `media` (id), `width`, `caption` (plain text) |
| `table` | `rows`: `rows[r][c]` is the runs of a cell; the first row is the header |

Text blocks may override their style with `align` (`left`, `center`, `right`,
`justify`), `spacing` (line multiple, 0.8–3), `before`, `after` (points, 0–72)
and `keepNext` (boolean).

A figure's `width` is in a 720-unit column whatever the page: 360 is half the
text column on any paper, and in Word.

## Runs

`{ text, b?, i?, u?, s?, code?, link?, font?, size?, color?, bg? }`. `size` is in
points; `color` and `bg` are `#rrggbb`; `font` is from the list in SKILL.md.
Line breaks are `\n` in `text`. Marks that are off are absent, not `false`.

## `setup`

`{ format, paper, orientation, margins: { top, bottom, left, right }, width }`.
Margins are in inches. `width` is the pageless text width. A pageless document
exports to Word and prints on default A4.

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
