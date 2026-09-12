# Deploy to GitHub Pages

This project uses Vite and can be deployed to GitHub Pages as a static site.

## Prerequisites

- The repo is pushed to GitHub (e.g., `https://github.com/<username>/super`)
- GitHub Pages is enabled in the repo settings

## Steps

### 1. Configure the `base` path

The `vite.config.ts` already has `base: '/super/'` set. If your repo is named differently, update it:

```ts
// vite.config.ts
export default defineConfig({
  base: '/your-repo-name/',
  // ...
});
```

### 2. Build the project

```bash
npm run build
```

This generates the static output in the `dist/` folder.

### 3. Deploy to GitHub Pages

**Option A — Using `gh-pages` package (recommended):**

```bash
npm install --save-dev gh-pages
```

Add this script to `package.json`:

```json
"scripts": {
  "deploy": "gh-pages -d dist"
}
```

Then run:

```bash
npm run deploy
```

**Option B — Manual via git:**

```bash
npm run build
git checkout -b gh-pages
cp -r dist/* .
rm -rf dist
git add .
git commit -m "deploy"
git push origin gh-pages
git checkout main
```

### 4. Enable GitHub Pages

1. Go to repo **Settings > Pages**
2. Source: **Deploy from a branch**
3. Branch: `gh-pages` (if using manual) or `gh-pages` (auto with `gh-pages`)
4. Save

### 5. Visit

The app will be available at:

```
https://<username>.github.io/super/
```

> **Note**: The service worker will register using the path `/super/sw.js`. Make sure the `start_url` in `manifest.json` is set to `/super/` if deploying to a subpath.

## Alternative: Vite PWA Plugin

For more advanced PWA features (automatic service worker generation, asset caching), consider using `vite-plugin-pwa`:

```bash
npm install --save-dev vite-plugin-pwa
```