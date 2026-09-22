import { writable, derived, get } from 'svelte/store';
import type { CategoryItem } from './models';
import {
	CATEGORIES_CSV_URL,
	DEFAULT_CATEGORY,
	KEY_CATEGORIES,
	loadJSON,
	saveJSON,
	parseCategoriesCSV,
	sortByLabel,
	uniqueCategories,
	resolveCategoryFrom
} from './utils';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Label -> category pairs ingested from the published Google Sheet.
 * Empty until hydrated from localStorage or fetched over the network.
 */
export const categories = writable<CategoryItem[]>([]);

/** ISO timestamp of the last successful refresh (null when never fetched). */
export const categoriesFetchedAt = writable<string | null>(null);

/** Current network state of the CSV ingestion. */
export const categoriesStatus = writable<FetchStatus>('idle');

/** Human-readable error from the last failed refresh. */
export const categoriesError = writable<string | null>(null);

/** Sorted, de-duplicated category names for display / diagnostics. */
export const categoryOptions = derived(categories, ($categories) =>
	uniqueCategories($categories)
);

/** Guard so the write-back subscription is only wired once. */
let subscribed = false;

/** Persist the current cache (items + timestamp) in one shot. */
function persist(): void {
	saveJSON(KEY_CATEGORIES, {
		items: get(categories),
		fetchedAt: get(categoriesFetchedAt)
	});
}

/**
 * Call once from the root layout's `onMount`.
 * Restores the cached sheet contents and wires up write-back persistence.
 */
export function hydrateCategories(): void {
	const stored = loadJSON<{ items?: CategoryItem[]; fetchedAt?: string | null }>(
		KEY_CATEGORIES,
		{}
	);

	categories.set(Array.isArray(stored.items) ? sortByLabel(stored.items) : []);
	categoriesFetchedAt.set(stored.fetchedAt ?? null);

	if (!subscribed) {
		// Persist on either change so the timestamp survives a reload.
		categories.subscribe(persist);
		categoriesFetchedAt.subscribe(persist);
		subscribed = true;
	}
}

/**
 * Fetch the sheet and REPLACE the whole cache.
 * On failure the previous cache is preserved so a flaky network never
 * destroys good data.
 */
export async function refreshCategories(): Promise<boolean> {
	categoriesStatus.set('loading');
	categoriesError.set(null);

	try {
		const response = await fetch(CATEGORIES_CSV_URL, { cache: 'no-store' });
		if (!response.ok) {
			throw new Error(`Sheet responded ${response.status}`);
		}

		const text = await response.text();
		const items = sortByLabel(parseCategoriesCSV(text));

		if (items.length === 0) {
			throw new Error('No item labels found in columns J-K');
		}

		// Full overwrite: add/edit/remove on the sheet is the source of truth.
		categories.set(items);
		categoriesFetchedAt.set(new Date().toISOString());
		categoriesStatus.set('success');
		return true;
	} catch (error) {
		categoriesStatus.set('error');
		categoriesError.set(error instanceof Error ? error.message : String(error));
		return false;
	}
}

/**
 * Load the sheet only when nothing is cached — the "first launch" path.
 * Once cached, the app never hits the network again until the user taps
 * "Refresh categories" in Settings.
 */
export async function ensureCategoriesLoaded(): Promise<void> {
	if (get(categories).length > 0) return;
	await refreshCategories();
}

/** Resolve a free-text label to a category, defaulting to `Otros`. */
export function resolveCategory(label: string): string {
	return resolveCategoryFrom(label, get(categories)) || DEFAULT_CATEGORY;
}
