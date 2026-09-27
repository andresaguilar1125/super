<script lang="ts">
	import { cn } from '$lib/cn';

	/**
	 * Shared text field. Replaces the repeated dynamic class ternary that was
	 * duplicated for the price, units, and label inputs.
	 *
	 * `invalid` drives both the visual state and `aria-invalid`, which the old
	 * markup never announced to assistive tech.
	 */
	export let id: string;
	export let value = '';
	export let placeholder = '';
	export let label: string | undefined = undefined;
	export let invalid = false;
	export let inputmode: 'numeric' | 'text' | 'decimal' | undefined = undefined;
	export let maxlength: number | undefined = undefined;
	export let pattern: string | undefined = undefined;
	export let enterkeyhint: 'done' | 'go' | 'next' | 'search' | 'send' | undefined = undefined;
	export let autocomplete: string | undefined = undefined;
	export let list: string | undefined = undefined;
	export let className: string = '';
	/** `pill` matches the calculator's compact entry row. */
	export let rounded: 'md' | 'pill' = 'md';

	/*
	 * There is ONE branch now. There used to be a second one for a `prefix` marker
	 * (the `₡` that sat inside the field): it wrapped the input in a flex box which
	 * carried the border, because a marker and a field cannot share a single
	 * `<input>`. Removing the `₡` app-wide made that prop unused, so the branch is
	 * gone and every field is a plain `<input>`.
	 *
	 * That also removed a real trap: the border had to use `focus-within` rather
	 * than `focus`, because focus lands on the INNER input and `:focus` never
	 * matches an ancestor. With one branch, `focus-within` still matches the
	 * element's own focus, so the single rule covers it.
	 *
	 * IMPORTANT — the error state repeats itself for `focus-within` on purpose.
	 * `:focus-within` carries pseudo-class specificity, so on its own it would
	 * OUTRANK a plain `.border-red-400` and paint an invalid field brand-green the
	 * moment the user clicked into it — the exact opposite of the message.
	 */
	const base =
		'w-full border bg-white text-zinc-900 transition-colors ' +
		'placeholder:text-zinc-400 ' +
		'focus:outline-none focus-visible:outline-none ' +
		'focus-within:border-brand ' +
		'dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500';

	const valid = 'border-zinc-300 dark:border-zinc-700';
	const error =
		'border-red-400 dark:border-red-500 ' +
		'focus-within:border-red-400 dark:focus-within:border-red-500';

	$: classes = cn(base, invalid ? error : valid, rounded === 'pill' ? 'rounded-full' : 'rounded-md', className);
</script>

{#if label}
	<!--
		Uppercase lives here rather than in every label string, so the wording stays
		"Price" in the markup and the accessible name while it READS as
		a field header. Setting `text-transform` instead of typing caps also means the
		copy can never fall out of sync with the CSS.

		This is the ONE place labels are styled, so it covers both the calculator's
		strip and the Compare sheet's cards — a field label should not be shouty on
		one screen and quiet on another.

		`tracking-wide` goes with the transform, matching the app's other uppercase
		micro-copy (the edit bar's "Editing", the category chips): caps at this size
		close up without it.
	-->
	<label
		for={id}
		class="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
	>
		{label}
	</label>
{/if}

<input
	{id}
	type="text"
	{value}
	{placeholder}
	{inputmode}
	{maxlength}
	{pattern}
	{enterkeyhint}
	{autocomplete}
	{list}
	aria-invalid={invalid}
	class={classes}
	on:input
	on:blur
	on:keydown
/>
