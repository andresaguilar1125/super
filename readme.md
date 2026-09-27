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
- [Theming](#theming)
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
- Each row shows the item name (or its category), a **colour-coded category
  chip**, the calculation (`3 × ₡230`), and the line subtotal.
- Newly added rows **flash briefly** (`--animate-flash`, 600ms) so an entry is
  confirmed without having to look away from the form.
- Every row can be **edited** (pencil icon) or **deleted** (bin icon).
- Deleting is a **two-tap** action: the bin glyph swaps to a check and the row
  disarms itself after 3 seconds. It replaced a native `confirm()`, which blocks
  the main thread, cannot be styled, and reads as a browser artefact inside an
  installed PWA.
- `Reset all` is a two-tap action that disarms itself after 3 seconds.

### Category chips

The category is a **monochrome chip** — one neutral grey for every category, not
a colour per category. A ten-hue rainbow was built first and then removed: with
ten saturated pills stacked down the tape, every row shouted equally loudly, so
the colour stopped carrying information entirely. What the chip still does is
separate the category from the product name, which is what a pill is actually
good at.

| Category | Hue | Category | Hue |
| --- | --- | --- | --- |
| Bebidas | cyan | Lacteos | sky |
| Carnes | orange | Postres | fuchsia |
| Granos | amber | Salsas | violet |
| Harinas | yellow | Vegetales | lime |
| Hogar | stone | Otros | slate |

Rules behind that palette:

- **Light fills use the 700 step, not 600.** The 600 step fails WCAG AA as a
text background for seven of the ten hues (cyan 3.60:1, orange 3.59:1, amber
3.19:1, yellow 2.93:1, sky 4.02:1, lime 3.06:1). Every 700 fill clears 4.5:1,
from yellow-700 at 4.92:1 to slate-700 at 10.34:1.
- **Dark fills use the 400 step with `zinc-950` text**, 6.98:1 (violet) to
12.95:1 (lime) — the hue steps lighter rather than inverting to a pale tint.
- **Red and rose are excluded** (reserved for destructive), and so is pink (the
brand colour, which would make one category look permanently highlighted).
- **Colour never carries the meaning alone** — the category name is always
written inside the chip, so it survives greyscale and colour-blindness
(WCAG 1.4.1).
- The chip is `bg-zinc-200 text-zinc-700` light and `dark:bg-zinc-800
  dark:text-zinc-300` dark — 8.25:1 and 10.07:1, comfortably past the 4.5:1 that
  10px uppercase text needs.
- `src/lib/chips.ts` owns the classes as literal strings (Tailwind discovers
  classes by scanning source text).

The breakdown line is **neutral and bold**, so weight carries the hierarchy
rather than hue — a second colour per row would compete with the chip.

### Sticky entry form

- Sits below the header **and** the running-total strip, and stays there while
the tape scrolls underneath.
- **The form is a plain neutral grey**, one step below the white tape rows
  (`bg-zinc-100`), which is what separates the controls you type into from the
  list you are building. In dark mode it is `bg-zinc-900` with a stronger
  border, and it must stay **darker than the `zinc-800` that `Input.svelte`
  paints its fields with** or the fields would disappear into their own
  container.
- Entry row is **one strip of three fields**: `Price · Units · Product`.
- The columns are sized `4.5rem / 2.75rem / 1fr`. **Price is fixed at 72px**
  because a price can hold at most 5 digits (~53px of text plus 16px of padding)
  and therefore never needs to grow — a flexible Price stretched to ~144px to hold
  53px of digits, and every extra pixel was a pixel Product could not use. **Units
  is fixed at 44px** for the same reason: it holds two digits, and a flexible
  share would give it width it can never use. **Product takes all the remainder**,
  because it is the only field whose content length actually varies.
- Price and Units are **centred** (they hold digits); Product is **left-aligned**
  (it holds text, so centring would make short and long names start in different
  places).
- **One gap token for the whole form:** `--spacing-form-gap` (12px) drives the
  strip.
- The `×` separators are **gone** from the form. Price × Units was a marker for a
  pair of fields; with three on one line, and the multiplication already written
  out on every tape row (`2 × 1 250`), it annotated something the user never
  needed telling. The 12px gutter it justified is kept on its own merit — three
  dense fields need the breathing room.
- Each field is still wide enough for its maximum input: Price 5 digits, Units 2,
  Product 30 characters (a long name **scrolls within the field** rather than
  truncating).
- Hitting `Enter` in any field adds the item.
- After adding, focus jumps back to the price field and Units resets to `1`, so a
  repeated item only needs its price retyped. The **Product name is required**, so
  each new row does need a name — the sheet's type-ahead makes that one or two
  keystrokes for anything previously bought.
- **Product is mandatory.** It is not merely a caption: the category is derived
  from it via the sheet (`resolveCategory()`), so a nameless row could only ever be
`Otros`. Price, Units **and** Product must all validate before a row is created.
- **Red is a warning, and it appears only after a tap on Add/Save.** The rule used
  to be the opposite — a required field was flagged from the very first render,
  reasoned as "the Add button is disabled anyway, so the red border IS the reason".
  That reads badly in practice: the form opens with an empty Price and Product, so a
  brand-new tape displayed two permanently red fields before the user had done
  anything wrong. A warning that is always on carries no information and simply
  looks broken.
- After the first attempted submit, each field shows its own warning **until that
  field becomes valid**, independently of the others. Fixing the price clears the
  price; it does not wait for the whole form. A successful add clears the latch, so
  the next entry starts neutral again.

### Floating add button

`+ Add Item` is a **floating action button** pinned to the bottom-right, not a
control inside the form.

- The form is sticky at the **top** of the screen, which is the wrong place for a
  thumb: on a long tape the hand holding the phone is nowhere near it. Pinning
  the action to the bottom edge keeps it reachable however far the tape scrolls —
  and the same is just as true for saving an edit.
- **It changes job with the form.** While editing it becomes **Save** with a check
  glyph; otherwise it adds with a plus. The glyph changes so the two modes are
distinguishable without reading the label.
- It looks **muted until Price, Units and Product all validate**, and the same
  condition gates both adding and saving — but it is deliberately **not `disabled`**.
  A tap on an incomplete form is what raises the red field warnings, so the click has
  to land; a genuinely `disabled` button would swallow it and explain nothing. It also
  fixes an accessibility gap: a disabled button is unfocusable and announces nothing,
  so a screen-reader user would never learn why it was inert.
- The muted state is `--brand-muted`, a solid opaque palette step — never
  transparency. A 50%-opacity button was hard to read and looked broken.
- It sits above the safe-area inset, and the tape carries bottom padding so the
  last row and `Reset all` can never sit underneath it.
- It is rendered OUTSIDE the sticky form: that form is `sticky z-10`, and a
non-auto z-index creates a stacking context, so a `fixed` child would be trapped
there and paint beneath the header (`z-20`). Same trap as the totals sheet.
- The label is visible text rather than a bare glyph — an extended FAB is easier
  to hit, and the seeder drives it by text.

### Editing a row

Each row has a pencil button. Tapping it puts the **sticky entry form itself**
into an edit state rather than opening a separate sheet:

- The form is already pinned to the top of the screen, which is exactly where an
  edit wants to be, so reusing it removed an entire overlay component and made add
  and edit behave identically.
- **The form locks while editing.** A header bar appears above the fields showing
  `Editing <product>` with a **Cancel** button, the row under edit gets a brand
  ring, and every other row's pencil is disabled.
- **The floating action becomes Save** (with a check glyph instead of a plus), and
  `Enter` in any field saves rather than adding a new row.
- **Cancel and the Escape key** are the two ways out. This is the only release
  from the lock, and it exists deliberately: without it a mis-tapped edit on a row
  you did not mean to change would trap you, and a keyboard-only user would have no
  exit at all.
- Tapping a **different** row's pencil while editing is ignored — you must save or
  cancel first. Because that makes the tap a no-op, the other pencils are rendered
  `disabled` so the affordance looks inert rather than broken.
- **Deleting the row being edited exits edit mode**, as does `Reset all`. One
  reactive rule covers both, and it clears the fields so the form can never keep
  showing a row that no longer exists.
- Price, Units and Product are prefilled and validated with the same rules as the
  entry form, so an edit cannot produce a row the form would have rejected. The
  **Product name is required here too**, so a row cannot be saved empty.
- The **category is derived**, not editable: it is re-resolved from the (possibly
  edited) product name via the sheet, exactly as `addRow()` does. Renaming `LECHE`
  to `ARROZ` therefore re-categorises the row.
- Saving calls `updateRow()`, which re-applies `roundPrice()` and recomputes the
  subtotal.

### Smart validation

- Units defaults to `1`.
- Invalid Price or Units shows an inline red border plus `aria-invalid` once Add has
  been pressed, and no row is created — the app never crashes on bad input.
- Limits are user-configurable from Settings (see [Money rules](#money-rules-crc)).

### Compare deals

A **bottom sheet**, opened from the Compare button in the header, that settles a
smaller purchase against a bigger one by price per unit. It is a sheet rather than
a route so it behaves like every other overlay in the app — same backdrop, focus
handling and Escape-to-close — and so the tape stays visible behind it.

- Two cards (**Small** / **Big**) **side by side**, each taking a **Price** and a
  **Units** that acts as the divisor: price per Unit is `price ÷ Units`. Inside each
  card the fields are **stacked** — two columns of fields on a 375px screen would
  leave each under ~90px and clip a 5-digit price.
- **The unit is inferred from the number, and stated on the field's LABEL.**
  Units up to **25** are read as a count of items and the label reads **Units**;
  above 25 it is read as a measure and the label reads **Grams or ml**. Each field
  infers independently, so there is no unit-kind toggle to remember.
- The label is where the inference is shown deliberately. It used to be echoed in
  a paragraph *under* the field as well, which put the answer in two places and —
  above the threshold — printed the same phrase twice in one card (`gram or ml`
  on its own line, then `per gram or ml` directly beneath it). Putting it on the
  label you are already reading means it appears exactly once, and it declares up
  front how the number will be read instead of confirming it afterwards. The rate
  line below is therefore just the figure and `per unit`.
- 25 is the cut-off because it is where a count stops being plausible for the
  things this screen compares — nobody buys 26 cans of soda or 26 tins of tuna as
  one line, whereas 4 cans or 10 eggs are ordinary. It is a single named constant
  (`COUNT_MAX` in `src/lib/utils.ts`).
- **Grams and millilitres are interchangeable** (1 g == 1 ml), so a 400 ml beer
  goes in as `400` and a 5-can pack goes in as `5`.
- The two fields infer **independently**, so comparing `4` against `500` is
  allowed and simply labels the two per-unit figures differently. There is no
  mixed-unit warning — this is a one-off calculator, and per the product decision
  an extra dismissal step is not worth it.
- Units must be `1` or more and is capped at 4 digits (up to `9999`), which is what
  makes gram-scale values usable.
- **The verdict appears directly under the cards**, in the slot the instructional
  paragraph used to occupy. That paragraph only explained what to type, which the
  labels already say, so it was spending the most valuable space in the sheet on
  something read once — while the answer required scrolling.
- When there is no result yet **nothing is rendered** there. There is no
"enter both prices…" placeholder: an empty slot is clearer than a sentence telling
you what a disabled button already tells you.
- The winner gets a brand-coloured ring and the sheet shows the savings and percentage
  difference. A tie is reported as a tie.
- **Opening the sheet always clears it** — comparing is a one-off calculation, not
  a saved list, so nothing lingers from a previous comparison. The **Clear** button
  in the header does the same thing on demand (single tap: it only discards
  unsaved fields, so the two-tap guard used for destroying a tape would be
  disproportionate).
- **The Product name is required.** The tape's category is *derived* from it via
  the sheet, so an unnamed winner would land in `Otros` and could never be a real
  entry. See [Money rules](#money-rules-crc) for the same rule on the calculator.
- `Add winner to tape` is **muted until there is a real result and a name**, and is
  rendered in **gray** while incomplete rather than green — it starts incomplete on
  every open, so a brand fill would make it look like the primary action most of the
  time it is visible. Like the calculator's button it is **not `disabled`**: tapping
  an incomplete sheet is what raises the red field warnings.
- `Add winner to tape` adds the winning option at its **total price with a
  single unit**, then returns to the calculator. Units is only the comparison
  divisor, not a count of items bought.

### PWA and offline

The app is a genuinely installable Progressive Web App — not just a home-screen
shortcut.

- A **Workbox service worker** is generated at build time by
  `@vite-pwa/sveltekit`. It precaches the client bundle (JS, CSS, **fonts**, icons)
  and every prerendered HTML page — 33 entries in a typical build. The two woff2
  files are matched by the `globPatterns` in `vite.config.ts`; leaving them out
  still worked offline (same-origin assets fall through to a CacheFirst runtime
  route) but made the offline font a side effect rather than a guarantee.
- **It works offline.** Every route is precached, so the app shell loads and
  navigation works with the network completely down. The tape, settings, theme,
  and settings all live in `localStorage`, so no data is lost either.
- **Updates apply automatically.** `registerType: 'autoUpdate'` means a new
  service worker takes over on the next load without a manual prompt.
- Registration is explicit (`PwaRegister.svelte` in the root layout) rather than
  an injected script, so it sits inside SvelteKit's own lifecycle.
- `static/manifest.webmanifest` declares `standalone` display, `portrait`
  orientation, theme colours, and three icons (two `any`, one `maskable`)
  across the standard 192px and 512px sizes.
- Safe-area insets keep content clear of notches and the home indicator, and
  overscroll bounce is disabled so the page doesn't rubber-band.
k
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
| **No decimals** | `34 560`, never `34 560.00` |
| **Rounding** | While typing, raw digits are kept. On blur/add, the price snaps to the nearest `5` colones when it is `≥ 10`; below `10` it is left alone |
| **Thousands separator** | A **space** — from `toLocaleString('es-CR')`, whose ICU grouping separator is a no-break space (U+00A0). The no-break variant matters on the compare cards, where a plain space would let an amount wrap mid-number |
| **Decimal mark** | A **dot**, even though `es-CR` uses a comma. Deliberate: the input fields only ever accept a dot, so `1 234.57` on the compare cards stays consistent with what you can type. The swap happens in one place, `formatAmount()` |
| **Currency symbol** | `₡` is **not** rendered with amounts. It survives only where it disambiguates a rule (the Settings labels and their help text), not on any figure |
| **Units** | Whole integers only — you cannot buy 1.25 cans of soda |
| **Price digits** | Max 5 (`99,999`) |
| **Unit digits** | Max 2 |
| **Price floor** | Prices below the fixed minimum (`₡10`) are rejected, so a mistyped digit cannot become a `₡1` line |

### Configurable limits

Settings exposes two sliders, both bounded on the UNIT price:

| Setting | Range | Step | Default |
| --- | --- | --- | --- |
| **Max Price** | 1,000 – 9,999 | 1 | 9,999 |
| **Max Units** | 5 – 50 | 5 | 50 |

**Min Price is no longer configurable.** It is a fixed `₡10`, declared as
`FIXED_MIN_PRICE` in the settings route and pinned into `normalize()`, which is
what migrates a value written by an older build. The slider was removed because
the floor is a mistyped-digit guard rather than a policy knob: the cheapest item in
`scripts/data.csv` is `₡90` (CULANTRO), so any single-digit floor blocks a slip
without ever rejecting a legitimate entry. Exposing it invited people to set a
policy with it. `₡10` rather than the old `₡5` because it sits above
`roundPrice()`'s `₡5` step, so a price at the floor is stable under rounding.

**The Max Price cap is on ONE item's price, never on a line total.** A `₡5,000`
item × 5 is a valid `₡25,000` line — `addRow()` multiplies *after* the check. The
`₡9,999` ceiling sits just under the 5-digit boundary the input's `maxlength`
already enforces, so it exists to catch a slipped digit rather than to express a
budget.

The floor applies to the **calculator's add and edit forms and both compare
Price fields** — the compare fields previously had no validation beyond
digit-stripping, so a `₡1` comparison was possible there even once the calculator
refused one.

Saved values are clamped and snapped back into range on load, so a value written
by an older build (or a hand-edited `localStorage`) can never leave the
calculator rejecting every price. The `{ ...DEFAULT_SETTINGS, ...stored }` merge
supplies `minPrice` for older stored settings that lack it, and `normalize()` then
pins it to the fixed floor.

---

## Screens

| Route | Purpose |
| --- | --- |
| `/` | Redirects to `/calculator` on mount |
| `/calculator` | The tape, the running total, and the sticky entry form |
| `/compare` | *removed* — Compare is a sheet opened from the header |
| `/settings` | Limits, appearance, sheet refresh, and the danger zone |

The header carries three controls: the **Compare** button (which opens a sheet),
the theme toggle, and Settings. Compare lives there rather than in the calculator's
form because the form's bottom row used to exist only to pair it with
`+ Add Item`; once the add action became a floating button that pairing had
nothing left to align to.

### Header behaviour

The header is shared across routes and adapts to where you are:

- **On the calculator:** a cart icon with the "Super" wordmark, the live total
  strip beneath the header, and Compare + theme + settings on the right.
- **On `/settings`:** the top-left becomes a **back arrow** and the total strip is
  hidden, because that screen has no tape on screen and a running total there
  would be noise. `/settings` is now the only drill-down route.

Compare used to be a route reached from a two-up action group in the calculator's
sticky form. It is now a **sheet** opened from the header, so there is no route to
navigate to and no back button to provide.

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

Category chips are the tape's primary visual organiser — see
[Category chips](#category-chips). An earlier iteration gave each category its
own hue; the reasoning that changed is that with ten saturated pills every row
shouted equally loudly, so the colour stopped conveying anything.

---

## Theming

### Dark mode

- Class-driven: a `.dark` class on `<html>`, **not** `prefers-color-scheme`.
  This requires the explicit `@custom-variant dark (&:where(.dark, .dark *));`
  in `src/app.css` — without it every `dark:` variant silently stops applying.
- Toggle from the header or from the Settings switch; both route through
  `setTheme()` / `toggleTheme()` in `src/lib/store.ts`.
- Persisted in `localStorage` under `supercalc-theme`.
- An inline, synchronous script in `src/app.html` applies the class before first
  paint, which prevents a flash of light UI on load.

### One brand colour (no accent picker)

The app has a **single fixed green**, not a user-selectable accent. Five accents
were removed deliberately: combined with the ten category hues that once existed,
the app had **three competing colour systems**, and the result read as pastel
noise rather than a design.

- **Light:** `emerald-700` with white text — **5.37:1**.
- **Dark:** `emerald-400` with `zinc-950` text — **10.29:1**.
- `emerald-600` was the obvious-looking choice and **fails at 3.67:1**. The 600
  step is not automatically dark enough; measure it.
- **Disabled** uses `--brand-muted`, a solid palette step (emerald-800 light /
  emerald-600 dark), never transparency and never a `color-mix()`.

> **Why `color-mix()` is gone.** The previous theme built its form tint and
> disabled fills by mixing the accent toward white or a neutral. Mixing toward a
> low-chroma neutral is exactly what produces a washed-out, pastel result, so the
> whole system was replaced with **solid palette steps**.

Tokens live in `src/app.css` as `--brand` / `--brand-hover` / `--brand-fg` /
`--brand-muted`, exposed through `@theme inline` so utilities compile to
`var(--brand)`. That indirection is still required — it is what lets one token set
carry different light and dark values without per-component overrides.

There is **no accent picker in Settings**, no `ACCENTS` list, and no
`src/lib/accents.ts`. A `supercalc-accent` key left in `localStorage` by an
older build is simply ignored — no error, no migration.

### Where the brand colour shows up

Button `solid`, Switch on-state and knob, the Input focus border, the compare
winner's ring, the Settings sliders, the category totals sheet's proportion bars,
and the global `:focus-visible` outline.

**Red is reserved for destructive/error** and stays hardcoded regardless of
anything else: the `destructive` / `destructive-soft` button variants, and the
per-row delete button, which is **permanently red** rather than red-on-hover —
on touch there is no hover to discover it with.

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
| `npm run deploy` | Build with `BASE_PATH=/super` and publish to the `gh-pages` branch |
| `npm run check` | Type-check with `svelte-check` |
| `npm run seed` | Seed the tape with random rows from `scripts/data.csv` (see below) |
| `node scripts/seed-dummy.mjs` | The seeder directly, for flags and one-off runs |

To build exactly as GitHub Pages will:

```bash
BASE_PATH=/<your-repo-name> npm run build
```

---

## Project structure

```
src/
├── lib/
│   ├── chips.ts               # Category chip classes (monochrome)
│   ├── categories.ts          # Google Sheet ingestion, cache, and stores
│   ├── cn.ts                  # clsx + tailwind-merge helper
│   ├── fonts.css              # Inter Variable, latin + latin-ext only
│   ├── models.ts              # TypeScript interfaces and union types
│   ├── chips.ts               # Category chip classes (monochrome)
│   ├── store.ts               # Global stores, actions, formatting, hydration
│   ├── utils.ts               # Pure helpers (CSV, validation, rounding, units)
│   └── components/
│       ├── Button.svelte      # solid | outline | ghost | destructive | destructive-soft
│       ├── Card.svelte        # default | danger
│       ├── CategoryTotalsSheet.svelte # Bottom sheet: spend per category
│       ├── CompareSheet.svelte        # Bottom sheet: small vs big price per unit
│       ├── IconButton.svelte  # 44×44, requires a `label`
│       ├── Input.svelte       # Uncontrolled field, optional prefix
│       ├── PwaRegister.svelte # Registers the service worker (renders nothing)
│       └── Switch.svelte      # role="switch" + aria-checked
├── routes/
│   ├── +layout.svelte         # Shared header, total strip, hydration, PWA
│   ├── +layout.ts             # export const prerender = true
│   ├── +page.svelte           # Redirects to /calculator
│   ├── calculator/+page.svelte
│   └── settings/+page.svelte
├── app.css                    # Tailwind v4 theme, brand tokens, base layer
├── app.d.ts                   # Ambient types (incl. vite-plugin-pwa client)
└── app.html                   # HTML shell + pre-paint theme script

static/
├── favicon.png
├── manifest.webmanifest       # Relative start_url/scope, so it survives a sub-path
└── icons/                     # Generated placeholder PWA icons

scripts/data.csv              # Sheet extract used by the tape seeder
.github/workflows/deploy.yml   # GitHub Pages deploy (build + publish)
```

---

## State and persistence

### Stores (`src/lib/store.ts`)

- `calculatorRows` — the tape; persisted to `localStorage`
- `subtotal` — **derived**, so there is no manual `updateSubtotal()` dance
- `unitCount` — derived sum of units, useful for badges
- `settings` — the two limits
- `theme` — `'light' | 'dark'`
- `currentView` and `compareEntries` — available for cross-screen state

### Sheet stores (`src/lib/categories.ts`)

- `categories`, `categoriesFetchedAt`, `categoriesStatus`, `categoriesError`
- `categoryOptions` — derived, sorted, de-duplicated category names

### Actions

- Rows: `addRow()`, `updateRow()`, `deleteRow()`, `resetAll()`
- Formatting: `formatCurrency()` (money, no decimals). The one number formatter is
  `formatAmount()` in `src/lib/utils.ts`; `formatCurrency()` is a thin wrapper over it,
  and the compare sheet's per-unit figures call it directly with
  `maxFractionDigits: 2`
- Appearance: `setTheme()`, `toggleTheme()`
- Categories: `hydrateCategories()`, `ensureCategoriesLoaded()`,
  `refreshCategories()`, `resolveCategory()`

### `localStorage` keys

| Key | Contents |
| --- | --- |
| `supercalc-rows` | The tape |
| `supercalc-settings` | Max price and max units |
| `supercalc-theme` | `light` or `dark` |
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
one-shot flags so write-back persistence is only wired once, and the theme
write-back exists precisely so a change can never be applied in the UI without
being persisted.

---

## Design system

A **flat, minimal** language: borders carry the elevation, and there are **no
shadows** anywhere.

- **Neutral `zinc` for structure**, with exactly one saturated colour: the
  **brand green** on the primary `solid` button. Red is reserved for
  destructive/error. There is no accent picker, so there is nothing else to
  colour and nothing to wash out. Category chips are neutral too — see
  [Category chips](#category-chips).
- **Disabled buttons never use transparency.** A 50%-opacity button is hard to
  read and looks broken rather than inactive. The floating add button uses
  `--brand-muted`; the compare sheet's winner button is grey, because it starts
  disabled on every open and a green fill would make it look like the primary
  action most of the time it is visible.
- **Radius scale** — `--radius-sm | md | lg | xl`, declared in `@theme`.
- **Touch targets** — `IconButton` and `Switch` are 44px tall; every `Button`
  size except `sm` clears 44px.
- **Motion** — a `prefers-reduced-motion` block neutralises every transition and
  animation in the app, and the added-row flash is additionally gated behind
  `motion-safe:` so it is never attached at all for a user who opted out. Note the
  global block collapses `animation-duration` but **not** `animation-delay`, so any
  delay-based animation would still need its own guard.
- **iOS zoom** — form text is forced to `16px` minimum so focusing a field never
  triggers a zoom.
- **Focus rings** — `:focus-visible` only, so mouse and touch interaction stays
  quiet. The ring uses the brand colour with a 2px offset, which keeps it visible even
  when it lands on a brand-coloured control.
- **Field focus borders use `focus-within`, not `focus`.** `focus-within` matches
  when the element itself *or* a descendant has focus. It was introduced for the
  `prefix` variant, where the border sat on a wrapper while focus lived on the
  inner `<input>` (and a `:focus` selector never matches an ancestor, so the class
  never fired at all). `Input.svelte` no longer has a prefix branch — the `₡` marker
  was removed — but `focus-within` is kept because it is the more robust of the
  two. The error state repeats itself for `focus-within` so an invalid field does
  not turn brand-green the moment it is clicked.

### Sticky stack geometry

Three bars stack at the top of the calculator. Their heights are tokens in
`src/app.css` so they can never drift apart:

```css
--spacing-header: 3.5rem;    /* 56px */
--spacing-totalbar: 2.75rem; /* 44px */
--spacing-sticky-top: calc(var(--spacing-header) + var(--spacing-totalbar));
--spacing-form-gap: 0.75rem; /* 12px — shared by the entry strip and the compare cards */
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

## Icons

The icons in `static/icons/` are **generated placeholders** — flat zinc squares
with a white plus mark, not finished artwork. They are committed to the repo, so
there is no build step that regenerates them and **no generator script in the
project** (an earlier `scripts/generate-icons.mjs` was removed; the README used to
reference it in five places).

Replace them with designed assets and keep the same filenames and sizes, so
`static/manifest.webmanifest` keeps resolving:

| File | Size | Purpose |
| --- | --- | --- |
| `static/icons/icon-192.png` | 192×192 | `any` |
| `static/icons/icon-512.png` | 512×512 | `any` |
| `static/icons/icon-maskable-512.png` | 512×512 | `maskable` |
| `static/favicon.png` | — | browser tab icon |

---

## Known gaps

Deliberate, verified limitations rather than bugs:

- **The icons are placeholders** — flat zinc squares with a white plus mark. The
  PWA installs correctly with them, but they are not finished artwork.
- **The app is single-device.** There is no backend and no sync; the tape lives
  only in the browser that created it.
- **There is no export.** A finished tape can't be printed, shared, or copied
  out — it exists only on screen and in `localStorage`.
- **Price is capped at 6 digits** on the compare sheet's Big field versus 5 on the
  calculator. Intentional (a larger option totals more), but worth knowing: the
  calculator's own 5-digit cap is **not** the binding constraint in practice,
  because `maxPrice` stops at 9,999 — a 5th digit above that fails the Settings
  limit anyway.
- **The `Product` field is a native `<datalist>`.** Support for the suggestion
  popup is unreliable on **iOS Safari**, which often renders no dropdown at all.
  Since picking a suggestion is how a label inherits its sheet category, an iOS
  user may never see categories resolve and should assume unmatched labels land
  in `Otros`. A custom combobox is the real fix; it has not been built.
- **`roundPrice()` runs on blur and on add, not on every keystroke.** Typing
  `1234` and hitting Enter stores `1,235` (the row is the source of truth), but
  the field can briefly show the unrounded value until it blurs.
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
- [ ] The brand green renders identically in light and dark, and a legacy
      `supercalc-accent` key in `localStorage` causes no error and no flash.
- [ ] Compare flow: entering the screen clears it, the winner ring shows on
      exactly one card, and `Add winner to tape` adds the **total** price at
      units `1`.
- [ ] Sheet: first launch fetches once, a warm cache makes no network request,
      `Refresh categories` overwrites the cache, and a failed refresh keeps the
      old data.
- [ ] Validation: tapping Add on an incomplete form warns with red borders and adds
      nothing; the warnings clear per field as each is fixed.
- [ ] Reduced-motion and keyboard-only focus rings behave correctly.
