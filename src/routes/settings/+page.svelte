<script lang="ts">
	import { settings, theme, accent, resetAll, setTheme, setAccent } from '$lib/store';
	import {
		categories,
		categoriesFetchedAt,
		categoriesStatus,
		categoriesError,
		refreshCategories
	} from '$lib/categories';
	import { ACCENTS } from '$lib/accents';
	import { cn } from '$lib/cn';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Switch from '$lib/components/Switch.svelte';

	// Local mirror so the inputs feel instant.
	// Clamp on init: values saved before the sliders existed could sit outside
	// the new ranges (the old inputs allowed up to 99,999 / 99).
	let s = {
		...$settings,
		maxPrice: Math.min(30000, Math.max(10000, Math.round($settings.maxPrice / 5000) * 5000)),
		maxQuantity: Math.min(50, Math.max(5, Math.round($settings.maxQuantity / 5) * 5))
	};
	let saved = false;

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
			maxPrice: Math.min(30000, Math.max(10000, Math.round(s.maxPrice / 5000) * 5000)),
			maxQuantity: Math.min(50, Math.max(5, Math.round(s.maxQuantity / 5) * 5))
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

		<div>
			<label for="max-price-input" class="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
				Max Price (₡)
			</label>
			<div class="flex items-center gap-3">
				<input
					id="max-price-input"
					type="range"
					bind:value={s.maxPrice}
					min="10000"
					max="30000"
					step="5000"
					class="h-2 flex-1 cursor-pointer accent-accent"
				/>
				<span class="w-16 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
					₡{s.maxPrice.toLocaleString('en-US')}
				</span>
			</div>
			<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
				Reject prices above this. 10,000 – 30,000 in steps of 5,000.
			</p>
		</div>

		<div>
			<label for="max-quantity-input" class="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
				Max Quantity
			</label>
			<div class="flex items-center gap-3">
				<input
					id="max-quantity-input"
					type="range"
					bind:value={s.maxQuantity}
					min="5"
					max="50"
					step="5"
					class="h-2 flex-1 cursor-pointer accent-accent"
				/>
				<span class="w-8 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
					{s.maxQuantity}
				</span>
			</div>
			<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
				Caps the quantity field. 5 – 50 in steps of 5.
			</p>
		</div>
	</Card>

	<!--
		Appearance is its own card rather than a row tacked onto the limits: the
		accent picker is the most visible control on this screen, and mixing it in
		with the numeric caps made the two feel like one setting.
	-->
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

		<!--
			Native radios rather than buttons: the group gets arrow-key navigation,
			roving focus and "2 of 5" style announcements for free, none of which a
			div-with-role="radio" reproduces reliably.

			The real input is `sr-only`, so the visible affordance has to carry both
			states itself. Selection is signalled by a CHECK GLYPH as well as the
			ring — never by colour alone (WCAG 1.4.1), which matters here because the
			swatch's whole job is to be a colour.

			`peer-*` works because the input precedes the ring overlay as a sibling;
			the overlay is what paints focus, since an outline on a clipped 1px input
			would never be seen.
		-->
		<fieldset class="space-y-2">
			<legend class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Accent Color</legend>
			<p class="text-xs text-zinc-500 dark:text-zinc-400">
				Tints buttons, switches and highlights. Applies instantly.
			</p>

			<div class="flex items-center gap-2">
				{#each ACCENTS as option (option.id)}
					<label
						class="relative flex h-11 flex-1 cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-white transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
					>
						<input
							type="radio"
							name="accent-color"
							class="peer sr-only"
							value={option.id}
							checked={$accent === option.id}
							aria-label={`${option.label} accent`}
							on:change={() => setAccent(option.id)}
						/>

						<span class={cn('flex h-6 w-6 items-center justify-center rounded-full', option.swatchClass)}>
							{#if $accent === option.id}
								<svg
									class="h-4 w-4 text-accent-fg"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									aria-hidden="true"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="m5 13 4 4L19 7" />
								</svg>
							{/if}
						</span>

						<span
							class="pointer-events-none absolute inset-0 rounded-md outline-2 outline-offset-2 outline-accent opacity-0 transition-opacity peer-checked:opacity-100 peer-focus-visible:opacity-100"
						></span>
					</label>
				{/each}
			</div>
		</fieldset>
	</Card>

	<!--
		Saves the LIMITS only. The accent is intentionally not in this payload —
		like dark mode it takes effect on tap and persists on its own key, so
		waiting for this button would be a second, contradictory rule.
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
