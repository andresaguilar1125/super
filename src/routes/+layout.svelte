<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { theme, hydrateStores, subtotal, formatCurrency, toggleTheme, accent, calculatorRows, totalsByCategory } from '$lib/store';
	import { hydrateCategories, ensureCategoriesLoaded } from '$lib/categories';
	import IconButton from '$lib/components/IconButton.svelte';
	import CategoryTotalsSheet from '$lib/components/CategoryTotalsSheet.svelte';
	import PwaRegister from '$lib/components/PwaRegister.svelte';

	// Sheet state lives here rather than in the store: it is transient UI with no
	// reason to survive a reload, and the only two things that touch it (the strip
	// trigger and the sheet itself) are both rendered from this file.
	let showTotals = false;

	onMount(() => {
		hydrateStores();
		// Restore the cached sheet labels, then fetch only on first launch
		// (empty cache). After that the cache is refreshed manually in Settings.
		hydrateCategories();
		ensureCategoriesLoaded();
	});

	// The header is shared across routes, so the top-left affordance, the total
	// strip, and the sticky offsets are all driven by the current path.
	// `/compare` and `/settings` are drill-downs: they get a back button and no
	// total strip (only the calculator has a running tape to total).
	$: path = $page.url.pathname;
	$: isSubPage = path.startsWith('/compare') || path.startsWith('/settings');
	$: showTotal = !isSubPage;

	// React to theme changes: flip the `dark` class on <html>.
	// Guarded for SSR where `document` doesn't exist.
	$: if (typeof document !== 'undefined') {
		document.documentElement.classList.toggle('dark', $theme === 'dark');
	}

	// Accent travels the same way — an attribute on <html> rather than classes on
	// individual elements, so one token swap repaints every consumer at once.
	// The pre-paint script in app.html already set the initial value; this keeps
	// it in sync afterwards. `dataset.accent` reflects an unknown value harmlessly
	// (it simply matches no token block and falls back to blue).
	$: if (typeof document !== 'undefined') {
		document.documentElement.dataset.accent = $accent;
	}
</script>

<div class="min-h-screen bg-zinc-50 transition-colors dark:bg-zinc-950">
	<!-- Renders nothing; registers the service worker after hydration. -->
	<PwaRegister />

	<!--
		Height is driven by the `--spacing-header` token. The calculator's sticky
		entry form offsets itself with the same token, so the two can never drift
		apart the way the old hardcoded `top-[60px]` could.
	-->
	<header
		class="sticky top-0 z-20 h-(--spacing-header) border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
	>
		<!-- Horizontal padding matches <main> so both edges align. -->
		<div class="relative mx-auto flex h-full max-w-2xl items-center justify-between px-4">
			<!--
				On the calculator this is the app identity. On sub-pages it becomes a
				back button instead, so those screens have a consistent way out from
				the top-left — the same corner the browser back gesture lives in.

				`-ml-1` + `px-1` nets to zero, so the 24px glyph starts exactly on the
				16px content gutter shared by the total strip and <main>. It used to be
				`-ml-2`, which pushed the glyph out to 12px and made the header the only
				surface in the app not on that line.
			-->
			<a
				href="{base}/"
				aria-label={isSubPage ? 'Back to calculator' : 'Super home'}
				title={isSubPage ? 'Back to calculator' : 'Super'}
				class="-ml-1 flex h-11 items-center gap-2 rounded-md px-1 text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
			>
				{#if isSubPage}
					<svg
						class="h-6 w-6 text-zinc-700 dark:text-zinc-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
					</svg>
				{:else}
					<svg
						class="h-6 w-6 text-zinc-700 dark:text-zinc-300"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"
						/>
					</svg>
					<span class="text-lg font-semibold tracking-tight">Super</span>
				{/if}
			</a>

			<!-- Centered running total removed — it now has its own strip below. -->

			<div class="flex items-center gap-1">
				<IconButton label="Toggle theme" on:click={toggleTheme}>
					{#if $theme === 'light'}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
						</svg>
					{:else}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
						</svg>
					{/if}
				</IconButton>

				<!--
					`-mr-3` cancels the dead space inside this 44px touch target: the 20px
					glyph is centred, leaving 12px of padding on each side. Without it the
					icon's right edge sat 28px from the viewport edge while every other
					surface used 16px. The touch target stays 44px — only its position
					shifts, and it now reaches closer to the screen edge.
				-->
				<a
					href="{base}/settings"
					aria-label="Settings"
					title="Settings"
					class="-mr-3 inline-flex h-11 w-11 items-center justify-center rounded-md text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					</svg>
				</a>
			</div>
		</div>
	</header>

	<!--
		Live running total. Sits directly beneath the header and sticks with it,
		so it stays visible while scrolling a long tape without competing with the
		logo/toolbar for space. Calculator-only: the drill-down screens have no
		tape on screen, so a running total there would be noise.
		Height is `--spacing-totalbar`, which the entry form's sticky offset
		accounts for via `--spacing-sticky-top`.
	-->
	{#if showTotal}
		<div
			class="sticky top-(--spacing-header) z-10 h-(--spacing-totalbar) border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
		>
			<div class="mx-auto flex h-full max-w-2xl items-center justify-between px-4">
				<!--
					The label is the TRIGGER for the category breakdown, not just a
					caption. It keeps the word "Total" — so the strip still says what the
					number beside it is when the sheet is closed — and adds a chevron as
					the affordance, with glyph and label forming one 44px-tall touch
					target inside the 44px strip.

					The chevron is a deliberate middle ground: a bare icon would drop the
					word "Total" from the strip entirely, while a fully labelled button
					would compete with the amount for the left half of a short bar. The
					sheet's own title carries the full "Totals by category" wording, so
					the shorthand reads unambiguously in context.

					`-ml-1` + `px-1` nets to zero, matching the header's left glyph so the
					label stays on the 16px content gutter. Disabled on an empty tape — a
					breakdown of nothing is not worth opening, and it keeps the sheet's
					empty state defensive rather than load-bearing.
				-->
				<button
					type="button"
					class="-ml-1 flex h-11 items-center gap-1 rounded-md px-1 text-xs font-medium uppercase tracking-wide text-zinc-500 transition-colors hover:text-zinc-900 disabled:opacity-50 disabled:hover:text-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-100 dark:disabled:hover:text-zinc-400"
					aria-expanded={showTotals}
					aria-controls="category-totals-sheet"
					disabled={$calculatorRows.length === 0}
					on:click={() => (showTotals = true)}
				>
					Total
					<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
					</svg>
				</button>
				<span class="text-lg font-semibold tabular-nums tracking-tight text-zinc-900 dark:text-zinc-100">
					₡{formatCurrency($subtotal)}
				</span>
			</div>
		</div>
	{/if}

	<main class="px-4 py-4 max-w-2xl mx-auto">
		<slot />
	</main>

	<!--
		Rendered as a SIBLING of <main>, and deliberately NOT inside the sticky
		total strip above. That strip is `sticky` with `z-10`, and a non-auto
		z-index creates a stacking context — a `fixed` overlay nested inside it
		would be trapped in that context and paint BELOW the header (`z-20`), so
		the backdrop would cover the header while the sheet itself stayed behind it.
		This level of the tree has no z-index, so the sheet's `z-40` applies against
		the header as intended.
	-->
	<CategoryTotalsSheet bind:open={showTotals} totals={$totalsByCategory} total={$subtotal} />
</div>
