<script lang="ts">
	import { cn } from '$lib/cn';

	/**
	 * Square icon-only control. Sized to 44x44 to satisfy the touch-target
	 * guideline — the previous `p-2` header buttons were ~36px.
	 *
	 * `label` is required so an accessible name is always guaranteed.
	 */
	export let label: string;
	export let disabled = false;
	export let className: string = '';

	const base =
		'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md ' +
		'text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 ' +
		'dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 ' +
		'disabled:cursor-not-allowed disabled:opacity-50';

	$: classes = cn(base, className);
</script>

<button type="button" aria-label={label} title={label} {disabled} class={classes} on:click>
	<slot />
</button>
