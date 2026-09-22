#!/usr/bin/env node
/**
 * seed-dummy.mjs — emulates a shopper tapping random items into SuperCalc.
 *
 * Reads `scripts/data.csv`, draws a random set of distinct products, and types
 * each one into the running app through the REAL UI (price / qty / label fields
 * and the `+ Add Item` button). Nothing is written to localStorage, the store,
 * or any source file — every row goes through the app's own validation,
 * rounding, label truncation, category resolution and persistence, exactly as a
 * human tap would. That is the whole point: a tape seeded any other way proves
 * nothing about the entry path.
 *
 * Usage:
 *   node scripts/seed-dummy.mjs                 # 15 items into localhost:4173
 *   node scripts/seed-dummy.mjs -n 25           # 25 items
 *   node scripts/seed-dummy.mjs --seed 12345    # reproducible draw
 *   node scripts/seed-dummy.mjs --append        # keep the existing tape
 *   node scripts/seed-dummy.mjs --dry-run       # print the draw, touch nothing
 *   node scripts/seed-dummy.mjs --headless      # no visible window
 *   node scripts/seed-dummy.mjs --base /super   # Pages-style sub-path build
 *
 * Requires the preview server to be up: `npm run preview`.
 * Reuses your installed Google Chrome (playwright-core, no bundled download).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const CSV_PATH = resolve(HERE, 'data.csv');

/*
 * A PERSISTENT profile directory, not a throwaway context. The app keeps its
 * tape in localStorage, which is per-profile — a fresh context would start
 * empty on every run, silently making `--append` a no-op and the reset guard
 * never fire. Persisting the profile makes this behave like a browser the user
 * actually uses: the tape survives between runs, so both modes are real.
 * (Gitignored — it's disposable state, not a fixture.)
 */
const PROFILE_DIR = resolve(ROOT, '.seed-profile');

// --- Options ----------------------------------------------------------------

function parseArgs(argv) {
	const opts = {
		count: 15,
		url: 'http://localhost:4173',
		base: '',
		headless: false,
		append: false,
		dryRun: false,
		seed: null,
		timeout: 15000
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		const next = () => argv[++i];
		switch (arg) {
			case '-n':
			case '--count':
				opts.count = Number(next());
				break;
			case '--url':
				opts.url = next();
				break;
			case '--base':
				opts.base = next();
				break;
			case '--seed':
				opts.seed = Number(next());
				break;
			case '--timeout':
				opts.timeout = Number(next());
				break;
			case '--headless':
				opts.headless = true;
				break;
			case '--append':
				opts.append = true;
				break;
			case '--dry-run':
				opts.dryRun = true;
				break;
			case '-h':
			case '--help':
				printHelp();
				process.exit(0);
			default:
				fail(`Unknown option: ${arg}\nRun with --help for usage.`);
		}
	}

	if (!Number.isInteger(opts.count) || opts.count < 1) {
		fail(`--count must be a positive integer (got ${opts.count}).`);
	}
	return opts;
}

function printHelp() {
	console.log(`
seed-dummy.mjs — seed the SuperCalc tape with random rows from scripts/data.csv

Options:
  -n, --count <n>     how many items to add (default 15)
      --url <url>     app origin (default http://localhost:4173)
      --base <path>   sub-path, e.g. /super for a BASE_PATH build
      --seed <n>      reproducible draw + quantities
      --append        keep the existing tape (default: clear it first)
      --dry-run       print the draw and exit without opening a browser
      --headless      run Chrome without a visible window
      --timeout <ms>  per-action timeout (default 15000)
  -h, --help          show this message
`);
}

function fail(message) {
	console.error(`\n✖ ${message}\n`);
	process.exit(1);
}

// --- Randomness -------------------------------------------------------------

/** mulberry32 — small deterministic PRNG so --seed makes runs comparable. */
function makeRandom(seed) {
	let state = seed >>> 0;
	return function random() {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function shuffled(array, random) {
	const out = array.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

// --- CSV parsing ------------------------------------------------------------

/*
 * `Monto` is quoted whenever it contains thousands separators ("1,440") and bare
 * otherwise (532) — about 650 of 895 rows are quoted. A naive split(',') or
 * `cut -d,` therefore corrupts the majority of rows, so match from the right
 * with alternates that accept either a quoted or a bare final field.
 */
const ROW_RE = /^[^,]*,([^,]*),([^,]*),(?:"([^"]*)"|([^,]*)),(?:"([^"]*)"|(.+))$/;

function parseCsv(text) {
	const lines = text.trim().split(/\r?\n/);
	const header = lines[0].trim();
	if (header !== 'Fecha,Persona,Comercio,Descripcion,Monto') {
		fail(`Unexpected CSV header:\n  ${header}\nExpected "Fecha,Persona,Comercio,Descripcion,Monto".`);
	}

	const rows = [];
	for (const line of lines.slice(1)) {
		if (!line.trim()) continue;
		const m = line.match(ROW_RE);
		if (!m) continue;

		// Fecha / Persona / Comercio are deliberately dropped.
		const desc = (m[3] ?? m[4] ?? '').trim();
		const rawMonto = m[5] ?? m[6] ?? '';
		const price = Number(rawMonto.replace(/[",]/g, ''));

		// Non-positive amounts exist in the sheet (e.g. an -440 row); drop them so
		// the draw length still matches what the caller asked for.
		if (!desc || !Number.isFinite(price) || price <= 0) continue;
		rows.push({ desc, price });
	}
	return rows;
}

/** Distinct descriptions only, so the tape doesn't fill with one product. */
function dedupeByDesc(rows) {
	const seen = new Set();
	const out = [];
	for (const row of rows) {
		if (seen.has(row.desc)) continue;
		seen.add(row.desc);
		out.push(row);
	}
	return out;
}

// --- Money ------------------------------------------------------------------

const colones = (n) => `₡${n.toLocaleString('en-US')}`;

/**
 * Mirror of `roundPrice()` in src/lib/utils.ts: the app rounds to the nearest
 * 5 colones once a price reaches 10, leaving smaller values alone. CRC has no
 * cents, so the result is always an integer.
 *
 * This exists ONLY so the script can predict the total it expects to see. The
 * app remains the source of truth — the script reads the running total off the
 * screen rather than trusting this number.
 */
function roundPrice(value) {
	if (!Number.isFinite(value) || value <= 0) return 0;
	if (value < 10) return Math.round(value);
	return Math.round(value / 5) * 5;
}

// --- Browser helpers --------------------------------------------------------

/**
 * Fill a controlled Svelte input through real user-style interaction. A value
 * that never fires `input` won't update the component's state, which would
 * leave `+ Add Item` disabled.
 */
async function fillField(page, selector, value) {
	const field = page.locator(selector);
	await field.fill(String(value));
}

/**
 * Commit the row.
 *
 * The Product field is a `datalist` combobox. While its popup is open the
 * `+ Add Item` button is enabled, hit-testable and positionally static, yet
 * Playwright's actionability check never passes and `click()` hangs until it
 * times out. Blurring the label field closes the popup and unblocks the click.
 *
 * Clicking also beats pressing Enter here: the same popup swallows Enter and
 * accepts an autocomplete suggestion instead of committing the row.
 */
async function addItem(page, { price, qty, label }, timeout) {
	await fillField(page, '#price-input', price);
	await fillField(page, '#qty-input', qty);
	await fillField(page, '#label-input', label);
	await page.locator('#label-input').blur();

	const button = page.locator('button:has-text("Add Item")');
	await button.click({ timeout });
}

/** Clear the tape using the app's own guarded two-tap reset. */
async function resetTape(page, timeout) {
	const reset = page.getByRole('button', { name: 'Reset all' });
	if ((await reset.count()) === 0) return false; // already empty — no button

	await reset.click({ timeout });
	// The button is REPLACED by the armed state, so re-locate it before the
	// second tap. The armed state is a plain variable that expires in ~3s.
	await page.getByRole('button', { name: 'Tap again to confirm' }).click({ timeout });
	await page.waitForTimeout(200);
	return true;
}

async function readState(page) {
	const rows = await page.locator('ul > li').allInnerTexts();
	const body = await page.locator('body').innerText();
	return {
		count: rows.length,
		newest: (rows[0] ?? '').replace(/\s+/g, ' ').trim(),
		total: body.match(/TOTAL\s*(₡[\d,]+)/)?.[1] ?? null,
		totalValue: Number((body.match(/TOTAL\s*₡([\d,]+)/)?.[1] ?? '0').replace(/,/g, ''))
	};
}

// --- Main -------------------------------------------------------------------

async function main() {
	const opts = parseArgs(process.argv.slice(2));

	// 1. Draw the rows first, before touching the browser.
	const csv = readFileSync(CSV_PATH, 'utf8');
	const valid = dedupeByDesc(parseCsv(csv));

	const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
	const random = makeRandom(seed);

	if (valid.length < opts.count) {
		fail(`Only ${valid.length} distinct valid products available; asked for ${opts.count}.`);
	}

	const pick = shuffled(valid, random)
		.slice(0, opts.count)
		// One independent quantity draw per item — never reused across the run.
		.map((row) => ({ ...row, qty: 1 + Math.floor(random() * 6) }))
		// The app rounds the price on the way in, so the stored row (and therefore
		// the subtotal) can differ from the raw sheet amount by a few colones.
		.map((row) => ({ ...row, price: roundPrice(row.price) }));

	const expectedTotal = pick.reduce((sum, r) => sum + r.price * r.qty, 0);

	console.log(`\nSuperCalc dummy-data seeder`);
	console.log(`  seed          ${seed}${opts.seed === null ? ' (random)' : ''}`);
	console.log(`  items         ${pick.length}`);
	console.log(`  expected      ${colones(expectedTotal)}`);
	console.log(`  target        ${opts.url}${opts.base}/calculator`);
	console.log(`  mode          ${opts.append ? 'append' : 'clear then seed'}\n`);

	if (opts.dryRun) {
		pick.forEach((r, i) => {
			console.log(
				`${String(i + 1).padStart(2)}/${pick.length}  ${r.desc.padEnd(22)}  ` +
					`${colones(r.price)} × ${r.qty} = ${colones(r.price * r.qty)}`
			);
		});
		console.log(`\n--dry-run: nothing was sent to the app.\n`);
		return;
	}

	// 2. Drive the real UI — through a persistent profile so the tape lives on.
	const context = await chromium.launchPersistentContext(PROFILE_DIR, {
		channel: 'chrome',
		headless: opts.headless
	});

	let added = 0;
	let failed = null;

	try {
		const page = context.pages()[0] ?? (await context.newPage());
		const target = `${opts.url}${opts.base}/calculator`;

		try {
			await page.goto(target, { waitUntil: 'domcontentloaded', timeout: opts.timeout });
		} catch {
			fail(`Could not reach ${target}.\nIs the app running?  npm run preview`);
		}

		if ((await page.locator('#price-input').count()) === 0) {
			fail(
				`${target} does not look like the calculator (no #price-input).\n` +
					`Check the URL / --base and that you're on the calculator screen.`
			);
		}

		// 3. Clear the tape first, so the final tape contains only seeded rows.
		let startingTotal = 0;
		if (!opts.append) {
			const cleared = await resetTape(page, opts.timeout);
			const state = await readState(page);
			if (cleared && state.count !== 0) {
				fail(`Reset did not empty the tape (still ${state.count} rows).`);
			}
			if (!cleared) console.log(`  (tape was already empty — nothing to reset)\n`);
		} else {
			startingTotal = (await readState(page)).totalValue;
			console.log(`  (appending to an existing tape — ${colones(startingTotal)} already on it)\n`);
		}

		// 4. One item, one verification, one log line. Never batched.
		for (let i = 0; i < pick.length; i++) {
			const row = pick[i];
			const before = await readState(page);

			try {
				await addItem(page, row, opts.timeout);
			} catch (error) {
				failed = { row, index: i, reason: error.message.split('\n')[0] };
				break;
			}

			// The row is prepended, so the newest item is `ul > li` index 0.
			const after = await readState(page);
			const subtotal = row.price * row.qty;
			const landed = after.count === before.count + 1;

			if (!landed) {
				failed = { row, index: i, reason: `row did not commit (count stayed ${before.count})` };
				break;
			}

			console.log(
				`${String(i + 1).padStart(2)}/${pick.length}  ${row.desc.padEnd(22)}  ` +
					`${colones(row.price)} × ${row.qty} = ${colones(subtotal)}   ` +
					`[total ${after.total}]`
			);
			added++;
		}

		// 5. Report from the app's own running-total strip, not a local sum.
		const final = await readState(page);
		console.log(`\n─────────────────────────────────────────────`);
		console.log(`  added         ${added} of ${pick.length}`);
		console.log(`  tape total    ${final.total}   (from the app's total strip)`);
		console.log(`  rows on tape  ${final.count}`);
		console.log(`  seed          ${seed}`);

		if (failed) {
			console.log(`\n  ✖ stopped at item ${failed.index + 1}: ${failed.row.desc}`);
			console.log(`    ${failed.reason}`);
			console.log(`    The tape holds the ${added} items that landed.`);
			process.exitCode = 1;
		} else {
			const actual = Number((final.total ?? '').replace(/[^\d]/g, ''));
			const expected = startingTotal + expectedTotal;
			const matches = actual === expected;
			console.log(
				`  verification  ${matches ? '✓ total matches the draw' : `✖ expected ${colones(expected)}`}`
			);
			if (!matches) process.exitCode = 1;
		}

		console.log(`\n  Tape left intact on the calculator.\n`);
	} finally {
		await context.close();
	}
}

main().catch((error) => fail(error.stack ?? String(error)));
