<script lang="ts">
	import { cn } from '$lib/cn';

	/**
	 * Border-driven surface. Replaces the `bg-white dark:bg-gray-800 rounded-lg
	 * shadow` pattern that was duplicated across the app.
	 *
	 * `tone="danger"` tints the border for the destructive zone.
	 */
	export let tone: 'default' | 'danger' = 'default';
	export let className: string = '';

	const base = 'rounded-lg border p-4';

	const tones = {
		default: 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
		danger: 'border-red-200 bg-white dark:border-red-900/60 dark:bg-zinc-900'
	} as const;

	$: classes = cn(base, tones[tone], className);
</script>

<div class={classes}>
	<slot />
</div>
