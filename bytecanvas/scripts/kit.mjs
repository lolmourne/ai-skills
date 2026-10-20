// Scene-authoring kit for ByteCanvas guideline files.
//
//   import * as k from '~/.claude/skills/bytecanvas/scripts/kit.mjs';
//
// Everything returns plain layer / page objects in the scene schema
// (../reference/scene-schema.md), so a scene module is ordinary code that
// pushes layers into arrays. All coordinates are in the page's logical units —
// Flutter dp on a mock screen (`scale: 3`), plain pixels on a guideline sheet.

import { CATEGORIES, SHAPE_LIBRARY, shapeDef } from './diagram-lib.mjs';

// ---- primitives -------------------------------------------------------------

export const rect = (x, y, w, h, o = {}) => ({ type: 'rect', x, y, w, h, ...o });
export const circle = (cx, cy, r, o = {}) => ({ type: 'ellipse', x: cx - r, y: cy - r, w: r * 2, h: r * 2, ...o });
export const text = (t, x, y, o = {}) => ({ type: 'text', text: String(t), x, y, ...o });
export const icon = (name, x, y, size = 24, color = '#000000', o = {}) => ({ type: 'icon', icon: name, x, y, size, color, ...o });
export const image = (src, x, y, w, h, o = {}) => ({ type: 'image', src, x, y, w, h, ...o });
export const svg = (src, x, y, w, h, o = {}) => ({ type: 'svg', ...(src.trim().startsWith('<') ? { markup: src } : { src }), x, y, w, h, ...o });
export const line = (x1, y1, x2, y2, o = {}) => ({ type: 'line', x1, y1, x2, y2, ...o });
export const pageRef = (page, x, y, w, h, o = {}) => ({ type: 'page', page, x, y, w, h, ...o });

// Vector shapes — editable in ByteCanvas as live shapes and paths, sharp at any
// size, and written as real paths by its SVG and editable-PDF exports.
export const polygon = (x, y, w, h, sides = 6, o = {}) => ({ type: 'polygon', x, y, w, h, sides, ...o });
export const star = (x, y, w, h, points = 5, inner = 0.5, o = {}) => ({ type: 'star', x, y, w, h, points, inner, ...o });
/** SVG path data (`d`), drawn at `scale` with its origin at (x, y) — paste a logo's path straight in. */
export const path = (d, x = 0, y = 0, o = {}) => ({ type: 'path', d, x, y, ...o });

/**
 * A group: one row in ByteCanvas's layer panel, picked up whole by a click on
 * the canvas, faded as one picture. Use one per component, so a UI kit opens
 * as named, foldable components instead of a heap of rectangles.
 */
export const group = (name, layers, o = {}) => ({ type: 'group', name, layers: layers.flat(), ...o });

/**
 * Clip `layers` to `base`, as Photoshop's clipping mask: a photo shown only
 * inside a circle, a pattern only inside a letter. Returns base + layers.
 */
export function clipped(base, layers) {
	return [base, ...layers.flat().map((l) => ({ ...l, clipBelow: true }))];
}

/** Flutter `Color(0xAARRGGBB)` / `withValues(alpha:)` → `#RRGGBBAA`. */
export function alpha(hex, a) {
	const h = hex.replace('#', '').slice(0, 6);
	return `#${h}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;
}

/** Flutter `Color(0xFF0A3D62)` literal → `#0A3D62` (alpha kept when not FF). */
export function flutterColor(v) {
	const s = String(v).replace(/^0x/i, '').padStart(8, 'F');
	const a = s.slice(0, 2), rgb = s.slice(2);
	return a.toUpperCase() === 'FF' ? `#${rgb}` : `#${rgb}${a}`;
}

/**
 * Rough advance width of a string, for laying things out next to text before
 * it is rendered (an icon beside a label, a chip sized to its text). Tuned on
 * Roboto/Inter-like faces; good to a few percent, which is enough for a mock.
 */
export function approxWidth(str, size, weight = 400) {
	let w = 0;
	for (const ch of String(str)) {
		if (/[il.,:;'|!]/.test(ch)) w += 0.26;
		else if (/[fjrt()\[\]]/.test(ch)) w += 0.34;
		else if (ch === ' ') w += 0.25;
		else if (/[mwMW@]/.test(ch)) w += 0.82;
		else if (/[A-Z0-9]/.test(ch)) w += 0.62;
		else w += 0.53;
	}
	return w * size * (weight >= 600 ? 1.05 : 1);
}

/** The height of a text layer's line box (what `y` is the top of). */
export const lineBox = (size, lineHeight = 1.25, lines = 1) => size * lineHeight * lines;

/**
 * A paragraph wrapped to `w` with the builder's real font metrics. `tools` is
 * what build.mjs hands a scene module's default-export function; load the face
 * first with `await tools.fonts([{ font, weight }])`. Returns the text layer,
 * its line count and its height, so the next block can start at `y + h + gap`.
 */
export function textBox(tools, t, x, y, w, o = {}) {
	if (!o.font) throw new Error('textBox needs o.font (the face it measures with)');
	const size = o.size ?? 14;
	const lineHeight = o.lineHeight ?? 1.25;
	const { text: wrapped, lines } = tools.wrap(t, w, { font: o.font, size, weight: o.weight ?? 400, italic: !!o.italic, letterSpacing: o.letterSpacing ?? 0 });
	return { layer: text(wrapped, x, y, { ...o, size, lineHeight, width: w }), lines, h: lineBox(size, lineHeight, lines) };
}

/** Text centred in a box, both ways. */
export function textIn(t, box, o = {}) {
	const size = o.size ?? 14;
	const lh = o.lineHeight ?? 1.25;
	const lines = String(t).split('\n').length;
	const align = o.align ?? 'center';
	return text(t, box.x + (o.padX ?? 0), box.y + (box.h - lineBox(size, lh, lines)) / 2, {
		...o,
		align,
		width: box.w - (o.padX ?? 0) * 2,
		lineHeight: lh,
		size
	});
}

/** Text whose line box is vertically centred on `cy`. */
export const textMid = (t, x, cy, o = {}) => text(t, x, cy - lineBox(o.size ?? 14, o.lineHeight ?? 1.25) / 2, o);

/** An icon centred on a point. */
export const iconAt = (name, cx, cy, size, color, o = {}) => icon(name, cx - size / 2, cy - size / 2, size, color, o);

/** Flutter BoxShadow(color, blurRadius, offset: Offset(0, dy)) → layer shadow. */
export function boxShadow({ color = '#000000', opacity = 0.25, blur = 8, dy = 2, dx = 0 } = {}) {
	return { color, opacity, blur, distance: Math.hypot(dx, dy), angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

// ---- phone chrome -------------------------------------------------------------

/** A status bar (time + signal/wifi/battery) for a mock screen of width `w`. */
export function statusBar(w, { color = '#FFFFFF', time = '9:41', font, top = 0, h = 47 } = {}) {
	const cy = top + h / 2 + 4;
	return [
		textMid(time, 28, cy, { size: 16, weight: 600, color, font, name: 'status/time' }),
		iconAt('signal_cellular_alt', w - 78, cy, 18, color, { name: 'status/signal' }),
		iconAt('wifi', w - 56, cy, 18, color, { name: 'status/wifi' }),
		{ ...iconAt('battery_full', w - 30, cy, 20, color, { name: 'status/battery' }), rotation: 90 }
	];
}

/** The iOS home indicator / Android gesture bar. */
export const homeIndicator = (w, h, color = '#111111') =>
	rect((w - 134) / 2, h - 13, 134, 5, { fill: color, radius: 3, name: 'home indicator' });

/**
 * A screen shown inside a phone body, for overview and flow pages. The screen
 * is a live thumbnail of its page, so it must be built earlier in the scene.
 */
export function phone(page, x, y, w, h, { bezel = 10, color = '#0B0F14', radius = 44, label, labelColor = '#111827', font, shadow = true } = {}) {
	const out = [
		rect(x - bezel, y - bezel, w + bezel * 2, h + bezel * 2, {
			fill: color,
			radius: radius + bezel,
			name: `frame/${page}`,
			...(shadow ? { shadow: boxShadow({ opacity: 0.22, blur: 40, dy: 18 }) } : {})
		}),
		pageRef(page, x, y, w, h, { radius, name: `screen/${page}` })
	];
	if (label) out.push(textIn(label, { x: x - 40, y: y + h + bezel + 18, w: w + 80, h: 30 }, { size: 20, weight: 600, color: labelColor, font, name: `label/${page}` }));
	return out;
}

// ---- guideline sheets -----------------------------------------------------------
// Every sheet shares one frame: a title block on the left edge and content
// below it, on a fixed-width page. `theme` carries the document's own look —
// it is the guideline's chrome, not the app's.

export const SHEET_W = 1600;
const M = 96; // sheet margin

export function defaultTheme(o = {}) {
	return {
		font: 'Inter',
		ink: '#111827',
		muted: '#6B7280',
		line: '#E5E7EB',
		paper: '#FFFFFF',
		panel: '#F9FAFB',
		accent: '#111827',
		...o
	};
}

/** A sheet page with its header. Returns { page, add, y } — `y` is where content starts. */
export function sheet(name, { title, kicker, intro, theme, height = 1200 }) {
	const th = theme;
	const layers = [
		text(kicker ?? name.toUpperCase(), M, M, { size: 16, weight: 700, color: th.accent, font: th.font, letterSpacing: 2, name: 'kicker' }),
		text(title ?? name, M, M + 34, { size: 56, weight: 800, color: th.ink, font: th.font, lineHeight: 1.1, name: 'title' })
	];
	let y = M + 34 + 70;
	if (intro) {
		layers.push(text(intro, M, y + 8, { size: 20, color: th.muted, font: th.font, lineHeight: 1.5, name: 'intro' }));
		y += 8 + lineBox(20, 1.5, intro.split('\n').length);
	}
	layers.push(line(M, y + 36, SHEET_W - M, y + 36, { color: th.line, strokeWidth: 2, name: 'rule' }));
	const page = { name, width: SHEET_W, height, background: th.paper, layers };
	return { page, add: (...ls) => layers.push(...ls.flat()), y: y + 84, x: M, w: SHEET_W - M * 2, theme: th };
}

/** Grow a sheet to fit what was added, plus the bottom margin. */
export function fit(s, contentBottom) {
	s.page.height = Math.max(s.page.height, Math.ceil(contentBottom + M));
	return s.page;
}

export function coverPage({ product, subtitle, version, date, theme, logo, logoW = 260, logoH = 124, logoBg, w = SHEET_W, h = 1000 }) {
	const th = theme;
	const layers = [
		rect(0, 0, w, h, { gradient: { angle: 135, stops: [[th.coverFrom ?? th.accent, 0], [th.coverTo ?? th.ink, 1]] }, name: 'cover background' }),
		circle(w - 160, 120, 360, { fill: '#FFFFFF0D', name: 'decor/orb 1', bleed: true }),
		circle(w - 40, h - 60, 220, { fill: '#FFFFFF0A', name: 'decor/orb 2', bleed: true })
	];
	let y = 220;
	if (logo) {
		if (logoBg) layers.push(rect(M, y - 24, logoW + 48, logoH + 48, { fill: logoBg, radius: 28, name: 'logo plate' }));
		layers.push(image(logo, M + (logoBg ? 24 : 0), y, logoW, logoH, { fit: 'contain', name: 'logo' }));
		y += logoH + 80;
	}
	layers.push(
		text('DESIGN GUIDELINE', M, y, { size: 18, weight: 700, color: '#FFFFFFB3', font: th.font, letterSpacing: 3 }),
		text(product, M, y + 36, { size: 88, weight: 800, color: '#FFFFFF', font: th.font, lineHeight: 1.05, name: 'product' }),
		text(subtitle ?? '', M, y + 36 + lineBox(88, 1.05, String(product).split('\n').length) + 28, { size: 26, color: '#FFFFFFCC', font: th.font, lineHeight: 1.45, name: 'subtitle' }),
		text([version, date].filter(Boolean).join('  ·  '), M, h - M - 24, { size: 18, color: '#FFFFFF99', font: th.font, name: 'version' })
	);
	return { name: '00 Cover', width: w, height: h, background: th.coverTo ?? th.ink, layers };
}

const luminance = (hex) => {
	const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
	const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const contrast = (a, b) => {
	const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
};
const onColor = (hex) => (contrast(hex, '#FFFFFF') >= contrast(hex, '#111111') ? '#FFFFFF' : '#111111');

/**
 * Colour sheet. `groups` is [{ title, swatches: [{ name, hex, token?, note? }] }];
 * each swatch shows its hex, its code token and its contrast against white.
 */
export function colorsPage({ groups, theme, name = '01 Colors', title = 'Color', intro }) {
	const s = sheet(name, { title, intro, theme });
	const th = theme;
	const cols = 4, gap = 28;
	const cw = (s.w - gap * (cols - 1)) / cols, ch = 230;
	let y = s.y;
	for (const g of groups) {
		s.add(text(g.title, s.x, y, { size: 26, weight: 700, color: th.ink, font: th.font, name: `group/${g.title}` }));
		y += 56;
		g.swatches.forEach((sw, i) => {
			const cx = s.x + (i % cols) * (cw + gap);
			const cy = y + Math.floor(i / cols) * (ch + gap);
			const fg = onColor(sw.hex);
			s.add(
				rect(cx, cy, cw, ch, { fill: th.paper, radius: 20, stroke: th.line, strokeWidth: 2, name: `swatch/${sw.name}/card` }),
				rect(cx, cy, cw, 140, { fill: sw.hex, radius: [20, 20, 0, 0], name: `swatch/${sw.name}`, ...(sw.hex.toUpperCase() === '#FFFFFF' || luminance(sw.hex) > 0.9 ? { stroke: th.line, strokeWidth: 2 } : {}) }),
				text(`${contrast(sw.hex, '#FFFFFF').toFixed(1)}:1 on white`, cx + 18, cy + 104, { size: 14, weight: 600, color: fg, font: th.font, name: `swatch/${sw.name}/contrast` }),
				text(sw.name, cx + 18, cy + 154, { size: 19, weight: 700, color: th.ink, font: th.font }),
				text([sw.hex.toUpperCase(), sw.token].filter(Boolean).join('   '), cx + 18, cy + 186, { size: 15, color: th.muted, font: th.mono ?? th.font })
			);
		});
		y += Math.ceil(g.swatches.length / cols) * (ch + gap) + 40;
	}
	return fit(s, y);
}

/** Type scale. `styles` is [{ name, size, weight, lineHeight?, sample?, usage?, font? }]. */
export function typographyPage({ styles, appFont, theme, name = '02 Typography', title = 'Typography', intro, scale = 2 }) {
	const s = sheet(name, { title, intro: intro ?? `${appFont} · sizes in dp, shown at ${scale}x`, theme });
	const th = theme;
	let y = s.y;
	for (const st of styles) {
		const sz = st.size * scale;
		const rowH = Math.max(lineBox(sz, st.lineHeight ?? 1.25) + 24, 96);
		s.add(
			text(st.name, s.x, y + 6, { size: 20, weight: 700, color: th.ink, font: th.font }),
			text(`${st.size} / w${st.weight}${st.usage ? `\n${st.usage}` : ''}`, s.x, y + 38, { size: 15, color: th.muted, font: th.font, lineHeight: 1.45 }),
			text(st.sample ?? 'Cucian bersih, wangi, rapi', s.x + 360, y, { size: sz, weight: st.weight, font: st.font ?? appFont, color: st.color ?? th.ink, lineHeight: st.lineHeight ?? 1.25, name: `type/${st.name}` }),
			line(s.x, y + rowH, s.x + s.w, y + rowH, { color: th.line, strokeWidth: 1 })
		);
		y += rowH + 28;
	}
	return fit(s, y);
}

/** Spacing and radius tokens, drawn to scale. */
export function spacingPage({ spacing = [], radii = [], theme, accent, name = '03 Spacing & Radius', title = 'Spacing & Radius', intro, scale = 3 }) {
	const s = sheet(name, { title, intro: intro ?? `Logical pixels (dp), drawn at ${scale}x`, theme });
	const th = theme;
	const ac = accent ?? th.accent;
	let y = s.y;
	s.add(text('Spacing', s.x, y, { size: 26, weight: 700, color: th.ink, font: th.font }));
	y += 60;
	for (const sp of spacing) {
		s.add(
			text(`${sp.value}`, s.x, y + 2, { size: 20, weight: 700, color: th.ink, font: th.font }),
			text(sp.usage ?? '', s.x + 80, y + 4, { size: 16, color: th.muted, font: th.font }),
			rect(s.x + 520, y, Math.max(2, sp.value * scale), 28, { fill: alpha(ac, 0.85), radius: 4, name: `spacing/${sp.value}` })
		);
		y += 52;
	}
	y += 40;
	s.add(text('Corner radius', s.x, y, { size: 26, weight: 700, color: th.ink, font: th.font }));
	y += 64;
	const box = 200;
	radii.forEach((r, i) => {
		const x = s.x + i * (box + 40);
		s.add(
			rect(x, y, box, box, { fill: th.panel, stroke: ac, strokeWidth: 3, radius: Math.min(box / 2, r.value * scale), name: `radius/${r.value}` }),
			text(`${r.value}`, x, y + box + 16, { size: 22, weight: 700, color: th.ink, font: th.font }),
			text(r.usage ?? '', x, y + box + 48, { size: 15, color: th.muted, font: th.font, lineHeight: 1.4 })
		);
	});
	y += box + 120;
	return fit(s, y);
}

/** Icon sheet: Material icon names on tiles. `icons` is [{ name, label?, style? }]. */
export function iconsPage({ icons, theme, color, tile = '#F3F4F6', style = 'filled', name = '04 Icons', title = 'Iconography', intro }) {
	const s = sheet(name, { title, intro, theme });
	const th = theme;
	const cols = 8, gap = 24;
	const cw = (s.w - gap * (cols - 1)) / cols;
	icons.forEach((ic, i) => {
		const x = s.x + (i % cols) * (cw + gap);
		const y = s.y + Math.floor(i / cols) * (cw + 72);
		s.add(
			rect(x, y, cw, cw, { fill: tile, radius: 24, name: `icon tile/${ic.name}` }),
			iconAt(ic.name, x + cw / 2, y + cw / 2, 64, color ?? th.ink, { style: ic.style ?? style, name: `icon/${ic.name}` }),
			textIn(ic.label ?? ic.name, { x, y: y + cw + 8, w: cw, h: 36 }, { size: 13, color: th.muted, font: th.font })
		);
	});
	return fit(s, s.y + Math.ceil(icons.length / cols) * (cw + 72));
}

/** Screens side by side inside phone bodies, for a flow or overview. */
export function flowPage({ screens, theme, name = '10 Screen Flow', title = 'Screens', intro, phoneW = 300, screenAspect = 844 / 390, gap = 90 }) {
	const th = theme;
	const phoneH = phoneW * screenAspect;
	const width = Math.max(SHEET_W, M * 2 + screens.length * phoneW + (screens.length - 1) * gap + 40);
	const s = sheet(name, { title, intro, theme });
	s.page.width = width;
	s.page.layers.find((l) => l.name === 'rule').x2 = width - M;
	screens.forEach((sc, i) => {
		const x = M + 20 + i * (phoneW + gap);
		s.add(phone(sc.page, x, s.y + 20, phoneW, phoneH, { radius: 36, label: sc.label ?? sc.page, labelColor: th.ink, font: th.font }));
		if (i < screens.length - 1) {
			const ay = s.y + 20 + phoneH / 2;
			s.add(iconAt('arrow_forward', x + phoneW + gap / 2, ay, 40, th.muted, { name: 'flow arrow' }));
		}
	});
	return fit(s, s.y + 20 + phoneH + 90);
}

/**
 * An exportable asset: a page sized exactly to one component, transparent
 * unless `background` is given. In ByteCanvas, File › Export on this page
 * produces the asset with nothing around it.
 */
export function assetPage(name, w, h, layers, { background = null, scale = 3 } = {}) {
	return { name, width: w, height: h, scale, background, layers: layers.flat() };
}

// ---- diagrams ------------------------------------------------------------------
// ByteCanvas's own diagram objects: library shapes whose label is part of the
// shape, and connectors stored as attachments to a shape's anchor, so moving a
// box in the app drags its lines along. Shape ids are the app's library
// (`SHAPES` below): flowchart, architecture, network, use case, device frames.

/** Every library shape id, by category — `SHAPES.flow`, `SHAPES.usecase`, … */
export const SHAPES = Object.fromEntries(CATEGORIES.map((c) => [c.id, SHAPE_LIBRARY.filter((s) => s.category === c.id).map((s) => s.id)]));

/** A library shape with its top-left at (x, y). Size defaults to the shape's own. */
export const shape = (shapeId, x, y, w, h, label = '', o = {}) => ({ type: 'diagram', shape: shapeId, x, y, w, h, label, ...o });

/**
 * A library shape centred on (cx, cy) with an `id` connectors can name — the
 * easy way to lay a flow out on a grid of centres. `o.w`/`o.h` override the
 * shape's default size.
 */
export function node(id, shapeId, label, cx, cy, o = {}) {
	const def = shapeDef(shapeId);
	if (!def) throw new Error(`unknown diagram shape "${shapeId}"`);
	// Even sizes keep a whole-pixel centre, so shapes centred on one row have
	// anchors on exactly one line — half a pixel off makes the router draw a jog.
	const even = (v) => Math.max(2, Math.round(v / 2) * 2);
	const w = even(o.w ?? def.defaultWidth), h = even(o.h ?? def.defaultHeight);
	return { type: 'diagram', id, shape: shapeId, label, ...o, x: cx - w / 2, y: cy - h / 2, w, h };
}

/**
 * A connector between two shapes (by `id`, or a unique label), each end
 * `'id'`, `'id.s'` (with an anchor: n e s w ne se sw nw) or a loose `{ x, y }`.
 * Options: `label`, `style` ('orthogonal' | 'straight'), `arrow` ('end' |
 * 'both' | 'none'), `lineStyle` ('solid' | 'dashed' | 'dotted'), `corner`
 * ('sharp' | 'rounded' | 'curved'), `bends` [{x,y}], `labelT` (0..1),
 * `labelOffset`, `stroke`, `strokeWidth`, `labelColor`, `fontSize`.
 */
export const connect = (from, to, o = {}) => ({ type: 'connector', from, to, ...o });

/**
 * Swimlanes: one band per actor/system, a header naming it, all in a group.
 * Horizontal lanes (the default) stack top to bottom with the flow running
 * left to right; vertical lanes sit side by side with the flow running down.
 * Headers are diagram shapes, so their names stay editable in the app; a
 * horizontal lane's header is a narrow band (< 60px) whose name the app turns
 * to run up it. Returns `{ layers, lane(nameOrIndex), at(nameOrIndex, along),
 * width, height }` — `lane()` is the body `{ x, y, w, h, cx, cy }` and
 * `at(lane, d)` the centre of the lane `d` units into the body along the flow.
 */
export function swimlanes({
	x = 0, y = 0, lanes, length, size = 170, header = 44, title, titleSize = 40,
	orientation = 'horizontal', fill = '#FFFFFF', altFill = '#F8FAFC', stroke = '#CBD5E1',
	headerFill = '#E2E8F0', headerStroke, labelColor = '#0F172A', fontSize = 15, font, weight = 700,
	name = 'Swimlanes'
}) {
	const names = lanes.map((l) => (typeof l === 'string' ? l : l.name));
	const sizes = lanes.map((l) => (typeof l === 'string' ? size : l.size ?? size));
	const horizontal = orientation !== 'vertical';
	const t = title ? titleSize : 0;
	const across = sizes.reduce((a, b) => a + b, 0);
	const head = { fill: headerFill, stroke: headerStroke ?? stroke, strokeWidth: 1.5, labelColor, fontSize, weight, ...(font ? { font } : {}) };
	const layers = [];
	const bodies = [];
	if (title) {
		layers.push(horizontal
			? shape('process', x, y, t, across, title, { ...head, name: `${name} / title` })
			: shape('process', x, y, across, t, title, { ...head, name: `${name} / title` }));
	}
	let off = 0;
	names.forEach((laneName, i) => {
		const s = sizes[i];
		const body = horizontal
			? { x: x + t + header, y: y + off, w: length - header - t, h: s }
			: { x: x + off, y: y + t + header, w: s, h: length - header - t };
		layers.push(horizontal
			? shape('process', x + t, y + off, header, s, laneName, { ...head, name: `${laneName} / header` })
			: shape('process', x + off, y + t, s, header, laneName, { ...head, name: `${laneName} / header` }));
		layers.push(rect(body.x, body.y, body.w, body.h, { fill: i % 2 ? altFill : fill, stroke, strokeWidth: 1.5, name: `${laneName} / lane` }));
		bodies.push({ ...body, cx: body.x + body.w / 2, cy: body.y + body.h / 2 });
		off += s;
	});
	const lane = (key) => {
		const i = typeof key === 'number' ? key : names.indexOf(key);
		if (!bodies[i]) throw new Error(`no swimlane "${key}" (lanes: ${names.join(', ')})`);
		return bodies[i];
	};
	return {
		layers: [group(name, layers)],
		lane,
		at: (key, along) => {
			const b = lane(key);
			return horizontal ? { x: b.x + along, y: b.cy } : { x: b.cx, y: b.y + along };
		},
		width: horizontal ? length : across,
		height: horizontal ? across : length
	};
}

/**
 * A plain diagram page at 1x: white, an optional title block, then `layers`
 * — whose coordinates are page pixels. Keep diagram pages at scale 1: label
 * sizes, the 60px swimlane-header rule and connector stubs are all in pixels.
 */
export function diagramPage(name, { width, height, title, subtitle, background = '#FFFFFF', font = 'Inter', ink = '#0F172A', muted = '#64748B' }, layers) {
	const head = [];
	if (title) head.push(text(title, 48, 40, { size: 30, weight: 800, color: ink, font, name: 'title' }));
	if (subtitle) head.push(text(subtitle, 48, 84, { size: 16, color: muted, font, name: 'subtitle' }));
	return { name, width, height, background, layers: [...head, ...layers.flat()] };
}

// ---- reuse ---------------------------------------------------------------------

const GEOM = ['x', 'y', 'w', 'h', 'x1', 'y1', 'x2', 'y2', 'size', 'strokeWidth', 'letterSpacing', 'width', 'fontSize', 'labelOffset'];
const XS = ['x', 'x1', 'x2'];
const YS = ['y', 'y1', 'y2'];

/**
 * Move and scale a set of layers as one — the way to reuse a component drawn
 * once in dp: on a screen at its real position (`scale: 1`), on a guideline
 * sheet at 2x, or alone on an asset page. Shadows, radii, dashes and type all
 * scale with it.
 */
export function place(layers, { x = 0, y = 0, scale = 1, prefix, clip, group: groupName } = {}) {
	const placed = layers.flat().map((l) => {
		// A group moves as its contents do; its name takes the prefix.
		if (l.type === 'group') {
			const g = { ...l, layers: place(l.layers, { x, y, scale, prefix, clip }) };
			if (prefix && g.name) g.name = `${prefix}/${g.name}`;
			return g;
		}
		const o = structuredClone(l);
		// A path's own scale carries the placement's, its x/y the offset.
		if (o.type === 'path') o.scale = (o.scale ?? 1) * scale;
		// A clip given here is in the layers' own coordinates, like everything else.
		if (clip && !o.clip) o.clip = { ...clip };
		for (const key of GEOM) if (typeof o[key] === 'number') o[key] *= scale;
		for (const key of XS) if (typeof o[key] === 'number') o[key] += x;
		for (const key of YS) if (typeof o[key] === 'number') o[key] += y;
		if (typeof o.radius === 'number') o.radius *= scale;
		else if (Array.isArray(o.radius)) o.radius = o.radius.map((r) => r * scale);
		if (Array.isArray(o.dash)) o.dash = o.dash.map((d) => d * scale);
		if (o.shadow) o.shadow = { ...o.shadow, blur: (o.shadow.blur ?? 8) * scale, distance: (o.shadow.distance ?? 4) * scale };
		if (o.clip) o.clip = { x: o.clip.x * scale + x, y: o.clip.y * scale + y, w: o.clip.w * scale, h: o.clip.h * scale };
		// A connector's turns and loose ends move with it; ends on shapes follow the shapes.
		if (Array.isArray(o.bends)) o.bends = o.bends.map((p) => ({ x: p.x * scale + x, y: p.y * scale + y }));
		for (const end of ['from', 'to']) if (o.type === 'connector' && typeof o[end]?.x === 'number') o[end] = { ...o[end], x: o[end].x * scale + x, y: o[end].y * scale + y };
		if (prefix && o.name) o.name = `${prefix}/${o.name}`;
		return o;
	});
	// `group: 'Button / Primary'` wraps the placed component in a named group.
	return groupName ? [group(groupName, placed)] : placed;
}
