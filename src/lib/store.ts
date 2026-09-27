import { writable, derived, get } from 'svelte/store';
import type { CalculatorRow, Settings, CompareEntry, Theme } from './models';
import { loadJSON, saveJSON, roundPrice, categoryTotals, formatAmount } from './utils';

// --- Storage keys -----------------------------------------------------------
const KEY_ROWS = 'supercalc-rows';
const KEY_SETTINGS = 'supercalc-settings';
const KEY_THEME = 'supercalc-theme';

// --- Calculator rows --------------------------------------------------------
// Persisted to localStorage. Hydration is deferred to `hydrateStores()` so
// SSR never touches `window`.
export const calculatorRows = writable<CalculatorRow[]>([]);

/** Derived live subtotal — no manual updateSubtotal() dance needed. */
export const subtotal = derived(calculatorRows, ($rows) =>
	$rows.reduce((sum, row) => sum + (row.error ? 0 : row.subtotal), 0)
);

/** Total number of units (sum of `units`) — useful for badges. */
export const unitCount = derived(calculatorRows, ($rows) =>
	$rows.reduce((sum, row) => sum + (row.error ? 0 : row.units), 0)
);

/**
 * Spend per category, largest first — powers the totals sheet.
 *
 * Derived rather than stored: it is a pure function of the tape, so a stored
 * copy would be one more thing that could fall out of sync after a delete or a
 * reset. The aggregation itself lives in `utils.ts` so it can be tested without
 * a store.
 */
export const totalsByCategory = derived(calculatorRows, ($rows) => categoryTotals($rows));

// --- Compare -----------------------------------------------------------------
export const compareEntries = writable<CompareEntry[]>([]);

// --- Settings ----------------------------------------------------------------

/**
 * The limits, as ONE exported source of truth.
 *
 * These are not decoration: `maxPrice` is also the price cap, so a stale stored
 * value silently changes what the calculator will accept. The settings route
 * imports these rather than repeating the numbers, so a range can never be
 * changed in the UI without the validator following.
 */
export const LIMITS = {
	/** Fixed price floor. A single-digit mistyped-price guard. */
	minPrice: 10,
	/**
	 * UNIT-PRICE ceiling — never a line-total ceiling. A ₡5 000 item × 5 is a
	 * perfectly valid ₡25 000 line, because `addRow()` multiplies AFTER this check.
	 * Set just under the 5-digit boundary the input's `maxlength` already enforces,
	 * so it catches a slipped digit without capping anyone's budget.
	 */
	maxPriceMin: 1000,
	maxPriceMax: 9999,
	maxUnitsMin: 5,
	maxUnitsMax: 50,
	maxUnitsStep: 5
} as const;

const DEFAULT_SETTINGS: Settings = {
	/*
	 * NOT user-configurable any more, and no longer surfaced in Settings: the
	 * slider was removed and this is now the fixed floor. It stays a stored field
	 * (rather than a constant read at the call site) because `validatePrice` takes
	 * it as an argument and every caller passes `$settings.minPrice` — hardcoding
	 * it there would scatter the number across four call sites.
	 *
	 * ₡10 is above `roundPrice()`'s ₡5 rounding step, so a price at the floor is
	 * stable under rounding rather than landing between two rounded values.
	 */
	minPrice: LIMITS.minPrice,
	maxPrice: LIMITS.maxPriceMax,
	maxUnits: 50,
	rememberTheme: false
};

export const settings = writable<Settings>(DEFAULT_SETTINGS);

// --- Theme -------------------------------------------------------------------
export const theme = writable<Theme>('light');


// --- Current view ------------------------------------------------------------
export const currentView = writable<string>('calculator');

// --- Persistence -------------------------------------------------------------
let rowsSubscribed = false;
let settingsSubscribed = false;
let themeSubscribed = false;

/**
 * Shapes written to localStorage BEFORE the Qty → Units rename.
 *
 * The rename reached the persisted fields themselves (`quantity` → `units`,
 * `maxQuantity` → `maxUnits`), so a tape saved by an earlier build carries the
 * OLD key. Reading it blind would give every row `units: undefined`, and
 * `price * undefined` is `NaN` — the subtotal, the running total and the totals
 * sheet would all silently render `0` or `NaN` rather than erroring.
 *
 * `Omit<…, 'units'>` + an optional `units` is what makes the legacy row type
 * work: a plain `Partial<CalculatorRow>` intersection would leave every OTHER
 * field optional too, and the mapped result would no longer satisfy
 * `CalculatorRow`. These types exist only to READ that legacy data; nothing
 * writes them.
 */
type LegacyRow = Omit<CalculatorRow, 'units'> & { units?: number; quantity?: number };
type LegacySettings = Omit<Partial<Settings>, 'maxUnits'> & {
	maxUnits?: number;
	maxQuantity?: number;
};

/**
 * Call once from the root layout's onMount.
 * Loads persisted state and wires up write-back subscriptions.
 */
export function hydrateStores(): void {
	// Rows. `quantity` is destructured OUT so the legacy key cannot survive into
	// the mapped row and be written back on the next persist; `?? 1` mirrors
	// `addRow()`'s floor, so a row carrying neither key becomes a sane single unit
	// instead of a NaN subtotal.
	const storedRows = loadJSON<LegacyRow[]>(KEY_ROWS, []);
	calculatorRows.set(
		storedRows.map(({ quantity, ...row }) => ({ ...row, units: row.units ?? quantity ?? 1 }))
	);

	if (!rowsSubscribed) {
		calculatorRows.subscribe((rows) => saveJSON(KEY_ROWS, rows));
		rowsSubscribed = true;
	}

	// Settings
	const storedSettings = loadJSON<LegacySettings>(KEY_SETTINGS, {});
	// Destructured out for the same reason as the row's `quantity`.
	const { maxQuantity: legacyMaxUnits, ...restSettings } = storedSettings;
	/*
	 * Sanitised on the way IN, not just when Settings is saved.
	 *
	 * A build that shipped a wider `maxPrice` range has already written e.g.
	 * `25000` into this key, and the range is the price CAP — so restoring it
	 * verbatim means the calculator keeps accepting ₡11 000 unit prices until the
	 * user happens to open Settings and press Save. That is a silently wrong
	 * limit, the same class of bug as the old min-price round trip. Correcting it
	 * here makes the stored value self-heal on the next load instead.
	 */
	settings.set({
		...DEFAULT_SETTINGS,
		...restSettings,
		minPrice: LIMITS.minPrice,
		maxPrice: Math.min(
			LIMITS.maxPriceMax,
			Math.max(LIMITS.maxPriceMin, Math.round(restSettings.maxPrice ?? DEFAULT_SETTINGS.maxPrice))
		),
		maxUnits: restSettings.maxUnits ?? legacyMaxUnits ?? DEFAULT_SETTINGS.maxUnits
	});

	if (!settingsSubscribed) {
		settings.subscribe((s) => saveJSON(KEY_SETTINGS, s));
		settingsSubscribed = true;
	}

	// Theme
	const storedTheme = (localStorage.getItem(KEY_THEME) as Theme | null) ?? 'light';
	theme.set(storedTheme);

	if (!themeSubscribed) {
		theme.subscribe((t) => localStorage.setItem(KEY_THEME, t));
		themeSubscribed = true;
	}

	}

/**
 * Single entry point for changing the theme.
 *
 * Both the header toggle and the Settings switch previously had their own
 * `toggleTheme()` — only the header one wrote to localStorage, so flipping the
 * Settings switch could silently fail to survive a reload. Routing every change
 * through here (plus the write-back subscription above) removes that
 * inconsistency.
 */
export function setTheme(next: Theme): void {
	theme.set(next);
}

export function toggleTheme(): void {
	theme.update((current) => (current === 'light' ? 'dark' : 'light'));
}


// --- Actions -----------------------------------------------------------------
/**
 * Add a row to the tape.
 *
 * `units` is a COUNT of the item bought, and it multiplies the price into the
 * subtotal. (The compare sheet's divisor is a different thing entirely — it is a
 * unitless measure used to compare two options, and it must NOT be passed here;
 * doing so once multiplied a ₡5,000 pack of 4 into a ₡20,000 row.)
 */
export function addRow(input: {
	price: number;
	units: number;
	category: string;
	label?: string;
}): CalculatorRow {
	const rounded = roundPrice(input.price);
	const label = input.label?.trim();
	const units = Math.max(1, Math.floor(input.units));
	const row: CalculatorRow = {
		id: crypto.randomUUID(),
		price: rounded,
		units,
		category: input.category,
		label: label ? label.slice(0, 30) : undefined,
		subtotal: rounded * units
	};
	calculatorRows.update((rows) => [row, ...rows]);
	return row;
}

export function updateRow(id: string, updates: Partial<CalculatorRow>): void {
	calculatorRows.update((rows) =>
		rows.map((row) => {
			if (row.id !== id) return row;
			const merged = { ...row, ...updates };
			if (typeof merged.price === 'number' && merged.price > 0) {
				merged.price = roundPrice(merged.price);
			}
			merged.subtotal = merged.error ? 0 : merged.price * merged.units;
			return merged;
		})
	);
}

export function deleteRow(id: string): void {
	calculatorRows.update((rows) => rows.filter((row) => row.id !== id));
}

export function resetAll(): void {
	calculatorRows.set([]);
}

// --- Formatting --------------------------------------------------------------
/**
 * Format a colón amount for display: integer, `es-CR` grouping (no-break space),
 * no decimals — `4560` → `4 560`.
 *
 * Thin wrapper over `formatAmount()` so there is exactly ONE number formatter in
 * the app. It previously carried its own `en-US` call, which grouped with a comma
 * while the compare screen used `es-CR` and grouped with a comma too but
 * decimalised with a dot — the two screens disagreed on both marks.
 *
 * The currency SIGN is deliberately not part of this: amounts render bare and the
 * `₡` is supplied by the surrounding copy where it aids comprehension (the
 * Settings labels). `formatColones()` was removed for that reason — it existed
 * only to glue the sign on, and nothing called it.
 */
export function formatCurrency(value: number): string {
	return formatAmount(value);
}

// Re-export `get` for callers that want a one-shot snapshot.
export { get };
