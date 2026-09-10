# Role & Objective
You are an expert mobile UI/UX engineer specializing in high-performance web applications. Build a lightweight, single-page application (SPA) optimized for single-handed use on mobile browsers during grocery shopping trips.

# Technology Stack Preference
Target implementation MUST use one of the following approaches:
1. **Primary Option — React PWA:** Built with React, Vite, and Tailwind CSS. Must include a Web Manifest and Service Worker configuration for full offline Progressive Web App functionality and installation on home screens. Use `framer-motion` or `@use-gesture/react` for touch/swipe mechanics.
2. **Alternative Option — Flutter Web:** Built using Flutter for Web using `flutter_slidable` for swipe interactions, `provider` or `riverpod` for local state, and `shared_preferences` for web persistence.

# Core Requirements & Architectural Specifications

## 1. Local Persistence (Zero-Backend)
- Persist all active shopping lists, unit comparison states, and active cart setups in Browser `localStorage` (React) or `shared_preferences` (Flutter).
- Data MUST survive accidental tab closes or browser page reloads.
- Provide a "Clear Trip" button protected by an explicit confirmation dialog ("Are you sure you want to reset all carts?").

## 2. Multi-Cart Architecture (1 or 2 Carts)
- Support a maximum of 2 active carts simultaneously (e.g., "Main Grocery" vs. "Office/Work").
- Fast navigation between carts via top-level Tabs or horizontal Swipe gestures.
- Display individual Cart Totals pinned at the bottom, alongside a dynamic "Grand Total" across both active carts.

## 3. Cart Row Design & Touch Gesture Rules
- Quick-add button (+) appends a new item row to the current active cart.
- **Row Columns Layout:** 
  1. Quantity (numeric input with prominent + / - stepper buttons)
  2. Unit Price / Amount (numeric input with `inputmode="decimal"`)
  3. Row Total (`Quantity * Amount`, computed automatically)
  4. Description / Item Name (text input)
- **Soft-Delete Mechanism (Swipe / Delete Tap):** Swiping a row left or tapping the row delete action must set `quantity = 0` instead of removing the row array item. This keeps the item line intact so the user can easily re-increment it without re-typing.
- **Cashier Flag / Discount Star:** Swipe right or tap a Star icon on any row to toggle an "Attention Needed at Checkout" visual highlight.

## 4. On-the-Fly Unit & Promo Comparison Engine
Include a slide-up drawer or modal comparison tool (Option A vs. Option B) capable of calculating true value and adding the winning item directly into the current active cart.

- **Scenario 1: Bulk vs. Single Pack Comparison**
  - Compare pack costs against single items (e.g., 6-pack at 2000 CRC / 960g total vs. 1 single can at 310 CRC).
- **Scenario 2: Cross-Unit Weight/Volume Normalization**
  - Convert mixed unit measurements (e.g., a 2kg bag at 1800 CRC vs. an 800g bag at 950 CRC).
  - Compute target target quantities required to match (e.g., "You need 2.5 bags of 800g to equal 2kg, costing 2375 CRC, which is X% more expensive").
- **Supported Base Units:** Units, Grams (g), Kilograms (kg), Milliliters (ml), Liters (l), Gallons.
- **Winner Action:** Highlight the most economical option and provide an "Add Winner to Cart" button that automatically creates an entry row in the selected cart.

# UI/UX Guardrails
- **Touch-First Guidelines:** Minimum touch target height of 48px across all buttons and input fields.
- **Keyboard Handling:** Prevent mobile soft-keyboards from obscuring bottom navigation, pinned totals, or drawer action buttons.