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
	/** Sum of units, not the number of rows. */
	unitCount: number;
	/** Percentage of the non-error tape total; 0 when the tape has no money. */
	share: number;
}

/**
 * Aggregate the tape by category, largest spend first.
 *
 * Rows carrying an `error` are skipped entirely rather than counted as zero:
 * including them would surface a category whose every item failed to price,
 * and would also inflate its `unitCount` with items that never added money.
 *
 * `share` is computed against the SUM OF THE SURVIVING ROWS rather than against
 * the tape's headline subtotal. Those two agree today because `subtotal` in
 * `store.ts` also zeroes error rows — computing it from this side keeps the
 * percentages summing to 100 even if that ever changes.
 *
 * Pure and store-free, so it stays unit-testable.
 */
export function categoryTotals(rows: CalculatorRow[]): CategoryTotal[] {
	const byCategory = new Map<string, { subtotal: number; unitCount: number }>();

	for (const row of rows) {
		if (row.error) continue;

		// A blank category still has to land somewhere visible, and `Otros` is the
		// same fallback `resolveCategory()` uses for an unresolvable label.
		const key = row.category || DEFAULT_CATEGORY;
		const bucket = byCategory.get(key) ?? { subtotal: 0, unitCount: 0 };

		bucket.subtotal += row.subtotal;
		bucket.unitCount += row.units;
		byCategory.set(key, bucket);
	}

	const total = [...byCategory.values()].reduce((sum, bucket) => sum + bucket.subtotal, 0);

	return [...byCategory.entries()]
		.map(([category, bucket]) => ({
			category,
			subtotal: bucket.subtotal,
			unitCount: bucket.unitCount,
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

/**
 * Locale used for every number the user sees.
 *
 * `es-CR` is the right locale for the GROUPING — ICU defines its thousands
 * separator as a no-break space, so `4560` renders as `4 560`. That matches how
 * colones are written in Costa Rica, and the no-break space matters in the narrow
 * comparison cards: a plain space would let an amount wrap mid-number.
 *
 * It is deliberately NOT used for the DECIMAL mark. `es-CR` also uses a comma for
 * decimals (`1 234,57`), and this app keeps the dot (`1 234.57`) for consistency
 * with the input fields and the rest of the UI copy. See `formatAmount()` for the
 * one place that swap happens, and for why it is a documented deviation rather
 * than a locale bug.
 */
export const NUMBER_LOCALE = 'es-CR';

/**
 * Format a number for display: `es-CR` grouping, dot decimals.
 *
 * The two callers need opposite shapes, which is why this is one helper with a
 * precision argument rather than two functions:
 *
 * - **Money** (`maxFractionDigits: 0`, the default) rounds to an integer, because
 *   CRC has no cents in everyday grocery math — `4560` → `4 560`.
 * - **Unit prices** (`maxFractionDigits: 2`) keep up to two decimals, because a
 *   price per gram is almost never a whole colón — `1234.567` → `1 234.57`.
 *
 * Why not `toLocaleString('es-CR')` outright: it renders the decimal comma as
 * `,`, which would make the compare screen read `1 234,57` beside input fields
 * that only ever accept a dot. Rather than carry two locale strings that disagree
 * (`en-US` groups with `,`, `es-CR` decimals with `,` — the combination we want
 * exists in neither), the grouping comes from the locale and the decimal mark is
 * swapped afterwards. The swap is only ever applied when decimals are requested,
 * so integer output is untouched.
 *
 * Pure and store-free, so it stays unit-testable alongside `roundPrice()`.
 */
export function formatAmount(value: number, maxFractionDigits = 0): string {
	const safe = Number.isFinite(value) ? value : 0;

	// Round for money so a stray float can never render as `4 560,0000001`. The
	// unit-price path rounds via `maximumFractionDigits` inside `toLocaleString`.
	const n = maxFractionDigits === 0 ? Math.round(safe) : safe;

	const out = n.toLocaleString(NUMBER_LOCALE, {
		minimumFractionDigits: 0,
		maximumFractionDigits: maxFractionDigits
	});

	if (maxFractionDigits === 0) return out;

	// Swap the decimal comma for a dot. `lastIndexOf` picks the decimal mark even
	// if the grouping separator were ever a comma too (the decimal is always the
	// LAST separator) — with `es-CR` the grouping is a no-break space, so the only
	// comma present is the decimal one. The `-1` guard covers an integer that
	// rendered no decimals at all: `out` is then returned untouched.
	const lastComma = out.lastIndexOf(',');
	if (lastComma === -1) return out;
	return out.slice(0, lastComma) + '.' + out.slice(lastComma + 1);
}

/** Strip everything except digits, then parse. */
export function digitsToInt(input: string): number {
	const digits = input.replace(/\D/g, '');
	if (!digits) return 0;
	return parseInt(digits, 10);
}

/**
 * Validate a raw price input string.
 * Rules: digits only, >= minPrice, max 5 digits, <= maxPrice.
 *
 * The floor is not cosmetic. Without it a mistyped `1` became a ₡1 line on the
 * tape and silently skewed the running total — and, because `roundPrice()`
 * leaves anything under ₡10 alone, it also survived the rounding pass intact.
 *
 * The default floor of ₡5 is chosen against the real dataset: the cheapest item
 * actually bought in `scripts/data.csv` is ₡90 (CULANTRO), so a floor of ₡5
 * cannot reject a legitimate entry while still blocking accidental single-digit
 * slips. Anything larger starts to become a policy decision rather than a guard.
 */
export function validatePrice(
	raw: string,
	minPrice: number,
	maxPrice: number
): { ok: boolean; value: number; reason?: string } {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return { ok: false, value: 0, reason: 'Price required' };
	if (digits.length > 5) return { ok: false, value: 0, reason: 'Max 5 digits' };
	const value = parseInt(digits, 10);
	if (value < minPrice) return { ok: false, value, reason: `Min ₡${minPrice}` };
	if (value > maxPrice) return { ok: false, value, reason: `Max ₡${maxPrice}` };
	return { ok: true, value };
}

/**
 * Validate a raw units input string.
 * Rules: digits only, > 0, max 2 digits, <= maxUnits.
 *
 * An EMPTY field means **1**, not an error. Units is a multiplier that is 1 for
 * the overwhelming majority of entries, so the field ships empty and `1` is what
 * its absence implies — the placeholder says as much. Prefilling a literal `1`
 * would mean every item required clearing a digit you did not want before typing
 * the one you did.
 *
 * The distinction that matters: empty is `1`, but an explicit `0` is still
 * rejected below. Empty is the user saying nothing; `0` is the user saying zero,
 * and a free item is not something this tape can express.
 */
export function validateUnits(
	raw: string,
	maxUnits: number
): { ok: boolean; value: number; reason?: string } {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return { ok: true, value: 1 };
	if (digits.length > 2) return { ok: false, value: 0, reason: 'Max 2 digits' };
	const value = parseInt(digits, 10);
	if (value <= 0) return { ok: false, value: 0, reason: 'Units must be > 0' };
	if (value > maxUnits) return { ok: false, value, reason: `Max ${maxUnits}` };
	return { ok: true, value };
}

/**
 * Largest units value still read as a COUNT of items.
 *
 * The compare sheet takes a single unitless divisor, and the user otherwise had
 * to remember that `400` meant grams while `4` meant units. Inferring the unit
 * removes that mental bookkeeping.
 *
 * 25 is the cut-off because it is the point where a count stops being plausible
 * for the things this app compares: nobody buys 26 cans of soda or 26 tins of
 * tuna as a single line, whereas 4 cans or 10 eggs are ordinary. Anything above
 * 25 is therefore read as a measure — grams or millilitres, which the app treats
 * as interchangeable (1 g == 1 ml), exactly as the divisor already did.
 *
 * Kept as one named constant so the threshold can be retuned without hunting
 * through the UI, and exported so tests can assert against the boundary rather
 * than duplicating the number.
 */
export const COUNT_MAX = 25;

/** Inferred kind for a compare divisor. */
export type UnitKind = 'count' | 'measure';

/**
 * Infer whether a compare divisor is a count of items or a weight/volume measure.
 * See `COUNT_MAX` for why the threshold sits where it does.
 */
export function inferUnitKind(value: number): UnitKind {
	return value <= COUNT_MAX ? 'count' : 'measure';
}

/** Human label for the inferred kind, e.g. next to a per-unit price. */
export function unitKindLabel(kind: UnitKind): string {
	return kind === 'count' ? 'unit' : 'gram or ml';
}

/**
 * Label for a compare sheet divisor field, swapping at the `COUNT_MAX` boundary.
 *
 * The unit used to be echoed in a paragraph UNDER the field, beneath a label that
 * always read "Units". That put the answer in two places at once and, above the
 * threshold, printed the same phrase twice in one card — the bare unit on its own
 * line and then `per gram or ml` on the next.
 *
 * The label above the field is the right home for it: that is the text you are
 * already reading when you decide what to type, so the field declares up front
 * whether its number is a count or a measure instead of confirming it afterwards.
 * One statement, in the place you look first, and nothing repeated below.
 *
 * Fed the PARSED value, so an empty or invalid field falls back to the neutral
 * "Units" rather than guessing a kind from nothing.
 */
export function unitFieldLabel(value: number): string {
	return value > COUNT_MAX ? 'Grams or ml' : 'Units';
}

/**
 * Validate a raw value used as the compare sheet's divisor — the "Units" field
 * on each of the Small and Big cards.
 *
 * Deliberately simpler than `validateUnits`: the compare sheet is a one-off
 * calculation rather than a tape entry, so it has no Max Units setting to
 * enforce. The rules are digits only, at most 4 digits, and at least 1.
 *
 * The 4-digit ceiling is what makes gram-scale values usable — 2 digits would
 * reject a 400 g beer or an 850 g pack. The value is unitless by design: grams
 * and millilitres are treated as interchangeable, so there is no unit to track.
 * The kind the UI DISPLAYS is inferred separately by `inferUnitKind()`; this
 * validator only decides whether the number is usable.
 */
export function validateCompareUnits(raw: string): { ok: boolean; value: number; reason?: string } {
	const digits = raw.replace(/\D/g, '');
	if (digits.length === 0) return { ok: false, value: 0, reason: 'Enter units' };
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
	singleUnits: number;
	packPrice: number;
	packUnits: number;
}): {
	singleUnitPrice: number;
	packUnitPrice: number;
	winner: 'single' | 'pack' | 'tie';
	savings: number;
	savingsPercent: number;
	hasResults: boolean;
} {
	const singleUnits = Math.max(1, Math.floor(input.singleUnits) || 1);
	const packUnits = Math.max(1, Math.floor(input.packUnits) || 1);

	const singleUnitPrice = input.singlePrice > 0 ? input.singlePrice / singleUnits : 0;
	const packUnitPrice = input.packPrice > 0 ? input.packPrice / packUnits : 0;
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
