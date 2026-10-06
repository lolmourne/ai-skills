// Wash2Shine / Clean Factory — design guideline + mock screens for ByteCanvas.
//
// Example scene (a real Flutter POS app: Clean Factory / Wash2Shine). Copy into the target
// project as design/bytecanvas/<name>-guideline.mjs and rewrite tokens, components and screens.
// Build:  node ~/.claude/skills/bytecanvas/scripts/build.mjs design/bytecanvas/wash2shine-guideline.mjs
// Output: design/bytecanvas/wash2shine-guideline.bcanvas  (+ PNGs in design/bytecanvas/exports/)
//
// Tokens are copied from lib/ui/theme.dart; component geometry from lib/ui/button.dart,
// lib/widgets/button_widget.dart, lib/widgets/main_scaffold.dart, lib/widgets/profilebar,
// lib/widgets/home/home_info.dart, lib/page/home.dart and lib/page/login.dart.
// Mock screens are in Flutter dp on a 390 x 844 viewport, rendered at 3x.

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
const k = await import(`${homedir()}/.claude/skills/bytecanvas/scripts/kit.mjs`);
const { rect, circle, text, icon, image, line, textIn, textMid, iconAt, boxShadow, alpha, place, approxWidth } = k;

// ---- tokens (lib/ui/theme.dart) ----------------------------------------------

const C = {
	primary: '#0A3D62', primaryLight: '#E4EAF1', primaryDark: '#062A44',
	success: '#37B67A', successLight: '#E7F8F0', successDark: '#1F7E52',
	warning: '#F9B04E', warningLight: '#FFF3DE', warningDark: '#C97F1E',
	danger: '#E74C3C', dangerLight: '#FCEAE8', dangerDark: '#B7352A',
	info: '#4A90E2', infoLight: '#EAF3FF', infoDark: '#2F6BB6',
	light: '#F7F8FA', dark: '#111111', surface: '#FFFFFF', border: '#DFE2E5',
	textPrimary: '#1A1A1A', textSecondary: '#6F7A83',
	deepNavy: '#04192B', field: '#F5F5F5', hint: '#A0AEC0', slate50: '#F1F5F9', slate200: '#E2E8F0'
};
const F = 'Roboto'; // no custom font in pubspec: Material default
const W = 390, H = 844, S = 3; // mock viewport (dp) and render scale
// The app's logo, relative to this file; the logo layers are skipped when it is not there.
/** A scroll view's content: Flutter clips it to the viewport, so the mock does too. */
const scrolled = (layers) => layers.map((l) => ({ ...l, clip: { x: 0, y: 0, w: W, h: H } }));

const LOGO_PATH = '../../assets/images/cf-logo.png';
const LOGO = existsSync(new URL(LOGO_PATH, import.meta.url)) ? LOGO_PATH : null;

const theme = k.defaultTheme({ font: 'Inter', accent: C.primary, ink: '#0F172A', coverFrom: C.primary, coverTo: C.deepNavy });

// ---- components, each drawn at (0, 0) in dp -----------------------------------

/** lib/ui/button.dart UIButton — solid / outline, three sizes. */
function uiButton(label, { variant = 'primary', outline = false, size = 'medium', iconName, iconAfter = false, w, disabled = false } = {}) {
	const base = { primary: C.primary, info: C.info, success: C.success, warning: C.warning, danger: C.danger }[variant];
	const dims = { small: [36, 12, 12.5, 16], medium: [44, 16, 13.5, 18], large: [50, 20, 15, 20] }[size];
	const [h, padX, fs, is] = dims;
	const fg = disabled ? (outline ? C.border : C.surface) : outline ? base : C.surface;
	const labelW = approxWidth(label, fs, 700);
	const contentW = labelW + (iconName ? is + 6 : 0);
	const bw = w ?? Math.ceil(contentW + padX * 2);
	const out = [
		rect(0, 0, bw, h, {
			name: 'background',
			radius: 10,
			...(outline ? { stroke: disabled ? C.border : base, strokeWidth: 1.5 } : { fill: disabled ? C.border : base })
		})
	];
	let x = (bw - contentW) / 2;
	if (iconName && !iconAfter) {
		out.push(iconAt(iconName, x + is / 2, h / 2, is, fg, { style: 'round' }));
		x += is + 6;
	}
	out.push(textMid(label, x, h / 2, { size: fs, weight: 700, color: fg, font: F }));
	if (iconName && iconAfter) out.push(iconAt(iconName, x + labelW + 6 + is / 2, h / 2, is, fg, { style: 'round' }));
	return out;
}

/** lib/widgets/button_widget.dart — the home-menu squircle tile with label. */
const TILE_W = 110; // about what a tile gets in the home grid; narrower clips "Permintaan Jemput"
function menuTile(label, iconName, bg, fg, { w = TILE_W, badge } = {}) {
	const sx = (w - 58) / 2;
	const out = [
		rect(sx, 8, 58, 58, { fill: bg, radius: 18, shadow: boxShadow({ color: bg, opacity: 0.35, blur: 10, dy: 4 }), name: 'squircle' }),
		iconAt(iconName, sx + 29, 8 + 29, 28, fg, { style: 'round' }),
		textIn(label, { x: 0, y: 8 + 58 + 8, w, h: 16 }, { size: 12, weight: 600, color: C.textPrimary, font: F })
	];
	if (badge) {
		const bx = sx + 58 - 16, by = 4;
		out.push(
			rect(bx, by, 22, 20, { fill: '#EF4444', radius: 10, stroke: '#FFFFFF', strokeWidth: 2, name: 'badge' }),
			textIn(String(badge), { x: bx, y: by, w: 22, h: 20 }, { size: 10.5, weight: 700, color: '#FFFFFF', font: F })
		);
	}
	return out;
}

/** The home menu tiles, as lib/page/home.dart lists them. */
const OPERATIONAL = [
	['Transaksi', 'receipt_long', C.infoLight, C.infoDark],
	['Logistik', 'local_shipping', C.warningLight, C.warningDark],
	['Permintaan Jemput', 'two_wheeler', C.successLight, C.successDark],
	['Pelanggan', 'people_alt', C.primaryLight, C.primary],
	['Chat', 'chat_bubble_outline', C.infoLight, C.info],
	['Komplain', 'support_agent', C.dangerLight, C.danger]
];
const MANAGEMENT = [
	['Laporan', 'bar_chart', C.primaryLight, C.primaryDark],
	['Absensi', 'fingerprint', C.warningLight, C.warning],
	['Pegawai', 'badge', C.successLight, C.success],
	['Settings', 'settings', C.light, C.textSecondary]
];

/** lib/ui/form.dart-style input, as the login page draws it (radius 14, prefix icon). */
function inputField(label, hint, iconName, { w = 294, suffix, focused = false } = {}) {
	return [
		text(label, 0, 0, { size: 13, weight: 600, color: C.textPrimary, font: F }),
		rect(0, 24, w, 52, { fill: C.surface, radius: 14, stroke: focused ? C.primary : C.border, strokeWidth: focused ? 1.8 : 1, name: 'field' }),
		iconAt(iconName, 24, 50, 20, C.primary, { style: 'round' }),
		textMid(hint, 48, 50, { size: 14, color: C.hint, font: F }),
		...(suffix ? [iconAt(suffix, w - 24, 50, 20, C.textSecondary, { style: 'outlined' })] : [])
	];
}

/** Status / tag chip. */
function chip(label, fg, bg, { iconName, size = 11, padX = 8, h = 22, radius = 6 } = {}) {
	const iw = iconName ? size + 4 + 4 : 0;
	const w = Math.ceil(approxWidth(label, size, 600) + padX * 2 + iw);
	return [
		rect(0, 0, w, h, { fill: bg, radius, name: 'chip' }),
		...(iconName ? [iconAt(iconName, padX + (size + 4) / 2, h / 2, size + 4, fg)] : []),
		textMid(label, padX + iw, h / 2, { size, weight: 600, color: fg, font: F })
	];
}
const chipWidth = (label, size = 11, padX = 8, iconName) => Math.ceil(approxWidth(label, size, 600) + padX * 2 + (iconName ? size + 8 : 0));

/** lib/widgets/main_scaffold.dart bottom bar (60dp + 34dp inset) with the centre FAB. */
function bottomNav(selected = 0) {
	const top = H - 94;
	const itemW = (W - 80) / 2;
	const item = (cx, ic, label, on) => [
		iconAt(ic, cx, top + 22, 24, on ? C.info : C.primaryLight, { style: 'round' }),
		textIn(label, { x: cx - 40, y: top + 38, w: 80, h: 14 }, { size: 11, weight: on ? 700 : 400, color: on ? C.info : C.primaryLight, font: F })
	];
	return [
		rect(0, top, W, 94, { fill: C.primaryDark, shadow: boxShadow({ opacity: 0.26, blur: 8, dy: -2 }), name: 'nav/bar' }),
		...item(itemW / 2, 'home', 'Home', selected === 0),
		...item(W - itemW / 2, 'qr_code_scanner', 'Scan', selected === 2),
		circle(W / 2, top - 18 + 32, 32, { fill: C.primaryDark, shadow: boxShadow({ opacity: 0.38, blur: 8, dy: 3 }), name: 'nav/fab ring' }),
		circle(W / 2, top - 18 + 32, 28, { fill: selected === 1 ? C.info : C.primary, name: 'nav/fab' }),
		iconAt('add', W / 2, top - 18 + 32, 38, '#FFFFFF', { style: 'round', name: 'nav/fab icon' }),
		k.homeIndicator(W, H, '#FFFFFF')
	];
}

/** lib/widgets/profilebar root header: user menu left, shop chip right. */
function profileBar({ user = 'Budi Santoso', shop = 'W2S Kemang', title } = {}) {
	const top = 47, h = 60, cy = top + h / 2;
	const out = [rect(0, 0, W, top + h, { fill: C.primary, shadow: boxShadow({ color: C.primaryDark, opacity: 0.25, blur: 10, dy: 3 }), name: 'appbar' }), ...k.statusBar(W, { font: F })];
	if (title) {
		out.push(iconAt('arrow_back', 30, cy, 24, '#FFFFFF', { style: 'round' }), textMid(title, 62, cy, { size: 17, weight: 700, color: '#FFFFFF', font: F }));
		return out;
	}
	const uw = approxWidth(user, 15.5, 700);
	const sw = Math.ceil(approxWidth(shop, 12.5, 600)) + 46;
	out.push(
		textMid(user, 16, cy, { size: 15.5, weight: 700, color: '#FFFFFF', font: F, letterSpacing: 0.1 }),
		iconAt('keyboard_arrow_down', 16 + uw + 14, cy, 18, '#FFFFFFB3', { style: 'round' }),
		rect(W - 16 - sw, cy - 16, sw, 32, { fill: alpha(C.primaryDark, 0.45), radius: 16, name: 'shop chip' }),
		iconAt('storefront', W - 16 - sw + 18, cy, 16, '#FFFFFF', { style: 'round' }),
		textMid(shop, W - 16 - sw + 32, cy, { size: 12.5, weight: 600, color: '#FFFFFF', font: F })
	);
	return out;
}

/** lib/widgets/home/home_info.dart summary panel. */
function homeInfoPanel(w = 358) {
	const out = [
		rect(0, 0, w, 216, { gradient: { angle: 135, stops: [[C.primaryDark, 0], [C.primary, 1]] }, radius: 24, shadow: boxShadow({ color: C.primaryDark, opacity: 0.35, blur: 16, dy: 6 }), name: 'panel' }),
		circle(w - 56, 64, 52, { fill: '#FFFFFF0A', name: 'decor' }),
		rect(20, 20, 150, 24, { fill: '#FFFFFF1F', radius: 20, stroke: '#FFFFFF2E', strokeWidth: 1, name: 'kicker pill' }),
		iconAt('auto_graph', 34, 32, 13, '#FFFFFFE6', { style: 'round' }),
		textMid('RINGKASAN HARI INI', 45, 32, { size: 10.5, weight: 700, color: '#FFFFFFE6', font: F, letterSpacing: 0.6 }),
		textMid('Diupdate 14:32', w - 140, 32, { size: 11.5, color: '#FFFFFFBF', font: F }),
		circle(w - 34, 32, 14, { fill: '#FFFFFF26' }),
		iconAt('refresh', w - 34, 32, 16, '#FFFFFF', { style: 'round' }),
		text('Pendapatan Hari Ini', 20, 60, { size: 13, color: '#FFFFFFCC', font: F }),
		text('Rp 2.450.000', 20, 80, { size: 26, weight: 700, color: '#FFFFFF', font: F })
	];
	const items = [['receipt_long', '42', 'Transaksi'], ['schedule', '18', 'Antrian'], ['local_laundry_service', '9', 'Dikerjakan']];
	const tw = (w - 40 - 16) / 3;
	items.forEach(([ic, v, label], i) => {
		const x = 20 + i * (tw + 8), y = 132;
		out.push(
			rect(x, y, tw, 64, { fill: '#FFFFFF1A', radius: 14, stroke: '#FFFFFF26', strokeWidth: 1 }),
			iconAt(ic, x + 22, y + 22, 16, '#FFFFFFD9', { style: 'round' }),
			textMid(v, x + 36, y + 22, { size: 16, weight: 700, color: '#FFFFFF', font: F }),
			textMid(label, x + 14, y + 46, { size: 11, color: '#FFFFFFCC', font: F })
		);
	});
	return out;
}

/** lib/page/home.dart quick POS card. */
function quickPosCard(w = 358) {
	return [
		rect(0, 0, w, 72, { gradient: { angle: 135, stops: [[C.primaryDark, 0], [C.primary, 1]] }, radius: 18, shadow: boxShadow({ color: C.primaryDark, opacity: 0.25, blur: 12, dy: 4 }), name: 'card' }),
		rect(18, 14, 44, 44, { fill: '#FFFFFF2E', radius: 12 }),
		iconAt('add_shopping_cart', 40, 36, 22, '#FFFFFF', { style: 'round' }),
		text('Mulai Transaksi Baru', 76, 17, { size: 15, weight: 700, color: '#FFFFFF', font: F }),
		text('Input pesanan laundry kiloan & satuan kasir', 76, 39, { size: 11.5, color: '#FFFFFFB3', font: F }),
		rect(w - 18 - 34, 19, 34, 34, { fill: '#FFFFFF2E', radius: 10 }),
		iconAt('arrow_forward_ios', w - 18 - 17, 36, 16, '#FFFFFF', { style: 'round' })
	];
}

/** lib/page/home.dart section card with a tile grid. */
function sectionCard(title, iconName, tag, tiles, perRow, w = 358) {
	const rows = Math.ceil(tiles.length / perRow);
	const gridH = rows * 98 + (rows - 1) * 12;
	const h = 16 + 22 + 14 + gridH + 16;
	const out = [
		rect(0, 0, w, h, { fill: C.surface, radius: 22, stroke: C.border, strokeWidth: 1, shadow: boxShadow({ opacity: 0.03, blur: 10, dy: 3 }), name: 'card' }),
		iconAt(iconName, 16 + 9, 27, 18, C.primary, { style: 'round' }),
		textMid(title, 42, 27, { size: 14.5, weight: 700, color: C.textPrimary, font: F }),
		...place(chip(tag, C.textSecondary, C.light, { radius: 8 }), { x: w - 16 - chipWidth(tag), y: 16 })
	];
	const tw = (w - 32) / perRow;
	tiles.forEach(([label, ic, bg, fg], i) => {
		out.push(...place(menuTile(label, ic, bg, fg, { w: tw, badge: label === 'Komplain' ? 3 : label === 'Chat' ? 12 : undefined }), { x: 16 + (i % perRow) * tw, y: 52 + Math.floor(i / perRow) * 110, prefix: label }));
	});
	return { layers: out, h };
}

/** lib/widgets/transaction/transaction_card.dart — one row of the list. */
function transactionCard({ inv, date, name, phone, member, total, paid, source, status }, w = 358) {
	const st = {
		queue: ['Antrian', 'hourglass_empty', '#448AFF'],
		wash: ['Dikerjakan', 'local_laundry_service', C.info],
		ready: ['Siap Diambil', 'access_time_filled', '#FFC107'],
		done: ['Selesai', 'check_circle', '#4CAF50']
	}[status];
	const out = [
		rect(0, 0, w, 128, { fill: C.surface, radius: 10, stroke: C.border, strokeWidth: 1, shadow: boxShadow({ opacity: 0.04, blur: 6, dy: 2 }), name: 'card' }),
		textMid(inv, 14, 22, { size: 11, color: C.textSecondary, font: F }),
		...place(chip(source === 'app' ? 'Aplikasi' : 'Antar Jemput', source === 'app' ? C.infoDark : '#FFFFFF', source === 'app' ? C.infoLight : C.warningDark, { iconName: source === 'app' ? 'phone_iphone' : 'local_shipping', size: 10, h: 20 }), { x: 14 + approxWidth(inv, 11) + 8, y: 12 }),
		iconAt('calendar_today', w - 14 - approxWidth(date, 11) - 10, 22, 12, C.textSecondary),
		textMid(date, w - 14 - approxWidth(date, 11), 22, { size: 11, color: C.textSecondary, font: F }),
		iconAt('person', 22, 52, 16, C.textSecondary),
		textMid(name, 36, 52, { size: 14, weight: 700, color: C.textPrimary, font: F }),
		iconAt('phone', 22, 74, 14, C.textSecondary),
		textMid(phone, 36, 74, { size: 12, color: C.textSecondary, font: F }),
		text(total, w - 14 - approxWidth(total, 14, 700), 44, { size: 14, weight: 700, color: C.textPrimary, font: F }),
		...place(chip(paid ? 'Lunas' : 'Belum Lunas', paid ? C.success : C.danger, paid ? C.successLight : C.dangerLight, { size: 10.5, h: 20 }), { x: w - 14 - chipWidth(paid ? 'Lunas' : 'Belum Lunas', 10.5), y: 66 }),
		line(14, 94, w - 14, 94, { color: C.border, strokeWidth: 1 }),
		iconAt(st[1], 24, 111, 16, st[2]),
		textMid(st[0], 38, 111, { size: 12, weight: 600, color: st[2], font: F }),
		textMid('Detail', w - 60, 111, { size: 12, weight: 600, color: C.primary, font: F }),
		iconAt('chevron_right', w - 20, 111, 18, C.primary, { style: 'round' })
	];
	if (member) {
		const mx = 36 + approxWidth(name, 14, 700) + 8;
		out.push(...place(chip('Member', C.infoDark, C.infoLight, { iconName: 'workspace_premium', size: 9.5, h: 18, radius: 4, padX: 6 }), { x: mx, y: 43 }));
	}
	return out;
}

// ---- screens -------------------------------------------------------------------

function loginScreen() {
	const L = [
		rect(0, 0, W, H, { gradient: { angle: 180, stops: [[C.deepNavy, 0], [C.primaryDark, 0.5], [C.primary, 1]] }, name: 'background' }),
		circle(W + 40 - 110, -60 + 110, 110, { fill: '#FFFFFF0A', name: 'decor/top right', bleed: true }),
		circle(-80 + 100, 120 + 100, 100, { fill: '#FFFFFF08', name: 'decor/left', bleed: true }),
		...k.statusBar(W, { font: F })
	];
	// Branding header, centred.
	const plateW = 48 * (800 / 381) + 36;
	L.push(
		rect((W - plateW) / 2, 92, plateW, 76, { fill: '#FFFFFF1F', radius: 20, stroke: '#FFFFFF33', strokeWidth: 1.5, shadow: boxShadow({ opacity: 0.15, blur: 16, dy: 6 }), name: 'logo plate' }),
		...(LOGO ? [image(LOGO, (W - plateW) / 2 + 18, 106, plateW - 36, 48, { fit: 'contain', name: 'logo' })] : []),
		textIn('CLEAN FACTORY', { x: 0, y: 184, w: W, h: 28 }, { size: 22, weight: 800, color: '#FFFFFF', font: F, letterSpacing: 2.5 }),
		textIn('POS & Operations System', { x: 0, y: 214, w: W, h: 18 }, { size: 13, weight: 500, color: '#FFFFFFB3', font: F, letterSpacing: 0.5 })
	);
	// Form card.
	const cx = 20, cy = 256, cw = W - 40, pad = 24;
	L.push(
		rect(cx, cy, cw, 470, { fill: C.surface, radius: 24, shadow: boxShadow({ opacity: 0.2, blur: 24, dy: 8 }), name: 'form card' }),
		text('Masuk Akun', cx + pad, cy + 28, { size: 20, weight: 700, color: C.textPrimary, font: F, letterSpacing: -0.5 }),
		text('Silakan masukkan email dan kata sandi Anda\nuntuk melanjutkan.', cx + pad, cy + 60, { size: 13, color: C.textSecondary, font: F, lineHeight: 1.4 }),
		...place(inputField('Email', 'nama@email.com', 'alternate_email', { w: cw - pad * 2, focused: true }), { x: cx + pad, y: cy + 118, prefix: 'email' }),
		...place(inputField('Kata Sandi', 'Masukkan kata sandi', 'lock_outline', { w: cw - pad * 2, suffix: 'visibility_off' }), { x: cx + pad, y: cy + 210, prefix: 'password' }),
		...place(uiButton('Masuk Sekarang', { size: 'large', iconName: 'arrow_forward', iconAfter: true, w: cw - pad * 2 }), { x: cx + pad, y: cy + 310, prefix: 'submit' }),
		rect(cx + pad, cy + 384, cw - pad * 2, 58, { fill: C.slate50, radius: 12, stroke: C.slate200, strokeWidth: 1, name: 'help box' }),
		iconAt('info_outline', cx + pad + 22, cy + 413, 18, alpha(C.primary, 0.8), { style: 'round' }),
		text('Lupa kata sandi atau akun bermasalah?\nHubungi administrator toko.', cx + pad + 40, cy + 396, { size: 11.5, color: C.textSecondary, font: F, lineHeight: 1.35 }),
		textIn('Clean Factory Indonesia • 1.0.10', { x: 0, y: cy + 470 + 20, w: W, h: 16 }, { size: 12, weight: 500, color: '#FFFFFF99', font: F }),
		k.homeIndicator(W, H, '#FFFFFF')
	);
	return { name: 'Screen / Login', width: W, height: H, scale: S, background: C.primaryDark, layers: L };
}

function homeScreen() {
	const L = [...profileBar()];
	L.push(...place(homeInfoPanel(), { x: 16, y: 119, prefix: 'summary' }));
	L.push(...place(quickPosCard(), { x: 16, y: 349, prefix: 'quick pos' }));
	const op = sectionCard('Operasional & Layanan', 'storefront', '6 Menu', OPERATIONAL, 3);
	L.push(...place(op.layers, { x: 16, y: 439, prefix: 'operasional' }));
	const mg = sectionCard('Manajemen Toko', 'analytics', '4 Menu', MANAGEMENT, 4);
	L.push(...scrolled(place(mg.layers, { x: 16, y: 439 + op.h + 18, prefix: 'manajemen' })));
	L.push(...bottomNav(0));
	return { name: 'Screen / Home', width: W, height: H, scale: S, background: C.light, layers: L };
}

function transactionListScreen() {
	const L = [...profileBar({ title: 'Daftar Transaksi' })];
	// Search + filter chips.
	L.push(
		rect(16, 123, W - 32, 46, { fill: C.surface, radius: 12, stroke: C.border, strokeWidth: 1, name: 'search' }),
		iconAt('search', 40, 146, 20, C.textSecondary, { style: 'round' }),
		textMid('Cari nama, no. HP, atau invoice', 60, 146, { size: 14, color: C.hint, font: F })
	);
	let fx = 16;
	[['Semua', true], ['Antrian'], ['Dikerjakan'], ['Siap Diambil'], ['Selesai']].forEach(([label, on]) => {
		const w = chipWidth(label, 12.5, 14);
		L.push(...scrolled(place(chip(label, on ? '#FFFFFF' : C.textSecondary, on ? C.primary : C.surface, { size: 12.5, padX: 14, h: 32, radius: 16 }), { x: fx, y: 181, prefix: `filter/${label}` })));
		if (!on) L.push(...scrolled([rect(fx, 181, w, 32, { stroke: C.border, strokeWidth: 1, radius: 16, name: `filter/${label}/border` })]));
		fx += w + 8;
	});
	const rows = [
		{ inv: 'INV-2610-0142', date: '02 Okt 2026', name: 'Rina Wijaya', phone: '0812-3456-7788', member: true, total: 'Rp 87.500', paid: true, source: 'app', status: 'wash' },
		{ inv: 'INV-2610-0141', date: '02 Okt 2026', name: 'Andi Pratama', phone: '0857-1122-3344', total: 'Rp 45.000', paid: false, source: 'pickup', status: 'queue' },
		{ inv: 'INV-2610-0139', date: '01 Okt 2026', name: 'Siti Rahma', phone: '0813-9988-7766', member: true, total: 'Rp 132.000', paid: true, source: 'app', status: 'ready' },
		{ inv: 'INV-2610-0137', date: '01 Okt 2026', name: 'Dewi Lestari', phone: '0821-4455-6677', total: 'Rp 60.000', paid: true, source: 'pickup', status: 'done' },
		{ inv: 'INV-2610-0133', date: '30 Sep 2026', name: 'Joko Susilo', phone: '0838-1234-5678', total: 'Rp 25.000', paid: false, source: 'app', status: 'done' }
	];
	rows.forEach((r, i) => L.push(...scrolled(place(transactionCard(r), { x: 16, y: 229 + i * 140, prefix: r.inv }))));
	L.push(...bottomNav(-1));
	return { name: 'Screen / Transaksi', width: W, height: H, scale: S, background: C.light, layers: L };
}

// ---- guideline sheets -----------------------------------------------------------

function componentsSheet() {
	const s = k.sheet('05 Components', { title: 'Components', intro: 'Drawn at 2x from lib/ui and lib/widgets. Each one also has its own page under "Asset /" for export.', theme });
	const Z = 2;
	let y = s.y;
	const heading = (t, note) => {
		s.add(text(t, s.x, y, { size: 26, weight: 700, color: theme.ink, font: theme.font }));
		if (note) s.add(text(note, s.x, y + 38, { size: 16, color: theme.muted, font: theme.mono ?? theme.font }));
		y += note ? 84 : 56;
	};

	heading('Buttons', 'UIButton(colorType, size) · radius 10 · bold label · outline border 1.5');
	const variants = ['primary', 'info', 'success', 'warning', 'danger'];
	for (const outline of [false, true]) {
		let x = s.x;
		for (const v of variants) {
			const label = v[0].toUpperCase() + v.slice(1);
			s.add(place(uiButton(label, { variant: v, outline, w: 120 }), { x, y, scale: Z, prefix: `button/${outline ? 'outline-' : ''}${v}` }));
			x += 120 * Z + 32;
		}
		y += 44 * Z + 28;
	}
	let x = s.x;
	for (const size of ['small', 'medium', 'large']) {
		const b = uiButton(`Simpan ${size}`, { size, iconName: 'check' });
		s.add(place(b, { x, y, scale: Z, prefix: `button/${size}` }));
		x += b[0].w * Z + 32;
	}
	s.add(place(uiButton('Disabled', { disabled: true, w: 120 }), { x, y, scale: Z, prefix: 'button/disabled' }));
	y += 50 * Z + 64;

	heading('Inputs', 'OutlineInputBorder radius 14 · border #DFE2E5 · focus 1.8 primary');
	s.add(place(inputField('Email', 'nama@email.com', 'alternate_email', { focused: true }), { x: s.x, y, scale: Z, prefix: 'input/focused' }));
	s.add(place(inputField('Kata Sandi', 'Masukkan kata sandi', 'lock_outline', { suffix: 'visibility_off' }), { x: s.x + 294 * Z + 48, y, scale: Z, prefix: 'input/default' }));
	y += 76 * Z + 64;

	heading('Menu tiles', 'ButtonWidget · 58 squircle radius 18 · icon 28 · label 12 w600 · tinted shadow');
	[...OPERATIONAL, ...MANAGEMENT].forEach(([label, ic, bg, fg], i) => {
		s.add(place(menuTile(label, ic, bg, fg, { badge: label === 'Komplain' ? 3 : undefined }), { x: s.x + (i % 6) * (TILE_W * Z + 4), y: y + Math.floor(i / 6) * (104 * Z + 16), scale: Z, prefix: `tile/${label}` }));
	});
	y += 2 * (104 * Z + 16) + 48;

	heading('Status chips', 'Status icon colours from transaction_card.dart; payment chips use semantic light/dark pairs');
	x = s.x;
	const chips = [['Lunas', C.success, C.successLight], ['Belum Lunas', C.danger, C.dangerLight], ['Member', C.infoDark, C.infoLight, 'workspace_premium'], ['Antar Jemput', '#FFFFFF', C.warningDark, 'local_shipping'], ['Aplikasi', C.infoDark, C.infoLight, 'phone_iphone'], ['6 Menu', C.textSecondary, C.light]];
	for (const [label, fg, bg, ic] of chips) {
		s.add(place(chip(label, fg, bg, { iconName: ic, size: 11 }), { x, y, scale: Z, prefix: `chip/${label}` }));
		x += chipWidth(label, 11, 8, ic) * Z + 24;
	}
	y += 22 * Z + 64;

	heading('Cards & navigation');
	s.add(place(quickPosCard(), { x: s.x, y, scale: Z, prefix: 'quick pos' }));
	s.add(place(transactionCard({ inv: 'INV-2610-0142', date: '02 Okt 2026', name: 'Rina Wijaya', phone: '0812-3456-7788', member: true, total: 'Rp 87.500', paid: true, source: 'app', status: 'wash' }), { x: s.x, y: y + 72 * Z + 40, scale: Z, prefix: 'transaction card' }));
	s.add(place(homeInfoPanel(), { x: s.x + 358 * Z + 48, y, scale: 1.4, prefix: 'summary panel' }));
	y += 72 * Z + 40 + 128 * Z + 48;
	s.add(place(bottomNav(0).filter((l) => l.name !== 'home indicator'), { x: s.x, y: y - (H - 112) * Z, scale: Z, prefix: 'bottom nav' }));
	y += 112 * Z + 40;
	return k.fit(s, y);
}

// ---- asset pages: one component per page, sized to it, for one-click export ----

function assets() {
	const pad = 12; // room for shadows
	const out = [];
	for (const [label, ic, bg, fg] of [...OPERATIONAL, ...MANAGEMENT]) {
		out.push(k.assetPage(`Asset / Tile / ${label}`, TILE_W + pad * 2, 98 + pad * 2, place(menuTile(label, ic, bg, fg), { x: pad, y: pad })));
	}
	for (const v of ['primary', 'success', 'danger']) {
		out.push(k.assetPage(`Asset / Button / ${v}`, 200, 50, uiButton('Masuk Sekarang', { variant: v, size: 'large', iconName: 'arrow_forward', iconAfter: true, w: 200 })));
	}
	out.push(k.assetPage('Asset / Quick POS card', 358 + pad * 2, 72 + pad * 2 + 8, place(quickPosCard(), { x: pad, y: pad })));
	out.push(k.assetPage('Asset / Summary panel', 358 + pad * 2 + 8, 216 + pad * 2 + 12, place(homeInfoPanel(), { x: pad + 4, y: pad })));
	out.push(k.assetPage('Asset / Bottom nav', W, 112, place(bottomNav(0), { y: -(H - 112) })));
	if (LOGO) out.push(k.assetPage('Asset / Logo on primary', 400, 190, [rect(0, 0, 400, 190, { fill: C.primary }), image(LOGO, 40, 20, 320, 150, { fit: 'contain', name: 'logo' })], { scale: 2 }));
	return out;
}

// ---- the document ---------------------------------------------------------------

export default {
	output: 'wash2shine-guideline.bcanvas',
	pngDir: 'exports',
	defaults: { font: F, iconStyle: 'round' },
	pages: [
		k.coverPage({ product: 'Clean Factory\nWash2Shine', subtitle: 'POS & Operations System — visual language,\ncomponents and screens of the staff app.', version: 'App 1.0.10', date: 'October 2026', theme, logo: LOGO ?? undefined, logoW: 252, logoH: 120, h: 1100 }),
		k.colorsPage({
			theme,
			intro: 'AppColors in lib/ui/theme.dart. Every semantic colour comes as a base, a light container and a dark on-container.',
			groups: [
				{ title: 'Brand', swatches: [
					{ name: 'Primary', hex: C.primary, token: 'AppColors.primary' },
					{ name: 'Primary Dark', hex: C.primaryDark, token: 'primaryDark' },
					{ name: 'Primary Light', hex: C.primaryLight, token: 'primaryLight' },
					{ name: 'Deep Navy', hex: C.deepNavy, token: 'login gradient' }
				] },
				...['success', 'warning', 'danger', 'info'].map((n) => ({
					title: n[0].toUpperCase() + n.slice(1),
					swatches: [
						{ name: n[0].toUpperCase() + n.slice(1), hex: C[n], token: `AppColors.${n}` },
						{ name: 'Light', hex: C[`${n}Light`], token: `${n}Light` },
						{ name: 'Dark', hex: C[`${n}Dark`], token: `${n}Dark` }
					]
				})),
				{ title: 'Neutrals', swatches: [
					{ name: 'Background', hex: C.light, token: 'AppColors.light' },
					{ name: 'Surface', hex: C.surface, token: 'surface' },
					{ name: 'Border', hex: C.border, token: 'border' },
					{ name: 'Field fill', hex: C.field, token: 'UITextFormField' },
					{ name: 'Text Primary', hex: C.textPrimary, token: 'textPrimary' },
					{ name: 'Text Secondary', hex: C.textSecondary, token: 'textSecondary' },
					{ name: 'Hint', hex: C.hint, token: 'hintStyle' },
					{ name: 'Dark', hex: C.dark, token: 'AppColors.dark' }
				] }
			]
		}),
		k.typographyPage({
			theme,
			appFont: F,
			intro: 'Roboto (Material default — pubspec declares no font). Sizes in dp, shown at 2x.',
			styles: [
				{ name: 'Display / amount', size: 26, weight: 700, sample: 'Rp 2.450.000', usage: 'Summary panel figure' },
				{ name: 'Brand wordmark', size: 22, weight: 800, sample: 'CLEAN FACTORY', usage: 'Login, letterSpacing 2.5' },
				{ name: 'Title', size: 20, weight: 700, sample: 'Masuk Akun', usage: 'Card titles' },
				{ name: 'App bar', size: 15.5, weight: 700, sample: 'Budi Santoso', usage: 'ProfileBar user name' },
				{ name: 'Section', size: 14.5, weight: 700, sample: 'Operasional & Layanan', usage: 'Section card header' },
				{ name: 'Body', size: 14, weight: 400, sample: 'Cucian bersih, wangi, rapi', usage: 'Inputs, list rows' },
				{ name: 'Button', size: 13.5, weight: 700, sample: 'Simpan Transaksi', usage: 'UIButton medium' },
				{ name: 'Caption', size: 13, weight: 400, sample: 'Silakan masukkan email dan kata sandi', usage: 'Helper text, lineHeight 1.4' },
				{ name: 'Label', size: 12, weight: 600, sample: 'Permintaan Jemput', usage: 'Menu tile label' },
				{ name: 'Micro', size: 10.5, weight: 700, sample: 'RINGKASAN HARI INI', usage: 'Kickers, badges' }
			]
		}),
		k.spacingPage({
			theme,
			accent: C.primary,
			spacing: [
				{ value: 4, usage: 'Icon ↔ caption, chip inner' },
				{ value: 8, usage: 'Tile padding, chip padding' },
				{ value: 12, usage: 'Grid row gap' },
				{ value: 16, usage: 'Screen gutter, card padding' },
				{ value: 18, usage: 'Between home sections' },
				{ value: 20, usage: 'Summary panel padding' },
				{ value: 24, usage: 'Form card padding' }
			],
			radii: [
				{ value: 6, usage: 'Status chip' },
				{ value: 10, usage: 'Buttons, list card' },
				{ value: 14, usage: 'Inputs, summary tiles' },
				{ value: 18, usage: 'Menu squircle' },
				{ value: 22, usage: 'Section card' },
				{ value: 24, usage: 'Hero panel, form card' }
			]
		}),
		k.iconsPage({
			theme,
			style: 'round',
			color: C.primary,
			tile: C.primaryLight,
			intro: 'Material Icons, Rounded variant (Icons.*_rounded) — names as in Flutter, minus the suffix.',
			icons: ['home', 'add', 'qr_code_scanner', 'receipt_long', 'local_shipping', 'two_wheeler', 'people_alt', 'chat_bubble_outline', 'support_agent', 'bar_chart', 'fingerprint', 'badge', 'settings', 'storefront', 'analytics', 'add_shopping_cart', 'local_laundry_service', 'water_drop', 'iron', 'scale', 'schedule', 'auto_graph', 'logout', 'trending_up'].map((name) => ({ name }))
		}),
		// Screens before anything that shows them as thumbnails.
		loginScreen(),
		homeScreen(),
		transactionListScreen(),
		componentsSheet(),
		k.flowPage({
			theme,
			name: '06 Screen Flow',
			title: 'Screens',
			intro: 'Mock screens at 390 × 844 dp. Each is its own page (1170 × 2532 px) — export it directly.',
			screens: [
				{ page: 'Screen / Login', label: 'Login' },
				{ page: 'Screen / Home', label: 'Home' },
				{ page: 'Screen / Transaksi', label: 'Daftar Transaksi' }
			]
		}),
		...assets()
	],
	// Extra crops of composed pages, exported to exports/slices/.
	slices: [
		{ name: 'home-summary-section', page: 'Screen / Home', x: 0, y: 107, w: 390, h: 324 },
		{ name: 'home-menu-operasional', page: 'Screen / Home', x: 8, y: 431, w: 374, h: 290 }
	]
};
