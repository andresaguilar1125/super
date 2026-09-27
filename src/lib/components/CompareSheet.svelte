<script lang="ts">
	import { tick } from 'svelte';
	import {
		compareUnitPrices,
		validateCompareUnits,
		validatePrice,
		unitFieldLabel,
		formatAmount
	} from '$lib/utils';
	import { addRow, settings } from '$lib/store';
	import { categories, resolveCategory } from '$lib/categories';
	import { cn } from '$lib/cn';
	import Card from '$lib/components/Card.svelte';
	import Button from '$lib/components/Button.svelte';
	import IconButton from '$lib/components/IconButton.svelte';
	import Input from '$lib/components/Input.svelte';

	/**
	 * Compare a small purchase against a big one by price per unit.
	 *
	 * This used to be a full `/compare` route. It is a sheet now so that comparing
	 * behaves exactly like every other overlay in the app — same backdrop, same
	 * focus handling, same Escape-to-close — and so the tape stays visible behind
	 * it. A whole screen for a two-field calculation was heavier than the job, and
	 * it forced the header to grow a back button and hide the running total just to
	 * get you back.
	 *
	 * The dialog skeleton (backdrop button, `wasOpen` transition guard, focus
	 * capture/restore, body scroll lock, Escape) is shared with
	 * `CategoryTotalsSheet`.
	 *
	 * IMPORTANT — where the caller mounts this: as a SIBLING of `<main>`, never
	 * inside the sticky entry form or the total strip. Those are `sticky z-10`, and
	 * a non-auto z-index creates a stacking context, so a `fixed` overlay nested
	 * inside one is trapped there and paints BELOW the header (`z-20`).
	 */
	export let open = false;

	const TITLE_ID = 'compare-sheet-title';

	let panel: HTMLDivElement | null = null;
	/** Element focused before opening, so focus can be handed back on close. */
	let lastFocused: HTMLElement | null = null;

	// Raw strings so the fields stay uncontrolled and mobile keyboards behave.
	let productName = '';
	let smallPriceRaw = '';
	let smallUnitsRaw = '1';
	let bigPriceRaw = '';
	let bigUnitsRaw = '1';

	/*
	 * Red is a WARNING, shown only after a tap on Add, never on open.
	 *
	 * This sheet starts blank every time, so flagging required fields on first render
	 * meant it greeted the user with four red borders — a warning that is always on
	 * conveys nothing and just looks broken. `attempted` latches on the first tap and
	 * each field then clears its OWN red as soon as it becomes valid. Same rule as
	 * the calculator's entry form.
	 */
	let attempted = false;

	/*
	 * Comparing is a one-off calculation, not a saved list, so it starts blank every
	 * time it opens. Reset on the closed→open TRANSITION rather than reactively, so
	 * a re-render while it is open cannot wipe what the user has typed.
	 */
	let wasOpen = false;
	$: if (open !== wasOpen) {
		wasOpen = open;
		if (open) {
			lastFocused = (typeof document !== 'undefined'
				? document.activeElement
				: null) as HTMLElement | null;

			reset();
			void tick().then(() => panel?.focus());
		} else {
			lastFocused?.focus();
		}
	}

	function reset() {
		productName = '';
		smallPriceRaw = '';
		bigPriceRaw = '';
		smallUnitsRaw = '1';
		bigUnitsRaw = '1';
		// A fresh sheet has nothing to warn about yet.
		attempted = false;
	}

	/* Lock background scrolling while open, and restore what the body had. */
	$: if (typeof document !== 'undefined') {
		document.body.style.overflow = open ? 'hidden' : '';
	}

	function close() {
		open = false;
	}

	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') close();
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

	function onSmallPrice(e: Event) {
		smallPriceRaw = onNumeric(e, 5);
	}
	function onSmallUnits(e: Event) {
		smallUnitsRaw = onNumeric(e, 4);
	}
	function onBigPrice(e: Event) {
		bigPriceRaw = onNumeric(e, 6);
	}
	function onBigUnits(e: Event) {
		bigUnitsRaw = onNumeric(e, 4);
	}

	/*
	 * The divisor must be a positive whole number. Gating the verdict on this keeps
	 * a zeroed field from producing a verdict computed off a coerced divisor —
	 * `compareUnitPrices` clamps to 1 to avoid dividing by zero, which would
	 * otherwise quietly treat "0" as "1".
	 */
	$: smallUnitsCheck = validateCompareUnits(smallUnitsRaw);
	$: bigUnitsCheck = validateCompareUnits(bigUnitsRaw);
	$: unitsValid = smallUnitsCheck.ok && bigUnitsCheck.ok;

	/*
	 * Prices go through the SAME validator as the calculator, including the
	 * Settings floor. These fields previously had no validation beyond
	 * digit-stripping, so a ₡1 comparison was possible here even after the
	 * calculator refused one.
	 */
	$: smallPriceCheck = validatePrice(smallPriceRaw, $settings.minPrice, $settings.maxPrice);
	$: bigPriceCheck = validatePrice(bigPriceRaw, $settings.minPrice, $settings.maxPrice);
	$: pricesValid = smallPriceCheck.ok && bigPriceCheck.ok;

	/*
	 * A price is REQUIRED for a comparison, and the Product name is required because
	 * the tape's category is derived from it. All of them warn only AFTER a tap on
	 * Add — see `attempted` — so the sheet no longer opens wearing four red borders.
	 * Each flag below switches back off the moment its own field becomes valid.
	 */
	$: smallPriceInvalid = attempted && !smallPriceCheck.ok;
	$: bigPriceInvalid = attempted && !bigPriceCheck.ok;

	/*
	 * The divisor's LABEL carries the inferred kind, so the unit is stated once —
	 * above the field, where you read it while deciding what to type — instead of
	 * also being echoed underneath. See `unitFieldLabel`.
	 */
	$: smallUnitsLabel = unitFieldLabel(smallUnitsCheck.value);
	$: bigUnitsLabel = unitFieldLabel(bigUnitsCheck.value);

	// Recomputes on every keystroke so the verdict tracks the inputs live.
	$: result = compareUnitPrices({
		singlePrice: parseInt(smallPriceRaw, 10) || 0,
		singleUnits: parseInt(smallUnitsRaw, 10) || 1,
		packPrice: parseInt(bigPriceRaw, 10) || 0,
		packUnits: parseInt(bigUnitsRaw, 10) || 1
	});

	/*
	 * Per-unit figures keep up to 2 decimals — a price per gram is almost never a
	 * whole colón, and 8 decimals would be unreadable.
	 *
	 * This used to be a LOCAL `toLocaleString('es-CR')` call, which grouped with a
	 * comma there while the calculator used `en-US` and grouped with a comma too
	 * but decimalised with a dot — so the two screens disagreed on both marks. It
	 * now goes through the app's one formatter: `es-CR` grouping (a no-break space)
	 * with a dot decimal, e.g. `1 234.57`.
	 */
	$: formatUnit = (n: number) => formatAmount(n, 2);

	/*
	 * The cards read Small / Big rather than Single / Pack because the comparison is
	 * not always a multipack question — it is just "less of this" versus "more of
	 * this", which holds whether a unit is one item or one gram. `compareUnitPrices()`
	 * still calls them `single`/`pack` internally; only the user-facing wording changed.
	 */
	$: winnerLabel = result.winner === 'single' ? 'Small' : 'Big';

	/** Add the winning option to the tape and close the sheet. */
	function addWinnerToTape() {
		/*
		 * Not `disabled` — see the footer markup. A tap on an incomplete form is what
		 * raises the red warnings, so it has to land. The early return still prevents
		 * an incomplete row (or a ₡0 row) from reaching the tape.
		 */
		if (!canAdd) {
			attempted = true;
			return;
		}

		const isSmall = result.winner !== 'pack';
		addRow({
			// Price is what the whole option costs, and units is 1: the Units field is
			// the divisor used to compare, NOT a count of items bought. Passing it
			// as `units` here made `addRow` multiply the two, so a ₡5,000 pack of 4
			// was added as a ₡20,000 row.
			price: parseInt(isSmall ? smallPriceRaw : bigPriceRaw, 10) || 0,
			units: 1,
			// Resolve like the calculator does, so a label picked from the sheet
			// inherits its column-J category instead of always landing in Otros.
			category: resolveCategory(productName.trim()),
			label: productName
		});

		// No navigation: the sheet sits over the calculator, so the new row is already
		// behind it once the sheet closes.
		close();
	}

	/**
	 * Gate the Add action on a usable result AND a product name — it used to be
	 * pressable with both sides empty, which added a ₡0 row to the tape.
	 *
	 * The name is required because the tape's category is DERIVED from it: an
	 * unnamed winner would land in `Otros` and could never be a real entry. The
	 * same rule applies to the calculator's own add and edit forms.
	 */
	$: productValid = productName.trim().length > 0;
	$: productInvalid = attempted && !productValid;
	$: canAdd = result.hasResults && unitsValid && productValid && pricesValid;
</script>

<svelte:window on:keydown={onKeydown} />

{#if open}
	<div class="fixed inset-0 z-40 flex flex-col justify-end">
		<!-- A real <button> so pointer users get the hit target and assistive tech is
		     not left with a giant unnamed element. -->
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-zinc-900/40 dark:bg-zinc-950/70"
			aria-label="Close compare"
			on:click={close}
		></button>

		<div
			bind:this={panel}
			id="compare-sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby={TITLE_ID}
			tabindex="-1"
			class="relative max-h-[90vh] overflow-y-auto rounded-t-xl border-t border-zinc-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-none outline-none dark:border-zinc-800 dark:bg-zinc-900"
		>
			<header
				class="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
			>
				<h2 id={TITLE_ID} class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
					Compare deals
				</h2>
			<!--
				The actions are wrapped in ONE flex group. With `justify-between` on the
				header, three direct children pushed the middle one to the CENTRE of the bar —
				which is where the Clear button was landing. Grouping them keeps the title
				left and the two actions together on the right, in the order Clear → Close.
			-->
			<div class="flex items-center">
				<IconButton
					label="Clear fields"
					className="shrink-0"
					on:click={reset}
				>
					<!-- Material Symbols `compare_arrows` — the same glyph the header uses to
					     open this sheet, so the two read as the same control. -->
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path d="M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z" />
					</svg>
				</IconButton>

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
			</div>
			</header>

			<div class="space-y-3 px-4 py-4">
				<!-- Product name, used when adding the winner to the tape. Carries the
				     sheet-backed type-ahead, so a picked label arrives with its category
				     already resolved. It is REQUIRED: the category is derived from this
				     name, so an unnamed winner could never be a real tape entry. -->
				<Input
					id="compare-name"
					label="Product"
					placeholder="Name"
					maxlength={30}
					list="compare-label-options"
					autocomplete="off"
					enterkeyhint="done"
					value={productName}
					invalid={productInvalid}
					className="px-3 py-2"
					on:input={onName}
				/>

				<!-- Type-ahead source: item labels (column K) from the published sheet. -->
				<datalist id="compare-label-options">
					{#each $categories as item (item.label)}
						<option value={item.label}>{item.category}</option>
					{/each}
				</datalist>

				<!--
					The two cards sit SIDE BY SIDE, with Price stacked above Units inside
					each. The fields cannot also be side by side: a two-column card layout
					leaves each field under ~90px on a 375px screen, which clips a 5-digit
					price. Stacking them inside keeps each field the full card width.
				-->
				<div class="grid grid-cols-2 gap-(--spacing-form-gap)">
					<Card
						className={result.hasResults && result.winner === 'single'
							? 'space-y-2 ring-2 ring-brand'
							: 'space-y-2'}
					>
						<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Small</p>
						<Input
							id="compare-small-price"
							label="Price"
							placeholder="0"
							inputmode="numeric"
							maxlength={5}
							value={smallPriceRaw}
							invalid={smallPriceInvalid}
							className="px-2 py-2"
							on:input={onSmallPrice}
						/>
						<Input
							id="compare-small-units"
							label={smallUnitsLabel}
							placeholder="1"
							inputmode="numeric"
							maxlength={4}
							value={smallUnitsRaw}
							invalid={!smallUnitsCheck.ok}
							className="px-2 py-2"
							on:input={onSmallUnits}
						/>
						<!--
							ONE line. The rate used to be `per {unit}` on one line, a <br>, then
							the number on a third — and the unit was repeated again on an echo line
							above. Three short lines for one statement, which read as a rendering
							fault. The unit now appears only on the field's LABEL, so this line can
							be just the figure and `per unit`.
						-->
						{#if result.singleUnitPrice > 0 && smallUnitsCheck.ok}
							<p class="text-xs text-zinc-500 dark:text-zinc-400">
								<span class="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
									{formatUnit(result.singleUnitPrice)}
								</span>
								per unit
							</p>
						{/if}
					</Card>

					<Card
						className={result.hasResults && result.winner === 'pack'
							? 'space-y-2 ring-2 ring-brand'
							: 'space-y-2'}
					>
						<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Big</p>
						<Input
							id="compare-big-price"
							label="Price"
							placeholder="0"
							inputmode="numeric"
							maxlength={6}
							value={bigPriceRaw}
							invalid={bigPriceInvalid}
							className="px-2 py-2"
							on:input={onBigPrice}
						/>
						<Input
							id="compare-big-units"
							label={bigUnitsLabel}
							placeholder="500"
							inputmode="numeric"
							maxlength={4}
							value={bigUnitsRaw}
							invalid={!bigUnitsCheck.ok}
							className="px-2 py-2"
							on:input={onBigUnits}
						/>
						<!-- Same single-line treatment as the Small card above. -->
						{#if result.packUnitPrice > 0 && bigUnitsCheck.ok}
							<p class="text-xs text-zinc-500 dark:text-zinc-400">
								<span class="text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
									{formatUnit(result.packUnitPrice)}
								</span>
								per unit
							</p>
						{/if}
					</Card>
				</div>

				<!--
					The verdict sits directly under the cards, where the instructional
					paragraph used to be. That paragraph only explained what to type, which
					the labels already say, so it was spending the most valuable space in
					the sheet on something you read once — while the actual answer required
					scrolling. Now the answer is above the fold and there is nothing to read
					when there is nothing to report.
				-->
				{#if result.hasResults && unitsValid}
					<Card>
						{#if result.winner === 'tie'}
							<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
								Same price per unit
							</p>
							<p class="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
								Both cost {formatUnit(result.singleUnitPrice)} per unit — pick whichever
								fits your pantry.
							</p>
						{:else}
							<p class="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
								{winnerLabel} wins
							</p>
							<p class="mt-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
								Save
								<span class="font-semibold text-zinc-900 dark:text-zinc-100">
									{formatUnit(result.savings)}
								</span>
								per unit —
								<span class="font-semibold text-zinc-900 dark:text-zinc-100">
									{result.savingsPercent.toFixed(1)}% cheaper
								</span>
								than the {result.winner === 'single' ? 'Big' : 'Small'} option.
							</p>
						{/if}
					</Card>
				{/if}
			</div>

			<div class="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
				<!--
					Gray while incomplete, not the brand green. This sheet starts blank on
					every open, so it would otherwise wear a prominent green fill almost
					all the time. Gray reads as "not yet".
					Measured: light `zinc-300` fill with `zinc-600` text is 5.23:1; dark
					`zinc-700` with `zinc-300` text is 7.07:1. The obvious dark pairing of
					`zinc-400` fails at 3.98:1 and was rejected.

					IMPORTANT — it is NOT `disabled`, even when incomplete. It keeps the
					gray look, but the tap has to land: that tap is what raises the red
					warnings on the empty fields. A `disabled` button swallows the click,
					so nothing would explain why the press did nothing — and an unfocusable
					button announces nothing to a screen reader either.
				-->
				<Button
					variant="solid"
					size="lg"
					block
					className={cn(
						'disabled:opacity-100',
						// Gray rather than red: red is reserved for the field warnings,
						// and the button is not itself an error. `hover:bg-brand-hover`
						// is neutralised so an incomplete button cannot light up green on
						// hover and read as ready.
						!canAdd &&
							'bg-zinc-300 text-zinc-600 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-700'
					)}
					on:click={addWinnerToTape}
				>
					Add winner to tape
				</Button>
			</div>
		</div>
	</div>
{/if}
