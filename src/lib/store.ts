import { writable, derived, get } from 'svelte/store';
import type { CalculatorRow, Settings, CompareEntry, Theme, Accent } from './models';
import { loadJSON, saveJSON, roundPrice, categoryTotals } from './utils';
import { DEFAULT_ACCENT, isAccent } from './accents';

// --- Storage keys -----------------------------------------------------------
const KEY_ROWS = 'supercalc-rows';
const KEY_SETTINGS = 'supercalc-settings';
const KEY_THEME = 'supercalc-theme';
const KEY_ACCENT = 'supercalc-accent';

// --- Calculator rows --------------------------------------------------------
// Persisted to localStorage. Hydration is deferred to `hydrateStores()` so
// SSR never touches `window`.
export const calculatorRows = writable<CalculatorRow[]>([]);

/** Derived live subtotal — no manual updateSubtotal() dance needed. */
export const subtotal = derived(calculatorRows, ($rows) =>
	$rows.reduce((sum, row) => sum + (row.error ? 0 : row.subtotal), 0)
);

/** Total number of items (sum of quantities) — useful for badges. */
export const itemCount = derived(calculatorRows, ($rows) =>
	$rows.reduce((sum, row) => sum + (row.error ? 0 : row.quantity), 0)
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
const DEFAULT_SETTINGS: Settings = {
	maxPrice: 25000,
	maxQuantity: 50,
	rememberTheme: false
};

export const settings = writable<Settings>(DEFAULT_SETTINGS);

// --- Theme -------------------------------------------------------------------
export const theme = writable<Theme>('light');

// --- Accent ------------------------------------------------------------------
/*
 * Deliberately NOT a field on `Settings`. Accent behaves like the theme: it
 * applies the moment it is tapped and persists under its own key, so it never
 * waits on "Save Settings". Keeping it out of `Settings` also leaves that
 * payload's shape untouched for anyone holding a `supercalc-settings` blob.
 */
export const accent = writable<Accent>(DEFAULT_ACCENT);

// --- Current view ------------------------------------------------------------
export const currentView = writable<string>('calculator');

// --- Persistence -------------------------------------------------------------
let rowsSubscribed = false;
let settingsSubscribed = false;
let themeSubscribed = false;
let accentSubscribed = false;

/**
 * Call once from the root layout's onMount.
 * Loads persisted state and wires up write-back subscriptions.
 */
export function hydrateStores(): void {
	// Rows
	const storedRows = loadJSON<CalculatorRow[]>(KEY_ROWS, []);
	calculatorRows.set(storedRows);

	if (!rowsSubscribed) {
		calculatorRows.subscribe((rows) => saveJSON(KEY_ROWS, rows));
		rowsSubscribed = true;
	}

	// Settings
	const storedSettings = loadJSON<Partial<Settings>>(KEY_SETTINGS, {});
	settings.set({ ...DEFAULT_SETTINGS, ...storedSettings });

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

	// Accent — validated, because the value comes from storage that a previous
	// version (or a hand-edit) could have left in any state.
	const storedAccent = localStorage.getItem(KEY_ACCENT);
	accent.set(isAccent(storedAccent) ? storedAccent : DEFAULT_ACCENT);

	if (!accentSubscribed) {
		accent.subscribe((a) => localStorage.setItem(KEY_ACCENT, a));
		accentSubscribed = true;
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

/**
 * Single entry point for changing the accent, mirroring `setTheme()`.
 * The write-back subscription in `hydrateStores()` handles persistence.
 */
export function setAccent(next: Accent): void {
	accent.set(next);
}

// --- Actions -----------------------------------------------------------------
export function addRow(input: {
	price: number;
	quantity: number;
	category: string;
	label?: string;
}): CalculatorRow {
	const rounded = roundPrice(input.price);
	const label = input.label?.trim();
	const row: CalculatorRow = {
		id: crypto.randomUUID(),
		price: rounded,
		quantity: Math.max(1, Math.floor(input.quantity)),
		category: input.category,
		label: label ? label.slice(0, 30) : undefined,
		subtotal: rounded * Math.max(1, Math.floor(input.quantity))
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
			merged.subtotal = merged.error ? 0 : merged.price * merged.quantity;
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
/** Format an integer as CRC with `,` thousands separator and no decimals. */
export function formatCurrency(value: number): string {
	const safe = Number.isFinite(value) ? Math.round(value) : 0;
	return safe.toLocaleString('en-US');
}

/** Convenience: same as formatCurrency but with the ₡ prefix. */
export function formatColones(value: number): string {
	return `₡${formatCurrency(value)}`;
}

// Re-export `get` for callers that want a one-shot snapshot.
export { get };
