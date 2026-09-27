/**
 * Category chip styling.
 *
 * ONE brand-green chip for every category. This replaces a ten-hue palette that
 * gave each category its own colour: with ten saturated pills stacked down the
 * tape the list read as a rainbow, and because the eye could not settle on
 * anything the colour stopped carrying information — every row was shouting
 * equally loudly.
 *
 * It now wears the app's single brand green — the same fill and the same
 * contrasting label token as the primary button, so the chip belongs to the
 * colour system rather than being a second palette sitting beside it. Using the
 * `--brand` / `--brand-fg` PAIR rather than two hardcoded steps is what lets ONE
 * declaration serve both modes: light resolves to the deep green with white text,
 * dark to the bright green with near-black text. No `dark:` override is needed,
 * and adding one would defeat the token.
 *
 * Measured (the 10px uppercase label is small text, so it needs the full 4.5:1):
 * - light: white on emerald-700 = 5.37:1
 * - dark:  zinc-950 on emerald-400 = 10.29:1
 *
 * The category name is still written INSIDE the chip, so colour is never the only
 * signal (WCAG 1.4.1) and nothing is lost for a colour-blind or greyscale user.
 * What the chip still does is what a pill is actually good at: it separates the
 * category from the product name, so the two lines of a row stay distinguishable.
 *
 * Do NOT name the retired neutral palette utilities in this comment. Tailwind
 * compiles class-shaped tokens it finds in source, comments included, so a prose
 * mention keeps emitting rules for colours nothing uses any more.
 *
 * `chipClass()` takes a category purely so call sites read naturally and so a
 * future per-category treatment would not need a signature change. It deliberately
 * ignores its argument today.
 *
 * Pure data + one lookup, no Svelte or store imports, so it stays unit-testable.
 */

/** Shared shape so every chip reads identically regardless of category. */
const CHIP_BASE =
	'inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';

/** The brand pair: one fill plus its contrasting label colour, resolved per mode. */
const CHIP_COLOURS = 'bg-brand text-brand-fg';

/** Resolve a category to its chip class list. */
export function chipClass(_category?: string | null): string {
	return `${CHIP_BASE} ${CHIP_COLOURS}`;
}
