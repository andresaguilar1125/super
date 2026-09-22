<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';

	/*
	 * `goto` does NOT prefix the base path, so a bare '/calculator' would break
	 * under a GitHub Pages sub-path. SvelteKit exposes the configured base, so
	 * the redirect is built from it rather than hardcoded.
	 */
	onMount(() => {
		void goto(`${base}/calculator`, { replaceState: true });
	});
</script>