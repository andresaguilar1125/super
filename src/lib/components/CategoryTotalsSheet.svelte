<script lang="ts">
	import { tick } from 'svelte';
	import type { CategoryTotal } from '$lib/utils';
	import { formatCurrency } from '$lib/store';

	/**
	 * Bottom sheet listing the tape's spend per category.
	 *
	 * A sheet rather than the alternatives that were considered:
	 * - a stacked bar in the total strip is not descriptive (an unlabelled
	 *   sliver tells you nothing) and needs a colour per category, which would
	 *   fight the palette and fail AA for most hues;
	 * - charts mean a dependency that the flat, border-driven design language
	 *   and the 32-entry service-worker precache would both pay for;
	 * - pills scroll sideways forever and cannot carry a value per category;
	 * - a table is mostly dead space at two categories.
	 *
	 * A sheet is an OVERLAY, so it costs the sticky geometry nothing — the
	 * `--spacing-sticky-top` token maths is untouched because the strip never
	 * changes height. Every row carries its own label, so the proportion bar is
	 * descriptive in a way a bare strip bar could never be, and it scales from
	 * one category to N.
	 *
	 * IMPORTANT — where this gets mounted: the caller renders it as a SIBLING of
	 * `<main>`, never inside the sticky total strip. The strip is `sticky z-10`,
	 * and a non-auto z-index creates a stacking context, so a `fixed` overlay
	 * nested inside it is trapped there and paints BELOW the header (`z-20`).
	 * Mounted at the root, this `z-40` wins as intended.
	 */
	export let open = false;
	export let totals: CategoryTotal[] = [];
	/** Headline tape total, for the sheet's footer. */
	export let total = 0;

	const TITLE_ID = 'category-totals-title';

	let panel: HTMLDivElement | null = null;
	/** Element focused before opening, so focus can be handed back on close. */
	let lastFocused: HTMLElement | null = null;

	/*
	 * Detect the open→closed TRANSITION rather than reacting to `open` itself.
	 * A bare `$: if (open)` block re-runs on every change while the sheet is
	 * open (a new row added, an accent switched), which would re-capture focus
	 * and stomp the value we are trying to preserve.
	 */
	let wasOpen = false;
	$: if (open !== wasOpen) {
		wasOpen = open;
		if (open) {
			lastFocused = (typeof document !== 'undefined'
				? document.activeElement
				: null) as HTMLElement | null;
			void tick().then(() => panel?.focus());
		} else {
			lastFocused?.focus();
		}
	}

	/*
	 * Lock background scrolling while open, and restore whatever the body had
	 * before. Without this the tape scrolls underneath the sheet on touch.
	 */
	$: if (typeof document !== 'undefined') {
		document.body.style.overflow = open ? 'hidden' : '';
	}

	function close() {
		open = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') close();
	}
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-40 flex flex-col justify-end">
		<!--
			A real <button> rather than a div with on:click: pointer users get the
			hit target for free, and assistive tech is not left wondering about a
			giant unnamed element. `cursor-default` stops it pretending to be a
			link, since the tap target is the whole viewport.
		-->
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-zinc-900/40 dark:bg-zinc-950/70"
			aria-label="Close totals"
			on:click={close}
		></button>

		<div
			bind:this={panel}
			id="category-totals-sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby={TITLE_ID}
			tabindex="-1"
			class="relative max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-none outline-none dark:border-zinc-800 dark:bg-zinc-900"
		>
			<header
				class="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<h2 id={TITLE_ID} class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
					Totals by category
				</h2>

				<button
					type="button"
					class="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
					aria-label="Close"
					on:click={close}
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18 18 6M6 6l12 12" />
					</svg>
				</button>
			</header>

			{#if totals.length === 0}
				<!--
					Defensive only: the strip's trigger is disabled when the tape is
					empty, so this should be unreachable in normal use.
				-->
				<p class="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
					No items on the tape yet.
				</p>
			{:else}
				<ul class="divide-y divide-zinc-200 dark:divide-zinc-800">
					{#each totals as row (row.category)}
						<li class="px-4 py-3">
							<div class="flex items-baseline justify-between gap-3">
								<span class="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
									{row.category}
								</span>
								<span class="shrink-0 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
									<span class="text-zinc-400 dark:text-zinc-600">₡</span>{formatCurrency(row.subtotal)}
								</span>
							</div>

							<div class="mt-2 flex items-center gap-3">
								<div class="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
									<!--
										Inline style, not a Tailwind class: `share` is per-row runtime
										data, and an arbitrary value like `w-[37%]` is never generated
										because Tailwind only sees literal source text at build time.
									-->
									<div class="h-full rounded-full bg-accent" style="width: {row.share}%"></div>
								</div>

								<span
									class="w-28 shrink-0 text-right text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
								>
									{row.share.toFixed(0)}% · {row.itemCount}{row.itemCount === 1 ? ' item' : ' items'}
								</span>
							</div>
						</li>
					{/each}
				</ul>

				<div class="flex items-baseline justify-between border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
					<span class="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
						Total
					</span>
					<span class="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
						₡{formatCurrency(total)}
					</span>
				</div>
			{/if}
		</div>
	</div>
{/if}
