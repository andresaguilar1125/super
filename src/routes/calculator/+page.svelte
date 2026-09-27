<script lang="ts">
	import {
		calculatorRows,
		settings,
		addRow,
		deleteRow,
		updateRow,
		resetAll,
		formatCurrency
	} from '$lib/store';
	import {
		categories,
		resolveCategory,
		refreshCategories,
		categoriesStatus,
		categoriesError
	} from '$lib/categories';
	import { roundPrice, validatePrice, validateUnits } from '$lib/utils';
	import { chipClass } from '$lib/chips';
	import type { CalculatorRow } from '$lib/models';
	import { cn } from '$lib/cn';
	import Button from '$lib/components/Button.svelte';
	import IconButton from '$lib/components/IconButton.svelte';
	import Input from '$lib/components/Input.svelte';

	// --- Form state ---
	let priceRaw = '';
	/*
	 * Units ships EMPTY, meaning 1 — see `validateUnits`. The placeholder carries
	 * the `1`, so nothing is lost visually, and the field starts ready to type over
	 * rather than holding a digit you have to clear first.
	 */
	let unitsRaw = '';
	let labelRaw = '';

	// --- Add feedback ---
	/**
	 * Id of the row to flash, set from `addRow()`'s return value. Cleared on the
	 * row's `animationend` so a later add of the same row cannot inherit a
	 * completed animation's state.
	 */
	let justAddedId: string | null = null;

	// --- Editing ---
	/*
	 * ONE piece of state drives the whole mode. `null` is add mode; anything else
	 * is the id of the row being edited. Everything below derives from it, so
	 * there is no way for "which row am I editing" and "am I editing" to
	 * disagree — the bug class that a separate `showEdit` boolean plus an
	 * `editingRow` object would have invited.
	 *
	 * The editor IS this page's sticky form rather than a separate sheet. The form
	 * is already pinned at the top of the screen, which is exactly where an edit
	 * wants to be, so reusing it removed a whole overlay component and made add
	 * and edit behave identically.
	 */
	let editingId: string | null = null;

	$: editingRow = editingId ? $calculatorRows.find((r) => r.id === editingId) ?? null : null;
	$: isEditing = editingId !== null;

	/*
	 * Auto-exit if the row being edited disappears. This covers BOTH ways that can
	 * happen — the row's own two-tap delete, and `Reset all` — in one rule, rather
	 * than having to remember to call a cleanup from each.
	 *
	 * `editingId = null` then runs the seeding block below, which clears the
	 * fields, so the form never keeps showing a deleted row's values.
	 */
	$: if (editingId !== null && !$calculatorRows.some((r) => r.id === editingId)) {
		editingId = null;
	}

	/*
	 * Seed and clear on the TRANSITION of `editingId`, never reactively off
	 * `editingRow`. A bare `$: if (editingRow)` would re-run every time the tape
	 * changed and wipe whatever the user was typing mid-edit.
	 */
	let wasEditing = false;
	$: if (isEditing !== wasEditing) {
		wasEditing = isEditing;
		if (isEditing && editingRow) {
			priceRaw = String(editingRow.price);
			unitsRaw = String(editingRow.units);
			labelRaw = editingRow.label ?? '';
			// Editing arrives from a valid row, so there is nothing to warn about yet.
			attempted = false;
			requestAnimationFrame(() => {
				document.getElementById('price-input')?.focus();
			});
		} else {
			priceRaw = '';
			unitsRaw = '';
			labelRaw = '';
		}
	}

	/*
	 * Red is a WARNING, shown only after the user has tried to add or save.
	 *
	 * The rule used to be the opposite — a required field was flagged from the very
	 * first render, on the argument that the (disabled) Add button already hid the
	 * reason and the red border WAS the reason. That reads badly in practice: the
	 * form opens with an empty price and a blank product, so a brand-new tape showed
	 * two permanently red fields before the user had done anything wrong. A warning
	 * that is always on carries no information; it just looks broken.
	 *
	 * `attempted` latches on the first tap of Add/Save and never resets while the
	 * form lives, so the fields stay neutral until asked. Once latched, every field
	 * shows its own error UNTIL THAT FIELD BECOMES VALID — per-field, not all-or-
	 * nothing, so fixing the price clears the price rather than leaving it red until
	 * the whole form is done.
	 */
	let attempted = false;

	// --- Derived validation (recomputes on every keystroke) ---
	$: priceCheck = validatePrice(priceRaw, $settings.minPrice, $settings.maxPrice);
	$: unitsCheck = validateUnits(unitsRaw, $settings.maxUnits);
	/*
	 * The product name is REQUIRED. It is not just a label: the category is derived
	 * from it via the sheet, so an unnamed row would always land in `Otros` and
	 * could never carry a real category or be re-resolved later. Gating here covers
	 * add AND save, because the two handlers early-return on `canAdd`.
	 */
	$: labelValid = labelRaw.trim().length > 0;
	$: canAdd = priceCheck.ok && unitsCheck.ok && labelValid;

	/*
	 * Per-field warning flags: only ever true after a submit attempt, and each one
	 * switches itself back off as soon as its field satisfies the rule.
	 */
	$: priceWarn = attempted && !priceCheck.ok;
	$: unitsWarn = attempted && !unitsCheck.ok;
	$: labelWarn = attempted && !labelValid;

	$: loadingCategories = $categoriesStatus === 'loading';

	// --- Handlers ---
	function handleAdd() {
		/*
		 * The action button is deliberately NOT `disabled` — see the markup. A tap on
		 * an incomplete form is what raises the red warnings, so this has to be
		 * reachable. The early return keeps the row itself from being created.
		 */
		if (!canAdd) {
			attempted = true;
			return;
		}
		const row = addRow({
			price: priceCheck.value,
			units: unitsCheck.value,
			// Resolve BEFORE addRow truncates the label to 30 chars, so labels
			// longer than the display cap still map to their sheet category.
			category: resolveCategory(labelRaw.trim()),
			label: labelRaw
		});
		justAddedId = row.id;
		// Reset for the next rapid-fire entry. Units goes back to empty, which
		// `validateUnits` reads as 1.
		priceRaw = '';
		unitsRaw = '';
		labelRaw = '';
		// A completed add satisfies whatever the last failed attempt was about; the
		// next tap starts from a clean slate rather than from stale red borders.
		attempted = false;
		// Focus price input again for fast supermarket tapping.
		requestAnimationFrame(() => {
			document.getElementById('price-input')?.focus();
		});
	}

	function startEdit(row: CalculatorRow) {
		/*
		 * Deliberately ignored while an edit is already open, per the product
		 * decision: you must save or cancel first. Because that makes the tap a
		 * no-op, the other rows' edit buttons are `disabled` during edit mode (see
		 * the tape markup) so the affordance LOOKS inert instead of looking broken.
		 */
		if (isEditing) return;
		editingId = row.id;
	}

	function cancelEdit() {
		editingId = null;
	}

	/** Save the in-progress edit back onto its row. */
	function handleSaveEdit() {
		// Same early-return-raise pattern as `handleAdd()`. During an edit the fields
		// arrive prefilled and valid, so `attempted` is normally already set.
		if (!canAdd || !editingId) {
			attempted = true;
			return;
		}

		const label = labelRaw.trim();
		// `label` is optional on the row, so a cleared name becomes `undefined`
		// rather than an empty string — the tape then falls back to the category.
		// `updateRow()` re-applies `roundPrice()` and recomputes the subtotal.
		updateRow(editingId, {
			price: priceCheck.value,
			units: unitsCheck.value,
			// Re-resolved from the (possibly edited) name, exactly as `addRow()`
			// does, so renaming a product re-categorises it.
			category: resolveCategory(label),
			label: label || undefined
		});

		editingId = null;
	}

	/**
	 * Remove the row currently under edit. The tape row carries NO delete control
	 * of its own — the pencil is each row's single affordance, so editing is the
	 * one route to changing or removing a row.
	 *
	 * That leaves this button with no confirmation step, unlike `Reset all` and
	 * the Settings wipe. The reason those need a second tap is that they are
	 * reachable from a cold start; this one is only reachable by first entering
	 * edit mode for this exact row, so intent is already established. A second
	 * tap here would be a formality.
	 *
	 * No exit wiring is needed: `deleteRow()` removes the row, and the reactive
	 * rule above clears `editingId`, which restores add mode and resets the
	 * fields — the same path `Reset all` uses. That is deliberate, because `id`
	 * comes from the row under edit, so the row this deletes and the row the
	 * auto-exit watches for are always the same one.
	 */
	function deleteEditingRow() {
		if (!editingId) return;
		deleteRow(editingId);
	}

	let confirmReset = false;
	function handleReset() {
		if (!confirmReset) {
			confirmReset = true;
			setTimeout(() => (confirmReset = false), 3000);
			return;
		}
		resetAll();
		confirmReset = false;
	}

	function onPriceBlur() {
		// Round on blur per README, but only if it parses.
		if (priceCheck.ok) {
			priceRaw = String(roundPrice(priceCheck.value));
		}
	}

	function onPriceInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		// Keep only digits, cap at 5.
		priceRaw = el.value.replace(/\D/g, '').slice(0, 5);
		el.value = priceRaw;
	}

	function onUnitsInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		unitsRaw = el.value.replace(/\D/g, '').slice(0, 2) || '';
		el.value = unitsRaw;
	}

	function onLabelInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		labelRaw = el.value.slice(0, 30);
		el.value = labelRaw;
	}

	/**
	 * Escape cancels an edit. This is the keyboard user's only way out of edit
	 * mode, which is why edit mode is a lock with a documented release rather
	 * than a true modal trap.
	 */
	function onKeydown(event: KeyboardEvent) {
		if (isEditing && event.key === 'Escape') cancelEdit();
	}

	/**
	 * Enter commits, in whichever mode the form is in. Routing both through one
	 * handler keeps the keyboard path identical to the button path — previously
	 * Enter always added, which would have silently created a NEW row while the
	 * form was showing an edit.
	 */
	function onEnter() {
		if (isEditing) handleSaveEdit();
		else handleAdd();
	}
</script>

<svelte:window on:keydown={onKeydown} />

<!-- Entry form — sticky below the header AND the running-total strip. The
     offset comes from a single `--spacing-sticky-top` token so all three
     heights stay in sync.

     The border is the brand green at 2px, and it goes NEUTRAL DARK while
     editing.

     Red was tried here and it read as an ERROR, not as "editing" — a red frame
     around a form of perfectly valid values looks like something is wrong with
     the data. A near-black frame says "this panel has changed job" without
     accusing the content. The red that remains for edit mode is the DELETE
     word, where red genuinely belongs, because that one is destructive.

     Each arm names its `dark:` partner, because these are FIXED palette steps
     rather than the `--brand` token that flips on its own.

     Do NOT reach for an opacity here. Measured, the brand border only clears
     7.61:1 on the darkest surface at FULL strength, so a 60% blend would drop it
     to about 3.5:1 and the edge would disappear. Bolder means width, not alpha.

     The surface itself stays neutral `zinc-100` / `zinc-900` — a tinted panel
     was tried and dropped, because the three field labels sit on this surface and
     any tint strong enough to read as colour pushed them under AA. -->
<div
	class={cn(
		'sticky top-(--spacing-sticky-top) z-10 mb-4 space-y-3 rounded-lg border-2 bg-zinc-100 p-3 dark:bg-zinc-900',
		// Same conflict group (`border-color`), so `tailwind-merge` keeps exactly one.
		isEditing ? 'border-zinc-900 dark:border-zinc-100' : 'border-brand'
	)}
>
	<!--
		Edit-mode bar. Shown ONLY while editing, and it is the primary signal that the
		form has changed job: without it the same three fields and the same button
		would silently be doing something different.

		Kept a small label plus text buttons rather than a solid fill — a solid
		colour block would compete with the tape instead of annotating it.

		The bar has NO coloured rule of its own. It briefly carried a red left
		border, which made three red marks appear at once (the panel edge, this rule,
		and the row's ring). The panel border already turns red in this mode and
		wraps the whole interaction, so the rule was pure duplication. Dropping it
		also removed the `pl-2` that offset the label around it, so `Editing` now
		sits on the same 12px as the `Price` label directly below.

		The bar deliberately does NOT name the row. It used to — `Editing <name>` —
		but the name was doing two jobs already done elsewhere: the row's own ring
		marks which row is open, and the prefilled fields show its values. A third
		copy of the name made the bar longer and the signal no weaker.

		DELETE and CANCEL are both text buttons, not icons. Cancel is the ONLY way
		out of edit mode besides the Escape key, so it has to be legible rather than
		inferred; an icon bin would have to be interpreted, whereas the word says
		what it does. Both labels are uppercase so the bar reads as one command strip
		rather than mixing a shouted DELETE with a quiet Cancel.

		DELETE carries NO confirmation step. The two-tap guard is reserved for
		actions reachable from a cold start; this one can only be reached by first
		entering edit mode for this exact row, so intent is already established by
		the time it is tappable.
	-->
	{#if isEditing}
		<div class="flex items-center justify-between gap-3">
			<p class="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
				Editing
			</p>
			<div class="flex shrink-0 items-center gap-1">
				<!--
					`ghost` paints `text-zinc-700`; passing `text-red-600` here wins
					because `Button` runs `cn()` with `className` LAST, so
					`tailwind-merge` resolves the same conflict group in our favour (and
					the full hover/focus set has to be overridden with it, or the ghost
					hover would repaint the text zinc). Verified live: the computed
					colour is red-600, not the variant's zinc. There is no `danger` text
					variant to use instead — `destructive` is a filled red.
				-->
				<Button
					variant="ghost"
					size="sm"
					className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
					on:click={deleteEditingRow}
				>
					DELETE
				</Button>
				<Button variant="ghost" size="sm" on:click={cancelEdit}>CANCEL</Button>
			</div>
		</div>
	{/if}

	<!--
		ONE strip for all three fields: Price · Units · Product.

		It used to be two rows — Price and Units as equal halves, then Product on its
		own full-width line below. That second line was mostly empty: product names
		are short (`LECHE DOS PINOS`), so the row spent a whole 44px of the sticky
		form's height on a few words, and the form is the most expensive real estate
		on the screen. Collapsing them means the form is one line shorter, so more of
		the tape is visible under it while typing.

		Track sizing is `4.5rem / 4.5rem / 1fr`, and each part is load-bearing:
		- **Price and Units are both FIXED at 4.5rem (72px).** They hold at most 5
		  digits (`maxlength={5}`, matching the Max Price ceiling of 9 999) and 2
		  digits (`maxlength={2}`) respectively. Giving each its own narrow track
		  rather than a flexible share is the point: a flexible Price grew to ~144px
		  to hold 53px of digits, and every one of those extra pixels is a pixel
		  Product cannot use. Neither field can get longer, so neither needs to grow —
		  only the Product name varies in length.
		  **Both are the SAME width on purpose.** Units only ever needs ~21px of
		  digits, so it is carrying dead space; but two adjacent numeric fields at
		  different widths read as a layout mistake rather than as a hierarchy, and
		  measured against the field's own padding the pair is unmistakably even.
		- **Product takes ALL the remainder (`1fr`).** It is the only field whose
		  content length varies — `ARROZ` versus `LECHE DOS PINOS ENTERA 1L` — so it is
		  the only one that benefits from slack. A long name scrolls within it rather
		  than truncating.

		`items-end` keeps the three fields on one baseline even though each cell also
		contains a label; every label is a single line, so the effect is that the
		field BOTTOMS align rather than the label tops.

		The `×` separator between Price and Units is GONE. It was a marker for the
		relationship between two fields that were stacked as a pair; with three
		fields on one line, and the multiplication already spelled out on every tape
		row as `2 × 1 980`, it was annotating something the user never had to be told.

		Each Input is wrapped in its own cell because the component renders a
		`<label>` sibling alongside the field, so an unwrapped Input would occupy
		two grid cells and push the columns out of line.
	-->
	<div class="grid grid-cols-[4.5rem_4.5rem_1fr] items-end gap-(--spacing-form-gap)">
		<div>
			<Input
				id="price-input"
				label="Price"
				placeholder="0"
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength={5}
				value={priceRaw}
				invalid={priceWarn}
				rounded="md"
				className="text-center px-2 py-2 font-semibold"
				on:input={onPriceInput}
				on:blur={onPriceBlur}
				on:keydown={(e) => e.key === 'Enter' && onEnter()}
			/>
		</div>

		<div>
			<Input
				id="units-input"
				label="Units"
				placeholder="1"
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength={2}
				value={unitsRaw}
				invalid={unitsWarn}
				rounded="md"
				className="text-center px-2 py-2 font-semibold"
				on:input={onUnitsInput}
				on:keydown={(e) => e.key === 'Enter' && onEnter()}
			/>
		</div>

		<!--
			Product is the one field that is left-aligned rather than centred: it
			holds text, not digits, so centring it would make a long name and a short
			one start in different places and read as ragged.

			Required, and flagged red from the first render — see the note beside
			`labelValid`. The narrower column means a long name scrolls within the
			field rather than truncating, so nothing typed is ever hidden.
		-->
		<div>
			<Input
				id="label-input"
				label="Product"
				placeholder="Name"
				maxlength={30}
				list="label-options"
				autocomplete="off"
				enterkeyhint="done"
				value={labelRaw}
				invalid={labelWarn}
				rounded="md"
				className="px-2 py-2"
				on:input={onLabelInput}
				on:keydown={(e) => e.key === 'Enter' && onEnter()}
			/>
		</div>
	</div>

	<!-- Type-ahead source: item labels (column K) from the published sheet. -->
	<datalist id="label-options">
		{#each $categories as item (item.label)}
			<option value={item.label}>{item.category}</option>
		{/each}
	</datalist>

	<!--
		Cold-start notice. The app already fetches the sheet once on first launch, so
		telling the user to go to Settings was making them do work the app was doing
		anyway — and the fetch usually finishes before the copy is even read. It now
		reports what is actually happening, and only offers a manual action once the
		automatic attempt has finished and still left nothing behind (i.e. offline
		with a cold cache).
	-->
	{#if loadingCategories}
		<p class="text-xs text-zinc-500 dark:text-zinc-400">Loading categories…</p>
	{:else if $categories.length === 0}
		<div class="space-y-2">
			<div
				class="flex items-center justify-between gap-3 rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800"
			>
				<p class="text-xs text-zinc-600 dark:text-zinc-400">No labels loaded yet.</p>
				<Button variant="outline" size="sm" on:click={() => refreshCategories()}>
					Load defaults
				</Button>
			</div>
			{#if $categoriesStatus === 'error'}
				<p class="text-xs text-red-600 dark:text-red-400">
					Could not reach the sheet ({$categoriesError}). Items can still be added by hand.
				</p>
			{/if}
		</div>
	{/if}
</div>

<!--
	Primary action, as a floating button pinned to the bottom-right.

	It changes job with the form: while editing it SAVES the row, otherwise it ADDS
	a new one. The glyph changes with it (plus → check) so the two modes are
	distinguishable at a glance without reading the label.

	It used to live inside the sticky form, which is the wrong place for a thumb:
	the form is at the TOP of the screen, so on a long tape the hand holding the
	phone is nowhere near it. Pinning the action to the bottom edge keeps it under
	the thumb regardless of how far the tape has scrolled — and the same is just as
	true for saving an edit.

	Rendered OUTSIDE the sticky form on purpose. That form is `sticky z-10`, and a
	non-auto z-index creates a stacking context — a `fixed` child would be trapped
	in it and paint beneath the header (`z-20`), which is the same trap documented
	for the totals sheet.

	The disabled state is `--brand-muted` (emerald-800), a solid step rather than
	transparency: a 50%-opacity button is hard to read and looks broken rather than
	inactive. See the token notes in `app.css`.

	IMPORTANT — it is NOT actually `disabled`, even when the form is incomplete. It
	keeps the muted look, but a tap has to be possible: that tap is what raises the
	red warnings on the empty fields. A genuinely `disabled` button swallows the
	click entirely, so the user gets no explanation for why nothing happened — and
	because a disabled button is also unfocusable and announces nothing, a screen
	reader user would never learn the reason either. Reachable-but-muted is the
	honest middle: it still LOOKS like it needs something, and asking now answers the
	question instead of ignoring it.
-->
<div class="pointer-events-none fixed inset-x-0 bottom-0 z-30">
	<div class="mx-auto flex max-w-2xl justify-end px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
		<Button
			variant="solid"
			size="lg"
			className={cn(
				'pointer-events-auto rounded-full shadow-none',
				// Muted while incomplete, via the same `--brand-muted` step as before.
				// `hover:bg-brand-hover` has to be neutralised too, or an incomplete
				// button would light up on hover and read as ready.
				!canAdd && 'bg-brand-muted hover:bg-brand-muted'
			)}
			on:click={onEnter}
		>
			{#if isEditing}
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m4.5 12.75 6 6 9-13.5" />
				</svg>
				Save
			{:else}
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15" />
				</svg>
				Add Item
			{/if}
		</Button>
	</div>
</div>

<!-- Empty state -->
{#if $calculatorRows.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-600">
		<svg class="mb-4 h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
		</svg>
		<p class="text-base font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
			Press Add Item to start
		</p>
	</div>
{:else}
	<!-- Tape -->
	<ul class="space-y-2">
		{#each $calculatorRows as row, i (row.id)}
			<li
				class={cn(
					'flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900',
					// `motion-safe:` rather than a bare animation: the global reduced-motion
					// block collapses the duration, but only `motion-safe:` guarantees the
					// animation is never attached at all for a user who opted out.
					justAddedId === row.id && 'motion-safe:animate-flash',
					// Marks the row under edit. Still needed even with the form's edit bar:
					// the form is pinned to the top, so on a long tape the row being edited
					// can be scrolled out of sight entirely.
					//
					// GREEN, not red. Red on the row read as "this row is broken"; brand
					// green reads as "this is the row I am working on", which is what edit
					// mode actually means. Red is now reserved for the one thing that
					// really is destructive — the DELETE word in the bar.
					editingId === row.id && 'ring-2 ring-brand'
				)}
				on:animationend={() => {
					if (justAddedId === row.id) justAddedId = null;
				}}
			>
				<!-- Row number -->
				<span class="w-6 shrink-0 text-right font-mono text-xs text-zinc-400 dark:text-zinc-600">
					{$calculatorRows.length - i}
				</span>

				<!-- Category + breakdown -->
				<div class="flex-1 min-w-0">
					<p class="truncate text-sm font-semibold uppercase tracking-tight text-zinc-900 dark:text-zinc-100">
						{row.label || row.category}
					</p>
					<p class="mt-0.5 truncate">
						<!--
							One neutral chip for every category, not a colour per category.
							Ten saturated pills made the tape read as a rainbow and, because
							every row shouted equally loudly, the colour stopped conveying
							anything. The chip's job now is separation: it sets the category
							apart from the product name without competing with it. The name is
							still written inside, so nothing depends on colour (WCAG 1.4.1).
						-->
						<span class={chipClass(row.category)}>{row.category}</span>
					</p>
				</div>

				<!--
					Line total on TOP, breakdown underneath, so `3 960` reads as the
					result and `2 × 1 980` as the working that produced it. The previous
					order made the eye land on the arithmetic before the answer.

					Real flex gaps and padding rather than margins so the digits and
					markers can never collapse into one another.

					The breakdown is neutral and bold. Weight carries the hierarchy,
					not hue — the tape already has the row's chip, and a second colour
					per row would muddle the one thing that differs between rows.

					Amounts render bare: the `₡` that used to sit in front of each figure
					was removed app-wide, so the digits themselves are now the only thing
					the column carries.
				-->
				<div class="shrink-0 text-right">
					{#if row.error}
						<p class="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
							0
						</p>
					{:else}
						<p class="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
							{formatCurrency(row.subtotal)}
						</p>
					{/if}

					<p class="flex items-center justify-end gap-0.5 text-xs font-semibold tabular-nums text-zinc-600 dark:text-zinc-300">
						<span>{row.units}</span>
						<span>×</span>
						<span>{formatCurrency(row.price)}</span>
					</p>
				</div>

				<!--
					The row's ONLY control. The bin that used to sit beside it is GONE, so
					editing is the single entry point for changing or removing a row — which
					is what lets the edit bar's DELETE skip a confirmation step.

					Disabled while an edit is already open, because the tap is ignored in
					that state — showing it as inert is honest, whereas an
					enabled-looking button that does nothing reads as broken.

					`-mr-2` rather than `-mr-1`: the pencil is last in the row now, so its
					44px target has to pull all the way back to land the 16px glyph on the
					16px content gutter. With a trailing button after it, the smaller pull
					was correct; without one it leaves the glyph 4px short.
				-->
				<IconButton
					label="Edit row"
					className="-mr-2 shrink-0"
					disabled={isEditing && editingId !== row.id}
					on:click={() => startEdit(row)}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.862 4.487Zm0 0L19.5 7.125" />
					</svg>
				</IconButton>

			</li>
		{/each}
	</ul>

	<!--
		Reset sits below the tape, centred and visually subordinate to the
		primary entry actions above — it's a destructive afterthought, not a
		headline action.

		RED TEXT, not a red fill, and red in BOTH states. The fill used to be swapped
		in on `confirmReset` by switching the whole variant, which is the trap this
		button has hit before: the armed state lost its red entirely once the ghost
		variant's hover colour regained control. So there is ONE class list, always
		red, and only the LABEL changes — the same arrangement as the edit bar's
		DELETE.

		Consequence worth knowing: colour no longer distinguishes armed from idle, so
		the word carries that job alone. `CONFIRM` has to be legible on its own.

		The bottom margin is generous because the floating add button overlays this
		area; without it the last row (or this button) would sit permanently under
		the FAB once the tape is long enough to scroll.
	-->
	<div class="mt-4 mb-20 flex justify-center">
		<Button
			variant="ghost"
			size="sm"
			className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
			on:click={handleReset}
		>
			{confirmReset ? 'CONFIRM' : 'RESET ALL'}
		</Button>
	</div>
{/if}
