import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/**
 * GitHub Pages serves project sites from `/<repo>/`, not from the domain root,
 * so the base path has to be injected at build time. The deploy workflow sets
 * `BASE_PATH` from the repository name, which means renaming the repo needs no
 * edit here. Locally the variable is unset and `dev` forces `''`, so
 * `npm run dev` keeps working at http://localhost:5173.
 *
 * `fallback` gives Pages a document to serve for any URL it has no file for.
 * That shell boots the client router, which is what makes a deep link or a hard
 * refresh survive on a host that has no rewrite rules.
 *
 * @type {import('@sveltejs/kit').Config}
 */
const config = {
	preprocess: [
		vitePreprocess({})
	],

	kit: {
		adapter: adapter({
			fallback: '404.html'
		}),
		paths: {
			base: process.argv.includes('dev') ? '' : process.env.BASE_PATH ?? ''
		}
	}
};

export default config;
