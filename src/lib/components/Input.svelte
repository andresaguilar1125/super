<script lang="ts">
	import { cn } from '$lib/cn';

	/**
	 * Shared text field. Replaces the repeated dynamic class ternary that was
	 * duplicated for the price, quantity, and label inputs.
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
	/** Static marker rendered inside the field, e.g. `₡` or `×`. */
	export let prefix: string | undefined = undefined;

	/*
	 * The focused border takes the accent, so the field the user is typing into is
	 * highlighted in their chosen colour. It wins over the resting border because
	 * `:focus` adds pseudo-class specificity that a bare utility can't match —
	 * no `!important` and no ordering dependency on `valid`/`error` below.
	 */
	const base =
		'w-full border bg-white text-zinc-900 transition-colors ' +
		'placeholder:text-zinc-400 ' +
		'focus:outline-none focus-visible:outline-none ' +
		'focus:border-accent ' +
		'dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500';

	const valid = 'border-zinc-300 dark:border-zinc-700';
	const error = 'border-red-400 dark:border-red-500';

	$: classes = cn(base, invalid ? error : valid, rounded === 'pill' ? 'rounded-full' : 'rounded-md', className);
</script>

{#if label}
	<label for={id} class="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
		{label}
	</label>
{/if}

{#if prefix}
	<!-- The wrapper carries the field styling so the marker sits inside it. -->
	<div class={cn(classes, 'flex items-center gap-0.5')}>
		<span class="shrink-0 text-xs text-zinc-400 dark:text-zinc-500" aria-hidden="true">{prefix}</span>
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
			class="w-full min-w-0 border-0 bg-transparent p-0 text-inherit focus:outline-none"
			on:input
			on:blur
			on:keydown
		/>
	</div>
{:else}
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
{/if}
