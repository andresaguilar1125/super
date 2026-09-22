<script lang="ts">
	import { cn } from '$lib/cn';

	/**
	 * Accessible toggle. The previous hand-rolled switch was a plain <button>
	 * with no `role="switch"` or state, so screen readers announced it as an
	 * unlabelled button. Here the role and `aria-checked` are always correct.
	 */
	export let checked: boolean;
	export let label: string;
	export let className: string = '';

	const track =
		'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors';
	/*
	 * `on` follows the chosen accent; `off` stays neutral zinc so "disabled" never
	 * reads as a colour. The knob is painted with `--accent-fg` rather than a
	 * fixed white/zinc: that token is by definition the contrasting pair of
	 * whatever is behind it, so one class keeps the knob visible on every accent
	 * in both modes (white on the light-mode fills, zinc-950 on the dark-mode
	 * ones).
	 */
	const on = 'border-accent bg-accent';
	const off = 'border-zinc-300 bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-700';
	const knob =
		'inline-block h-4 w-4 transform rounded-full bg-accent-fg transition-transform';
</script>

<!--
  The button is the hit area (44px tall) while the inner span paints the track,
  so the touch target clears the guideline without making the control look
  oversized. `on:click` forwards to the consumer.
-->
<button
	type="button"
	role="switch"
	aria-checked={checked}
	aria-label={label}
	class={cn('inline-flex h-11 shrink-0 items-center pr-2', className)}
	on:click
>
	<span class={cn(track, checked ? on : off)}>
		<span class={cn(knob, checked ? 'translate-x-6' : 'translate-x-1')} />
	</span>
</button>
