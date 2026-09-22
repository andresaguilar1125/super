/**
 * Every route is prerendered. This app is entirely client-side: there are no
 * server load functions, and nothing touches `window` or `localStorage` outside
 * of `onMount`, so prerendering and SSR are both safe.
 *
 * `adapter-static` requires full prerender coverage (it runs with `strict: true`
 * unless told otherwise) — a route that is neither prerendered nor covered by
 * the `404.html` fallback would fail the build.
 */
export const prerender = true;
export const ssr = true;
