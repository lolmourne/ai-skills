#!/usr/bin/env node
// Check a `.bcanvas` file the way ByteCanvas will when it opens it.
//
//   node validate.mjs <file.bcanvas> [--repo <path to bytecanvas checkout>]
//
// Always runs the standalone checks (header, manifest, image table bounds, PNG
// signatures and sizes, layer → image references). When the ByteCanvas repo is
// found it also runs the file through the app's own `unpackProject` and
// `restoreDocument`, which is the authoritative answer.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const ri = args.indexOf('--repo');
const repoArg = ri >= 0 ? args.splice(ri, 2)[1] : undefined;
const file = args[0];
if (!file) {
	console.error('usage: node validate.mjs <file.bcanvas> [--repo path]');
	process.exit(2);
}

const buf = readFileSync(file);
const problems = [];
const fail = (m) => problems.push(m);

if (buf.subarray(0, 8).toString('ascii') !== 'BYTECNVS') fail('bad magic');
const version = buf.readUInt32LE(8);
const n = buf.readUInt32LE(12);
if (version !== 1) fail(`unexpected format version ${version}`);
if (16 + n > buf.length) fail('manifest runs past the end of the file');
const manifest = JSON.parse(buf.subarray(16, 16 + n).toString('utf8'));
const imageSection = buf.subarray(16 + n);

if (manifest.app !== 'ByteCanvas') fail('manifest.app is not "ByteCanvas"');
manifest.images.forEach((img, i) => {
	if (img.offset + img.length > imageSection.length) return fail(`image ${i} is outside the file`);
	const png = imageSection.subarray(img.offset, img.offset + img.length);
	if (png.readUInt32BE(0) !== 0x89504e47) return fail(`image ${i} is not a PNG`);
	const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
	if (w !== img.width || h !== img.height) fail(`image ${i} is ${w}x${h} but the table says ${img.width}x${img.height}`);
});
const ids = new Set();
let layerCount = 0;
manifest.pages.forEach((p, pi) => {
	if (!(p.width >= 1 && p.height >= 1)) fail(`page ${pi + 1} has no size`);
	for (const l of p.layers) {
		layerCount++;
		if (ids.has(l.id)) fail(`duplicate layer id ${l.id}`);
		ids.add(l.id);
		if (!(l.image >= 0 && l.image < manifest.images.length)) fail(`layer "${l.name}" points at a missing image`);
		else {
			const img = manifest.images[l.image];
			if (img.width !== l.width || img.height !== l.height) fail(`layer "${l.name}" size ${l.width}x${l.height} differs from its image ${img.width}x${img.height}`);
		}
		for (const k of ['x', 'y', 'scaleX', 'scaleY', 'rotation']) {
			if (!Number.isFinite(l.transform?.[k])) fail(`layer "${l.name}" transform.${k} is not a number`);
		}
		if (l.vector) {
			const v = l.vector;
			if (!Number.isFinite(v.width) || !Number.isFinite(v.height)) fail(`layer "${l.name}" vector has no size`);
			const bad = (v.paths ?? []).some((p) => p.nodes.some((n) => ![n.x, n.y, n.in?.x ?? 0, n.in?.y ?? 0, n.out?.x ?? 0, n.out?.y ?? 0].every(Number.isFinite)));
			// The app drops a node with a bad number on open, silently changing the shape.
			if (bad) fail(`layer "${l.name}" vector has a point that is not a number`);
			if (!v.shape && !(v.paths ?? []).length) fail(`layer "${l.name}" vector has neither a shape nor paths`);
		}
	}
	// Groups: every reference resolves, and each group's layers sit together —
	// the app regroups a split group on open, which reorders the stack.
	const groups = new Map((p.groups ?? []).map((g) => [g.id, g]));
	for (const l of p.layers) if (l.groupId && !groups.has(l.groupId)) fail(`layer "${l.name}" names a missing group`);
	for (const g of groups.values()) if (g.parentId && !groups.has(g.parentId)) fail(`group "${g.name}" names a missing parent`);
	const inside = (l, gid) => {
		for (let id = l.groupId, n = 0; id && n < 64; id = groups.get(id)?.parentId, n++) if (id === gid) return true;
		return false;
	};
	for (const g of groups.values()) {
		const at = p.layers.map((l, i) => (inside(l, g.id) ? i : -1)).filter((i) => i >= 0);
		if (!at.length) fail(`group "${g.name}" has no layers (the app drops it)`);
		else if (at[at.length - 1] - at[0] + 1 !== at.length) fail(`group "${g.name}" is split by layers outside it`);
	}
});

console.log(`${file}: ${manifest.pages.length} pages, ${layerCount} layers, ${manifest.images.length} images, ${(buf.length / 1048576).toFixed(2)} MB`);
for (const p of manifest.pages) {
	const vectors = p.layers.filter((l) => l.vector).length;
	const extra = [vectors && `${vectors} vector`, p.groups?.length && `${p.groups.length} group${p.groups.length === 1 ? '' : 's'}`].filter(Boolean).join(', ');
	console.log(`  - ${p.name} (${p.width}x${p.height}, ${p.layers.length} layers${extra ? `; ${extra}` : ''})`);
}

// The app's own reader, when its source is on this machine.
const repo = [repoArg, process.env.BYTECANVAS_REPO, join(homedir(), 'Documents/projects/js/bytecanvas')]
	.filter(Boolean)
	.map((r) => resolve(r))
	.find((r) => existsSync(join(r, 'src/lib/project/format.ts')));
if (repo) {
	const script = `
		import { readFileSync } from 'node:fs';
		const { unpackProject, restoreDocument } = await import(${JSON.stringify(pathToFileURL(join(repo, 'src/lib/project/format.ts')).href)});
		const { manifest, images } = unpackProject(new Uint8Array(readFileSync(${JSON.stringify(resolve(file))})));
		const doc = restoreDocument(manifest, images.map((_, i) => ({ i })));
		console.log('  ByteCanvas reader: OK (' + doc.pages.length + ' pages)');
	`;
	const r = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', join(repo, 'tests/register.mjs'), '--input-type=module', '-e', script], { cwd: repo, encoding: 'utf8' });
	if (r.status === 0) process.stdout.write(r.stdout);
	else fail(`ByteCanvas reader rejected the file: ${(r.stderr || r.stdout).trim().split('\n').slice(-3).join(' ')}`);
} else {
	console.log('  (ByteCanvas repo not found — skipped the app-reader check)');
}

if (problems.length) {
	console.error('INVALID:\n  ' + problems.join('\n  '));
	process.exit(1);
}
console.log('valid');
