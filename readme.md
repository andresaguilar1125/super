# Smart Grocery & Cart Compare (CRC Mobile PWA)

A high-performance, single-page Progressive Web Application (PWA) for grocery shopping in Costa Rica (CRC / ₡). Zero-backend, works offline.

## App Logic

### Cart System
- **Single cart** stored in `localStorage` under key `smart_grocery_single_cart_v6`
- Each item has: `id`, `name`, `qty` (1-10), `price` (₡10-₡25,000), and `flagged` (boolean for starred items)
- Running cumulative balance is computed per row so you can see the total growing as you add items
- Validation prevents adding new items until existing incomplete rows are filled in

### Touch Interactions
- **Swipe left (≥80px)** → triggers delete confirmation dialog
- **Swipe right (≥80px)** → toggles star/flag on the item
- **Long-press (500ms)** → opens an action sheet with flag/unflag and delete options
- Gesture handling uses native `touchstart`/`touchmove`/`touchend` events with a 10px dead zone to distinguish scroll from swipe

### Unit & Promo Comparison Engine
A slide-up modal that compares two product options (A vs B) to find the true cost-per-unit:

1. **Compatibility check**: Compares base unit types (units, grams, milliliters). Pack vs Units is also compatible.
2. **Normalization**: Converts both options to a shared base unit using `UNIT_TYPES` factors (e.g., kg → g ×1000, L → mL ×1000, Gal → mL ×3785.41)
3. **Unit price calculation**: `totalPrice / totalBaseQuantity` for each option
4. **Winner determination**: Lower unit price wins. Shows % cheaper and relative savings (how much Option B would cost to match Option A's size)
5. **Add Winner to Cart**: One-tap push of the winning deal into the active cart

### PWA Features
- Service worker (`/sw.js`) caches the app shell for offline use
- Web manifest enables "Add to Home Screen" on Android
- iOS fallback modal shows manual install instructions
- `beforeinstallprompt` event listener captures the native install prompt

### Theme
- Dark/light mode toggled via top bar button
- Preference persisted in `localStorage` (`smart_grocery_theme_v5`)
- Tailwind CSS handles dark mode via class-based toggling

## Tech Stack

- **Framework**: React 18 + Vite 5
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Persistence**: Browser `localStorage`
- **PWA**: Web Manifest + Service Worker