<script lang="ts">
	import { cn } from '$lib/cn';

	/**
	 * Flat, border-driven button. Shadows are intentionally absent — elevation
	 * is communicated with borders and background shifts only.
	 *
	 * The `solid` variant — and only that one — wears the selectable accent, so
	 * the primary action of each screen is the single place the user's colour
	 * choice shows up most strongly. `destructive` and `destructive-soft` stay
	 * hardcoded red regardless of accent: that colour is a warning, not a theme.
	 *
	 * `text-accent-fg` supplies the contrasting pair (white on every light-mode
	 * fill, zinc-950 on every dark-mode one), which is why this needs no `dark:`
	 * overrides of its own.
	 */
	type Variant = 'solid' | 'outline' | 'ghost' | 'destructive' | 'destructive-soft';
	type Size = 'sm' | 'md' | 'lg';

	export let variant: Variant = 'solid';
	export let size: Size = 'md';
	/** Stretch to fill the container width. */
	export let block = false;
	export let disabled = false;
	export let type: 'button' | 'submit' | 'reset' = 'button';
	export let className: string = '';
	/** When set the button renders as an anchor, for navigation actions. */
	export let href: string | undefined = undefined;

	const base =
		'inline-flex items-center justify-center gap-2 rounded-md font-medium ' +
		'transition-colors select-none ' +
		'disabled:cursor-not-allowed disabled:opacity-50';

	const variants: Record<Variant, string> = {
		solid:
			'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-hover',
		outline:
			'border border-zinc-300 bg-transparent text-zinc-900 hover:bg-zinc-100 ' +
			'dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800',
		ghost:
			'bg-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 ' +
			'dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
		destructive: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
		'destructive-soft':
			'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 ' +
			'dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70'
	};

	// Every size clears the 44px touch-target guideline at `md` and above.
	const sizes: Record<Size, string> = {
		sm: 'h-9 px-3 text-sm',
		md: 'h-11 px-4 text-sm',
		lg: 'h-12 px-5 text-base'
	};

	$: classes = cn(base, variants[variant], sizes[size], block && 'w-full', className);
</script>

{#if href}
	<a {href} class={classes}>
		<slot />
	</a>
{:else}
	<button {type} {disabled} class={classes} on:click>
		<slot />
	</button>
{/if}
