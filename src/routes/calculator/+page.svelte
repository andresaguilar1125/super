<script lang="ts">
	import {
		calculatorRows,
		settings,
		addRow,
		deleteRow,
		resetAll,
		formatCurrency
	} from '$lib/store';
	import { categories, resolveCategory } from '$lib/categories';
	import { roundPrice, validatePrice, validateQuantity } from '$lib/utils';
	import { base } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import IconButton from '$lib/components/IconButton.svelte';
	import Input from '$lib/components/Input.svelte';

	// --- Form state ---
	let priceRaw = '';
	let qtyRaw = '1';
	let labelRaw = '';

	// --- Derived validation (recomputes on every keystroke) ---
	$: priceCheck = validatePrice(priceRaw, $settings.maxPrice);
	$: qtyCheck = validateQuantity(qtyRaw, $settings.maxQuantity);
	$: canAdd = priceCheck.ok && qtyCheck.ok;

	// --- Handlers ---
	function handleAdd() {
		if (!canAdd) return;
		addRow({
			price: priceCheck.value,
			quantity: qtyCheck.value,
			// Resolve BEFORE addRow truncates the label to 30 chars, so labels
			// longer than the display cap still map to their sheet category.
			category: resolveCategory(labelRaw.trim()),
			label: labelRaw
		});
		// Reset for the next rapid-fire entry. Quantity goes back to 1.
		priceRaw = '';
		qtyRaw = '1';
		labelRaw = '';
		// Focus price input again for fast supermarket tapping.
		requestAnimationFrame(() => {
			document.getElementById('price-input')?.focus();
		});
	}

	function handleDelete(id: string) {
		// Ask the user to confirm before removing.
		if (!confirm('Delete this item?')) return;
		deleteRow(id);
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

	function onQtyInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		qtyRaw = el.value.replace(/\D/g, '').slice(0, 2) || '';
		el.value = qtyRaw;
	}

	function onLabelInput(e: Event) {
		const el = e.currentTarget as HTMLInputElement;
		labelRaw = el.value.slice(0, 30);
		el.value = labelRaw;
	}
</script>

<!-- Entry form — sticky below the header AND the running-total strip. The
     offset comes from a single `--spacing-sticky-top` token so all three
     heights stay in sync. -->
<div
	class="sticky top-(--spacing-sticky-top) z-10 mb-4 space-y-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
>
	<!-- Price + Qty share the full row, weighted 3:2 so the 5-digit price keeps
	     more room than the 2-digit quantity. The `auto` middle column sizes the
	     × on its own, so the marker stays correct at any UI scale. `items-end`
	     lines the marker up with the FIELD bottoms rather than the label tops.
	     Each Input is wrapped because the component renders a <label> next to
	     the field, which would otherwise occupy two grid cells. -->
	<!-- Price and Qty are EQUAL halves (50/50), each the same width as the
	     Compare / + Add Item buttons below, so every row in the form lines up on
	     the same two columns. The gutter comes from `--spacing-form-gap`, the
	     single token shared with the action row — the two grids cannot drift.

	     The `×` no longer gets its own `auto` column. That third column consumed
	     gap-width from the row and was what made a true 50/50 impossible. Instead
	     the separator is absolutely positioned in the gutter that already exists
	     between the two columns, so it costs the layout nothing and `grid-cols-2`
	     divides the row exactly in half. `items-end` is retained so the marker
	     still tracks the FIELD bottoms rather than the label tops. -->
	<div class="grid grid-cols-2 items-end gap-(--spacing-form-gap)">
		<!--
			`relative` is load-bearing: it makes THIS cell the containing block for
			the × below. Without it the separator's `left-full` would resolve against
			the whole grid and park the glyph on the form's right edge instead of in
			the gutter between the fields.
		-->
		<div class="relative">
			<Input
				id="price-input"
				label="Price"
				placeholder="0"
				prefix="₡"
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength={5}
				value={priceRaw}
				invalid={!!priceRaw && !priceCheck.ok}
				rounded="md"
				className="justify-center px-2 py-2 font-semibold"
				on:input={onPriceInput}
				on:blur={onPriceBlur}
				on:keydown={(e) => e.key === 'Enter' && handleAdd()}
			/>

			<!--
				The × belongs to the RELATIONSHIP between the two fields, not to the
				quantity's own text, so it sits in the gutter between them.

				`left-full` puts this box's left edge on the price cell's right edge, and
				`w-(--spacing-form-gap)` sizes it to the gutter exactly — both derive from
				the same token, so the glyph stays centred however the gap is tuned. It
				needs ~2px of clearance either side at 12px; at 8px the ~8px-wide glyph
				touched both borders and looked jammed.

				`pointer-events-none` stops it swallowing taps meant for the fields, and
				`aria-hidden` keeps punctuation out of the accessibility tree. Height and
				`bottom-0` match `items-end`, so the glyph tracks the FIELD bottoms rather
				than the label tops.
			-->
			<div
				class="pointer-events-none absolute bottom-0 left-full flex h-11 w-(--spacing-form-gap) items-center justify-center"
				aria-hidden="true"
			>
				<span class="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">×</span>
			</div>
		</div>

		<div>
			<Input
				id="qty-input"
				label="Qty"
				placeholder="1"
				inputmode="numeric"
				pattern="[0-9]*"
				maxlength={2}
				value={qtyRaw}
				invalid={!!qtyRaw && !qtyCheck.ok}
				rounded="md"
				className="justify-center px-2 py-2 font-semibold"
				on:input={onQtyInput}
				on:keydown={(e) => e.key === 'Enter' && handleAdd()}
			/>
		</div>
	</div>

	<!-- Product name gets its own full-width row below the numeric pair, so long
	     names have room to display before being truncated. -->
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
			rounded="md"
			className="px-3 py-2"
			on:input={onLabelInput}
			on:keydown={(e) => e.key === 'Enter' && handleAdd()}
		/>
	</div>

	<!-- Type-ahead source: item labels (column K) from the published sheet. -->
	<datalist id="label-options">
		{#each $categories as item (item.label)}
			<option value={item.label}>{item.category}</option>
		{/each}
	</datalist>

	{#if $categories.length === 0}
		<p class="text-xs text-zinc-500 dark:text-zinc-400">
			No labels loaded yet. Open <a href="{base}/settings" class="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">Settings</a>
			and tap “Refresh categories”.
		</p>
	{/if}

	<!-- Two-up action group: compare on the left, the primary CTA on the right.
	     Uses the SAME `--spacing-form-gap` as the Price|Qty row above, so the field
	     columns and the button columns land on identical x-positions. -->
	<div class="grid grid-cols-2 gap-(--spacing-form-gap)">
		<Button variant="outline" size="lg" href="{base}/compare">
			<!-- Material Symbols `compare_arrows` (same path data @mui/icons-material
			     CompareArrows renders). Inlined because this project ships no icon
			     package — every glyph is a hand-rolled SVG. Filled, not stroked: the
			     Material path is authored for fill, and stroking it would fatten the
			     arrow heads. -->
			<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
				<path d="M9.01 14H2v2h7.01v3L13 15l-3.99-4v3zm5.98-1v-3H22V8h-7.01V5L11 9l3.99 4z" />
			</svg>
			Compare
		</Button>
		<Button variant="solid" size="lg" disabled={!canAdd} on:click={handleAdd}>
			+ Add Item
		</Button>
	</div>
</div>

<!-- Empty state -->
{#if $calculatorRows.length === 0}
	<div class="flex flex-col items-center justify-center py-12 text-zinc-400 dark:text-zinc-600">
		<svg class="mb-4 h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
		</svg>
		<p class="text-base font-medium text-zinc-600 dark:text-zinc-400">No items yet</p>
		<p class="text-sm">Add your first item above</p>
	</div>
{:else}
	<!-- Tape -->
	<ul class="space-y-2">
		{#each $calculatorRows as row, i (row.id)}
			<li
				class="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900"
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
					<p class="truncate text-xs text-zinc-500 dark:text-zinc-400">
						<span class="font-medium text-accent">{row.category}</span>
					</p>
				</div>

				<!--
					Line total on TOP, breakdown underneath, so `₡3,960` reads as the
					result and `2 × ₡1,980` as the working that produced it. The previous
					order made the eye land on the arithmetic before the answer.

					Real flex gaps and padding rather than margins so the digits and
					markers can never collapse into one another.

					The WHOLE breakdown line takes the accent, markers included. Muting
					the `×` and `₡` while colouring the digits was tried first and looked
					broken-up — two colours inside one short phrase reads as a mistake
					rather than as hierarchy. Colouring the line end-to-end makes it a
					single accented unit, which is cleaner against the neutral label
					block opposite it.

					This is why `gold` (amber) had to go: amber-500 is ~2:1 on white and
					could not carry this line as text, whereas pink-700 is 5.90:1 and
					pink-400 is 7.21:1 on zinc-950.
				-->
				<div class="shrink-0 text-right">
					{#if row.error}
						<p class="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
							<span class="text-red-400 dark:text-red-600">₡</span>0
						</p>
					{:else}
						<p class="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
							<span class="text-zinc-400 dark:text-zinc-600">₡</span>{formatCurrency(row.subtotal)}
						</p>
					{/if}

					<p class="flex items-center justify-end gap-0.5 text-xs tabular-nums text-accent">
						<span>{row.quantity}</span>
						<span>×</span>
						<span><span>₡</span>{formatCurrency(row.price)}</span>
					</p>
				</div>

				<!-- Delete -->
				<IconButton
					label="Delete row"
					className="-mr-1 shrink-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
					on:click={() => handleDelete(row.id)}
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
				</IconButton>
			</li>
		{/each}
	</ul>

	<!--
		Reset sits below the tape, centred and visually subordinate to the
		primary entry actions above — it's a destructive afterthought, not a
		headline action.
	-->
	<div class="mt-4 flex justify-center">
		<Button
			variant={confirmReset ? 'destructive' : 'ghost'}
			size="sm"
			on:click={handleReset}
		>
			{confirmReset ? 'Tap again to confirm' : 'Reset all'}
		</Button>
	</div>
{/if}
