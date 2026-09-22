import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  // Tailwind v4 is wired in through its own Vite plugin — no PostCSS config.
  plugins: [
    tailwindcss(),
    sveltekit(),

    /*
     * Full PWA support: generates the Workbox service worker and injects the
     * registration, which is what upgrades this from a home-screen shortcut to
     * a genuinely installable, offline-capable PWA.
     *
     * `SvelteKitPWA` rather than the plain VitePWA plugin — it points Workbox at
     * `.svelte-kit/output`, where prerendered HTML and client assets live
     * *before* the adapter runs.
     */
    SvelteKitPWA({
      registerType: 'autoUpdate',

      // Registration is explicit, via <PwaRegister /> in +layout.svelte, so the
      // plugin must not also inject its own inline script.
      injectRegister: null,

      // Keep the hand-authored static/manifest.webmanifest as the source of
      // truth instead of letting the plugin generate one.
      manifest: false,

      workbox: {
        // Precache the client bundle and the prerendered HTML shells.
        //
        // `woff2` is load-bearing for OFFLINE correctness, not a nicety. The
        // font files are emitted into `_app/immutable/assets/` and were NOT in
        // this list, so the very first online-only load fetched Inter outside
        // the precache. Workbox's runtime route for same-origin assets is
        // CacheFirst, so the woff2 landed in the runtime cache and offline
        // worked anyway — but it was an accident: a cold cache plus offline
        // would have fallen back to the system font. Precaching them makes the
        // offline font a guarantee rather than a side effect.
        globPatterns: [
          'client/**/*.{js,css,ico,png,svg,webp,webmanifest,woff2}',
          'prerendered/**/*.{html,json}'
        ],

        // Drop precaches from earlier builds so stale hashed chunks can't pile up.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },

      kit: {
        // Must match the adapter's `fallback`.
        adapterFallback: '404.html',

        /*
         * The plugin builds its precache URLs from SvelteKit's `paths.base`, NOT
         * from Vite's own `base` — verified by setting `base` and watching the
         * root entry stay a bare "/".
         *
         * Without this the prerendered index page is precached as `{url: "/"}`,
         * which on a project site resolves to the DOMAIN root, not `/<repo>/`.
         * That 404s, Workbox's install fails, and the service worker never
         * activates — the app still works online, so the failure is silent.
         *
         * The trailing slash matters too: `/<repo>` gets a 301 to `/<repo>/`,
         * and a redirected response is not a valid precache entry.
         *
         * Falls back to "/" so a root-hosted local build keeps working.
         */
        base: process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : '/'
      },

      devOptions: {
        // Off in dev: a service worker caching localhost causes confusing
        // stale-module behaviour. Test PWA behaviour against `npm run preview`.
        enabled: false
      }
    })
  ],

  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: [
      '192.168.100.45',
      'localhost'
    ]
  }
});