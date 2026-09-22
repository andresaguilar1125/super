/**
 * Shared constants and pure helpers for SuperCalc CRC.
 * Keep this file free of Svelte/store imports so it stays unit-testable.
 */

import type { CalculatorRow, CategoryItem } from './models';

/**
 * Published Google Sheet (gid `data`), exported as CSV.
 * Read-only ingestion: the sheet is the single source of truth for
 * item labels (column K) and their categories (column J).
 */
export const CATEGORIES_CSV_URL =
	'https://docs.google.com/spreadsheets/d/e/2PACX-1vQFpRO4TrwAcGggAjB_iZVtdKaKhv59Mhzqy7RhE6JYtYmG704aYHMc6Us1etPgoffJZuLtkk4Ec1fE/pub?output=csv';

/** Category assigned to any label that is not found in the sheet. */
export const DEFAULT_CATEGORY = 'Otros';

/** 0-based CSV field indexes. Column J = category, column K = item label. */
export const CSV_CATEGORY_INDEX = 9;
export const CSV_LABEL_INDEX = 10;

/** localStorage key holding the cached label/category pairs. */
export const KEY_CATEGORIES = 'supercalc-categories';

/**
 * Normalise a string for accent- and case-insensitive comparison.
 * The sheet uses `Lacteos` while users may type `Lácteos`.
 */
export function normalizeKey(value: string): string {
	return value
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.trim()
		.toLowerCase();
}

/**
 * Minimal RFC-4180 CSV parser: handles quoted fields, `""` escapes,
 * commas inside quotes, and both CRLF and LF line endings.
 */
export function parseCSV(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (inQuotes) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++; // consume the escaped quote
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else if (char !== '\r') {
			field += char;
		}
	}

	// Flush the trailing field/row when the file has no final newline.
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows;
}

/**
 * Extract `{ label, category }` pairs from the published sheet CSV.
 *
 * - Row 0 is a header and is skipped.
 * - Rows missing the label (column K) are ignored — the sheet has many
 *   transaction rows that carry no item label.
 * - Rows whose category (column J) is blank fall back to `DEFAULT_CATEGORY`.
 * - Duplicate labels are de-duplicated case/accent-insensitively; the LAST
 *   occurrence wins so the most recent sheet entry takes precedence.
 */
export function parseCategoriesCSV(text: string): CategoryItem[] {
	const rows = parseCSV(text);
	const byLabel = new Map<string, CategoryItem>();

	for (const row of rows.slice(1)) {
		const label = (row[CSV_LABEL_INDEX] ?? '').trim();
		if (!label) continue;

		const category = (row[CSV_CATEGORY_INDEX] ?? '').trim() || DEFAULT_CATEGORY;
		// Later rows overwrite earlier ones (recency wins).
		byLabel.set(normalizeKey(label), { label, category });
	}

	return [...byLabel.values()];
}

/** Alphabetical sort using Spanish collation, so `Á` sorts next to `A`. */
export function sortByLabel(items: CategoryItem[]): CategoryItem[] {
	return [...items].sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
}

/** Unique category names in alphabetical order. */
export function uniqueCategories(items: CategoryItem[]): string[] {
	const seen = new Map<string, string>();
	for (const item of items) {
		const key = normalizeKey(item.category);
		if (!seen.has(key)) seen.set(key, item.category);
	}
	return [...seen.values()].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
}

/**
 * Resolve the category for a free-text label.
 * Falls back to `DEFAULT_CATEGORY` when the label is empty or unknown.
 */
export function resolveCategoryFrom(
	label: string,
	items: CategoryItem[]
): string {
	const key = normalizeKey(label);
	if (!key) return DEFAULT_CATEGORY;
	const match = items.find((item) => normalizeKey(item.label) === key);
	return match ? match.category : DEFAULT_CATEGORY;
}

/** One category's share of the tape. `share` is 0–100. */
export interface CategoryTotal {
	category: string;
	subtotal: number;
	/** Sum of quantities, not the number of rows. */
	itemCount: number;
	/** Percentage of the non-error tape total; 0 when the tape has no money. */
	share: number;
}

/**
 * Aggregate the tape by category, largest spend first.
 *
 * Rows carrying an `error` are skipped entirely rather than counted as zero:
 * including them would surface a category whose every item failed to price,
 * and would also inflate its `itemCount` with items that never added money.
 *
 * `share` is computed against the SUM OF THE SURVIVING ROWS rather than against
 * the tape's headline subtotal. Those two agree today because `subtotal` in
 * `store.ts` also zeroes error rows — computing it from this side keeps the
 * percentages summing to 100 even if that ever changes.
 *
 * Pure and store-free, so it stays unit-testable.
 */
export function categoryTotals(rows: CalculatorRow[]): CategoryTotal[] {
	const byCategory = new Map<string, { subtotal: number; itemCount: number }>();

	for (const row of rows) {
		if (row.error) continue;

		// A blank category still has to land somewhere visible, and `Otros` is the
		// same fallback `resolveCategory()` uses for an unresolvable label.
		const key = row.category || DEFAULT_CATEGORY;
		const bucket = byCategory.get(key) ?? { subtotal: 0, itemCount: 0 };

		bucket.subtotal += row.subtotal;
		bucket.itemCount += row.quantity;
		byCategory.set(key, bucket);
	}

	const total = [...byCategory.values()].reduce((sum, bucket) => sum + bucket.subtotal, 0);

	return [...byCategory.entries()]
		.map(([category, bucket]) => ({
			category,
			subtotal: bucket.subtotal,
			itemCount: bucket.itemCount,
			share: total > 0 ? (bucket.subtotal / total) * 100 : 0
		}))
		.sort((a, b) => b.subtotal - a.subtotal);
}

/**
 * Round to the nearest 5 colones when price >= 10.
 * Below 10 colones we leave the value untouched (README rule).
 * CRC has no cents, so the result is always an integer.
 */
export function roundPrice(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	if (value < 10) return Math.round(value);
	return Math.round(value / 5) * 5;
}

/** Strip everything except digits, then parse. */
export function digitsToInt(input: string): number {
	const digits = input.replace(/\D/g, '');
	if (!digits) return 0;
	return parseInt(digits, 10);
}

/**
 * Validate a raw price input string.
 * Rules: digits only, > 0, max 5 digits, <= maxPrice.
 */
export function validatePrice(
	raw: string,
	maxPrice: number
): { ok: boolean; value: number; reason?: string } {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return { ok: false, value: 0, reason: 'Price required' };
	if (digits.length > 5) return { ok: false, value: 0, reason: 'Max 5 digits' };
	const value = parseInt(digits, 10);
	if (value <= 0) return { ok: false, value: 0, reason: 'Price must be > 0' };
	if (value > maxPrice) return { ok: false, value, reason: `Max ₡${maxPrice}` };
	return { ok: true, value };
}

/**
 * Validate a raw quantity input string.
 * Rules: digits only, > 0, max 2 digits, <= maxQuantity.
 */
export function validateQuantity(
	raw: string,
	maxQuantity: number
): { ok: boolean; value: number; reason?: string } {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return { ok: false, value: 0, reason: 'Quantity required' };
	if (digits.length > 2) return { ok: false, value: 0, reason: 'Max 2 digits' };
	const value = parseInt(digits, 10);
	if (value <= 0) return { ok: false, value: 0, reason: 'Quantity must be > 0' };
	if (value > maxQuantity) return { ok: false, value, reason: `Max ${maxQuantity}` };
	return { ok: true, value };
}

/**
 * Validate a raw quantity used as the compare page's divisor — the "Qty" field
 * on each of the Single and Pack cards.
 *
 * Deliberately simpler than `validateQuantity`: the compare page is a one-off
 * calculation rather than a tape entry, so it has no Max Quantity setting to
 * enforce. The rules are digits only, at most 4 digits, and at least 1.
 *
 * The 4-digit ceiling is what makes gram-scale values usable — 2 digits would
 * reject a 400 g beer or an 850 g pack. The value is unitless by design: grams
 * and millilitres are treated as interchangeable, so there is no unit to track.
 */
export function validateCompareQty(raw: string): { ok: boolean; value: number; reason?: string } {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return { ok: false, value: 0, reason: 'Enter a Qty' };
	if (digits.length > 4) return { ok: false, value: 0, reason: 'Max 4 digits' };
	const value = parseInt(digits, 10);
	if (value < 1) return { ok: false, value: 0, reason: 'Must be 1 or more' };
	return { ok: true, value };
}

/**
 * Compare two purchase options by price per unit — a single item versus a
 * pack. Ported from the reference implementation.
 *
 * Returns `winner: 'tie'` when the per-unit prices match, and zeroed savings
 * when either option is incomplete so the UI can distinguish "no result yet"
 * from a genuine tie.
 */
export function compareUnitPrices(input: {
	singlePrice: number;
	singleQty: number;
	packPrice: number;
	packQty: number;
}): {
	singleUnitPrice: number;
	packUnitPrice: number;
	winner: 'single' | 'pack' | 'tie';
	savings: number;
	savingsPercent: number;
	hasResults: boolean;
} {
	const singleQty = Math.max(1, Math.floor(input.singleQty) || 1);
	const packQty = Math.max(1, Math.floor(input.packQty) || 1);

	const singleUnitPrice = input.singlePrice > 0 ? input.singlePrice / singleQty : 0;
	const packUnitPrice = input.packPrice > 0 ? input.packPrice / packQty : 0;
	const hasResults = singleUnitPrice > 0 && packUnitPrice > 0;

	if (!hasResults) {
		return {
			singleUnitPrice,
			packUnitPrice,
			winner: 'tie',
			savings: 0,
			savingsPercent: 0,
			hasResults: false
		};
	}

	const diff = singleUnitPrice - packUnitPrice;
	const winner: 'single' | 'pack' | 'tie' = diff === 0 ? 'tie' : diff < 0 ? 'single' : 'pack';
	const savings = Math.abs(diff);
	const savingsPercent = (savings / Math.max(singleUnitPrice, packUnitPrice)) * 100;

	return { singleUnitPrice, packUnitPrice, winner, savings, savingsPercent, hasResults: true };
}

/** Safe localStorage read with JSON parse + fallback. */
export function loadJSON<T>(key: string, fallback: T): T {
	if (typeof localStorage === 'undefined') return fallback;
	try {
		const raw = localStorage.getItem(key);
		if (!raw) return fallback;
		return JSON.parse(raw) as T;
	} catch {
		return fallback;
	}
}

/** Safe localStorage write. */
export function saveJSON(key: string, value: unknown): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		/* quota or private mode — ignore */
	}
}
