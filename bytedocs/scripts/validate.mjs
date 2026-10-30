#!/usr/bin/env node
// Check a `.bdoc` with the app's own reader, and report what it holds.
//
//   node validate.mjs <f.bdoc>
//
// Errors exit 1: the file does not open, a picture is not a PNG, a drawing is
// not a project, the Word export fails. Warnings are about the writing (a
// heading level skipped, an empty heading, a figure with no caption).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildDocx, outline, plainText, unpackDoc } from './doc-lib.mjs';

const file = process.argv[2];
if (!file) {
	console.error('usage: node validate.mjs <f.bdoc>');
	process.exit(2);
}
const errors = [];
const warnings = [];
let doc;
try {
	doc = unpackDoc(new Uint8Array(readFileSync(resolve(file))));
} catch (e) {
	console.error(`ERROR ${e.message}`);
	process.exit(1);
}

const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
const counts = {};
let last = 0;
for (const b of doc.blocks) {
	counts[b.type] = (counts[b.type] ?? 0) + 1;
	if (/^h[123]$/.test(b.type)) {
		const level = Number(b.type[1]);
		if (!plainText(b.runs).trim()) warnings.push('an empty heading');
		if (level > last + 1) warnings.push(`heading "${plainText(b.runs)}" skips a level (H${last || 0} to H${level})`);
		last = level;
	}
	if (b.type === 'figure') {
		const m = doc.media.get(b.media);
		if (!PNG.every((v, i) => m.png[i] === v)) errors.push(`figure ${b.media} is not a PNG`);
		if (m.project && new TextDecoder().decode(m.project.subarray(0, 8)) !== 'BYTECNVS') errors.push(`figure ${b.media} has a project that is not .bcanvas`);
		if (!b.caption.trim()) warnings.push(`figure ${b.media} has no caption`);
		if (!m.project) warnings.push(`figure "${b.caption}" is a picture only: it opens in ByteCanvas as pixels, not shapes`);
	}
}
if (!doc.title.trim()) warnings.push('the document has no title');
try {
	buildDocx(doc);
} catch (e) {
	errors.push(`the Word export failed: ${e.message}`);
}

console.log(`title: ${doc.title || '(none)'}`);
console.log(`preset: ${doc.styles.name} (${doc.styles.id}), ${doc.setup.format}${doc.setup.format === 'pages' ? `, ${doc.setup.paper} ${doc.setup.orientation}` : ''}`);
console.log(`blocks: ${doc.blocks.length} — ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(', ')}`);
const toc = outline(doc.blocks);
if (toc.length) console.log(`outline:\n${toc.map((e) => `${'  '.repeat(e.level)}${e.text}`).join('\n')}`);
for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`ERROR ${e}`);
if (errors.length) process.exit(1);
console.log('ok');
