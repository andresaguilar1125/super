export interface CalculatorRow {
	id: string;
	price: number;
	/**
	 * How many of the item were bought. Called `units` rather than `quantity` so
	 * the field, the Settings cap and the UI label all use one word — the label has
	 * read "Units" since the rename, and a `quantity` identifier behind a "Units"
	 * label is the kind of drift that makes a codebase read as two vocabularies.
	 */
	units: number;
	category: string;
	/** Optional free-text item name (e.g. "Leche Dos Pinos 1L"). */
	label?: string;
	subtotal: number;
	error?: string;
}

export interface Settings {
	/** Reject prices below this. Guards against a mistyped single digit. */
	minPrice: number;
	maxPrice: number;
	/** Reject unit counts above this — the "Max Units" slider in Settings. */
	maxUnits: number;
	rememberTheme: boolean;
}

/** A single item label from the sheet (column K) and its category (column J). */
export interface CategoryItem {
	label: string;
	category: string;
}

/** Cached sheet contents plus the timestamp of the last successful refresh. */
export interface CategoryCache {
	items: CategoryItem[];
	fetchedAt: string | null;
}

export interface CompareEntry {
	id: string;
	productName: string;
	category?: string;
	price: number;
	units: number;
	unitPrice: number;
	isWinner?: boolean;
	savings?: number;
	savingsPercent?: number;
}

export type Theme = 'light' | 'dark';

