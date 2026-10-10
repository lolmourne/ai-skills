// Vector geometry for the builder: scene shapes as ByteCanvas `VectorSpec`s.
//
// ByteCanvas keeps a vector layer as a bitmap plus the spec it was drawn from
// (see ../reference/format.md, "Vector layers"). For a generated layer to stay
// put the first time someone edits it in the app, the spec and the bitmap must
// agree exactly with how the app itself would draw them — so the geometry here
// (live shapes, stroke padding) is a port of the app's `src/lib/vector/path.ts`,
// and the painting in build.mjs is a port of its `paintVector`.
//
// Pure: no DOM, no Chrome. Coordinates are document pixels.

const KAPPA = 0.5522847498;

// ---- live shapes ----------------------------------------------------------------

/** Neighbouring radii that ask for more than their side shrink together (the CSS rule). */
export function fitRadii(radii, w, h) {
	const r = radii.map((v) => Math.max(0, v || 0));
	const [tl, tr, br, bl] = r;
	let f = 1;
	const check = (sum, side) => {
		if (sum > side && sum > 0) f = Math.min(f, side / sum);
	};
	check(tl + tr, w);
	check(br + bl, w);
	check(tl + bl, h);
	check(tr + br, h);
	return r.map((v) => v * f);
}

function rectPath(w, h, radii) {
	const [tl, tr, br, bl] = fitRadii(radii, w, h);
	const nodes = [];
	const corner = (x, y, r, inDir, outDir) => {
		if (r <= 0) {
			nodes.push({ x, y });
			return;
		}
		const k = r * KAPPA;
		const a = { x: x - inDir.x * r, y: y - inDir.y * r };
		const b = { x: x + outDir.x * r, y: y + outDir.y * r };
		nodes.push({ x: a.x, y: a.y, out: { x: a.x + inDir.x * k, y: a.y + inDir.y * k }, mode: 'smooth' });
		nodes.push({ x: b.x, y: b.y, in: { x: b.x - outDir.x * k, y: b.y - outDir.y * k }, mode: 'smooth' });
	};
	corner(0, 0, tl, { x: 0, y: -1 }, { x: 1, y: 0 });
	corner(w, 0, tr, { x: 1, y: 0 }, { x: 0, y: 1 });
	corner(w, h, br, { x: 0, y: 1 }, { x: -1, y: 0 });
	corner(0, h, bl, { x: -1, y: 0 }, { x: 0, y: -1 });
	return { closed: true, nodes };
}

function ellipsePath(w, h) {
	const rx = w / 2, ry = h / 2, kx = rx * KAPPA, ky = ry * KAPPA;
	return {
		closed: true,
		nodes: [
			{ x: rx, y: 0, in: { x: rx - kx, y: 0 }, out: { x: rx + kx, y: 0 }, mode: 'symmetric' },
			{ x: w, y: ry, in: { x: w, y: ry - ky }, out: { x: w, y: ry + ky }, mode: 'symmetric' },
			{ x: rx, y: h, in: { x: rx + kx, y: h }, out: { x: rx - kx, y: h }, mode: 'symmetric' },
			{ x: 0, y: ry, in: { x: 0, y: ry + ky }, out: { x: 0, y: ry - ky }, mode: 'symmetric' }
		]
	};
}

function radialPath(w, h, radii) {
	const n = radii.length;
	const raw = radii.map((r, i) => {
		const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
		return { x: Math.cos(a) * r, y: Math.sin(a) * r };
	});
	const xs = raw.map((p) => p.x), ys = raw.map((p) => p.y);
	const minX = Math.min(...xs), minY = Math.min(...ys);
	const sw = Math.max(...xs) - minX || 1, sh = Math.max(...ys) - minY || 1;
	return { closed: true, nodes: raw.map((p) => ({ x: ((p.x - minX) / sw) * w, y: ((p.y - minY) / sh) * h })) };
}

/** The outline the app draws for a live shape in a w × h box. */
export function liveShapePaths(shape, w, h) {
	if (shape.kind === 'rect') return [rectPath(w, h, shape.radii)];
	if (shape.kind === 'ellipse') return [ellipsePath(w, h)];
	if (shape.kind === 'polygon') {
		const sides = Math.round(Math.min(64, Math.max(3, shape.sides)));
		return [radialPath(w, h, new Array(sides).fill(1))];
	}
	const points = Math.round(Math.min(64, Math.max(3, shape.points)));
	const inner = Math.min(1, Math.max(0.01, shape.inner));
	const radii = [];
	for (let i = 0; i < points; i++) radii.push(1, inner);
	return [radialPath(w, h, radii)];
}

export const specPaths = (spec) => (spec.shape ? liveShapePaths(spec.shape, spec.width, spec.height) : spec.paths);

// ---- stroke padding: must match the app's `vectorPad` to the hundredth ---------------

function sharpestMiter(paths, limit) {
	let worst = 1;
	for (const path of paths) {
		const n = path.nodes.length;
		for (let i = 0; i < n; i++) {
			if (!path.closed && (i === 0 || i === n - 1)) continue;
			const node = path.nodes[i];
			const prev = path.nodes[(i - 1 + n) % n];
			const next = path.nodes[(i + 1) % n];
			const a = node.in ?? prev, b = node.out ?? next;
			const v1 = { x: a.x - node.x, y: a.y - node.y }, v2 = { x: b.x - node.x, y: b.y - node.y };
			const l1 = Math.hypot(v1.x, v1.y), l2 = Math.hypot(v2.x, v2.y);
			if (l1 < 1e-9 || l2 < 1e-9) continue;
			const theta = Math.acos(Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / (l1 * l2))));
			const s = Math.sin(theta / 2);
			if (s < 1e-6) continue;
			if (1 / s <= limit) worst = Math.max(worst, 1 / s);
		}
	}
	return worst;
}

export function vectorPad(spec) {
	if (!spec.stroke || spec.strokeWidth <= 0) return 0;
	const half = spec.strokeAlign === 'inside' ? 0 : spec.strokeAlign === 'outside' ? spec.strokeWidth : spec.strokeWidth / 2;
	if (half === 0) return 0;
	let factor = spec.lineCap === 'square' ? Math.SQRT2 : 1;
	if (spec.lineJoin === 'miter') factor = Math.max(factor, sharpestMiter(specPaths(spec), spec.miterLimit));
	const reach = half * factor;
	return reach > 0 ? Math.ceil(reach * 100) / 100 + 0.5 : 0;
}

export function vectorBox(spec) {
	const pad = vectorPad(spec);
	return { pad, width: Math.max(1, spec.width + pad * 2), height: Math.max(1, spec.height + pad * 2) };
}

// ---- bounds --------------------------------------------------------------------------

function segments(path) {
	const n = path.nodes.length;
	const out = [];
	for (let i = 0; i < (path.closed ? n : n - 1); i++) {
		const a = path.nodes[i], b = path.nodes[(i + 1) % n];
		out.push({ p0: a, c1: a.out ?? a, c2: b.in ?? b, p3: b, line: !a.out && !b.in });
	}
	return out;
}

function cubicAt(s, t) {
	const u = 1 - t;
	return {
		x: u * u * u * s.p0.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.p3.x,
		y: u * u * u * s.p0.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.p3.y
	};
}

function extremaT(p0, p1, p2, p3) {
	const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
	const out = [];
	if (Math.abs(a) < 1e-12) {
		if (Math.abs(b) > 1e-12) out.push(-c / b);
	} else {
		const d = b * b - 4 * a * c;
		if (d >= 0) out.push((-b + Math.sqrt(d)) / (2 * a), (-b - Math.sqrt(d)) / (2 * a));
	}
	return out.filter((t) => t > 0 && t < 1);
}

/** Exact bounds — curve extremes, not control points — as the app sizes a box. */
export function pathsBounds(paths) {
	let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
	const see = (p) => {
		x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
	};
	for (const path of paths) {
		for (const n of path.nodes) see(n);
		for (const s of segments(path)) {
			if (s.line) continue;
			for (const t of [...extremaT(s.p0.x, s.c1.x, s.c2.x, s.p3.x), ...extremaT(s.p0.y, s.c1.y, s.c2.y, s.p3.y)]) see(cubicAt(s, t));
		}
	}
	return x1 < x0 ? null : { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function mapPaths(paths, f) {
	return paths.map((p) => ({
		closed: p.closed,
		nodes: p.nodes.map((n) => {
			const o = { ...f(n) };
			if (n.in) o.in = f(n.in);
			if (n.out) o.out = f(n.out);
			if (n.mode) o.mode = n.mode;
			return o;
		})
	}));
}

// ---- SVG path data -----------------------------------------------------------------------

/** An elliptical arc as cubics (the SVG arc implementation notes, F.6). */
function arcToCubics(x1, y1, rx, ry, phi, large, sweep, x2, y2) {
	if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
	const sin = Math.sin(phi), cos = Math.cos(phi);
	const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
	const xp = cos * dx + sin * dy, yp = -sin * dx + cos * dy;
	rx = Math.abs(rx); ry = Math.abs(ry);
	const lam = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry);
	if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
	const sign = large === sweep ? -1 : 1;
	const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp;
	const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * yp * yp + ry * ry * xp * xp)));
	const cxp = (co * rx * yp) / ry, cyp = (-co * ry * xp) / rx;
	const cx = cos * cxp - sin * cyp + (x1 + x2) / 2, cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
	const ang = (ux, uy, vx, vy) => {
		const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
		return a;
	};
	const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
	let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
	if (!sweep && dt > 0) dt -= 2 * Math.PI;
	if (sweep && dt < 0) dt += 2 * Math.PI;
	const parts = Math.ceil(Math.abs(dt) / (Math.PI / 2));
	const out = [];
	const step = dt / parts;
	const k = (4 / 3) * Math.tan(step / 4);
	const pt = (t) => ({ x: cx + rx * Math.cos(t) * cos - ry * Math.sin(t) * sin, y: cy + rx * Math.cos(t) * sin + ry * Math.sin(t) * cos });
	const d = (t) => ({ x: -rx * Math.sin(t) * cos - ry * Math.cos(t) * sin, y: -rx * Math.sin(t) * sin + ry * Math.cos(t) * cos });
	for (let i = 0; i < parts; i++) {
		const a = t1 + i * step, b = a + step;
		const p0 = pt(a), p1 = pt(b), d0 = d(a), d1 = d(b);
		out.push([p0.x + k * d0.x, p0.y + k * d0.y, p1.x - k * d1.x, p1.y - k * d1.y, p1.x, p1.y]);
	}
	return out;
}

/**
 * SVG path data (`d`) as ByteCanvas paths: every command, relative and
 * absolute, arcs included. Quadratics become cubics, as the app stores them.
 */
export function parseSvgPath(d) {
	const tokens = String(d).match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
	const paths = [];
	let path = null;
	let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, lastCtrl = null, lastQuad = null;
	const num = () => {
		const v = Number(tokens[i++]);
		if (!Number.isFinite(v)) throw new Error(`path data: expected a number near "${tokens.slice(i - 2, i + 2).join(' ')}"`);
		return v;
	};
	const flag = () => {
		// Arc flags may be written without separators ("a5 5 0 011 1").
		const t = tokens[i];
		if (t === '0' || t === '1') { i++; return Number(t); }
		if (/^[01]/.test(t)) { tokens[i] = t.slice(1); return Number(t[0]); }
		return num();
	};
	const start = (px, py) => {
		path = { closed: false, nodes: [{ x: px, y: py }] };
		paths.push(path);
		sx = px; sy = py;
	};
	const lineTo = (px, py) => {
		if (!path) start(x, y);
		path.nodes.push({ x: px, y: py });
	};
	const curveTo = (c1x, c1y, c2x, c2y, px, py) => {
		if (!path) start(x, y);
		path.nodes[path.nodes.length - 1].out = { x: c1x, y: c1y };
		path.nodes.push({ x: px, y: py, in: { x: c2x, y: c2y } });
	};
	while (i < tokens.length) {
		if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
		else if (!cmd) throw new Error('path data must start with a command');
		const rel = cmd === cmd.toLowerCase();
		const ox = rel ? x : 0, oy = rel ? y : 0;
		switch (cmd.toUpperCase()) {
			case 'M': {
				x = num() + ox; y = num() + oy;
				start(x, y);
				// Further pairs after a moveto are linetos.
				cmd = rel ? 'l' : 'L';
				lastCtrl = lastQuad = null;
				break;
			}
			case 'L': x = num() + ox; y = num() + oy; lineTo(x, y); lastCtrl = lastQuad = null; break;
			case 'H': x = num() + ox; lineTo(x, y); lastCtrl = lastQuad = null; break;
			case 'V': y = num() + oy; lineTo(x, y); lastCtrl = lastQuad = null; break;
			case 'C': {
				const c1x = num() + ox, c1y = num() + oy, c2x = num() + ox, c2y = num() + oy;
				x = num() + ox; y = num() + oy;
				curveTo(c1x, c1y, c2x, c2y, x, y);
				lastCtrl = { x: c2x, y: c2y }; lastQuad = null;
				break;
			}
			case 'S': {
				const c1 = lastCtrl ? { x: 2 * x - lastCtrl.x, y: 2 * y - lastCtrl.y } : { x, y };
				const c2x = num() + ox, c2y = num() + oy;
				x = num() + ox; y = num() + oy;
				curveTo(c1.x, c1.y, c2x, c2y, x, y);
				lastCtrl = { x: c2x, y: c2y }; lastQuad = null;
				break;
			}
			case 'Q':
			case 'T': {
				const q = cmd.toUpperCase() === 'Q'
					? { x: num() + ox, y: num() + oy }
					: lastQuad ? { x: 2 * x - lastQuad.x, y: 2 * y - lastQuad.y } : { x, y };
				const px = num() + ox, py = num() + oy;
				curveTo(x + ((q.x - x) * 2) / 3, y + ((q.y - y) * 2) / 3, px + ((q.x - px) * 2) / 3, py + ((q.y - py) * 2) / 3, px, py);
				x = px; y = py; lastQuad = q; lastCtrl = null;
				break;
			}
			case 'A': {
				const rx = num(), ry = num(), rot = (num() * Math.PI) / 180, large = flag(), sweep = flag();
				const px = num() + ox, py = num() + oy;
				for (const c of arcToCubics(x, y, rx, ry, rot, large, sweep, px, py)) curveTo(...c);
				x = px; y = py; lastCtrl = lastQuad = null;
				break;
			}
			case 'Z': {
				if (path) {
					// A closing point on top of the first is the first point again.
					const first = path.nodes[0], last = path.nodes[path.nodes.length - 1];
					if (path.nodes.length > 1 && Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.y - last.y) < 1e-6) {
						if (last.in) first.in = last.in;
						path.nodes.pop();
					}
					path.closed = true;
				}
				x = sx; y = sy; path = null; lastCtrl = lastQuad = null;
				break;
			}
			default:
				throw new Error(`path data: unknown command "${cmd}"`);
		}
	}
	return paths.filter((p) => p.nodes.length >= 2);
}

// ---- scene layers as specs ---------------------------------------------------------------

const DEFAULTS = { strokeAlign: 'center', lineCap: 'butt', lineJoin: 'miter', miterLimit: 4, dash: [], fillRule: 'nonzero' };

/**
 * A scene layer as a vector spec, plus where its geometry's origin sits on the
 * page — or null for a layer that stays a picture (a gradient fill: a vector
 * layer's fill is one colour; the app's gradient overlay is the way to put a
 * gradient on a shape there).
 *
 * Rects and ellipses are stroked *inside* their box, as the builder always
 * drew them, so a stroked rect is still exactly w × h; paths and lines are
 * stroked on their centre line unless `strokeAlign` says otherwise.
 */
export function layerSpec(l) {
	if (l.gradient) return null;
	const base = (extra) => ({
		...DEFAULTS,
		fill: l.fill ?? null,
		stroke: l.stroke ?? null,
		strokeWidth: l.stroke ? (l.strokeWidth ?? 1) : (l.strokeWidth ?? 0),
		dash: Array.isArray(l.dash) ? l.dash : [],
		...(l.cap ? { lineCap: l.cap } : {}),
		...(l.join ? { lineJoin: l.join } : {}),
		...(l.strokeAlign ? { strokeAlign: l.strokeAlign } : {}),
		...(l.fillRule ? { fillRule: l.fillRule } : {}),
		...extra
	});
	switch (l.type) {
		case 'rect': {
			const r = Array.isArray(l.radius) ? l.radius : [l.radius ?? 0, l.radius ?? 0, l.radius ?? 0, l.radius ?? 0];
			return { spec: base({ width: l.w, height: l.h, paths: [], shape: { kind: 'rect', radii: r.map(Number) }, strokeAlign: l.strokeAlign ?? 'inside' }), x: l.x, y: l.y };
		}
		case 'ellipse':
			return { spec: base({ width: l.w, height: l.h, paths: [], shape: { kind: 'ellipse' }, strokeAlign: l.strokeAlign ?? 'inside' }), x: l.x, y: l.y };
		case 'polygon':
			return { spec: base({ width: l.w, height: l.h, paths: [], shape: { kind: 'polygon', sides: l.sides ?? 6 } }), x: l.x, y: l.y };
		case 'star':
			return { spec: base({ width: l.w, height: l.h, paths: [], shape: { kind: 'star', points: l.points ?? 5, inner: l.inner ?? 0.5 } }), x: l.x, y: l.y };
		case 'line': {
			const paths = [{ closed: false, nodes: [{ x: l.x1, y: l.y1 }, { x: l.x2, y: l.y2 }] }];
			return fitted(base({ paths, fill: null, stroke: l.color ?? '#000000', strokeWidth: l.strokeWidth ?? 1, lineCap: l.cap ?? 'round' }));
		}
		case 'path': {
			const raw = l.nodes ? structuredClone(l.nodes) : parseSvgPath(l.d ?? '');
			const s = l.scale ?? 1;
			const paths = mapPaths(Array.isArray(raw[0]?.nodes) ? raw : [{ closed: l.closed !== false, nodes: raw }], (p) => ({ x: p.x * s + (l.x ?? 0), y: p.y * s + (l.y ?? 0) }));
			if (!paths.length) throw new Error(`layer "${l.name ?? 'path'}": no path data`);
			return fitted(base({ paths, fill: l.fill === undefined && !l.stroke ? '#000000' : (l.fill ?? null) }));
		}
		default:
			return null;
	}
}

/** Free geometry moved so its bounds start at the origin, as the app keeps it. */
function fitted(spec) {
	const b = pathsBounds(spec.paths);
	if (!b) throw new Error('a path with no points');
	return {
		spec: { ...spec, width: b.width, height: b.height, paths: mapPaths(spec.paths, (p) => ({ x: p.x - b.x, y: p.y - b.y })) },
		x: b.x,
		y: b.y
	};
}

export const VECTOR_TYPES = new Set(['rect', 'ellipse', 'polygon', 'star', 'line', 'path']);
