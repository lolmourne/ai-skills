// The drawing in the example PRD, made with the bytecanvas skill.
//
//   node ~/.claude/skills/bytecanvas/scripts/build.mjs checkout-flow.mjs --png exports
//
// `exports/` then holds the PNG the document shows, and checkout-flow.bcanvas
// is the project behind it: the figure line in checkout-prd.md names both.

import { homedir } from 'node:os';
const k = await import(`${homedir()}/.claude/skills/bytecanvas/scripts/kit.mjs`);

const FONT = 'Inter';
// 780 wide: a full-width figure on A4 is shown at 602px, so this keeps labels
// readable there. Drawn at 1100, they would arrive at half their size.
const step = { fill: '#EEF2FF', stroke: '#4338CA', w: 110, h: 64 };
const ask = { fill: '#FEF3C7', stroke: '#B45309', labelColor: '#451A03', w: 118, h: 92 };
const done = { fill: '#DCFCE7', stroke: '#15803D', labelColor: '#052E16' };
const Y = 100;

const flow = k.diagramPage('Checkout flow', { width: 780, height: 210, font: FONT }, [
	k.node('cart', 'process', 'Cart', 70, Y, step),
	k.node('guest', 'decision', 'Signed in?', 225, Y, ask),
	k.node('details', 'process', 'Guest details', 390, Y, step),
	k.node('pay', 'process', 'Payment (3DS)', 540, Y, step),
	k.node('end', 'terminator', 'Done', 700, Y, { ...done, w: 90 }),
	k.connect('cart', 'guest'),
	k.connect('guest.e', 'details.w', { label: 'No' }),
	k.connect('details', 'pay'),
	k.connect('pay', 'end')
]);

export default { output: 'checkout-flow.bcanvas', pngDir: 'exports', defaults: { font: FONT }, pages: [flow] };
