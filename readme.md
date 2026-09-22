# SuperCalc CRC

A mobile-first grocery calculator for shopping in Costa Rican Colones (₡).
Newest items appear at the top of a rolling "tape", a live total stays pinned
under the header, and a sticky entry form keeps the price field one tap away
while you scroll — no need to press `=` after every item.

Built with SvelteKit 2 + Svelte 4 and styled with Tailwind CSS v4. It ships as a
fully installable PWA that works offline, and is prerendered to static files for
GitHub Pages. See **[github-pages.md](./github-pages.md)** to deploy it.

---

## Table of contents

- [Features](#features)
- [Money rules (CRC)](#money-rules-crc)
- [Screens](#screens)
- [Categories from Google Sheets](#categories-from-google-sheets)
- [Theming and accent colors](#theming-and-accent-colors)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [State and persistence](#state-and-persistence)
- [Design system](#design-system)
- [Icon generation](#icon-generation)
- [Project bundle script](#project-bundle-script)
- [Known gaps](#known-gaps)
- [Pre-PR checklist](#pre-pr-checklist)

---

## Features

### Rolling tape

- Newest items land at the **top** of the list.
- Rows renumber automatically as you add and delete.
- Each row shows the item name (or its category), the category, the calculation
  (`3 × ₡230`), and the line subtotal.
- Deleting a row asks for confirmation before removing it.
- `Reset all` is a two-tap action that disarms itself after 3 seconds.

### Sticky entry form

- Sits below the header **and** the running-total strip, and stays there while
  the tape scrolls underneath.
- Entry row is laid out as `Price × Qty`, then a full-width `Product` field.
- Price and Qty are **equal halves (50/50)**, each the same width as the Compare
  and `+ Add Item` buttons below them, so every row in the form lines up on the
  same two columns.
- **One gap token for the whole form:** `--spacing-form-gap` (12px) drives both
  the Price|Qty row and the Compare|+ Add Item row, so the two grids cannot
  drift apart.
- The `×` is absolutely positioned inside that gutter rather than occupying its
  own grid column — a third column would have consumed gap-width and made a true
  50/50 impossible. It is sized from the same token, so it stays centred (2px
  clearance each side) whenever the gap is tuned. At 8px the ~8px-wide glyph
  touched both field borders, which is why the gap is 12px.
- Because the two fields are equal, each is wide enough for its maximum input
  (5 digits for Price, 2 for Qty) with the text centered.
- Hitting `Enter` in any field adds the item.
- After adding, focus jumps back to the price field and Qty resets to `1` so you
  can rapid-fire prices without retyping the quantity.
- `+ Add Item` is disabled until both Price and Qty validate.

### Smart validation

- Quantity defaults to `1`.
- Invalid Price or Qty shows an inline red border plus `aria-invalid`, and the
  Add button stays disabled — the app never crashes on bad input.
- Limits are user-configurable from Settings (see [Money rules](#money-rules-crc)).

### Compare deals

A `/compare` screen that settles single-item versus pack pricing:

- Two cards (**Single** / **Pack**), each taking a **Price** and a **Qty** that
  acts as the divisor: price per Qty is `price ÷ Qty`.
- **Qty is unitless on purpose.** It is whatever you want to divide by — grams,
  millilitres, or a count. 1 g is treated as 1 ml, so a 400 ml beer goes in as
  `400` and a 5-can pack goes in as `5`. There is no unit-kind toggle.
- Qty must be `1` or more and is capped at 4 digits (up to `9999`), which is what
  makes gram-scale values usable.
- The winner gets an accent ring and the screen shows the savings and percentage
  difference. A tie is reported as a tie.
- **Entering the screen always clears it** — comparing is a one-off calculation,
  not a saved list, so nothing lingers from a previous comparison.
- `Add winner to tape` adds the winning option at its **total price with a
  quantity of 1**, then returns to the calculator. Qty is only the comparison
  divisor, not a count of items bought.

### PWA and offline

The app is a genuinely installable Progressive Web App — not just a home-screen
shortcut.

- A **Workbox service worker** is generated at build time by
  `@vite-pwa/sveltekit`. It precaches the client bundle (JS, CSS, **fonts**, icons)
  and every prerendered HTML page — 34 entries in a typical build. The two woff2
  files are matched by the `globPatterns` in `vite.config.ts`; leaving them out
  still worked offline (same-origin assets fall through to a CacheFirst runtime
  route) but made the offline font a side effect rather than a guarantee.
- **It works offline.** Every route is precached, so the app shell loads and
  navigation works with the network completely down. The tape, settings, theme,
  and accent all live in `localStorage`, so no data is lost either.
- **Updates apply automatically.** `registerType: 'autoUpdate'` means a new
  service worker takes over on the next load without a manual prompt.
- Registration is explicit (`PwaRegister.svelte` in the root layout) rather than
  an injected script, so it sits inside SvelteKit's own lifecycle.
- `static/manifest.webmanifest` declares `standalone` display, `portrait`
  orientation, theme colours, and three icons (two `any`, one `maskable`)
  across the standard 192px and 512px sizes.
- Safe-area insets keep content clear of notches and the home indicator, and
  overscroll bounce is disabled so the page doesn't rubber-band.

**Testing offline:** a service worker is disabled in dev (`devOptions.enabled:
false`) because caching localhost causes confusing stale-module behaviour. Test
it properly with a production build:

```bash
npm run build && npm run preview
```

Then load the app, and in DevTools check **Application → Service Workers** shows
`sw.js` as *activated*. Ticking **Offline** in the Network tab and reloading
should still render the full app.

### Performance notes

Audited with Lighthouse 12 (mobile, `--throttling-method=devtools`). Scores:
**Performance 98, Accessibility 100, Best Practices 100, SEO 100.**

Two things are worth knowing before optimising further:

- **`--throttling-method=simulate` is not trustworthy on this app.** Repeat runs
  of an unchanged build returned FCP anywhere from 987 ms to 2411 ms, and
  blocking a resource sometimes *improved* the score — which is causally
  impossible. Use `devtools` (real throttling) for A/B comparisons; the three
  devtools runs above land within 20 ms of each other.
- **The CSS is deliberately left as an external stylesheet.** SvelteKit's
  `kit.inlineStyleThreshold` does remove the render-blocking request (a real
  ~150 ms win), but it also rewrites the `@font-face` `url()`s to `./name.woff2`,
  which resolve relative to the *document* and 404 under the GitHub Pages
  sub-path (`/super/calculator` → `/super/inter-latin-*.woff2`). `paths.relative:
  true` does not correct it. The audit still reported Performance 100 in that
  state — artificially, because the fonts had failed to load and the fallback
  was being measured. Don't enable it without re-verifying that both
  `@font-face` URLs still return 200 *and* that the two files are in the
  precache manifest.

The one remaining Lighthouse opportunity is the render-blocking CSS request
(~150 ms). It only pays off if the font-URL problem above is solved.

---

## Money rules (CRC)

Colones have no cents in everyday grocery math, so the app drops them entirely.

| Rule | Behaviour |
| --- | --- |
| **No decimals** | `34,560`, never `34,560.00` |
| **Rounding** | While typing, raw digits are kept. On blur/add, the price snaps to the nearest `5` colones when it is `≥ 10`; below `10` it is left alone |
| **Thousands separator** | Always `,` (via `en-US` formatting) |
| **Currency prefix** | `₡` is rendered by the UI, not stored in the value |
| **Quantity** | Whole integers only — you cannot buy 1.25 cans of soda |
| **Price digits** | Max 5 (`99,999`) |
| **Quantity digits** | Max 2 |

### Configurable limits

Both validators are capped by settings the user controls:

| Setting | Range | Step | Default |
| --- | --- | --- | --- |
| **Max Price** | 10,000 – 30,000 | 5,000 | 25,000 |
| **Max Quantity** | 5 – 50 | 5 | 50 |

Saved values are clamped and snapped back into range on load, so a value written
by an older build (or a hand-edited `localStorage`) can never leave the
calculator rejecting every price.

---

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/calculator` on mount |
| `/calculator` | The tape, the running total, and the sticky entry form |
| `/compare` | Single vs. pack price comparison |
| `/settings` | Limits, appearance, sheet refresh, and the danger zone |

### Header behaviour

The header is shared across routes and adapts to where you are:

- **On the calculator:** a cart icon with the "Super" wordmark, the live total
  strip beneath the header, and theme + settings buttons on the right.
- **On `/compare` and `/settings`:** the top-left becomes a **back arrow** and the
  total strip is hidden, because those screens have no tape on screen and a
  running total there would be noise.

`/compare` is reached from the two-up action group in the calculator's sticky
form (Compare on the left, `+ Add Item` on the right).

---

## Categories from Google Sheets

Item labels and their categories are **not hardcoded**. They are ingested from a
published Google Sheet (exported as CSV), which is the single source of truth.

| Sheet column | CSV index | Meaning |
| --- | --- | --- |
| **J** (`Super`) | `9` | Category assigned to the row |
| **K** (`Nota`) | `10` | Item label offered in the type-ahead |

The CSV URL and the column indexes live in `src/lib/utils.ts`:

```ts
export const CATEGORIES_CSV_URL = '…/pub?output=csv';
export const DEFAULT_CATEGORY = 'Otros';
export const CSV_CATEGORY_INDEX = 9;
export const CSV_LABEL_INDEX = 10;
```

### How ingestion works

- **Type-ahead:** the `Product` field is a native `<datalist>`. Picking a
  suggestion inherits its sheet category. Typing anything else falls back to
  `Otros`. The same type-ahead is reused on the compare screen.
- **First load:** the CSV is fetched only when the cache is empty. A warm cache
  means **zero** network requests on launch.
- **Caching:** parsed pairs are cached in `localStorage` under
  `supercalc-categories` as `{ items, fetchedAt }`.
- **Manual refresh:** `Refresh categories` in Settings re-fetches and
  **replaces the whole cache**, so adds, edits, and removals on the sheet are all
  picked up. The screen shows the label count and the last-refreshed timestamp.
- **Failure handling:** a failed refresh reports the error in Settings and keeps
  the previous cache intact rather than wiping good data.
- **Matching** is accent- and case-insensitive, so typing `Lácteos` matches the
  sheet's `Lacteos`.
- **Fallbacks:** unknown labels resolve to `Otros`; blank category cells also
  fall back to `Otros`.
- **Duplicates:** de-duplicated, and the **last** occurrence in the sheet wins
  (recency wins).
- **CSV parsing** is a small RFC-4180 parser that handles quoted fields, `""`
  escapes, commas inside quotes, and both CRLF and LF line endings.

Category pills were removed — categories are assigned automatically from column J
when an item is added.

---

## Theming and accent colors

### Dark mode

- Class-driven: a `.dark` class on `<html>`, **not** `prefers-color-scheme`.
  This requires the explicit `@custom-variant dark (&:where(.dark, .dark *));`
  in `src/app.css` — without it every `dark:` variant silently stops applying.
- Toggle from the header or from the Settings switch; both route through
  `setTheme()` / `toggleTheme()` in `src/lib/store.ts`.
- Persisted in `localStorage` under `supercalc-theme`.
- An inline, synchronous script in `src/app.html` applies the class before first
  paint, which prevents a flash of light UI on load.

### Accent colors

Five selectable accents — **Blue** (default), **Purple**, **Pink**, **Green**, and
**Teal**. **Red is intentionally excluded** and stays reserved for
destructive/error, so a primary button can never be mistaken for a delete.

```ts
// src/lib/accents.ts — the single source of truth
export const ACCENTS: readonly AccentOption[] = [
  { id: 'blue',   label: 'Blue',   swatchClass: 'bg-blue-600 dark:bg-blue-500' },
  { id: 'purple', label: 'Purple', swatchClass: 'bg-purple-600 dark:bg-purple-400' },
  { id: 'pink',   label: 'Pink',   swatchClass: 'bg-pink-700 dark:bg-pink-400' },
  { id: 'green',  label: 'Green',  swatchClass: 'bg-emerald-700 dark:bg-emerald-400' },
  { id: 'teal',   label: 'Teal',   swatchClass: 'bg-teal-700 dark:bg-teal-300' }
];
```

**Pink replaced gold.** Amber was the one hue in the palette that could not be
read as *text*: `amber-500` is roughly 2:1 on a white surface, far below the
4.5:1 AA threshold. That was tolerable while the accent was only ever a fill
behind `--accent-fg`, but the calculator tape now paints its **category** and its
**breakdown values** in the accent, so an unreadable-as-text hue could no longer
be offered. The count stays at five — this was a swap, not a removal.

**Pink rather than rose.** Rose was the obvious substitute and was rejected on a
hue argument: `rose-600` sits at hue ~17.6° against `red-600`'s ~27.3° — barely
10° apart, which makes a rose primary button read as a second red and
reintroduces exactly the destructive/primary ambiguity the no-red rule exists to
prevent. Pink's ~4° is ~23° from red and stays clearly distinct.

Anyone still holding a saved `gold` fails the `isAccent()` check and falls back
to blue.

A few things worth knowing before changing them:

- **Three places must agree:** `ACCENTS` in `src/lib/accents.ts`, the token
  blocks in `src/app.css`, and the `accents` array in the pre-paint script in
  `src/app.html`.
- **Add, don't rename.** Changing an existing id silently resets anyone who had
  picked it — the stored value fails the `isAccent()` check and falls back to
  blue.
- **Swatch classes must be literal strings.** Tailwind v4 discovers classes by
  scanning source text, so `` `bg-${color}-600` `` would never be generated.
- **`--accent-fg` is the contrasting pair, and it flips per mode.** With gold
  gone the rule is uniform: every light-mode fill is deep enough for white text,
  and every dark-mode fill is light enough to carry `zinc-950`. That is why
  components need no per-accent `dark:` overrides of their own.
- **Contrast is verified, not assumed.** Each fill clears WCAG AA (4.5:1) against
  its foreground — e.g. light purple is 7.07:1 on white, dark purple is 7.13:1 on
  `zinc-950`, light pink is 5.90:1, dark pink is 7.21:1.
- **Light-mode fills use the 700 step, not 600,** for blue/purple/green/teal's
  sake only where the numbers warrant it — pink-600 measures 4.54:1 on white,
  which clears AA by four hundredths and is not a defensible margin.
- The accent is **not** part of the `Settings` payload. Like the theme it applies
  on tap and persists under its own key (`supercalc-accent`), so it never waits
  on `Save Settings`.
- It is applied as a `data-accent` **attribute** on `<html>`, not as classes, so
  swapping one token repaints every consumer at once.
- The Settings picker uses native radios (`sr-only` input + a `peer-checked`
  ring overlay + a check glyph). Selection is never signalled by colour alone
  (WCAG 1.4.1) — which matters here because the swatch's whole job is colour.

### Where the accent shows up

Button `solid`, Switch on-state and knob, Input `focus:border-accent`, the
compare winner's ring, the Settings sliders, the calculator tape's **category
label and breakdown values** (the `×` and `₡` glyphs stay muted), the category
totals sheet's proportion bars, and the global `:focus-visible` outline. The
`destructive` / `destructive-soft` button variants stay hardcoded red regardless
of the accent.

---

## Tech stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | **SvelteKit 2** | `@sveltejs/kit` ^2, prerendered (`prerender = true`) |
| UI | **Svelte 4** | `^4.2.7` — *no runes, no snippets* |
| Build | **Vite 5** | via `@sveltejs/vite-plugin-svelte` ^3 |
| Styling | **Tailwind CSS v4** | via the `@tailwindcss/vite` plugin |
| Language | **TypeScript 5** | `strict: true` |
| Adapter | **`@sveltejs/adapter-static`** | Prerenders to `build/`; `fallback: '404.html'` |
| PWA | **`@vite-pwa/sveltekit`** | Workbox service worker + offline precache |
| Utilities | **`clsx`** + **`tailwind-merge`** | composed as `cn()` in `src/lib/cn.ts` |
| Font | **Inter Variable** | self-hosted; only `latin` + `latin-ext` are declared (see `src/lib/fonts.css`) |

> **Tailwind v4 is CSS-first.** There is no `tailwind.config.js` and no
> `postcss.config.js` in this project — both were removed. All theme
> configuration lives in `src/app.css` under `@theme`.

> **The base path is injected, not hardcoded.** `svelte.config.js` reads
> `paths.base` from the `BASE_PATH` environment variable at build time, so the
> same source deploys to GitHub Pages (served from `/<repo>/`) or any root host
> without edits.

---

## Getting started

### Prerequisites

- **Node.js 18+** and npm
- A modern browser (Chrome, Brave, or Safari)

### Install and run

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` with `strictPort` enabled, and is
bound to `host: true` so you can open it from a phone on the same network.
Additional hosts are allow-listed in `vite.config.ts`.

### Available scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server (service worker off) |
| `npm run build` | Prerender + build the static site into `build/` |
| `npm run preview` | Serve the production build, including the service worker |
| `npm run check` | Type-check with `svelte-check` |
| `npm run compress` | Bundle the source into `project-bundle.txt` |
| `node scripts/generate-icons.mjs` | Regenerate the placeholder PWA icons |

To build exactly as GitHub Pages will:

```bash
BASE_PATH=/<your-repo-name> npm run build
```

---

## Project structure

```
src/
├── lib/
│   ├── accents.ts             # Accent palette — single source of truth
│   ├── categories.ts          # Google Sheet ingestion, cache, and stores
│   ├── cn.ts                  # clsx + tailwind-merge helper
│   ├── fonts.css              # Inter Variable, latin + latin-ext only
│   ├── models.ts              # TypeScript interfaces and union types
│   ├── store.ts               # Global stores, actions, formatting, hydration
│   ├── utils.ts               # Pure helpers (CSV, validation, rounding)
│   └── components/
│       ├── Button.svelte      # solid | outline | ghost | destructive | destructive-soft
│       ├── Card.svelte        # default | danger
│       ├── IconButton.svelte  # 44×44, requires a `label`
│       ├── Input.svelte       # Uncontrolled field, optional prefix
│       ├── PwaRegister.svelte # Registers the service worker (renders nothing)
│       └── Switch.svelte      # role="switch" + aria-checked
├── routes/
│   ├── +layout.svelte         # Shared header, total strip, hydration, PWA
│   ├── +layout.ts             # export const prerender = true│   ├── +page.svelte           # Redirects to /calculator
│   ├── calculator/+page.svelte
│   ├── compare/+page.svelte
│   └── settings/+page.svelte
├── app.css                    # Tailwind v4 theme, accent tokens, base layer
├── app.d.ts                   # Ambient types (incl. vite-plugin-pwa client)
└── app.html                   # HTML shell + pre-paint theme/accent script

static/
├── favicon.png
├── manifest.webmanifest       # Relative start_url/scope, so it survives a sub-path
└── icons/                     # Generated placeholder PWA icons

scripts/generate-icons.mjs     # Pure-Node PNG generator (no dependencies)
.github/workflows/deploy.yml   # GitHub Pages deploy (build + publish)
```

---

## State and persistence

### Stores (`src/lib/store.ts`)

- `calculatorRows` — the tape; persisted to `localStorage`
- `subtotal` — **derived**, so there is no manual `updateSubtotal()` dance
- `itemCount` — derived sum of quantities, useful for badges
- `settings` — the two limits
- `theme` — `'light' | 'dark'`
- `accent` — the selected accent id
- `currentView` and `compareEntries` — available for cross-screen state

### Sheet stores (`src/lib/categories.ts`)

- `categories`, `categoriesFetchedAt`, `categoriesStatus`, `categoriesError`
- `categoryOptions` — derived, sorted, de-duplicated category names

### Actions

- Rows: `addRow()`, `updateRow()`, `deleteRow()`, `resetAll()`
- Formatting: `formatCurrency()`, `formatColones()`
- Appearance: `setTheme()`, `toggleTheme()`, `setAccent()`
- Categories: `hydrateCategories()`, `ensureCategoriesLoaded()`,
  `refreshCategories()`, `resolveCategory()`

### `localStorage` keys

| Key | Contents |
| --- | --- |
| `supercalc-rows` | The tape |
| `supercalc-settings` | Max price and max quantity |
| `supercalc-theme` | `light` or `dark` |
| `supercalc-accent` | Accent id |
| `supercalc-categories` | `{ items, fetchedAt }` |

### Hydration

Hydration happens once in `+layout.svelte`'s `onMount`:

```ts
hydrateStores();
hydrateCategories();
ensureCategoriesLoaded();
```

This keeps SSR entirely free of `window` and `localStorage` access — the initial
server render never touches browser APIs. Subscriptions are guarded by
one-shot flags so write-back persistence is only wired once, and the theme and
accent write-backs exist precisely so a change can never be applied in the UI
without being persisted.

---

## Design system

A **flat, minimal** language: borders carry the elevation, and there are **no
shadows** anywhere.

- **Neutral `zinc` for all structure.** Saturated colour is reserved for
  destructive/error (red) and the user-selected accent.
- **Radius scale** — `--radius-sm | md | lg | xl`, declared in `@theme`.
- **Touch targets** — `IconButton` and `Switch` are 44px tall; every `Button`
  size except `sm` clears 44px.
- **Motion** — a `prefers-reduced-motion` block neutralises every transition and
  animation in the app.
- **iOS zoom** — form text is forced to `16px` minimum so focusing a field never
  triggers a zoom.
- **Focus rings** — `:focus-visible` only, so mouse and touch interaction stays
  quiet. The ring uses the accent with a 2px offset, which keeps it visible even
  when it lands on an accent-coloured control.

### Sticky stack geometry

Three bars stack at the top of the calculator. Their heights are tokens in
`src/app.css` so they can never drift apart:

```css
--spacing-header: 3.5rem;    /* 56px */
--spacing-totalbar: 2.75rem; /* 44px */
--spacing-sticky-top: calc(var(--spacing-header) + var(--spacing-totalbar));
--spacing-form-gap: 0.75rem; /* 12px — shared by both rows in the entry form */
```

| Layer | Sticks at | z-index |
| --- | --- | --- |
| Header | `top-0` | `z-20` |
| Total strip | `top-(--spacing-header)` | `z-10` |
| Entry form | `top-(--spacing-sticky-top)` | `z-10` |

If the header height ever changes, update the token — **not** a hardcoded offset.

### Layout gutter

A single **16px gutter** is shared by the header, the total strip, `<main>`, the
entry form, and tape rows. The header icons are the fiddly part:

- Left glyph: `-ml-1` combined with `px-1` nets to zero, placing the 24px glyph
  exactly on the 16px line.
- Right glyph: the 44px settings target centres a 20px glyph, leaving 12px of
  dead space each side — hence `-mr-3`.

---

## Icon generation

`scripts/generate-icons.mjs` writes the three PWA icons plus the favicon. It
encodes PNGs by hand using only Node's `zlib` and `fs`, so it has **zero
dependencies** and does not need to run on every install.

```bash
node scripts/generate-icons.mjs
```

Output lands in `static/icons/`. These are **placeholders** — flat zinc squares
with a white plus mark, not finished artwork. Replace them with designed icons
when available; keep the filenames and sizes so `manifest.webmanifest` keeps
resolving.

---

## Project bundle script

`compress-project.js` walks the project and concatenates every source file into
a single `project-bundle.txt` — handy for feeding the whole codebase to an LLM.

```bash
npm run compress
```

It builds its ignore list from `.gitignore` (including nested files) plus an
extra list covering lockfiles, itself, its own output, and OS cruft; it filters
by extension and skips files over 500 KB.

---

## Known gaps

Deliberate, verified limitations rather than bugs:

- **The icons are placeholders** — flat zinc squares with a white plus mark. The
  PWA installs correctly with them, but they are not finished artwork. Replace
  them via `node scripts/generate-icons.mjs` or with designed assets.
- **The app is single-device.** There is no backend and no sync; the tape lives
  only in the browser that created it.
- **There is no export.** A finished tape can't be printed, shared, or copied
  out — it exists only on screen and in `localStorage`.
- **`/compare` caps Price at 6 digits** for the pack field versus 5 on the
  calculator. Intentional (pack totals run higher), but worth knowing.
- **Prerendering means no server logic.** Every route is prebuilt HTML, so any
  future feature needing a backend (accounts, receipt upload, shared lists) would
  require switching adapters.
- **Category data needs a network round trip the first time.** A cold cache with
  no connection leaves the type-ahead empty until the sheet is reachable — the
  tape itself still works offline.

---

## Pre-PR checklist

- [ ] `npm run check` passes with no TypeScript errors.
- [ ] `npm run build` completes and `npm run preview` serves the result cleanly.
- [ ] Base path: `BASE_PATH=/<repo> npm run build` produces a site that works
      when served from a `/‹repo›/` sub-directory (deep links included).
- [ ] PWA: in a `npm run preview` build, DevTools shows `sw.js` as *activated*,
      and the app still renders with **Offline** ticked in the Network tab.
- [ ] Sticky stack still lines up: header, total strip, and entry form do not
      overlap or leave a gap while scrolling a long tape.
- [ ] Header gutter alignment holds at 16px on a ~375px viewport.
- [ ] Dark mode toggles from both the header and Settings, and survives a reload
      with no flash of light UI.
- [ ] All five accents apply instantly, persist across a reload, and the
      pre-paint script shows no flash of default blue.
- [ ] Compare flow: entering the screen clears it, the winner ring shows on
      exactly one card, and `Add winner to tape` adds the **total** price at
      quantity `1`.
- [ ] Sheet: first launch fetches once, a warm cache makes no network request,
      `Refresh categories` overwrites the cache, and a failed refresh keeps the
      old data.
- [ ] Validation: out-of-range Price/Qty is rejected with a visible error state
      and a disabled Add button.
- [ ] Reduced-motion and keyboard-only focus rings behave correctly.
