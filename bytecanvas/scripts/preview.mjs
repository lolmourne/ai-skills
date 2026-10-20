#!/usr/bin/env node
// Open a `.bcanvas` in the real ByteCanvas app, headless, and screenshot it —
// the end-to-end proof that the app accepts the file and shows what was meant.
//
//   node preview.mjs <file.bcanvas> [--url https://…] [--page <n|name>]… [--out dir]
//
// The file is dropped onto the window exactly as a Finder drop delivers it.
// Prints the page tabs the app shows; writes preview-<n>.png per --page
// (default: the first page) into --out (default: next to the file).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { launch } from './chrome.mjs';

const args = process.argv.slice(2);
const take = (name) => {
	const out = [];
	for (let i = args.indexOf(name); i >= 0; i = args.indexOf(name)) out.push(args.splice(i, 2)[1]);
	return out;
};
const url = take('--url')[0] ?? process.env.BYTECANVAS_URL ?? 'https://bytecanvas.adrianuskevinkusuma.com';
const pages = take('--page');
const outArg = take('--out')[0];
const file = args[0];
if (!file) {
	console.error('usage: node preview.mjs <file.bcanvas> [--url URL] [--page n|name]… [--out dir]');
	process.exit(2);
}
const outBase = outArg ? resolve(outArg) : dirname(resolve(file));
mkdirSync(outBase, { recursive: true });

const chrome = await launch({ width: 1600, height: 1000 });
const until = async (expr, ms = 30000) => {
	const t0 = Date.now();
	while (Date.now() - t0 < ms) {
		if (await chrome.evaluate(`!!(${expr})`).catch(() => false)) return true;
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`timed out waiting for ${expr}`);
};

try {
	await chrome.send('Page.enable');
	await chrome.send('Page.navigate', { url });
	await until(`document.querySelector('.pages-bar')`);

	const b64 = readFileSync(file).toString('base64');
	await chrome.evaluate(`(() => {
		const bin = atob(${JSON.stringify(b64)});
		const buf = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
		const dt = new DataTransfer();
		dt.items.add(new File([buf], ${JSON.stringify(basename(file))}, { type: '' }));
		window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
		return 1;
	})()`);
	const notice = `document.querySelector('.notice')?.textContent ?? ''`;
	await until(`/Opened|could not|not a|truncated|invalid/i.test(${notice})`, 120000);
	const msg = await chrome.evaluate(notice);
	console.log(`app says: ${msg.trim()}`);
	if (!/Opened/.test(msg)) process.exitCode = 1;

	const tabs = await chrome.evaluate(`[...document.querySelectorAll('.pages-bar .tab')].map((t) => t.textContent.trim())`);
	console.log(`${tabs.length} page tabs: ${tabs.join(' | ')}`);

	for (const [i, want] of (pages.length ? pages : ['1']).entries()) {
		const idx = /^\d+$/.test(want) ? Number(want) - 1 : tabs.findIndex((t) => t.includes(want));
		if (idx < 0 || idx >= tabs.length) {
			console.warn(`no page "${want}"`);
			continue;
		}
		await chrome.evaluate(`document.querySelectorAll('.pages-bar .tab')[${idx}].click(), 1`);
		await new Promise((r) => setTimeout(r, 800));
		const shot = await chrome.send('Page.captureScreenshot', { format: 'png' });
		const out = resolve(outBase, `preview-${i + 1}.png`);
		writeFileSync(out, Buffer.from(shot.data, 'base64'));
		console.log(`screenshot of "${tabs[idx]}" → ${out}`);
	}
} finally {
	chrome.close();
}
