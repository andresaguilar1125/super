export interface CalculatorRow {
	id: string;
	price: number;
	quantity: number;
	category: string;
	/** Optional free-text item name (e.g. "Leche Dos Pinos 1L"). */
	label?: string;
	subtotal: number;
	error?: string;
}

export interface Settings {
	maxPrice: number;
	maxQuantity: number;
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

/**
 * Selectable accent colour. Red is intentionally excluded (reserved for
 * destructive/error), and the palette deliberately has no literal "white"
 * option — it would be invisible on a white card.
 *
 * `pink` replaced `gold`: amber is the one hue in the palette that fails WCAG AA
 * as TEXT on a light surface (amber-500 is ~2:1 on white), and the calculator
 * tape now paints its category and breakdown values in the accent. Pink was
 * chosen over rose because rose sits only ~10° from red-600, which made a
 * primary button ambiguous with a destructive one.
 * Keep in sync with the token blocks in `src/app.css`.
 */
export type Accent = 'blue' | 'purple' | 'pink' | 'green' | 'teal';
