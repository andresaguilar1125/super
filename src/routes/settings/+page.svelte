<script lang="ts">
	import { settings, theme, resetAll, setTheme, formatCurrency, LIMITS } from '$lib/store';
	import {
		categories,
		categoriesFetchedAt,
		categoriesStatus,
		categoriesError,
		refreshCategories
	} from '$lib/categories';
	import type { Settings } from '$lib/models';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Switch from '$lib/components/Switch.svelte';

	/**
	 * The price FLOOR, no longer user-configurable.
	 *
	 * It is a mistyped-digit guard rather than a policy knob: the real dataset's
	 * cheapest item is ₡90, so any floor in single digits blocks a slip without ever
	 * rejecting a legitimate entry. Exposing it as a slider invited people to set a
	 * policy with it, which is not what it is for.
	 *
	 * Read from `LIMITS` rather than repeated here, because the same number is what
	 * `hydrateStores()` pins stored settings to. Two copies would be free to drift.
	 */
	const FIXED_MIN_PRICE = LIMITS.minPrice;

	/**
	 * Snap a settings object into the sliders' ranges, and pin the values that are no
	 * longer user-configurable.
	 *
	 * A stored value can sit outside a range for two reasons: it predates the current
	 * sliders (the old inputs allowed up to 99,999 / 99), or it is simply not on a
	 * step boundary. Clamping here means the UI can never show a value its slider
	 * cannot represent.
	 *
	 * `minPrice` is FORCED, not clamped. The slider is gone — the floor is a fixed
	 * ₡10 — but the field still exists on `Settings` and every validator call site
	 * reads it, so a value stored by an older build has to be corrected here or the
	 * calculator would keep enforcing whatever it used to be. This is the migration.
	 */
	function normalize(source: Pick<Settings, 'minPrice' | 'maxPrice' | 'maxUnits'>) {
		return {
			minPrice: FIXED_MIN_PRICE,
			maxPrice: Math.min(
				LIMITS.maxPriceMax,
				Math.max(LIMITS.maxPriceMin, Math.round(source.maxPrice))
			),
			maxUnits: Math.min(
				LIMITS.maxUnitsMax,
				Math.max(LIMITS.maxUnitsMin, Math.round(source.maxUnits / LIMITS.maxUnitsStep) * LIMITS.maxUnitsStep)
			)
		};
	}

	/*
	 * Local mirror so the sliders feel instant.
	 *
	 * The mirror has to be re-seeded from the store AFTER hydration, and this is
	 * not a nicety — it is the whole reason the block below exists.
	 *
	 * Every route is prerendered with SSR on, and `hydrateStores()` runs in the
	 * LAYOUT's `onMount`. A page's own `onMount` fires BEFORE its parent's, so at
	 * the moment this component initialises the store is still holding the DEFAULTS
	 * (5 / 25 000 / 50). A direct load or a refresh of `/settings` therefore used to
	 * render the defaults regardless of what was saved — and because `Save` writes
	 * this mirror back to the store, pressing it then OVERWROTE the user's real
	 * values with the defaults. A silently destructive round trip.
	 *
	 * Navigating in from the calculator happened to work, because by then hydration
	 * had already finished and the store held the real values. That is why the bug
	 * looked intermittent.
	 *
	 * The reactive block below follows the store until the user first touches a
	 * slider, then stops. `touched` is what keeps it from fighting a drag, and it is
	 * deliberately not reset by `saveSettings()` — after a save the mirror and the
	 * store agree anyway.
	 */
	let s = { ...$settings, ...normalize($settings) };
	let saved = false;
	let touched = false;

	// Re-seed from the store on hydration (and on any external change), until the
	// user starts editing. Without the guard a drag would be stomped mid-move.
	$: if (!touched) s = { ...$settings, ...normalize($settings) };

	/** Format the last-refresh timestamp for display. */
	$: lastRefreshed = $categoriesFetchedAt
		? new Date($categoriesFetchedAt).toLocaleString()
		: 'Never';
	$: refreshing = $categoriesStatus === 'loading';

	async function handleRefreshCategories() {
		await refreshCategories();
	}

	function saveSettings() {
		$settings = {
			...s,
			// Snap + clamp to the slider ranges so a stale value can never
			// leave the calculator rejecting every price.
			...normalize(s)
		};
		saved = true;
	}

	let confirmWipe = false;
	function wipeTape() {
		if (!confirmWipe) {
			confirmWipe = true;
			setTimeout(() => (confirmWipe = false), 3000);
			return;
		}
		resetAll();
		confirmWipe = false;
	}
</script>

<div class="space-y-6">
	<h2 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">Settings</h2>

	<Card className="space-y-4">
		<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Limits</p>

		<!--
			The Min Price row is GONE. The floor is a fixed ₡10 now — see
			`FIXED_MIN_PRICE`. Removing it also removes the only reason `touched`
			needed to be resilient to a third slider's drag.
		-->
		<div>
			<label for="max-price-input" class="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
				Max Price (₡)
			</label>
			<div class="flex items-center gap-3">
				<input
					id="max-price-input"
					type="range"
					bind:value={s.maxPrice}
					on:input={() => (touched = true)}
					min={LIMITS.maxPriceMin}
					max={LIMITS.maxPriceMax}
					step="1"
					class="h-2 w-0 flex-1 cursor-pointer accent-brand"
				/>
				<!--
					`w-20` on BOTH value spans, not `w-16` on one and `w-8` on the other.
					The span is `shrink-0`, so its width comes straight out of the
					slider's `flex-1` share — two different widths meant two different
					slider lengths, which reads as a layout bug. `20` (80px) holds the
					widest value here (`9 999`, ~53px) with room to spare.
				-->
				<span class="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
					{formatCurrency(s.maxPrice)}
				</span>
			</div>
			<!--
				`step="1"`, NOT 100. A step that does not divide (max − min) exactly makes
				the top of the range UNREACHABLE: at step 100 from 1000 the slider tops out
				at 9900, so the label could read `9 999` while the control under it
				physically could not. The value is snapped to a single colón instead, which
				costs nothing at a 9 000-value range and keeps the ceiling real.
			-->
			<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
				Reject prices above this, {formatCurrency(LIMITS.maxPriceMin)} –
				{formatCurrency(LIMITS.maxPriceMax)}. This caps the price of ONE item, not the
				line total — a {formatCurrency(5000)} item × 5 is a valid
				{formatCurrency(25000)} line.
			</p>
		</div>

		<div>
			<label for="max-units-input" class="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
				Max Units
			</label>
			<div class="flex items-center gap-3">
				<input
					id="max-units-input"
					type="range"
					bind:value={s.maxUnits}
					on:input={() => (touched = true)}
					min={LIMITS.maxUnitsMin}
					max={LIMITS.maxUnitsMax}
					step={LIMITS.maxUnitsStep}
					class="h-2 w-0 flex-1 cursor-pointer accent-brand"
				/>
				<span class="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
					{s.maxUnits}
				</span>
			</div>
			<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
				Caps the Units field. {LIMITS.maxUnitsMin} – {LIMITS.maxUnitsMax} in steps of
				{LIMITS.maxUnitsStep}.
			</p>
		</div>
	</Card>

	<!-- Dark mode is the only display setting there is. -->
	<Card className="space-y-4">
		<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Appearance</p>

		<div class="flex items-center justify-between">
			<div>
				<p class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Dark Mode</p>
				<p class="text-xs text-zinc-500 dark:text-zinc-400">Same as the header toggle</p>
			</div>
			<Switch
				checked={$theme === 'dark'}
				label="Dark mode"
				on:click={() => setTheme($theme === 'dark' ? 'light' : 'dark')}
			/>
		</div>

	</Card>

	<!--
		Saves the LIMITS only. Dark mode is intentionally excluded: like the header
		toggle it takes effect on tap and persists under its own key, so waiting for
		this button would be a second, contradictory rule.
	-->
	<Button variant="solid" size="md" block on:click={saveSettings}>
		{saved ? '✓ Saved!' : 'Save Settings'}
	</Button>

	<!-- Item categories from the Google Sheet -->
	<Card className="space-y-3">
		<div>
			<p class="mb-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Item Categories</p>
			<p class="text-xs text-zinc-500 dark:text-zinc-400">
				Item names and their categories are read-only, imported from your Google Sheet
				(columns J and K). They load automatically the first time and are kept on this
				device. Tap below to pull the latest edits.
			</p>
		</div>

		<div class="flex items-center justify-between text-xs">
			<span class="text-zinc-500 dark:text-zinc-400">Labels</span>
			<span class="font-medium text-zinc-900 dark:text-zinc-100">{$categories.length}</span>
		</div>
		<div class="flex items-center justify-between text-xs">
			<span class="text-zinc-500 dark:text-zinc-400">Last refreshed</span>
			<span class="font-medium text-zinc-900 dark:text-zinc-100">{lastRefreshed}</span>
		</div>

		<Button variant="solid" size="md" block disabled={refreshing} on:click={handleRefreshCategories}>
			{refreshing ? 'Refreshing…' : 'Refresh categories'}
		</Button>

		{#if $categoriesStatus === 'success'}
			<p class="text-xs text-zinc-600 dark:text-zinc-400">
				✓ Updated — {$categories.length} labels loaded.
			</p>
		{:else if $categoriesStatus === 'error'}
			<p class="text-xs text-red-600 dark:text-red-400">
				Could not reach the sheet ({$categoriesError}). Your saved categories were kept.
			</p>
		{/if}
	</Card>

	<!-- Danger zone -->
	<Card tone="danger">
		<p class="mb-1 text-sm font-semibold text-red-600 dark:text-red-400">Danger Zone</p>
		<p class="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
			Clears every item on the tape. Settings are kept.
		</p>
		<Button
			variant={confirmWipe ? 'destructive' : 'destructive-soft'}
			size="md"
			block
			on:click={wipeTape}
		>
			{confirmWipe ? 'Tap again to confirm' : 'Clear all items'}
		</Button>
	</Card>
</div>
