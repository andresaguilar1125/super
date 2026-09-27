/**
 * Category pill palette — one colour per item category.
 *
 * The nine names below are the complete set of category values in the published
 * sheet's column K, plus `Otros` (the fallback `resolveCategoryFrom()` assigns to
 * any label it cannot match). Ten pills, ten hues.
 *
 * Why a hardcoded map rather than a hash or an index:
 * - an index would re-colour every category the moment the sheet gained or lost a
 *   row, so an old screenshot of a tape would stop matching the app;
 * - a hash guarantees collisions at ten values (birthday problem), and two
 *   categories sharing a hue defeats the entire point of colour-coding;
 * - a literal map is stable and self-documenting, at the cost of a new sheet
 *   category landing on the fallback colour until this file is updated. That is
 *   the accepted trade.
 *
 * Colour rules, verified by computing WCAG ratios rather than eyeballing:
 * - **Light fills use the 700 step, not 600.** The 600 step fails AA as a text
 *   background for seven of these ten hues (cyan 3.60:1, orange 3.59:1, amber
 *   3.19:1, yellow 2.93:1, sky 4.02:1, lime 3.06:1 — all below 4.5:1). Every 700
 *   fill clears it, from yellow-700 at 4.92:1 up to slate-700 at 10.34:1. This
 *   mirrors the rule the accent palette already follows.
 * - **Dark fills use the 400 step with zinc-950 text**, ranging 6.98:1 (violet)
 *   to 12.95:1 (lime). The hue is kept and stepped lighter rather than being
 *   inverted to a pale tint, exactly like the accents.
 * - Red and rose are absent on purpose: red stays reserved for destructive/error
 *   so a delete control can never be confused with a category. Pink is the
 *   user-selected accent, so using it here would make one category look
 *   permanently "selected".
 *
 * Every `swatchClass` is a complete literal string. Tailwind v4 discovers classes
 * by scanning source text, so a name assembled at runtime (`` `bg-${hue}-700` ``)
 * would never be generated — the same constraint documented in `accents.ts`.
 *
 * Pure data + one lookup, no Svelte or store imports, so it stays unit-testable.
 */
import { DEFAULT_CATEGORY, normalizeKey } from './utils';

/**
 * Category name (from the sheet) -> pill classes.
 *
 * Keyed by plain string rather than by the `Accent` union on purpose — these
 * are categories, not accents, and keeping the two palettes' types apart stops
 * them being conflated later.
 */
const CATEGORY_PILL_CLASSES: Record<string, string> = {
	Bebidas: 'bg-cyan-700 text-white dark:bg-cyan-400 dark:text-zinc-950',
	Carnes: 'bg-orange-700 text-white dark:bg-orange-400 dark:text-zinc-950',
	Granos: 'bg-amber-700 text-white dark:bg-amber-400 dark:text-zinc-950',
	Harinas: 'bg-yellow-700 text-white dark:bg-yellow-400 dark:text-zinc-950',
	Hogar: 'bg-stone-700 text-white dark:bg-stone-400 dark:text-zinc-950',
	Lacteos: 'bg-sky-700 text-white dark:bg-sky-400 dark:text-zinc-950',
	Postres: 'bg-fuchsia-700 text-white dark:bg-fuchsia-400 dark:text-zinc-950',
	Salsas: 'bg-violet-700 text-white dark:bg-violet-400 dark:text-zinc-950',
	Vegetales: 'bg-lime-700 text-white dark:bg-lime-400 dark:text-zinc-950',
	Otros: 'bg-slate-700 text-white dark:bg-slate-400 dark:text-zinc-950'
};

/** Shared shape so every pill reads identically regardless of category. */
const PILL_BASE =
	'inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';

/** Classes used for a category with no entry in the map — same as `Otros`. */
const FALLBACK_CLASSES = CATEGORY_PILL_CLASSES[DEFAULT_CATEGORY];

/**
 * Resolve a category to its full class list.
 *
 * Matching is accent- and case-insensitive via `normalizeKey()`, the same
 * comparison `resolveCategoryFrom()` uses, so a hand-edited `Lácteos` in
 * localStorage still finds the `Lacteos` pill instead of silently falling back.
 */
export function pillClass(category: string | undefined | null): string {
	if (!category) return `${PILL_BASE} ${FALLBACK_CLASSES}`;

	const key = normalizeKey(category);
	const match = Object.keys(CATEGORY_PILL_CLASSES).find((name) => normalizeKey(name) === key);

	return `${PILL_BASE} ${match ? CATEGORY_PILL_CLASSES[match] : FALLBACK_CLASSES}`;
}

/** The categories this palette knows about, for diagnostics and tests. */
export const KNOWN_CATEGORIES: readonly string[] = Object.keys(CATEGORY_PILL_CLASSES);
