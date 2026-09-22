# Deploying SuperCalc manually to GitHub Pages

This is the **manual** counterpart to [`github-pages.md`](./github-pages.md).
That guide deploys through GitHub Actions; this one publishes the build output to
a branch from your own machine, with no workflow involved.

Use it when you want to ship without waiting on CI, when Actions is unavailable,
or when you need to publish a build that exists only on your laptop.

> **The repository is public**, so Pages works on GitHub Free and no plan upgrade
> is needed. Remember that everything committed here is world-readable — never
> commit API keys, tokens, or `.env` files.

---

## Table of contents

- [Choose your route](#choose-your-route)
- [Blocking issue: the lockfile is not committed](#blocking-issue-the-lockfile-is-not-committed)
- [Why the `git subtree` recipe does not work](#why-the-git-subtree-recipe-does-not-work)
- [Manual deploy in five steps](#manual-deploy-in-five-steps)
- [Why `--nojekyll` is required](#why-nojekyll-is-required)
- [The base path](#the-base-path)
- [Deploying updates later](#deploying-updates-later)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Going back to Actions](#going-back-to-actions)
- [Checklist](#checklist)

---

## Choose your route

GitHub Pages publishes from **exactly one source**. It is either the Actions
artifact or a branch — never both.

| Route | Publishes when | Cost |
| --- | --- | --- |
| [Actions](./github-pages.md) | You push to `main` | Automatic, but blocked until the lockfile below is committed |
| **Branch** (this guide) | You run `npm run deploy` | Manual, but needs no CI |

Pick one deliberately. Leaving both half-configured is the most common way to end
up with a site that silently stops updating.

---

## Blocking issue: the lockfile is not committed

The Actions workflow fails in about ten seconds with:

```
Dependencies lock file is not found in /home/runner/work/super/super.
Supported file patterns: package-lock.json, npm-shrinkwrap.json, yarn.lock
```

`package-lock.json` exists on disk but was **never committed**, so `npm ci` has
nothing to install from. This does not affect the manual route, but it is a
one-commit fix and worth doing regardless:

```bash
cd /Users/juniorlopez/Github/super

git ls-files package-lock.json          # empty output confirms it is untracked
git add package-lock.json
git commit -m "chore: commit lockfile so npm ci works in CI"
git push
```

That push re-triggers *Deploy to GitHub Pages* and, if it goes green, publishes
the site with no manual work at all.

---

## Why the `git subtree` recipe does not work

`github-pages.md` previously recommended this:

```bash
BASE_PATH=/super npm run build
touch build/.nojekyll
git subtree push --prefix build origin gh-pages   # ✗ cannot work
```

`build/` is listed in `.gitignore` and has never been committed, so there is no
tree for `git subtree split` to read — the command fails immediately.

Two further corrections to that recipe:

- **`--dotfiles` is not the flag that carries `.nojekyll`.** It governs
  dot-*prefixed* files (`.well-known`, `.nojekyll` if it already exists in the
  source directory). The correct option is `--nojekyll`, which writes the marker
  into the published branch directly.
- **`touch build/.nojekyll` is unnecessary** when using the CLI with `--nojekyll`.

The recipe below replaces it.

---

## Manual deploy in five steps

### Step 1 — Install the publisher

```bash
npm i -D gh-pages
```

Requires Git ≥ 1.9 and Node > 14.

### Step 2 — Wire up the scripts

Add to `package.json`:

```json
"scripts": {
  "predeploy": "BASE_PATH=/super npm run build",
  "deploy": "gh-pages -d build --nojekyll"
}
```

`npm run deploy` runs `predeploy` automatically, so **one command does both the
build and the publish** — they cannot drift out of sync.

> `BASE_PATH=/super npm run build` is POSIX shell syntax. Correct on macOS and
> Linux; it will not work in a Windows `cmd` or PowerShell shell.

### Step 3 — Publish

```bash
npm run deploy
```

Expected output ends with `Published`. The CLI clones the repo into a cache
directory, creates (or updates) `gh-pages`, copies `build/` into its root, and
pushes to `origin`.

**Publish before configuring Pages.** The branch dropdown in Settings will not
offer `gh-pages` until the branch actually exists on the remote.

Confirm it landed:

```bash
git ls-remote --heads origin gh-pages
```

### Step 4 — Point Pages at the branch

1. Open the repository on GitHub.
2. **Settings** → **Pages**.
3. Under **Build and deployment** → **Source**, choose **Deploy from a branch**.
4. Set the branch to **`gh-pages`** and the folder to **`/ (root)`**.
5. Save.

### Step 5 — Retire the Actions workflow

Because the source can only be one thing, the deploy workflow should be switched
off so it cannot conflict with the branch:

- **Actions** → **Deploy to GitHub Pages** → **⋯** → **Disable workflow**.

Skipping this is not fatal, but the workflow's `deploy` job will keep failing
while Pages is on a branch source, and each push will send a failure email.

### Stray files inherited from the default branch

**`gh-pages` ≥ 6 does not remove dot-prefixed files**, even though its own docs
and `options.remove` (`**/*`) suggest a full clean. On the **first** publish,
when no `gh-pages` branch exists yet, the CLI clones `main` at depth 1, checks
out a new branch from it, and copies `build/` on top — so `.github/` and
`.gitignore` from `main` survive into the published branch and are served by
Pages as static files.

Re-running `npm run deploy` and even clearing the cache with
`npx gh-pages-clean` do **not** remove them. Clean them once by hand:

```bash
TMP=$(mktemp -d)
git clone --branch gh-pages --depth 1 \
  https://github.com/andresaguilar1125/super.git "$TMP"
cd "$TMP"
git rm -r --ignore-unmatch .github .gitignore
git commit -m "chore(gh-pages): drop files inherited from the default branch"
git push origin HEAD:gh-pages
```

The leak is harmless — `deploy.yml` in a published branch is never executed by
Actions — but it advertises your workflow and ignores to anyone browsing the
branch. To avoid it next time, create the branch with an initial empty commit
before the first publish.

---

## Why `--nojekyll` is required

When Pages publishes **from a branch**, it runs Jekyll over the content first, and
Jekyll ignores every file and directory whose name begins with an underscore.

SvelteKit's entire client bundle lives in `_app/`. Without the marker, `_app/` is
stripped from the published site: the HTML loads, but there is no CSS and no
JavaScript, and the page is blank.

`--nojekyll` writes that marker for you.

> This does **not** apply to the Actions route, which uploads a prebuilt artifact
> and bypasses Jekyll entirely. Only add `.nojekyll` for a branch deploy.

---

## The base path

A project site is served from `/<repo>/`, not the domain root, so the build must
know its own sub-path. `svelte.config.js` reads it from `BASE_PATH`:

```js
paths: {
  base: process.argv.includes('dev') ? '' : process.env.BASE_PATH ?? ''
}
```

- The value must match the **repository name**: `BASE_PATH=/super`.
- Building without it produces HTML that requests `/_app/...` instead of
  `/super/_app/...`. Every asset 404s and you get a blank page.
- Because this is hand-written in `predeploy`, **renaming the repository requires
  editing that script**. (The Actions workflow avoids this by deriving the value
  from `github.event.repository.name`.)

---

## Deploying updates later

```bash
npm run deploy
```

That is the whole loop. `gh-pages` removes the previous contents of the branch
before copying, so stale hashed chunks cannot accumulate.

Two behaviours to keep in mind:

- **Installed users update automatically.** `registerType: 'autoUpdate'` means a
  new service worker activates on the next visit without a prompt.
- **`npm run preview` caches its file manifest at startup.** If you rebuild while
  a preview server is running, newly hashed `_app/immutable/*` assets 404 even
  though they exist on disk. Restart the preview server after every build.

---

## Verification

### Locally, before publishing

```bash
npm run check                                  # type-checks must pass
BASE_PATH=/super npm run build
npm run preview
```

Then load **`http://localhost:4173/super/calculator`** — the `/super/` prefix is
the entire point. Testing at the domain root proves nothing, because that is not
where Pages will serve the app.

### After publishing

```bash
# 1. The branch exists on the remote
git ls-remote --heads origin gh-pages

# 2. The site answers
curl -sI https://andresaguilar1125.github.io/super/ | head -1        # expect 200

# 3. Assets carry the sub-path — THE key check
curl -s https://andresaguilar1125.github.io/super/ \
  | grep -o '/super/_app/immutable/[^"]*' | head -1

# 4. The service worker is served
curl -sI https://andresaguilar1125.github.io/super/sw.js | head -1
```

Step 3 is the one that catches a bad build. If the only matches are `/_app/...`
with no `/super` prefix, the build ran without `BASE_PATH`.

Allow a minute after the first successful deploy for Pages to propagate; a 404 in
that window is normal.

### In the browser

- [ ] The app loads at `https://andresaguilar1125.github.io/super/`.
- [ ] **Hard refresh** on `/super/calculator` works (served by `404.html`).
- [ ] Compare and Settings navigate, and Back returns you.
- [ ] DevTools → **Application → Service Workers** shows `sw.js` *activated*.
- [ ] DevTools → **Application → Manifest** shows the icons with no errors.
- [ ] Ticking **Offline** and reloading still renders the app.
- [ ] The browser offers **Install**.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `git subtree` fails outright | `build/` is gitignored, never committed | Use the CLI recipe; do not un-ignore `build/` |
| Blank page, `_app` 404s in console | Built without `BASE_PATH`, or `.nojekyll` missing | Check `predeploy` sets `BASE_PATH=/super`; confirm `--nojekyll` is passed |
| Missing CSS/JS, `_app` folder absent on the branch | Jekyll stripped the underscore directory | Add `--nojekyll` and redeploy |
| `gh-pages` not offered in the Pages branch dropdown | Branch does not exist on the remote yet | Run `npm run deploy` first |
| `.github/` or `.gitignore` visible on the branch | Inherited from `main` on first publish | Clean once by hand — see [Stray files](#stray-files-inherited-from-the-default-branch) |
| Site never updates after a push | Pages Source is still **GitHub Actions** | Switch Source to the branch, or switch back to Actions and re-enable the workflow |
| `fatal: A branch named 'gh-pages' already exists` | Stale `gh-pages` cache | `npx gh-pages-clean`, or delete `node_modules/.cache/gh-pages` |
| Push rejected / auth prompt | Wrong remote credentials | Confirm `origin` is `https://github.com/andresaguilar1125/super.git` |
| Deployed, but the page looks stale | Browser or service-worker cache | Hard refresh, or a private window |
| Trailing-slash URL 404s (`/super/calculator/`) | Expected | `trailingSlash` is unset; `404.html` serves the shell and the client router takes over |

Verbose output from the publisher:

```bash
NODE_DEBUG=gh-pages npm run deploy
```

---

## Going back to Actions

The workflow is the better long-term route once the lockfile is committed —
`BASE_PATH` is derived from the repository name, so renaming the repo needs no
edit, and deploys are automatic on push.

```bash
# 1. Re-enable the workflow
#    Actions → Deploy to GitHub Pages → ⋯ → Enable workflow

# 2. Switch Pages back to the artifact source
#    Settings → Pages → Source → GitHub Actions
```

Leaving the `gh-pages` branch in place is harmless — it just sits unused. Delete
it only if you are sure:

```bash
git push origin --delete gh-pages
```

---

## Checklist

- [ ] `package-lock.json` committed (unblocks Actions either way).
- [ ] `gh-pages` installed as a devDependency.
- [ ] `predeploy` and `deploy` scripts added to `package.json`.
- [ ] `BASE_PATH=/super npm run build && npm run preview` verified at
      `http://localhost:4173/super/`, deep-link refresh included.
- [ ] `npm run deploy` reports `Published`.
- [ ] `git ls-remote --heads origin gh-pages` shows the branch.
- [ ] Branch contains `.nojekyll` and `_app/`, and no files inherited from `main`.
- [ ] **Settings → Pages → Source** set to **Deploy from a branch** →
      `gh-pages` → `/ (root)`.
- [ ] Actions workflow disabled (or Pages Source switched back to Actions).
- [ ] Live asset URLs contain `/super/_app/immutable/...` and return `200`.
- [ ] Service worker activates and the app renders offline.

---

## Related documentation

- [`github-pages.md`](./github-pages.md) — the Actions-based deploy
- [`readme.md`](./readme.md) — architecture, features, and local development
- [gh-pages CLI](https://github.com/tschaub/gh-pages) — publisher reference
- [GitHub: configuring a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Bypassing Jekyll on GitHub Pages](https://github.blog/2009-12-29-bypassing-jekyll-on-github-pages/)
