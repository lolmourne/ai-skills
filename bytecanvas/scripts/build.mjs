#!/usr/bin/env node
// ByteCanvas scene builder — turns a scene JSON into a `.bcanvas` project file
// (and, optionally, PNG exports of every page and slice).
//
//   node build.mjs <scene.json|scene.mjs> [--out file.bcanvas] [--png <dir>] [--chrome <path>]
//
// Every layer is rasterised in headless Chrome with Canvas 2D — the same engine
// ByteCanvas itself draws with — so text, fonts and icons come out exactly as
// the app would render them. No npm dependencies: Chrome is driven over the
// DevTools protocol with Node's built-in WebSocket and fetch (Node >= 22).
//
// The scene schema is documented in ../reference/scene-schema.md.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { launch } from './chrome.mjs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ---- args ------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => {
	const i = args.indexOf(name);
	if (i < 0) return undefined;
	const v = args[i + 1];
	args.splice(i, 2);
	return v;
};
const outArg = flag('--out');
const pngArg = flag('--png');
const chromeArg = flag('--chrome');
const scenePath = args[0];
if (!scenePath) {
	console.error('usage: node build.mjs <scene.json> [--out file.bcanvas] [--png dir] [--chrome path]');
	process.exit(2);
}
const sceneDir = dirname(resolve(scenePath));

// Chrome comes up before the scene is read: a scene module may measure text
// with it while laying out (see `tools` below).
const chrome = await launch({ chrome: chromeArg });
process.on('exit', () => chrome.close());
await chrome.evaluate(`(${pageRuntime.toString()})(); true`);

/**
 * Handed to a scene module's default-export function. Text layers never wrap
 * in ByteCanvas, so a scene that sets paragraphs has to break lines itself —
 * and it needs real advance widths to do it and to know how tall the result
 * is. `fonts()` loads faces and measures every character once; after that
 * `width()` and `wrap()` are synchronous, which keeps layout code plain.
 * Kerning is ignored, so `wrap` keeps a 2% margin.
 */
const metricTables = new Map();
const CHARSET = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('') + '–—•…“”‘’→←↑↓✓✕·×°±€£¥©®™½¼¾àáâãäèéêëìíîïòóôõöùúûüñçÀÁÉÍÓÚÑÇ①②③④⑤⑥⑦⑧⑨⑩›‹«»';
const tools = {
	async fonts(faces) {
		const todo = faces.map((f) => ({ font: f.font, weight: f.weight ?? 400, italic: !!f.italic })).filter((f) => !metricTables.has(`${f.font}|${f.weight}|${f.italic}`));
		if (!todo.length) return;
		const missing = await chrome.evaluate(`__bcanvas.loadFonts(${JSON.stringify(todo.map((f) => ({ family: f.font, weight: f.weight, italic: f.italic })))}, [])`);
		if (missing.length) console.warn(`warning: fonts not loaded for measuring: ${missing.join(', ')}`);
		const tables = await chrome.evaluate(`(() => {
			const ctx = __bcanvas.canvas(1, 1).getContext('2d');
			const chars = [...${JSON.stringify(CHARSET)}];
			return ${JSON.stringify(todo)}.map((f) => {
				ctx.font = (f.italic ? 'italic ' : '') + f.weight + ' 100px "' + f.font + '", system-ui, sans-serif';
				const t = {};
				for (const ch of chars) t[ch] = ctx.measureText(ch).width / 100;
				return t;
			});
		})()`);
		todo.forEach((f, i) => metricTables.set(`${f.font}|${f.weight}|${f.italic}`, tables[i]));
	},
	width(str, { font, size, weight = 400, italic = false, letterSpacing = 0 }) {
		const t = metricTables.get(`${font}|${weight}|${!!italic}`);
		if (!t) throw new Error(`measure ${font} ${weight} with tools.fonts() first`);
		let w = 0;
		for (const ch of String(str)) w += (t[ch] ?? t['n']) * size + letterSpacing;
		return w;
	},
	/** Break `str` (existing newlines kept) to fit `maxWidth`. Returns { text, lines }. */
	wrap(str, maxWidth, opts) {
		const limit = maxWidth * 0.98;
		const out = [];
		for (const para of String(str).split('\n')) {
			let line = '';
			for (const word of para.split(/ +/)) {
				const next = line ? `${line} ${word}` : word;
				if (line && tools.width(next, opts) > limit) {
					out.push(line);
					line = word;
				} else line = next;
			}
			out.push(line);
		}
		return { text: out.join('\n'), lines: out.length };
	}
};

// A scene is JSON, or a JS module whose default export is the scene (or a
// function returning it, called with `tools`) — code is the easier way to lay
// out a real screen.
const scene = /\.(m?js)$/i.test(scenePath)
	? await (async () => {
			const mod = (await import(pathToFileURL(resolve(scenePath)).href)).default;
			return typeof mod === 'function' ? await mod(tools) : mod;
		})()
	: JSON.parse(readFileSync(scenePath, 'utf8'));
const relOut = (p) => resolve(sceneDir, p);
const outPath = outArg ? resolve(outArg) : scene.output ? relOut(scene.output) : resolve(scenePath.replace(/\.(json|m?js)$/i, '') + '.bcanvas');
const pngDir = pngArg ? resolve(pngArg) : scene.pngDir ? relOut(scene.pngDir) : null;

// ---- scene normalisation (Node side) --------------------------------------

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };

/** Inline every file reference as a data URL so the page needs no file access. */
function inlineSources(layer) {
	if ((layer.type === 'image' || layer.type === 'svg') && layer.src && !/^data:|^https?:/.test(layer.src)) {
		const p = isAbsolute(layer.src) ? layer.src : resolve(sceneDir, layer.src);
		if (!existsSync(p)) throw new Error(`layer "${layer.name ?? layer.type}": file not found: ${p}`);
		const mime = MIME[extname(p).toLowerCase()] ?? 'application/octet-stream';
		layer.src = `data:${mime};base64,${readFileSync(p).toString('base64')}`;
	}
	if (layer.type === 'svg' && layer.markup) {
		layer.src = 'data:image/svg+xml;base64,' + Buffer.from(layer.markup).toString('base64');
	}
}

if (!Array.isArray(scene.pages) || !scene.pages.length) throw new Error('scene has no pages');
const pageNames = new Set();
for (const page of scene.pages) {
	if (!page.name) throw new Error('every page needs a name');
	if (pageNames.has(page.name)) throw new Error(`duplicate page name "${page.name}"`);
	pageNames.add(page.name);
	for (const l of page.layers ?? []) inlineSources(l);
}

// ---- the in-page renderer ---------------------------------------------------
// Runs inside Chrome. Kept as a function so it is syntax-checked with the
// rest of the file, then shipped over with toString().

function pageRuntime() {
	const SUPERSAMPLE = 2;
	const ICON_FAMILIES = {
		filled: 'Material Icons',
		outlined: 'Material Icons Outlined',
		round: 'Material Icons Round',
		sharp: 'Material Icons Sharp',
		'two-tone': 'Material Icons Two Tone'
	};

	const fontShorthand = (family, size, weight, italic) =>
		`${italic ? 'italic ' : ''}${weight} ${size}px "${family}", system-ui, sans-serif`;

	function linkCss(href) {
		return new Promise((res) => {
			const l = document.createElement('link');
			l.rel = 'stylesheet';
			l.href = href;
			l.onload = res;
			l.onerror = res;
			document.head.appendChild(l);
		});
	}

	/** Load every family/weight the scene uses, then prove each is resident. */
	async function loadFonts(textFaces, iconStyles) {
		const byFamily = new Map();
		for (const f of textFaces) {
			if (!byFamily.has(f.family)) byFamily.set(f.family, new Set());
			byFamily.get(f.family).add(`${f.italic ? 1 : 0},${f.weight}`);
		}
		const loads = [];
		for (const [family, set] of byFamily) {
			const tuples = [...set].sort((a, b) => {
				const [ai, aw] = a.split(',').map(Number);
				const [bi, bw] = b.split(',').map(Number);
				return ai - bi || aw - bw;
			});
			const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:ital,wght@${tuples.join(';')}&display=block`;
			loads.push(linkCss(href));
		}
		for (const s of iconStyles) {
			loads.push(linkCss(`https://fonts.googleapis.com/icon?family=${ICON_FAMILIES[s].replace(/ /g, '+')}`));
		}
		await Promise.all(loads);
		const missing = [];
		for (const f of textFaces) {
			const spec = fontShorthand(f.family, 32, f.weight, f.italic);
			try { await document.fonts.load(spec, 'Aa'); } catch {}
			if (!document.fonts.check(spec, 'Aa')) missing.push(`${f.family} ${f.weight}${f.italic ? ' italic' : ''}`);
		}
		for (const s of iconStyles) {
			const spec = `24px "${ICON_FAMILIES[s]}"`;
			try { await document.fonts.load(spec, 'home'); } catch {}
			if (!document.fonts.check(spec, 'home')) missing.push(ICON_FAMILIES[s]);
		}
		await document.fonts.ready;
		return missing;
	}

	const canvas = (w, h) => {
		const c = document.createElement('canvas');
		c.width = Math.max(1, Math.ceil(w));
		c.height = Math.max(1, Math.ceil(h));
		return c;
	};

	const loadImage = (src) =>
		new Promise((res, rej) => {
			const img = new Image();
			img.onload = () => res(img);
			img.onerror = () => rej(new Error('image failed to load: ' + src.slice(0, 60)));
			img.src = src;
		});

	function roundRectPath(ctx, x, y, w, h, r) {
		const rr = Array.isArray(r) ? r : [r ?? 0, r ?? 0, r ?? 0, r ?? 0];
		const lim = Math.min(w, h) / 2;
		ctx.beginPath();
		ctx.roundRect(x, y, w, h, rr.map((v) => Math.min(lim, Math.max(0, v))));
	}

	function paintFor(ctx, l, w, h) {
		if (l.gradient) {
			const g = l.gradient;
			let grad;
			if (g.type === 'radial') {
				grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 2);
			} else {
				// CSS convention: 0deg points up, 90deg points right.
				const a = (((g.angle ?? 180) - 90) * Math.PI) / 180;
				const len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a));
				const cx = w / 2, cy = h / 2;
				grad = ctx.createLinearGradient(cx - (Math.cos(a) * len) / 2, cy - (Math.sin(a) * len) / 2, cx + (Math.cos(a) * len) / 2, cy + (Math.sin(a) * len) / 2);
			}
			const stops = g.stops ?? [];
			stops.forEach((s, i) => {
				const [color, at] = Array.isArray(s) ? s : [s.color, s.at];
				grad.addColorStop(at ?? i / Math.max(1, stops.length - 1), color);
			});
			return grad;
		}
		return l.fill ?? null;
	}

	/** Text exactly as ByteCanvas lays out a single-style text layer. */
	function textLayout(l) {
		const lines = String(l.text).split('\n');
		const font = fontShorthand(l.font, l.size, l.weight, l.italic);
		const m = canvas(1, 1).getContext('2d');
		m.font = font;
		const lh = l.size * l.lineHeight;
		let top = 0;
		let boxWidth = 0;
		const out = [];
		for (const text of lines) {
			if (l.letterSpacing) m.letterSpacing = `${l.letterSpacing}px`;
			const mt = m.measureText(text);
			const ascent = Number.isFinite(mt.fontBoundingBoxAscent) ? mt.fontBoundingBoxAscent : l.size * 0.8;
			const descent = Number.isFinite(mt.fontBoundingBoxDescent) ? mt.fontBoundingBoxDescent : l.size * 0.2;
			const baseline = top + (lh - (ascent + descent)) / 2 + ascent;
			out.push({ text, width: mt.width, baseline });
			boxWidth = Math.max(boxWidth, mt.width);
			top += lh;
		}
		return { font, lines: out, boxWidth, height: top };
	}

	function rasterText(l) {
		const lay = textLayout(l);
		const pad = Math.ceil(l.size * 0.12) + (l.italic ? Math.ceil(l.size * 0.2) : 0);
		const w = Math.max(1, Math.ceil((lay.boxWidth + pad * 2) * SUPERSAMPLE));
		const h = Math.max(1, Math.ceil((lay.height + pad * 2) * SUPERSAMPLE));
		const c = canvas(w, h);
		const ctx = c.getContext('2d');
		ctx.setTransform(SUPERSAMPLE, 0, 0, SUPERSAMPLE, pad * SUPERSAMPLE, pad * SUPERSAMPLE);
		ctx.font = lay.font;
		if (l.letterSpacing) ctx.letterSpacing = `${l.letterSpacing}px`;
		ctx.fillStyle = l.color;
		ctx.textBaseline = 'alphabetic';
		for (const line of lay.lines) {
			const x = l.align === 'center' ? (lay.boxWidth - line.width) / 2 : l.align === 'right' ? lay.boxWidth - line.width : 0;
			ctx.fillText(line.text, x, line.baseline);
			if (l.underline || l.strike) {
				const y = l.underline ? line.baseline + l.size * 0.1 : line.baseline - l.size * 0.3;
				ctx.fillRect(x, y, line.width, Math.max(1, l.size / 14));
			}
		}
		return { c, pad, boxWidth: lay.boxWidth, height: lay.height, scale: 1 / SUPERSAMPLE };
	}

	async function rasterLayer(l, pageCanvases) {
		const w = l.w, h = l.h;
		switch (l.type) {
			case 'rect':
			case 'ellipse': {
				// A stroke is drawn inside the box, so the layer is exactly w x h.
				const c = canvas(w, h);
				const ctx = c.getContext('2d');
				const sw = l.strokeWidth ?? (l.stroke ? 1 : 0);
				const inset = sw / 2;
				const path = () => {
					if (l.type === 'ellipse') {
						ctx.beginPath();
						ctx.ellipse(w / 2, h / 2, Math.max(0, w / 2 - inset), Math.max(0, h / 2 - inset), 0, 0, Math.PI * 2);
					} else {
						const r = Array.isArray(l.radius) ? l.radius.map((v) => Math.max(0, v - inset)) : Math.max(0, (l.radius ?? 0) - inset);
						roundRectPath(ctx, inset, inset, w - sw, h - sw, r);
					}
				};
				path();
				const paint = paintFor(ctx, l, w, h);
				if (paint) { ctx.fillStyle = paint; ctx.fill(); }
				if (sw > 0 && l.stroke) {
					ctx.lineWidth = sw;
					ctx.strokeStyle = l.stroke;
					if (l.dash) ctx.setLineDash(l.dash);
					ctx.stroke();
				}
				return { c };
			}
			case 'line': {
				const minX = Math.min(l.x1, l.x2), minY = Math.min(l.y1, l.y2);
				const sw = l.strokeWidth ?? 1;
				const c = canvas(Math.abs(l.x2 - l.x1) + sw * 2, Math.abs(l.y2 - l.y1) + sw * 2);
				const ctx = c.getContext('2d');
				ctx.strokeStyle = l.color ?? '#000';
				ctx.lineWidth = sw;
				ctx.lineCap = l.cap ?? 'round';
				if (l.dash) ctx.setLineDash(l.dash);
				ctx.beginPath();
				ctx.moveTo(l.x1 - minX + sw, l.y1 - minY + sw);
				ctx.lineTo(l.x2 - minX + sw, l.y2 - minY + sw);
				ctx.stroke();
				return { c, x: minX - sw, y: minY - sw };
			}
			case 'text':
				return rasterText(l);
			case 'icon': {
				const family = ICON_FAMILIES[l.style ?? 'filled'];
				const s = l.size * SUPERSAMPLE;
				const c = canvas(s, s);
				const ctx = c.getContext('2d');
				ctx.font = `${s}px "${family}"`;
				ctx.fillStyle = l.color ?? '#000';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.fillText(l.icon, s / 2, s / 2);
				return { c, scale: 1 / SUPERSAMPLE, w: l.size, h: l.size };
			}
			case 'image':
			case 'svg': {
				const img = await loadImage(l.src);
				const iw = img.naturalWidth || w, ih = img.naturalHeight || h;
				// Keep a photo's own resolution when it is larger than its box,
				// so zooming in ByteCanvas — or exporting at the page size —
				// does not reveal a downsampled copy. SVGs render at 2x.
				const density = l.type === 'svg' ? SUPERSAMPLE : Math.max(1, Math.min(4, Math.min(iw / w, ih / h)));
				const cw = w * density, ch = h * density;
				const c = canvas(cw, ch);
				const ctx = c.getContext('2d');
				if (l.radius) { roundRectPath(ctx, 0, 0, cw, ch, (Array.isArray(l.radius) ? l.radius : [l.radius]).map((r) => r * density)); ctx.clip(); }
				const fit = l.fit ?? (l.type === 'svg' ? 'contain' : 'cover');
				let dw = cw, dh = ch;
				if (fit !== 'fill') {
					const k = fit === 'cover' ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);
					dw = iw * k; dh = ih * k;
				}
				ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
				if (l.tint) {
					ctx.globalCompositeOperation = 'source-in';
					ctx.fillStyle = l.tint;
					ctx.fillRect(0, 0, cw, ch);
				}
				return { c, scale: 1 / density, w, h };
			}
			case 'page': {
				// A live thumbnail of another page — for overviews and flows.
				const src = pageCanvases.get(l.page);
				if (!src) throw new Error(`page layer refers to "${l.page}", which is not built yet (put it earlier in the scene)`);
				const density = Math.max(1, Math.min(3, src.width / w));
				const cw = w * density, ch = h * density;
				const c = canvas(cw, ch);
				const ctx = c.getContext('2d');
				if (l.radius) { roundRectPath(ctx, 0, 0, cw, ch, l.radius * density); ctx.clip(); }
				ctx.drawImage(src, 0, 0, cw, ch);
				return { c, scale: 1 / density, w, h };
			}
			default:
				throw new Error(`unknown layer type "${l.type}"`);
		}
	}

	function shadowColor(hex, opacity) {
		let h = hex.replace('#', '');
		if (h.length === 3) h = h.split('').map((ch) => ch + ch).join('');
		const n = parseInt(h.slice(0, 6), 16);
		const a = (h.length === 8 ? parseInt(h.slice(6), 16) / 255 : 1) * opacity;
		return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
	}

	/** Composite a page the way ByteCanvas renders it, for the PNG exports. */
	function compositePage(page, built) {
		const c = canvas(page.width, page.height);
		const ctx = c.getContext('2d');
		if (page.background) { ctx.fillStyle = page.background; ctx.fillRect(0, 0, c.width, c.height); }
		for (const b of built) {
			if (b.visible === false) continue;
			ctx.save();
			ctx.globalAlpha = b.opacity;
			ctx.globalCompositeOperation = { normal: 'source-over' }[b.blendMode] ?? b.blendMode;
			const t = b.transform;
			const dw = b.width * t.scaleX, dh = b.height * t.scaleY;
			ctx.translate(t.x + dw / 2, t.y + dh / 2);
			ctx.rotate(t.rotation);
			const s = b.effects?.dropShadow;
			if (s?.enabled) {
				const rad = (s.angle * Math.PI) / 180;
				ctx.shadowColor = shadowColor(s.color, s.opacity);
				ctx.shadowBlur = s.blur;
				ctx.shadowOffsetX = Math.cos(rad) * s.distance;
				ctx.shadowOffsetY = Math.sin(rad) * s.distance;
			}
			ctx.drawImage(b.canvas, -dw / 2, -dh / 2, dw, dh);
			ctx.restore();
		}
		return c;
	}

	const pngBase64 = (c) => c.toDataURL('image/png').slice('data:image/png;base64,'.length);

	/**
	 * Crop a built layer to a page-space rectangle. `at` is where the layer's
	 * top-left lands and `scale` its page px per layer px. Returns the new
	 * canvas and offset, or null when nothing of it is left.
	 */
	function cropTo(c, at, scale, clip) {
		const lx0 = Math.max(0, Math.floor((clip.x - at.x) / scale));
		const ly0 = Math.max(0, Math.floor((clip.y - at.y) / scale));
		const lx1 = Math.min(c.width, Math.ceil((clip.x + clip.w - at.x) / scale));
		const ly1 = Math.min(c.height, Math.ceil((clip.y + clip.h - at.y) / scale));
		if (lx1 <= lx0 || ly1 <= ly0) return null;
		if (lx0 === 0 && ly0 === 0 && lx1 === c.width && ly1 === c.height) return { c, dx: 0, dy: 0 };
		const out = canvas(lx1 - lx0, ly1 - ly0);
		out.getContext('2d').drawImage(c, -lx0, -ly0);
		return { c: out, dx: lx0 * scale, dy: ly0 * scale };
	}

	window.__bcanvas = { loadFonts, rasterLayer, compositePage, pngBase64, canvas, cropTo };
}

// ---- unit handling ----------------------------------------------------------
// A page may declare `scale`: every geometric value in its layers is then in
// logical units (Flutter dp) and multiplied up to pixels here, so a scene can
// copy padding, radii and font sizes straight out of the Dart code.

/** A text layer's per-character extras, in ByteCanvas's run style. */
function runStyle(l) {
	const style = {};
	if (l.letterSpacing) style.tracking = Math.round((l.letterSpacing / l.size) * 10000) / 100;
	if (l.underline) style.underline = true;
	if (l.strike) style.strike = true;
	return style;
}

const GEOM = ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'size', 'strokeWidth', 'letterSpacing', 'maxWidth', 'width'];

function scaleLayer(l, k) {
	const o = structuredClone(l);
	for (const key of GEOM) if (typeof o[key] === 'number') o[key] *= k;
	if (typeof o.radius === 'number') o.radius *= k;
	else if (Array.isArray(o.radius)) o.radius = o.radius.map((r) => r * k);
	if (Array.isArray(o.dash)) o.dash = o.dash.map((d) => d * k);
	if (o.clip) o.clip = { x: o.clip.x * k, y: o.clip.y * k, w: o.clip.w * k, h: o.clip.h * k };
	if (o.shadow) o.shadow = { ...o.shadow, blur: (o.shadow.blur ?? 8) * k, distance: (o.shadow.distance ?? 4) * k };
	return o;
}

function withDefaults(l, scene) {
	const d = scene.defaults ?? {};
	if (l.type === 'text') {
		return {
			font: d.font ?? 'Roboto',
			weight: 400,
			italic: false,
			color: d.color ?? '#000000',
			align: 'left',
			lineHeight: d.lineHeight ?? 1.25,
			...l,
			size: l.size ?? d.size ?? 16
		};
	}
	if (l.type === 'icon') return { style: d.iconStyle ?? 'filled', size: 24, ...l };
	return l;
}

// ---- ids --------------------------------------------------------------------

let idCounter = 0;
const rnd = () => Math.random().toString(36).slice(2, 8);
const layerId = () => `layer_${++idCounter}_${rnd()}`;
let pageCounter = 0;
const pageId = () => `page_${++pageCounter}_${rnd()}`;

// ---- main -------------------------------------------------------------------

try {

	// Collect fonts across the whole scene first: one stylesheet per family.
	const faces = new Map();
	const iconStyles = new Set();
	for (const page of scene.pages) {
		for (const raw of page.layers ?? []) {
			const l = withDefaults(raw, scene);
			if (l.type === 'text') faces.set(`${l.font}|${l.weight}|${l.italic}`, { family: l.font, weight: l.weight, italic: l.italic });
			if (l.type === 'icon') iconStyles.add(l.style);
		}
	}
	const missing = await chrome.evaluate(`__bcanvas.loadFonts(${JSON.stringify([...faces.values()])}, ${JSON.stringify([...iconStyles])})`);
	if (missing.length) console.warn(`warning: fonts not loaded (rendered in a fallback face): ${missing.join(', ')}`);

	await chrome.evaluate(`window.__pages = new Map(); window.__built = new Map(); true`);

	const manifestPages = [];
	const images = []; // { bytes, width, height }

	for (const page of scene.pages) {
		const k = page.scale ?? 1;
		const width = Math.round((page.width ?? 0) * k);
		const height = Math.round((page.height ?? 0) * k);
		if (width < 1 || height < 1) throw new Error(`page "${page.name}" has no size`);

		const layers = [];
		const builtForComposite = [];
		const overflow = [];
		const below = []; // bottoms of layers that only run off the bottom: summarised, often a deliberate fold
		for (const raw of page.layers ?? []) {
			const l = scaleLayer(withDefaults(raw, scene), k);
			const r = await chrome.evaluate(`(async () => {
				const l = ${JSON.stringify(l)};
				const r = await __bcanvas.rasterLayer(l, __pages);
				const key = 'b' + __built.size;
				__built.set(key, r.c);
				return { key, cw: r.c.width, ch: r.c.height, scale: r.scale ?? 1, x: r.x, y: r.y, pad: r.pad ?? 0, boxWidth: r.boxWidth, textHeight: r.height };
			})()`);

			// Where the layer's top-left lands. Text is anchored by its visible
			// box; ByteCanvas pads the bitmap, so the layer starts `pad` earlier.
			let x = r.x ?? l.x ?? 0;
			let y = r.y ?? l.y ?? 0;
			if (l.type === 'text') {
				let tx = l.x;
				if (typeof l.width === 'number') {
					if (l.align === 'center') tx = l.x + (l.width - r.boxWidth) / 2;
					else if (l.align === 'right') tx = l.x + l.width - r.boxWidth;
				}
				x = tx - r.pad;
				y = l.y - r.pad;
			}

			// Where the ink is, for the overflow check below (text without its pad).
			const ink = l.type === 'text'
				? { x0: x + r.pad, y0: l.y, x1: x + r.pad + r.boxWidth, y1: l.y + r.textHeight }
				: { x0: x, y0: y, x1: x + r.cw * r.scale, y1: y + r.ch * r.scale };
			if (l.type === 'text' && typeof l.width === 'number' && r.boxWidth > l.width + k) {
				overflow.push(`"${String(l.text).split('\n')[0].slice(0, 40)}" is ${(r.boxWidth / k).toFixed(0)} wide, its box ${(l.width / k).toFixed(0)}`);
			}

			// Clipping (e.g. a phone screen's edge): crop the bitmap to what is
			// inside, or drop the layer when nothing is. Rotation is ignored.
			if (l.clip) {
				const cr = await chrome.evaluate(`(() => {
					const c = __built.get(${JSON.stringify(r.key)});
					const out = __bcanvas.cropTo(c, ${JSON.stringify({ x, y })}, ${r.scale}, ${JSON.stringify(l.clip)});
					if (!out) { __built.delete(${JSON.stringify(r.key)}); return null; }
					__built.set(${JSON.stringify(r.key)}, out.c);
					return { dx: out.dx, dy: out.dy, cw: out.c.width, ch: out.c.height };
				})()`);
				if (!cr) continue;
				x += cr.dx;
				y += cr.dy;
				r.cw = cr.cw;
				r.ch = cr.ch;
				Object.assign(ink, { x0: Math.max(ink.x0, l.clip.x), y0: Math.max(ink.y0, l.clip.y), x1: Math.min(ink.x1, l.clip.x + l.clip.w), y1: Math.min(ink.y1, l.clip.y + l.clip.h) });
			}
			// Past the page edge by more than one logical unit. `bleed: true` on a
			// layer says it is meant to (a decorative shape running off the page).
			if (!l.bleed && !l.rotation) {
				const off = [ink.x0 < -k && 'left', ink.y0 < -k && 'top', ink.x1 > width + k && 'right', ink.y1 > height + k && 'bottom'].filter(Boolean);
				if (off.length) {
					const label = l.name ?? (l.type === 'text' ? `"${String(l.text).split('\n')[0].slice(0, 40)}"` : l.type === 'icon' ? `icon/${l.icon}` : l.type);
					if (off.length === 1 && off[0] === 'bottom') below.push(ink.y1);
					else overflow.push(`${label} runs off the ${off.join('/')} (${[ink.x0, ink.y0, ink.x1, ink.y1].map((v) => Math.round(v / k)).join(',')} on ${page.width}x${page.height})`);
				}
			}
			const png = await chrome.evaluate(`__bcanvas.pngBase64(__built.get(${JSON.stringify(r.key)}))`);
			const imageIndex = images.length;
			images.push({ bytes: Buffer.from(png, 'base64'), width: r.cw, height: r.ch });

			const name = l.name ?? (l.type === 'text' ? String(l.text).split('\n')[0].slice(0, 40) : l.type === 'icon' ? `icon/${l.icon}` : l.type);
			const layer = {
				id: layerId(),
				name,
				visible: l.visible !== false,
				locked: l.locked === true,
				opacity: l.opacity ?? 1,
				blendMode: l.blendMode ?? 'normal',
				transform: { x, y, scaleX: r.scale, scaleY: r.scale, rotation: ((l.rotation ?? 0) * Math.PI) / 180 },
				width: r.cw,
				height: r.ch,
				image: imageIndex
			};
			// A text layer's name follows its content unless it was chosen by hand.
			if (l.type === 'text' && l.name) layer.renamed = true;
			if (l.type === 'text') {
				layer.text = {
					content: String(l.text),
					fontFamily: l.font,
					fontSize: l.size,
					fontWeight: l.weight,
					italic: !!l.italic,
					align: l.align,
					lineHeight: l.lineHeight,
					color: l.color,
					// What the picture was drawn with has to be in the spec too, or
					// the first edit in ByteCanvas re-renders the words without it.
					// ByteCanvas keeps tracking in % of the size, not pixels.
					runs: [{ text: String(l.text), style: runStyle(l) }]
				};
			}
			if (l.shadow) {
				layer.effects = {
					dropShadow: { enabled: true, color: l.shadow.color ?? '#000000', opacity: l.shadow.opacity ?? 0.25, blur: l.shadow.blur, distance: l.shadow.distance, angle: l.shadow.angle ?? 90 }
					// The other effects are left out: the reader fills in each missing one
					// with its default, which is exactly "disabled".
				};
			}
			layers.push(layer);
			builtForComposite.push({ key: r.key, ...layer });
		}

		const composite = await chrome.evaluate(`(() => {
			const built = ${JSON.stringify(builtForComposite)}.map((b) => ({ ...b, canvas: __built.get(b.key) }));
			const c = __bcanvas.compositePage(${JSON.stringify({ width, height, background: page.background ?? null })}, built);
			__pages.set(${JSON.stringify(page.name)}, c);
			return ${pngDir ? '__bcanvas.pngBase64(c)' : 'null'};
		})()`);
		await chrome.evaluate(`__built.clear(); true`);

		if (pngDir && page.export !== false) {
			mkdirSync(pngDir, { recursive: true });
			writeFileSync(join(pngDir, `${slug(page.name)}.png`), Buffer.from(composite, 'base64'));
		}

		manifestPages.push({
			id: pageId(),
			name: page.name,
			width,
			height,
			guides: { v: (page.guides?.v ?? []).map((g) => g * k), h: (page.guides?.h ?? []).map((g) => g * k) },
			background: page.background ?? null,
			selectedLayerId: null,
			selectedLayerIds: [],
			layers
		});
		process.stdout.write(`  page ${manifestPages.length}/${scene.pages.length}: ${page.name} (${layers.length} layers)\n`);
		if (below.length) overflow.push(`${below.length} layer(s) continue past the bottom, down to y=${Math.round(Math.max(...below) / k)} of ${page.height} — page too short, or a deliberate fold?`);
		if (overflow.length) {
			console.warn(`  warning: overflow on "${page.name}":`);
			for (const m of overflow.slice(0, 12)) console.warn(`    - ${m}`);
			if (overflow.length > 12) console.warn(`    … and ${overflow.length - 12} more`);
		}
	}

	// Slices: named crops of a built page, exported as their own PNGs.
	if (pngDir && Array.isArray(scene.slices)) {
		for (const s of scene.slices) {
			const page = scene.pages.find((p) => p.name === s.page);
			if (!page) throw new Error(`slice "${s.name}" refers to missing page "${s.page}"`);
			const k = page.scale ?? 1;
			const out = s.scale ?? 1;
			const png = await chrome.evaluate(`(() => {
				const src = __pages.get(${JSON.stringify(s.page)});
				const c = __bcanvas.canvas(${s.w * k * out}, ${s.h * k * out});
				c.getContext('2d').drawImage(src, ${s.x * k}, ${s.y * k}, ${s.w * k}, ${s.h * k}, 0, 0, c.width, c.height);
				return __bcanvas.pngBase64(c);
			})()`);
			mkdirSync(join(pngDir, 'slices'), { recursive: true });
			writeFileSync(join(pngDir, 'slices', `${slug(s.name)}.png`), Buffer.from(png, 'base64'));
		}
	}

	writeFileSync(outPath, pack(manifestPages, images, scene.activeIndex ?? 0, cmykMemory(scene.cmyk)));
	const total = images.reduce((n, i) => n + i.bytes.length, 0);
	console.log(`wrote ${outPath} — ${manifestPages.length} pages, ${images.length} images, ${(total / 1048576).toFixed(1)} MB`);
	if (pngDir) console.log(`png exports in ${pngDir}`);
} finally {
	chrome.close();
}

function slug(s) {
	return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
}

/**
 * A scene's brand CMYK values in the shape the app stores them: keyed by
 * lower-case six-digit hex, alpha dropped, each ink 0..100. Accepts
 * `{ c, m, y, k }` or `[c, m, y, k]`. ByteCanvas shows these in its colour
 * picker and prints them exactly in a CMYK PDF; any colour not listed is
 * separated by formula.
 */
function cmykMemory(raw) {
	const out = {};
	for (const [hex, v] of Object.entries(raw ?? {})) {
		const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim());
		if (!m) throw new Error(`cmyk: "${hex}" is not a hex colour`);
		const six = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
		const [c, mg, y, k] = Array.isArray(v) ? v : [v?.c, v?.m, v?.y, v?.k];
		const inks = [c, mg, y, k].map(Number);
		if (inks.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) {
			throw new Error(`cmyk: "${hex}" needs four inks from 0 to 100`);
		}
		out[`#${six.toLowerCase()}`] = { c: inks[0], m: inks[1], y: inks[2], k: inks[3] };
	}
	return out;
}

/** The `.bcanvas` container: magic, version, manifest length, manifest, PNGs. */
function pack(pages, images, activeIndex, cmyk = {}) {
	let offset = 0;
	const table = images.map((img) => {
		const entry = { offset, length: img.bytes.length, type: 'image/png', width: img.width, height: img.height };
		offset += img.bytes.length;
		return entry;
	});
	const manifest = {
		app: 'ByteCanvas',
		version: 1,
		savedAt: new Date().toISOString(),
		activeIndex: Math.min(pages.length - 1, Math.max(0, activeIndex)),
		pages,
		images: table
	};
	// Optional in the format: left out when there is none, as the app does.
	if (Object.keys(cmyk).length) manifest.cmyk = cmyk;
	const json = Buffer.from(JSON.stringify(manifest), 'utf8');
	const header = Buffer.alloc(16);
	header.write('BYTECNVS', 0, 'ascii');
	header.writeUInt32LE(1, 8);
	header.writeUInt32LE(json.length, 12);
	return Buffer.concat([header, json, ...images.map((i) => i.bytes)]);
}
