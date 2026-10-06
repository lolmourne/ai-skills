// Headless Chrome over the DevTools protocol, with no dependencies: Node's
// built-in WebSocket and fetch (Node >= 22) are all it needs.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function findChrome(chromeArg) {
	const candidates = [
		chromeArg,
		process.env.CHROME,
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
		'/Applications/Chromium.app/Contents/MacOS/Chromium',
		'/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium',
		'/usr/bin/chromium-browser'
	].filter(Boolean);
	const hit = candidates.find((c) => existsSync(c));
	if (!hit) throw new Error('Chrome not found; pass --chrome <path> or set CHROME');
	return hit;
}

export async function launch({ chrome: chromeArg, width = 1440, height = 900 } = {}) {
	const profile = mkdtempSync(join(tmpdir(), 'bcanvas-build-'));
	const proc = spawn(
		findChrome(chromeArg),
		['--headless=new', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', `--window-size=${width},${height}`, 'about:blank'],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);
	// Port 0 lets Chrome pick a free port, so two builds never collide; it
	// announces the browser endpoint on stderr.
	const wsUrl = await new Promise((res, rej) => {
		let buf = '';
		const t = setTimeout(() => rej(new Error('Chrome did not start')), 20000);
		proc.stderr.on('data', (d) => {
			buf += d;
			const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
			if (m) { clearTimeout(t); res(m[1]); }
		});
		proc.on('exit', (c) => rej(new Error(`Chrome exited (${c})`)));
	});
	const port = new URL(wsUrl).port;
	let target;
	for (let i = 0; i < 40 && !target; i++) {
		const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
		target = list.find((t) => t.type === 'page');
		if (!target) await new Promise((r) => setTimeout(r, 250));
	}
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
	let id = 0;
	const pending = new Map();
	ws.onmessage = (m) => {
		const msg = JSON.parse(m.data);
		if (msg.id && pending.has(msg.id)) {
			const { res, rej } = pending.get(msg.id);
			pending.delete(msg.id);
			msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
		}
	};
	const send = (method, params = {}) =>
		new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
	const evaluate = async (expr) => {
		const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
		if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
		return r.result.value;
	};
	const close = () => {
		try { ws.close(); } catch {}
		proc.kill();
		setTimeout(() => rmSync(profile, { recursive: true, force: true }), 500);
	};
	return { send, evaluate, close };
}
