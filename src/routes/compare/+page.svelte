<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { compareUnitPrices, validateCompareQty } from '$lib/utils';
	import { addRow } from '$lib/store';
	import { categories, resolveCategory } from '$lib/categories';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import Input from '$lib/components/Input.svelte';

	// Raw strings so the fields stay uncontrolled and mobile keyboards behave.
	let productName = '';
	let singlePriceRaw = '';
	let singleUnitsRaw = '1';
	let packPriceRaw = '';
	let packUnitsRaw = '1';

	/**
	 * Comparing is a one-off calculation, not a saved list. Entering the screen
	 * always starts from a blank slate so a previous comparison can't linger and
	 * silently skew the next one.
	 */
	onMount(reset);
	function reset() {
		productName = '';
		singlePriceRaw = '';
		packPriceRaw = '';
		singleUnitsRaw = '1';
		packUnitsRaw = '1';
	}

	// Digits-only helpers, matching the calculator's entry rules.
	const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

	function onNumeric(e: Event, max: number): string {
		const el = e.currentTarget as HTMLInputElement;
		const next = digits(el.value, max);
		el.value = next;
		return next;
	}

	// Svelte 4 does not allow TS syntax in markup, so handlers live here.
	function onName(e: Event): void {
		const el = e.currentTarget as HTMLInputElement;
		productName = el.value.slice(0, 30);
		el.value = productName;
	}

	function onSinglePrice(e: Event) {
		singlePriceRaw = onNumeric(e, 5);
	}
	function onSingleUnits(e: Event) {
		singleUnitsRaw = onNumeric(e, 4);
	}
	function onPackPrice(e: Event) {
		packPriceRaw = onNumeric(e, 6);
	}
	function onPackUnits(e: Event) {
		packUnitsRaw = onNumeric(e, 4);
	}

	// The divisor must be a positive whole number. Gating the verdict on this
	// keeps a zeroed field from producing a verdict computed off a coerced
	// divisor — `compareUnitPrices` clamps to 1 to avoid dividing by zero, which
	// would otherwise quietly treat "0" as "1".
	$: singleUnitsCheck = validateCompareQty(singleUnitsRaw);
	$: packUnitsCheck = validateCompareQty(packUnitsRaw);
	$: unitsValid = singleUnitsCheck.ok && packUnitsCheck.ok;

	// Recomputes on every keystroke so the verdict tracks the inputs live.
	$: result = compareUnitPrices({
		singlePrice: parseInt(singlePriceRaw, 10) || 0,
		singleQty: parseInt(singleUnitsRaw, 10) || 1,
		packPrice: parseInt(packPriceRaw, 10) || 0,
		packQty: parseInt(packUnitsRaw, 10) || 1
	});

	// Format the per-unit figure with at most 2 decimals — price per Qty is
	// almost never whole colones, but showing 8 decimals would be unreadable.
	$: formatUnit = (n: number) =>
		n.toLocaleString('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

	$: winnerLabel = result.winner === 'single' ? 'Single' : 'Pack';

	/** Add the winning option to the tape and return to the calculator. */
	function addWinnerToTape() {
		if (!result.hasResults || !unitsValid) return;
		const isSingle = result.winner !== 'pack';
		addRow({
			// Price is what the whole package costs, and quantity is 1: the Qty
			// field is the divisor used to compare, NOT a count of items bought.
			// Passing it as `quantity` here made `addRow` multiply the two, so a
			// ₡5,000 pack of 4 was added as a ₡20,000 row.
			price: parseInt(isSingle ? singlePriceRaw : packPriceRaw, 10) || 0,
			quantity: 1,
			// Resolve like the calculator does, so a label picked from the sheet
			// inherits its column-J category instead of always landing in Otros.
			category: resolveCategory(productName.trim()),
			label: productName
		});
		// Straight back to the tape so the added row is visible immediately.
		void goto(`${base}/calculator`);
	}
</script>

<div class="space-y-4">
	<div>
		<h2 class="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
			Compare deals
		</h2>
		<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
			Enter a single item and a pack to see which costs less per Qty.
		</p>
	</div>

	<!-- Product name, used when adding the winner to the tape. Carries the same
	     sheet-backed type-ahead as the calculator's Item field, so a picked
	     label arrives with its category already resolved. -->
	<Input
		id="compare-name"
		label="Product"
		placeholder="Name"
		maxlength={30}
		list="label-options"
		autocomplete="off"
		enterkeyhint="done"
		value={productName}
		className="px-3 py-2"
		on:input={onName}
	/>

	<!-- Type-ahead source: item labels (column K) from the published sheet. -->
	<datalist id="label-options">
		{#each $categories as item (item.label)}
			<option value={item.label}>{item.category}</option>
		{/each}
	</datalist>

	<div class="grid grid-cols-2 gap-3">
		<!-- Single -->
		<Card
			className={result.hasResults && result.winner === 'single'
				? 'space-y-3 ring-2 ring-accent'
				: 'space-y-3'}
		>
			<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Single</p>
			<Input
				id="single-price"
				label="Price"
				placeholder="0"
				prefix="₡"
				inputmode="numeric"
				maxlength={5}
				value={singlePriceRaw}
				className="px-2 py-2"
				on:input={onSinglePrice}
			/>
			<Input
				id="single-units"
				label="Qty"
				placeholder="500"
				inputmode="numeric"
				maxlength={4}
				value={singleUnitsRaw}
				invalid={!singleUnitsCheck.ok}
				className="px-2 py-2"
				on:input={onSingleUnits}
			/>
			{#if result.singleUnitPrice > 0 && singleUnitsCheck.ok}
				<p class="text-xs text-zinc-500 dark:text-zinc-400">
					Price per Qty<br />
					<span class="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
						₡{formatUnit(result.singleUnitPrice)}
					</span>
				</p>
			{/if}
		</Card>

		<!-- Pack -->
		<Card
			className={result.hasResults && result.winner === 'pack'
				? 'space-y-3 ring-2 ring-accent'
				: 'space-y-3'}
		>
			<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Pack</p>
			<Input
				id="pack-price"
				label="Price"
				placeholder="0"
				prefix="₡"
				inputmode="numeric"
				maxlength={6}
				value={packPriceRaw}
				className="px-2 py-2"
				on:input={onPackPrice}
			/>
			<Input
				id="pack-units"
				label="Qty Pack"
				placeholder="500"
				inputmode="numeric"
				maxlength={4}
				value={packUnitsRaw}
				invalid={!packUnitsCheck.ok}
				className="px-2 py-2"
				on:input={onPackUnits}
			/>
			{#if result.packUnitPrice > 0 && packUnitsCheck.ok}
				<p class="text-xs text-zinc-500 dark:text-zinc-400">
					Price per Qty<br />
					<span class="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
						₡{formatUnit(result.packUnitPrice)}
					</span>
				</p>
			{/if}
		</Card>
	</div>

	<!-- Verdict. Held back until both Qty values are valid, so a zeroed field
	     shows guidance rather than a misleading winner. -->
	{#if result.hasResults && unitsValid}
		<div class="space-y-3">
			<Card>
				{#if result.winner === 'tie'}
					<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
						Same price per Qty
					</p>
					<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
						Both options cost ₡{formatUnit(result.singleUnitPrice)} per Qty — pick whichever
						fits your pantry.
					</p>
				{:else}
					<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
						{winnerLabel} wins
					</p>
					<p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
						You save
						<span class="font-semibold text-zinc-900 dark:text-zinc-100">
							₡{formatUnit(result.savings)}
						</span>
						per Qty —
						<span class="font-semibold text-zinc-900 dark:text-zinc-100">
							{result.savingsPercent.toFixed(1)}% cheaper
						</span>
						than the {result.winner === 'single' ? 'pack' : 'single item'}.
					</p>
				{/if}
			</Card>

			<Button variant="solid" size="lg" block on:click={addWinnerToTape}>
				Add winner to tape
			</Button>
		</div>
	{:else}
		<div class="flex flex-col items-center justify-center py-8 text-zinc-400 dark:text-zinc-600">
			<svg class="mb-3 h-9 w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
			</svg>
				<p class="text-sm">
					{unitsValid
						? 'Enter both prices to see which is the better value per Qty.'
						: 'Qty must be 1 or more.'}
				</p>
		</div>
	{/if}
</div>
