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
        globPatterns: [
          'client/**/*.{js,css,ico,png,svg,webp,webmanifest}',
          'prerendered/**/*.{html,json}'
        ],

        // Drop precaches from earlier builds so stale hashed chunks can't pile up.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true
      },

      kit: {
        // Must match the adapter's `fallback`.
        adapterFallback: '404.html'
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