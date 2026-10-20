// Payment approval, drawn three ways with ByteCanvas's own diagram objects:
// a flowchart, a use case diagram and a swimlane. Every box is a library
// shape with its label inside it and every line a connector attached to its
// shapes' anchors, so in the app a dragged box takes its lines with it and a
// double-click edits the words.
//
//   node ~/.claude/skills/bytecanvas/scripts/build.mjs payment-approval-diagrams.mjs --png exports
//
// In a real request the steps, actors and thresholds come from the code
// (the approval service, its states and its role checks), not from here.

import { homedir } from 'node:os';
const k = await import(`${homedir()}/.claude/skills/bytecanvas/scripts/kit.mjs`);

const FONT = 'Inter';
const C = {
	process: { fill: '#EEF2FF', stroke: '#4338CA' },
	decision: { fill: '#FEF3C7', stroke: '#B45309', labelColor: '#451A03' },
	terminal: { fill: '#DCFCE7', stroke: '#15803D', labelColor: '#052E16' },
	reject: { fill: '#FEE2E2', stroke: '#B91C1C', labelColor: '#450A0A' },
	data: { fill: '#E0F2FE', stroke: '#0369A1', labelColor: '#082F49' }
};
const yes = { label: 'Yes', labelColor: '#15803D' };
const no = { label: 'No', labelColor: '#B91C1C' };

// ---- 1. Flowchart ---------------------------------------------------------------

const X = 430; // the main column
const flow = k.diagramPage('Payment Approval / Flowchart', {
	width: 1060, height: 1560, font: FONT,
	title: 'Payment approval — flowchart',
	subtitle: 'From request to payout; amounts over Rp 10.000.000 need the finance manager.'
}, [
	k.node('start', 'terminator', 'Start', X, 170, C.terminal),
	k.node('submit', 'manual-input', 'Submit payment request', X, 280, { ...C.data, w: 200 }),
	k.node('validate', 'process', 'Validate request\n(budget, vendor, docs)', X, 400, { ...C.process, w: 200, h: 76 }),
	k.node('valid', 'decision', 'Valid?', X, 530, C.decision),
	k.node('amount', 'decision', 'Amount >\nRp 10 jt?', X, 680, { ...C.decision, w: 170, h: 110 }),
	k.node('supervisor', 'process', 'Supervisor approval', 250, 820, C.process),
	k.node('finance', 'process', 'Finance manager approval', 610, 820, { ...C.process, w: 190 }),
	k.node('approved', 'decision', 'Approved?', X, 960, C.decision),
	k.node('pay', 'process', 'Execute payment', X, 1100, C.process),
	k.node('ledger', 'document', 'Record in ledger', X, 1220, C.data),
	k.node('notify', 'process', 'Notify requester', X, 1340, C.process),
	k.node('end', 'terminator', 'End', X, 1450, C.terminal),
	k.node('reject', 'process', 'Reject & notify requester', 860, 960, { ...C.reject, w: 190 }),
	k.node('end2', 'terminator', 'End', 860, 1100, C.terminal),

	k.connect('start', 'submit'),
	k.connect('submit', 'validate'),
	k.connect('validate', 'valid'),
	k.connect('valid.s', 'amount.n', yes),
	k.connect('valid.e', 'reject.n', no),
	k.connect('amount.w', 'supervisor.n', { label: '≤ 10 jt' }),
	k.connect('amount.e', 'finance.n', { label: '> 10 jt' }),
	k.connect('supervisor.s', 'approved.n'),
	k.connect('finance.s', 'approved.n'),
	k.connect('approved.s', 'pay.n', yes),
	k.connect('approved.e', 'reject.w', no),
	k.connect('pay', 'ledger'),
	k.connect('ledger', 'notify'),
	k.connect('notify', 'end'),
	k.connect('reject', 'end2')
]);

// ---- 2. Use case diagram ----------------------------------------------------------

const UC = { w: 220, h: 84, fill: '#FFFFFF', stroke: '#4338CA' };
const assoc = { arrow: 'none', style: 'straight', stroke: '#475569' };
const dep = (label) => ({ label, lineStyle: 'dashed', style: 'straight', stroke: '#7C3AED', labelColor: '#6D28D9' });
const useCase = k.diagramPage('Payment Approval / Use Cases', {
	width: 1420, height: 940, font: FONT,
	title: 'Payment approval — use cases',
	subtitle: 'Who does what; «include» is always part of the base case, «extend» only sometimes.'
}, [
	k.shape('boundary', 270, 140, 880, 760, 'Payment Approval System', { fill: '#F8FAFC', stroke: '#334155', labelColor: '#0F172A', fontSize: 16, name: 'System boundary' }),
	k.node('requester', 'actor', 'Requester', 120, 330),
	k.node('spv', 'actor', 'Supervisor', 120, 680),
	k.node('fm', 'actor', 'Finance Manager', 1300, 330),
	k.node('gw', 'actor', 'Payment Gateway\n«system»', 1300, 680),

	k.node('uc-submit', 'use-case', 'Submit payment request', 480, 300, UC),
	k.node('uc-track', 'use-case', 'Track request status', 480, 440, UC),
	k.node('uc-review', 'use-case', 'Review request', 480, 620, UC),
	k.node('uc-decide', 'use-case', 'Approve / reject request', 480, 780, UC),
	k.node('uc-validate', 'use-case', 'Validate request', 900, 300, UC),
	k.node('uc-high', 'use-case', 'Approve high-value payment', 900, 470, UC),
	k.node('uc-pay', 'use-case', 'Execute payment', 900, 630, UC),
	k.node('uc-notify', 'use-case', 'Send notification', 900, 790, UC),

	k.connect('requester', 'uc-submit', assoc),
	k.connect('requester', 'uc-track', assoc),
	k.connect('spv', 'uc-review', assoc),
	k.connect('spv', 'uc-decide', assoc),
	k.connect('fm', 'uc-high', assoc),
	k.connect('fm', 'uc-pay', assoc),
	k.connect('gw', 'uc-pay', assoc),
	k.connect('uc-submit', 'uc-validate', dep('«include»')),
	k.connect('uc-high.sw', 'uc-decide.ne', dep('«extend»')),
	k.connect('uc-decide', 'uc-notify', dep('«include»'))
]);

// ---- 3. Swimlane ------------------------------------------------------------------

const lanes = k.swimlanes({
	x: 48, y: 130, length: 1800, size: 150, header: 44, font: FONT,
	lanes: ['Requester', 'System', 'Supervisor', 'Finance']
});
const at = (lane, along, id, shapeId, label, o) => {
	const p = lanes.at(lane, along);
	return k.node(id, shapeId, label, p.x, p.y, o);
};
const P = { ...C.process, w: 150, h: 64, fontSize: 13 };
const D = { ...C.decision, w: 120, h: 84, fontSize: 13 };
const swim = k.diagramPage('Payment Approval / Swimlane', {
	width: 1900, height: 800, font: FONT,
	title: 'Payment approval — swimlane',
	subtitle: 'The same flow, by who acts at each step.'
}, [
	lanes.layers,
	at('Requester', 90, 's-start', 'terminator', 'Start', { ...C.terminal, w: 100, h: 48, fontSize: 13 }),
	at('Requester', 260, 's-submit', 'process', 'Submit request', P),
	at('System', 440, 's-validate', 'process', 'Validate request', P),
	at('System', 620, 's-valid', 'decision', 'Valid?', D),
	at('Supervisor', 800, 's-review', 'process', 'Review request', P),
	at('Supervisor', 980, 's-approved', 'decision', 'Approved?', D),
	at('Finance', 1160, 's-pay', 'process', 'Execute payment', P),
	at('System', 1340, 's-record', 'process', 'Record & notify', P),
	at('Requester', 1520, 's-receive', 'process', 'Receive outcome', P),
	at('Requester', 1680, 's-end', 'terminator', 'End', { ...C.terminal, w: 100, h: 48, fontSize: 13 }),

	k.connect('s-start', 's-submit'),
	k.connect('s-submit.s', 's-validate.w'),
	k.connect('s-validate', 's-valid'),
	k.connect('s-valid.n', 's-submit.e', { ...no, label: 'No — fix & resubmit' }),
	k.connect('s-valid.e', 's-review.n', yes),
	k.connect('s-review', 's-approved'),
	k.connect('s-approved.e', 's-pay.n', yes),
	k.connect('s-approved.n', 's-record.w', { ...no, label: 'No — rejected' }),
	k.connect('s-pay.e', 's-record.s'),
	k.connect('s-record.n', 's-receive.s'),
	k.connect('s-receive', 's-end')
]);

export default {
	output: 'payment-approval-diagrams.bcanvas',
	pngDir: 'exports',
	defaults: { font: FONT },
	pages: [flow, useCase, swim]
};
