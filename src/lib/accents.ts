/**
 * Ordered accent palette — the single source of truth for what the Settings
 * picker offers.
 *
 * Red is intentionally absent: it stays reserved for destructive/error, so a
 * primary button can never be mistaken for a delete. There is also no literal
 * "white" option — it would be invisible on a white card.
 *
 * `pink` replaced `gold`. Amber was the only hue that failed WCAG AA as text on
 * a light surface (amber-500 is ~2:1 on white), and the accent is now used for
 * text — the tape's category and breakdown values — not just as a fill.
 * `rose` was the near-miss: at hue ~17° it sits only ~10° from red-600, so it
 * read as a second red and made a primary button ambiguous with a delete.
 * Pink at hue ~4° is ~23° away and stays clearly distinct.
 *
 * The ids here, the token blocks in `src/app.css`, and the pre-paint script in
 * `src/app.html` all have to agree. Changing the id of an existing accent
 * silently resets anyone who had picked it (the stored value fails the
 * `isAccent` check and falls back to the default), so prefer adding over
 * renaming.
 *
 * Pure data only — no Svelte or store imports, so this stays unit-testable.
 */
import type { Accent } from './models';

export interface AccentOption {
	id: Accent;
	/** Human label. Also the picker's accessible name. */
	label: string;
	/**
	 * Solid fill for the picker swatch.
	 *
	 * These must be complete literal class strings. Tailwind v4 discovers
	 * classes by scanning source text, so a name assembled at runtime (e.g.
	 * `` `bg-${color}-600` ``) would never be generated.
	 */
	swatchClass: string;
}

export const ACCENTS: readonly AccentOption[] = [
	{ id: 'blue', label: 'Blue', swatchClass: 'bg-blue-600 dark:bg-blue-500' },
	{ id: 'purple', label: 'Purple', swatchClass: 'bg-purple-600 dark:bg-purple-400' },
	/* Swatch mirrors the fill step exactly (pink-700 light / pink-400 dark), the
	   same pairing green and teal already use. */
	{ id: 'pink', label: 'Pink', swatchClass: 'bg-pink-700 dark:bg-pink-400' },
	{ id: 'green', label: 'Green', swatchClass: 'bg-emerald-700 dark:bg-emerald-400' },
	{ id: 'teal', label: 'Teal', swatchClass: 'bg-teal-700 dark:bg-teal-300' }
];

export const DEFAULT_ACCENT: Accent = 'blue';

/** Narrow an untrusted value (e.g. raw localStorage) to a known accent. */
export function isAccent(value: unknown): value is Accent {
	return typeof value === 'string' && ACCENTS.some((a) => a.id === value);
}
