#!/usr/bin/env node
// Open a `.bdoc` in the real ByteDocs app, headless, and screenshot it — the
// end-to-end proof that the app accepts the file and shows what was meant.
//
//   node preview.mjs <f.bdoc> [--url https://…/doc] [--out dir] [--shots n]
//
// The file is dropped onto the page, as a Finder drop delivers it. Writes
// preview-<n>.png, one per screenful, for up to --shots screens (default 3).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { launch } from './chrome.mjs';

const args = process.argv.slice(2);
const take = (name) => {
	const i = args.indexOf(name);
	return i < 0 ? null : args.splice(i, 2)[1];
};
const url = take('--url') ?? process.env.BYTEDOCS_URL ?? 'https://bytecanvas.adrianuskevinkusuma.com/doc';
const outArg = take('--out');
const shots = Number(take('--shots') ?? 3);
const file = args[0];
if (!file) {
	console.error('usage: node preview.mjs <f.bdoc> [--url URL] [--out dir] [--shots n]');
	process.exit(2);
}
const outBase = outArg ? resolve(outArg) : dirname(resolve(file));
mkdirSync(outBase, { recursive: true });

const chrome = await launch({ width: 1440, height: 1000 });
const until = async (expr, ms = 30000) => {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		if (await chrome.evaluate(`!!(${expr})`).catch(() => false)) return true;
		await new Promise((r) => setTimeout(r, 200));
	}
	return false;
};

try {
	await chrome.send('Page.enable');
	await chrome.send('Page.navigate', { url });
	if (!(await until(`document.querySelector('.paper')`))) {
		console.error(`ByteDocs did not load at ${url}. If it is not deployed there yet, run the app locally and pass --url http://localhost:5173/doc`);
		process.exit(1);
	}
	const b64 = readFileSync(file).toString('base64');
	await chrome.evaluate(`(() => {
		const bin = atob(${JSON.stringify(b64)});
		const buf = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
		const dt = new DataTransfer();
		dt.items.add(new File([buf], ${JSON.stringify(basename(file))}, { type: '' }));
		document.querySelector('.doc-app').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
		return 1;
	})()`);
	const notice = `document.querySelector('.notice')?.textContent ?? ''`;
	await until(`/Opened|Couldn't/.test(${notice})`, 30000);
	const msg = await chrome.evaluate(notice);
	console.log(`app says: ${msg.trim() || '(nothing)'}`);
	if (!/Opened/.test(msg)) process.exitCode = 1;
	const state = await chrome.evaluate(`JSON.parse(document.querySelector('.paper').dataset.doc)`);
	const stack = await chrome.evaluate(`({ ...document.querySelector('.stack').dataset })`);
	console.log(`${state.blocks.length} blocks, ${stack.format}, ${stack.pages} page(s), style set ${await chrome.evaluate(`document.querySelector('.paper').dataset.styles`)}`);
	await until(`[...document.querySelectorAll('.figure-block img')].every((i) => i.complete && i.naturalWidth > 0)`, 8000);
	const view = await chrome.evaluate(`document.querySelector('.scroll').clientHeight`);
	const total = await chrome.evaluate(`document.querySelector('.scroll').scrollHeight`);
	for (let i = 0; i < shots && i * view < total; i++) {
		await chrome.evaluate(`document.querySelector('.scroll').scrollTop = ${i * view}, 1`);
		await new Promise((r) => setTimeout(r, 300));
		const shot = await chrome.send('Page.captureScreenshot', { format: 'png' });
		const out = resolve(outBase, `preview-${i + 1}.png`);
		writeFileSync(out, Buffer.from(shot.data, 'base64'));
		console.log(`screenshot → ${out}`);
	}
} finally {
	chrome.close();
}
