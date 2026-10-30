#!/usr/bin/env node
// Read a `.bdoc`: Markdown on stdout (or --out), pictures saved with --media.
//
//   node read.mjs <f.bdoc> [--out doc.md] [--media dir] [--docx f.docx]
//
// The Markdown carries front matter and figure lines that build.mjs reads back
// when --media is given. It holds the words and structure; colours, fonts and
// sizes set by hand, an edited style set and a paragraph's own spacing do not
// survive Markdown, so changes that must keep those edit the blocks instead
// (see "Changing a document" in SKILL.md).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { blocksToMarkdown, buildDocx, unpackDoc } from './doc-lib.mjs';

const args = process.argv.slice(2);
const take = (name) => {
	const i = args.indexOf(name);
	return i < 0 ? null : args.splice(i, 2)[1];
};
const outArg = take('--out');
const mediaArg = take('--media');
const docxArg = take('--docx');
if (!args[0]) {
	console.error('usage: node read.mjs <f.bdoc> [--out doc.md] [--media dir] [--docx f.docx]');
	process.exit(2);
}
const doc = unpackDoc(new Uint8Array(readFileSync(resolve(args[0]))));

const mediaDir = mediaArg ? resolve(mediaArg) : null;
if (mediaDir) mkdirSync(mediaDir, { recursive: true });
const from = outArg ? dirname(resolve(outArg)) : process.cwd();
const rel = (p) => relative(from, p).split('\\').join('/');

function figureLine(b) {
	const m = doc.media.get(b.media);
	if (!mediaDir) return `*[Figure${b.caption ? `: ${b.caption}` : ''}]*`;
	const png = join(mediaDir, `${b.media}.png`);
	writeFileSync(png, m.png);
	const opts = [`width=${Math.round((b.width / 720) * 100)}%`];
	// The app's PNGs may be 2x; what the document says is the display size.
	const scale = new DataView(m.png.buffer, m.png.byteOffset).getUint32(16) / m.width;
	if (scale !== 1) opts.push(`scale=${scale}`);
	if (m.project) {
		const project = join(mediaDir, `${b.media}.bcanvas`);
		writeFileSync(project, m.project);
		opts.push(`project=${rel(project)}`);
	}
	return `![${b.caption}](${rel(png)} "${opts.join(' ')}")`;
}

const s = doc.setup;
const front = ['---', `title: ${doc.title}`, `preset: ${doc.styles.id}`, `format: ${s.format}`, `paper: ${s.paper}`, `orientation: ${s.orientation}`,
	`margins: ${s.margins.top} ${s.margins.bottom} ${s.margins.left} ${s.margins.right}`, `width: ${s.width}`, '---', ''].join('\n');

// Runs of text blocks go through the app's writer; figures are lines of their own.
const parts = [];
let run = [];
const flush = () => {
	if (run.length) parts.push(blocksToMarkdown(run).trimEnd());
	run = [];
};
for (const b of doc.blocks) {
	if (b.type === 'figure') {
		flush();
		parts.push(figureLine(b));
	} else run.push(b);
}
flush();
const md = `${front}\n${parts.join('\n\n')}\n`;
if (outArg) {
	mkdirSync(dirname(resolve(outArg)), { recursive: true });
	writeFileSync(resolve(outArg), md);
	console.error(`wrote ${resolve(outArg)}`);
} else process.stdout.write(md);
if (docxArg) {
	writeFileSync(resolve(docxArg), buildDocx(doc));
	console.error(`wrote ${resolve(docxArg)}`);
}
