#!/usr/bin/env node
// Build a ByteDocs document from Markdown (or a small JS module).
//
//   node build.mjs <doc.md|doc.mjs> [--out f.bdoc] [--docx f.docx]
//
// Markdown is read by the app's own reader, so what it accepts is what a paste
// into ByteDocs accepts. On top of that:
//
//   ---                         front matter, all optional
//   title: Checkout v2
//   preset: modern              one of the ten presets
//   format: pages | pageless
//   paper: a4 | letter | legal | a5
//   orientation: portrait | landscape
//   margins: 1                  inches: one value, or top bottom left right
//   width: narrow | medium | wide | full    (pageless text width)
//   ---
//   ![Caption](flow.png "width=M project=flow.bcanvas scale=2")
//
// A figure alone on its line takes a PNG, and with `project=` the `.bcanvas`
// behind it, which is what makes it editable in the app. width is S, M, L,
// Full or a percentage of the column; scale is how many pixels the PNG has per
// display pixel (2 for the embed-style renders ByteCanvas makes).
//
// With no `title:`, a document opening with its only `# ` heading takes that as
// the title and moves the other headings up a level, undoing what a Markdown
// export does.

import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
	COLUMN_WIDTH,
	DEFAULT_SETUP,
	DEFAULT_STYLES,
	PRESETS,
	buildDocx,
	markdownToBlocks,
	newId,
	packDoc,
	plainText,
	presetById,
	sanitizeBand,
	sanitizeSetup,
	sanitizeStyles,
	textToBand
} from './doc-lib.mjs';

const args = process.argv.slice(2);
const take = (name) => {
	const i = args.indexOf(name);
	return i < 0 ? null : args.splice(i, 2)[1];
};
const outArg = take('--out');
const docxArg = take('--docx');
const file = args[0];
if (!file) {
	console.error('usage: node build.mjs <doc.md|doc.mjs> [--out f.bdoc] [--docx f.docx]');
	process.exit(2);
}
const src = resolve(file);
const base = dirname(src);
const stem = basename(src, extname(src));

const fail = (msg) => {
	console.error(`error: ${msg}`);
	process.exit(1);
};

function frontMatter(text) {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
	if (!m) return { meta: {}, body: text };
	const meta = {};
	for (const line of m[1].split(/\r?\n/)) {
		const i = line.indexOf(':');
		if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
	}
	return { meta, body: text.slice(m[0].length) };
}

function pngSize(bytes, path) {
	const sig = [137, 80, 78, 71, 13, 10, 26, 10];
	if (!sig.every((b, i) => bytes[i] === b)) fail(`${path} is not a PNG`);
	const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	return { w: v.getUint32(16), h: v.getUint32(20) };
}

const WIDTHS = { s: 0.33, m: 0.5, l: 0.75, full: 1 };
const media = new Map();

function figure(caption, path, opts) {
	const full = resolve(base, path);
	let png;
	try {
		png = new Uint8Array(readFileSync(full));
	} catch {
		fail(`figure not found: ${full}`);
	}
	const { w, h } = pngSize(png, full);
	const scale = Number(opts.scale ?? 1);
	if (!(scale > 0)) fail(`bad scale on ${path}`);
	const entry = { png, width: Math.round(w / scale), height: Math.round(h / scale) };
	if (opts.project) {
		let project;
		try {
			project = new Uint8Array(readFileSync(resolve(base, opts.project)));
		} catch {
			fail(`project not found: ${resolve(base, opts.project)}`);
		}
		if (new TextDecoder().decode(project.subarray(0, 8)) !== 'BYTECNVS') fail(`${opts.project} is not a .bcanvas project`);
		entry.project = project;
	}
	const id = newId('m');
	media.set(id, entry);
	const want = String(opts.width ?? '').toLowerCase();
	const fraction = want.endsWith('%') ? parseFloat(want) / 100 : WIDTHS[want];
	const width = fraction ? Math.round(COLUMN_WIDTH * Math.min(1, fraction)) : Math.min(COLUMN_WIDTH, entry.width);
	return { id: newId(), type: 'figure', media: id, width, caption };
}

const FIGURE = /^!\[([^\]]*)\]\(\s*([^\s)]+)(?:\s+"([^"]*)")?\s*\)\s*$/;
/** A page break: Markdown has none, so a comment other readers hide, on a line of its own. */
const PAGE_BREAK = /^<!--\s*page\s*break\s*-->$/i;

/** Markdown around figures: the reader has no images, deliberately, so they are split out first. */
function bodyToBlocks(body) {
	const out = [];
	let chunk = [];
	const flush = () => {
		if (chunk.length) out.push(...markdownToBlocks(chunk.join('\n')));
		chunk = [];
	};
	let fenced = false;
	for (const line of body.split(/\r?\n/)) {
		if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
		if (!fenced && PAGE_BREAK.test(line.trim())) {
			flush();
			out.push({ id: newId(), type: 'pagebreak' });
			continue;
		}
		const m = fenced ? null : FIGURE.exec(line.trim());
		if (!m) {
			chunk.push(line);
			continue;
		}
		flush();
		const opts = Object.fromEntries((m[3] ?? '').split(/\s+/).filter(Boolean).map((p) => p.split('=')));
		out.push(figure(m[1], m[2], opts));
	}
	flush();
	return out;
}

/**
 * A header or footer: a string is its text (lines split on a newline, or on a
 * literal `\n` in front matter, marks as inline Markdown, `{page}` and
 * `{pages}` as page numbers); an object is a band as the format stores it.
 */
function bandFrom(v, align = 'center', rule) {
	if (v === undefined || v === null || v === '') return undefined;
	if (typeof v === 'object') return sanitizeBand(v);
	const band = textToBand(String(v).replace(/\\n/g, '\n'), align, false);
	if (!band) return undefined;
	band.rule = rule === undefined ? false : rule === true || rule === 'true' || rule === 'yes';
	return band;
}

function setupFrom(meta) {
	const s = { ...DEFAULT_SETUP };
	for (const side of ['header', 'footer']) {
		const band = bandFrom(meta[side], meta[`${side}-align`] || 'center', meta[`${side}-rule`]);
		if (band) s[side] = band;
	}
	for (const k of ['format', 'paper', 'orientation', 'width']) if (meta[k]) s[k] = meta[k];
	if (meta.margins) {
		const n = meta.margins.split(/[\s,]+/).map(Number);
		const [top, bottom, left, right] = n.length === 1 ? [n[0], n[0], n[0], n[0]] : n;
		s.margins = { top, bottom, left, right };
	}
	return sanitizeSetup(s);
}

function stylesFrom(preset) {
	if (!preset) return DEFAULT_STYLES;
	const p = presetById(preset.toLowerCase());
	if (!p) fail(`no preset "${preset}" — one of: ${PRESETS.map((x) => x.id).join(', ')}`);
	return p;
}

/** `# Title` at the top, and no other `# `: the title, with the rest moved up. */
function liftTitle(blocks) {
	const first = blocks[0];
	if (first?.type !== 'h1' || blocks.slice(1).some((b) => b.type === 'h1')) return { title: '', blocks };
	const up = { h2: 'h1', h3: 'h2' };
	return { title: plainText(first.runs), blocks: blocks.slice(1).map((b) => (up[b.type] ? { ...b, type: up[b.type] } : b)) };
}

let title, blocks, setup, styles;
if (extname(src) === '.mjs') {
	const scene = (await import(pathToFileURL(src).href)).default;
	styles = stylesFrom(scene.preset);
	// A function edits a copy of the preset: only what differs has to be said.
	if (typeof scene.styles === 'function') {
		const copy = structuredClone(styles);
		styles = sanitizeStyles(scene.styles(copy) ?? copy);
	} else if (scene.styles) styles = sanitizeStyles(scene.styles);
	const bands = {};
	for (const side of ['header', 'footer']) {
		const band = bandFrom(scene[side], scene[`${side}Align`] || 'center', scene[`${side}Rule`]);
		if (band) bands[side] = band;
	}
	setup = sanitizeSetup({ ...DEFAULT_SETUP, ...scene.setup, ...bands });
	blocks = typeof scene.body === 'string' ? bodyToBlocks(scene.body) : scene.body;
	title = scene.title ?? '';
} else {
	const { meta, body } = frontMatter(readFileSync(src, 'utf8'));
	styles = stylesFrom(meta.preset);
	setup = setupFrom(meta);
	blocks = bodyToBlocks(body);
	title = meta.title ?? '';
}
if (!title) ({ title, blocks } = liftTitle(blocks));
if (!blocks.length) fail('the document has no content');

const doc = { title, blocks, media, setup, styles };
const out = resolve(outArg ?? `${dirname(src)}/${stem}.bdoc`);
writeFileSync(out, packDoc(doc));
console.log(`wrote ${out} — ${blocks.length} blocks, ${media.size} figure(s), preset ${styles.id}, ${setup.format}`);
if (docxArg) {
	writeFileSync(resolve(docxArg), buildDocx(doc));
	console.log(`wrote ${resolve(docxArg)}`);
}
