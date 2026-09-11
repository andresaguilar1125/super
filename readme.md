# Smart Grocery & Cart Compare (CRC Mobile PWA)

A high-performance, single-page Progressive Web Application (PWA) optimized for single-handed use on mobile browsers during grocery shopping trips in Costa Rica (CRC / ₡).

---

## 📋 Role & Objective
An expert mobile UI/UX web application designed for fast, frictionless shopping. Features zero-backend local persistence, a touch-first layout, a dynamic unit/deal comparison engine, and full offline functionality.

---

## 🛠️ Technology Stack
* **Framework:** React + Vite
* **Styling:** Tailwind CSS (Mobile-first layout)
* **Touch/Swipe Mechanics:** Framer Motion / Native Touch Events
* **PWA & Offline Support:** Web Manifest + Service Worker
* **Persistence:** Browser `localStorage` (Zero-backend required)

---

## 🚀 Core Features & Architectural Specifications

### 1. Local Persistence (Zero-Backend)
* Automatically persists all active shopping lists, custom cart structures, and unit comparison states in `localStorage`.
* Prevents data loss during accidental tab closes, browser page reloads, or cellular connectivity drops.
* **Reset All:** Features a top-level confirmation dialog to clear all active carts cleanly when starting a new trip.

### 2. Multi-Cart Architecture (1 or 2 Carts)
* **Single-Cart Default:** Defaults to 1 active cart ("Main Grocery") for maximum simplicity, with an option to toggle a 2nd Cart ("Office/Work").
* **Fast Navigation:** Top-level tabs allow quick switching and horizontal swipe navigation between active carts.
* **Summary Row:** Displays item count and active cart totals pinned at the bottom action bar.

### 3. Cart Row Design & Touch Gesture Rules
* **Compact Layout:** Optimized row heights with clean placeholder input fields to save screen space.
* **Columns Layout:**
  1. **Quantity:** Numeric input (stepper control locked between **1** and **25**).
  2. **Unit Price (₡):** Numeric input (`inputmode="decimal"`) clamped between **10 ₡** and **25,000 ₡**. Direct typing allows complete backspacing/wipe without intrusive auto-formatting before blur.
  3. **Row Total:** Automatically computed (`Quantity × Amount`).
  4. **Description / Item Name:** Starts blank with an `"Item name..."` placeholder for typing without text deletion.
* **Direct Hard-Delete:** Swiping left or tapping the delete action immediately removes the item row.
* **Cashier Flag / Discount Star:** Tap the Star icon or swipe right on any row to toggle an "Attention Needed at Checkout" visual highlight.
* **Flagged Quick Filter:** Top-header button to filter only flagged/starred items instantly.

### 4. On-the-Fly Unit & Promo Comparison Engine
Slide-up modal tool (Option A vs. Option B) for calculating true cost-per-unit value and automatically pushing the winning item into the active cart.

* **Layout Consistency:** Uses identical column ordering as the main cart (Qty/Size, Price, Base Unit).
* **Price & Quantity Rules:** Shares the same validation constraints (**1 to 25** quantity, **10 ₡ to 25,000 ₡** price).
* **Scenario 1 — Bulk vs. Single Pack:** Compare total pack costs against single items (e.g., 6-pack vs. single unit).
* **Scenario 2 — Cross-Unit Weight/Volume Normalization:** Converts mixed measurements (e.g., 2kg bag at ₡1,800 vs. 800g bag at ₡950) to reveal true relative savings.
* **Supported Units:** Units, Grams (g), Kilograms (kg), Milliliters (ml), Liters (l), Gallons.
* **Winner Action:** Highlights the economical choice with an **"Add Winner to Cart"** action.

---

## 📱 UI/UX & Mobile Guardrails
* **Touch-First Guidelines:** Minimum touch target height of 48px across all stepper buttons, stars, and controls.
* **Compact Bottom Bar:** Slim sticky bottom action bar containing "+ Add New Item Row", "Compare Deals", and Cart Totals.
* **Keyboard Handling:** Avoids viewport shifts or obscured inputs when the mobile soft keyboard appears.