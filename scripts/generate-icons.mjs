// One-off placeholder icon generator. Produces flat zinc PNGs with a white
// plus mark so the PWA manifest has real, correctly-sized icons to point at.
// Replace the output with designed artwork when available.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const CRC_TABLE = (() => {
	const table = new Int32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		table[n] = c;
	}
	return table;
})();

function crc32(buf) {
	let c = 0xffffffff;
	for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(body));
	return Buffer.concat([len, body, crc]);
}

/** Encode an RGBA pixel buffer as a PNG. */
function encodePng(width, height, rgba) {
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // colour type: RGBA
	ihdr[10] = 0; // deflate
	ihdr[11] = 0; // adaptive filtering
	ihdr[12] = 0; // no interlace

	// Each scanline is prefixed with its filter byte (0 = None).
	const stride = width * 4;
	const raw = Buffer.alloc((stride + 1) * height);
	for (let y = 0; y < height; y++) {
		raw[y * (stride + 1)] = 0;
		rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
	}

	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/**
 * Dark rounded-square background with a white plus.
 * `inset` shrinks the artwork for maskable icons, which need a safe zone.
 */
function drawIcon(size, { inset = 0 } = {}) {
	const rgba = Buffer.alloc(size * size * 4);
	const bg = [9, 9, 11]; // zinc-950
	const mark = [250, 250, 250]; // zinc-50

	const pad = size * 0.06 + inset;
	const radius = size * 0.22;

	// Plus geometry: arm thickness and half-length.
	const arm = size * 0.1;
	const half = size * 0.28;

	for (let y = 0; y < size; y++) {
		for (let x = 0; x < size; x++) {
			const i = (y * size + x) * 4;

			// Rounded-rect background (signed distance against each corner).
			const cx = Math.min(Math.max(x, pad + radius), size - pad - radius);
			const cy = Math.min(Math.max(y, pad + radius), size - pad - radius);
			const dx = x - cx;
			const dy = y - cy;
			const outside = x < pad || y < pad || x >= size - pad || y >= size - pad;
			const inRound = !outside || Math.hypot(dx, dy) <= radius;

			if (!inRound) {
				rgba[i + 3] = 0; // transparent
				continue;
			}

			const inPlus =
				(Math.abs(x - size / 2) <= arm / 2 && Math.abs(y - size / 2) <= half) ||
				(Math.abs(y - size / 2) <= arm / 2 && Math.abs(x - size / 2) <= half);

			const [r, g, b] = inPlus ? mark : bg;
			rgba[i] = r;
			rgba[i + 1] = g;
			rgba[i + 2] = b;
			rgba[i + 3] = 255;
		}
	}

	return encodePng(size, size, rgba);
}

const targets = [
	['static/favicon.png', 64, {}],
	['static/icons/icon-192.png', 192, {}],
	['static/icons/icon-512.png', 512, {}],
	// Maskable icons are cropped aggressively, so the mark is inset further.
	['static/icons/icon-maskable-512.png', 512, { inset: 512 * 0.1 }]
];

for (const [path, size, opts] of targets) {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, drawIcon(size, opts));
	console.log(`wrote ${path} (${size}x${size})`);
}
