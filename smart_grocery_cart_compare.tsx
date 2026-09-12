import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, 
  Plus, 
  Minus, 
  Trash2, 
  RotateCcw, 
  Scale, 
  Star, 
  X, 
  AlertTriangle, 
  Download, 
  Sun, 
  Moon 
} from 'lucide-react';

const CURRENCY_SYMBOL = '₡';

const UNIT_TYPES = {
  UNITS: { label: 'Units', base: 'unit', factor: 1 },
  PACK: { label: 'Pack', base: 'pack', factor: 1, isPack: true },
  G: { label: 'Grams (g)', base: 'g', factor: 1 },
  KG: { label: 'Kilograms (kg)', base: 'g', factor: 1000 },
  ML: { label: 'Milliliters (ml)', base: 'ml', factor: 1 },
  L: { label: 'Liters (l)', base: 'ml', factor: 1000 },
  GAL: { label: 'Gallons (gal)', base: 'ml', factor: 3785.41 },
};

const INITIAL_ITEMS = [];

export default function App() {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_single_cart_v6');
      if (saved) return JSON.parse(saved);
      const v5 = localStorage.getItem('smart_grocery_carts_v5');
      if (v5) {
        const parsed = JSON.parse(v5);
        if (Array.isArray(parsed) && parsed[0]?.items) {
          return parsed[0].items;
        }
      }
      return INITIAL_ITEMS;
    } catch (e) {
      return INITIAL_ITEMS;
    }
  });

  // UI state
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_theme_v5');
      return saved === 'light' ? 'light' : 'dark';
    } catch (e) {
      return 'dark';
    }
  });
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);
  const [rowError, setRowError] = useState(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [actionSheetItem, setActionSheetItem] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);

  const EMPTY_COMP_A = { name: '', price: '', qty: '', unit: 'UNITS', packCount: '1' };
  const EMPTY_COMP_B = { name: '', price: '', qty: '', unit: 'UNITS', packCount: '1' };

  // Unit comparison engine state: empty by default
  const [compA, setCompA] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_comp_a_v5');
      return saved ? JSON.parse(saved) : EMPTY_COMP_A;
    } catch (e) {
      return EMPTY_COMP_A;
    }
  });
  const [compB, setCompB] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_comp_b_v5');
      return saved ? JSON.parse(saved) : EMPTY_COMP_B;
    } catch (e) {
      return EMPTY_COMP_B;
    }
  });

  const handleClearCompare = () => {
    setCompA({ name: '', price: '', qty: '', unit: 'UNITS', packCount: '1' });
    setCompB({ name: '', price: '', qty: '', unit: 'UNITS', packCount: '1' });
  };

  // Touch gesture & long-press ref tracking
  const touchStartPos = useRef({ x: 0, y: 0 });
  const [swipingItemId, setSwipingItemId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const longPressTimer = useRef(null);
  const isLongPressTriggered = useRef(false);

  useEffect(() => {
    try {
      localStorage.setItem('smart_grocery_single_cart_v6', JSON.stringify(items));
      localStorage.setItem('smart_grocery_comp_a_v5', JSON.stringify(compA));
      localStorage.setItem('smart_grocery_comp_b_v5', JSON.stringify(compB));
      localStorage.setItem('smart_grocery_theme_v5', theme);
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [items, compA, compB, theme]);

  // Handle PWA installation
  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(Boolean(isRunningStandalone));

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowIosInstallModal(true);
    }
  };

  const activeSymbol = CURRENCY_SYMBOL;

  // Running cumulative balance calculated from top to bottom
  const itemsWithBalance = useMemo(() => {
    let running = 0;
    return items.map((item) => {
      const q = parseInt(item.qty, 10) || 0;
      const p = parseFloat(item.price) || 0;
      const subtotal = q * p;
      running += subtotal;
      return {
        ...item,
        subtotal,
        cumulativeBalance: running
      };
    });
  }, [items]);

  const cartTotals = useMemo(() => {
    const subtotal = items.reduce((acc, item) => {
      const q = Number(item.qty) || 0;
      const p = Number(item.price) || 0;
      return acc + (q * p);
    }, 0);

    const totalFlaggedCount = items.filter(i => i.flagged).length;
    const activeItemCount = items.filter(i => (parseInt(i.qty, 10) || 0) > 0).length;

    return {
      subtotal,
      activeItemCount,
      totalFlaggedCount
    };
  }, [items]);

  const isItemValid = (item) => {
    const q = parseInt(item.qty, 10);
    const p = parseFloat(item.price);
    return !isNaN(q) && q > 0 && !isNaN(p) && p >= 10;
  };

  const hasIncompleteItems = useMemo(() => {
    return items.some(item => !isItemValid(item));
  }, [items]);

  const handleAddItem = (name = '', price = '') => {
    if (items.length > 0) {
      const incompleteIndex = items.findIndex(item => !isItemValid(item));
      if (incompleteIndex !== -1) {
        setRowError('Please enter a valid Quantity (1-10) and Price (min ₡10) for existing rows before adding a new one.');
        setTimeout(() => setRowError(null), 3500);
        return;
      }
    }
    setRowError(null);

    const newItem = {
      id: Date.now().toString(),
      name: name,
      qty: 1,
      price: price !== '' ? price : '',
      flagged: false
    };

    setItems(prev => [...prev, newItem]);
  };

  const handleUpdateItem = (itemId, field, value) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handlePriceChange = (itemId, val) => {
    if (val === '') {
      handleUpdateItem(itemId, 'price', '');
      return;
    }
    let num = parseInt(val, 10);
    if (isNaN(num)) return;
    if (num > 25000) num = 25000;
    handleUpdateItem(itemId, 'price', num);
  };

  const handleBlurPrice = (itemId, rawPrice) => {
    if (rawPrice === '' || rawPrice === null || rawPrice === undefined) {
      handleUpdateItem(itemId, 'price', 10);
      return;
    }
    let numeric = parseInt(rawPrice, 10);
    if (isNaN(numeric) || numeric < 10) {
      numeric = 10;
    } else if (numeric > 25000) {
      numeric = 25000;
    }
    handleUpdateItem(itemId, 'price', numeric);
  };

  const handleQtyChange = (itemId, val) => {
    if (val === '') {
      handleUpdateItem(itemId, 'qty', '');
      return;
    }
    let num = parseInt(val, 10);
    if (isNaN(num)) return;
    if (num < 1) num = 1;
    if (num > 10) num = 10;
    handleUpdateItem(itemId, 'qty', num);
  };

  const handleBlurQty = (itemId, rawQty) => {
    if (rawQty === '' || rawQty === null || rawQty === undefined) {
      handleUpdateItem(itemId, 'qty', 1);
      return;
    }
    let numeric = parseInt(rawQty, 10);
    if (isNaN(numeric) || numeric < 1) {
      numeric = 1;
    } else if (numeric > 10) {
      numeric = 10;
    }
    handleUpdateItem(itemId, 'qty', numeric);
  };

  const handleHardDelete = (itemId) => {
    setItems(prev => prev.filter(item => item.id !== itemId));
  };

  const handleToggleFlag = (itemId) => {
    setItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, flagged: !item.flagged };
      }
      return item;
    }));
  };

  const handleClearAll = () => {
    setItems([]);
    setIsClearModalOpen(false);
  };

  // Touch & Long-press handlers
  const handleTouchStart = (e, item) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    setSwipingItemId(item.id);
    isLongPressTriggered.current = false;

    // Start 500ms long-press timer
    longPressTimer.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setSwipeOffset(0);
      setSwipingItemId(null);
      setActionSheetItem(item);
    }, 500);
  };

  const handleTouchMove = (e, itemId) => {
    const deltaX = e.touches[0].clientX - touchStartPos.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

    // Cancel long-press if movement exceeds 10px
    if (Math.abs(deltaX) > 10 || deltaY > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    if (isLongPressTriggered.current) return;
    if (swipingItemId !== itemId) return;

    if (Math.abs(deltaX) > deltaY && deltaY < 40) {
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = (item) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (isLongPressTriggered.current) {
      setSwipingItemId(null);
      setSwipeOffset(0);
      return;
    }

    if (swipingItemId === item.id) {
      if (swipeOffset < -80) {
        setDeleteConfirmItem(item);
      } else if (swipeOffset > 80) {
        handleToggleFlag(item.id);
      }
    }
    setSwipingItemId(null);
    setSwipeOffset(0);
  };

  const comparisonResults = useMemo(() => {
    const pA = Math.max(0, parseFloat(compA.price) || 0);
    const qA = compA.unit === 'PACK' ? 1 : (parseFloat(compA.qty) || 1);
    const packA = parseFloat(compA.packCount) || 1;
    const typeA = UNIT_TYPES[compA.unit] || UNIT_TYPES.UNITS;

    const pB = Math.max(0, parseFloat(compB.price) || 0);
    const qB = compB.unit === 'PACK' ? 1 : (parseFloat(compB.qty) || 1);
    const packB = parseFloat(compB.packCount) || 1;
    const typeB = UNIT_TYPES[compB.unit] || UNIT_TYPES.UNITS;

    const compatible = typeA.base === typeB.base || 
      (compA.unit === 'PACK' && compB.unit === 'UNITS') ||
      (compA.unit === 'UNITS' && compB.unit === 'PACK');

    const totalBaseA = qA * packA * typeA.factor;
    const totalBaseB = qB * packB * typeB.factor;

    const unitPriceA = totalBaseA > 0 ? pA / totalBaseA : 0;
    const unitPriceB = totalBaseB > 0 ? pB / totalBaseB : 0;

    let winner = null;
    let percentDiff = 0;
    let savingsAmount = 0;
    let normalizationText = null;

    if (pA > 0 && pB > 0 && totalBaseA > 0 && totalBaseB > 0 && compatible) {
      const ratioBtoA = totalBaseA / totalBaseB;
      const costBToMatchA = Math.round(pB * ratioBtoA);

      if (unitPriceA < unitPriceB) {
        winner = 'A';
        percentDiff = Math.round(((unitPriceB - unitPriceA) / unitPriceB) * 100);
        savingsAmount = Math.max(0, costBToMatchA - pA);
      } else if (unitPriceB < unitPriceA) {
        winner = 'B';
        percentDiff = Math.round(((unitPriceA - unitPriceB) / unitPriceA) * 100);
        savingsAmount = Math.max(0, pA - costBToMatchA);
      } else {
        winner = 'TIED';
      }

      const ratioFormatted = Number(ratioBtoA.toFixed(2));
      const unitLabelB = compB.unit;
      const unitLabelA = compA.unit;

      normalizationText = `You need ${ratioFormatted}× Option B (${compB.qty}${unitLabelB}) to match Option A (${compA.qty}${unitLabelA}), costing ${CURRENCY_SYMBOL}${costBToMatchA.toLocaleString()}.`;
    }

    return {
      unitPriceA,
      unitPriceB,
      compatible,
      winner,
      percentDiff,
      savingsAmount,
      normalizationText
    };
  }, [compA, compB]);

  const handleAddWinnerToCart = () => {
    if (!comparisonResults.winner || comparisonResults.winner === 'TIED') return;
    const winnerObj = comparisonResults.winner === 'A' ? compA : compB;
    const name = `${winnerObj.name || 'Deal Winner'} (${winnerObj.qty}${winnerObj.unit})`;
    const price = Math.max(10, Math.min(25000, parseFloat(winnerObj.price) || 10));
    
    handleAddItem(name, price);
    setIsCompareOpen(false);
  };

  const visibleItems = useMemo(() => {
    if (filterFlagged) {
      return itemsWithBalance.filter(i => i.flagged);
    }
    return itemsWithBalance;
  }, [itemsWithBalance, filterFlagged]);

  return (
    <div className={`min-h-screen flex flex-col font-sans select-none pb-28 transition-colors duration-200 ${
      theme === 'light' ? 'bg-slate-100 text-slate-800' : 'bg-slate-900 text-slate-100'
    }`}>
      {/* div1: TOP BAR (Grid with Logo, Title, and 4 evenly distributed action icons) */}
      <header className={`sticky top-0 z-30 backdrop-blur-md border-b shadow-sm transition-colors ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200 shadow-slate-200/50'
          : 'bg-slate-800/95 border-slate-700/60 shadow-lg'
      }`}>
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          {/* div5 & div9: Brand (Logo + App Title) */}
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-xl border border-emerald-500/30 shrink-0">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <h1 className={`font-bold text-sm leading-tight tracking-tight truncate ${
              theme === 'light' ? 'text-slate-900' : 'text-white'
            }`}>
              Smart Grocery
            </h1>
          </div>

          {/* 4 evenly spaced & centered action buttons: [Filter Star] [Download] [Theme] [Reset] */}
          <div className="grid grid-cols-4 items-center gap-1 shrink-0">
            {/* Action 1: Filter Flagged Items (Star) */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => setFilterFlagged(!filterFlagged)}
                className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition ${
                  filterFlagged
                    ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50 font-bold'
                    : theme === 'light'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-700'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
                title={filterFlagged ? "Showing Starred Items" : "Filter Starred Items"}
              >
                <Star className={`w-4 h-4 ${filterFlagged || cartTotals.totalFlaggedCount > 0 ? 'fill-emerald-400 text-emerald-400' : ''}`} />
              </button>
            </div>

            {/* Action 2: Download / Install App */}
            <div className="flex items-center justify-center">
              <button
                onClick={handleInstallClick}
                className={`p-1.5 rounded-lg border text-xs flex items-center justify-center transition ${
                  isStandalone
                    ? 'opacity-40 cursor-default bg-transparent border-transparent text-slate-400'
                    : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                }`}
                title="Install App as PWA"
                disabled={isStandalone}
              >
                <Download className="w-4 h-4" />
              </button>
            </div>

            {/* Action 3: Theme Toggle */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className={`p-1.5 rounded-lg border text-xs transition flex items-center justify-center ${
                  theme === 'light'
                    ? 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4 text-slate-700" />}
              </button>
            </div>

            {/* Action 4: Reset Shopping Trip */}
            <div className="flex items-center justify-center">
              <button
                onClick={() => setIsClearModalOpen(true)}
                className={`p-1.5 rounded-lg border text-xs transition flex items-center justify-center ${
                  theme === 'light'
                    ? 'bg-slate-100 text-slate-400 border-slate-200 hover:text-rose-500 active:bg-rose-50'
                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-rose-400 active:bg-rose-500/10'
                }`}
                title="Clear Shopping Trip"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* div2: ITEMS SECTION */}
      <main className="max-w-md mx-auto w-full px-4 pt-3 flex-1">
        {/* Row Validation Warning */}
        {rowError && (
          <div className="mb-3 p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl flex items-center gap-2 text-rose-700 dark:text-rose-200 text-xs shadow-md animate-fadeIn">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
            <span className="flex-1 font-medium">{rowError}</span>
            <button
              onClick={() => setRowError(null)}
              className="p-1 text-rose-500 hover:opacity-75 rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Item List */}
        {visibleItems.length === 0 ? (
          <div className={`py-12 text-center rounded-3xl border border-dashed transition-colors ${
            theme === 'light'
              ? 'bg-white border-slate-300 text-slate-500'
              : 'bg-slate-800/40 border-slate-800 text-slate-400'
          }`}>
            {filterFlagged ? (
              <>
                <Star className={`w-12 h-12 mx-auto mb-2 ${theme === 'light' ? 'text-emerald-300' : 'text-emerald-700'}`} />
                <p className="font-semibold text-sm">No Starred Items</p>
                <p className="text-xs mt-1.5 opacity-80 max-w-xs mx-auto px-4">
                  Long-press any item row or swipe right to star it and focus your shopping list
                </p>
              </>
            ) : (
              <>
                <ShoppingCart className={`w-12 h-12 mx-auto mb-2 ${theme === 'light' ? 'text-slate-300' : 'text-slate-600'}`} />
                <p className="font-medium">Cart is empty</p>
                <p className="text-xs mt-1 opacity-75">Tap "+ Add Item Row" below to get started</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleItems.map((item) => {
              const rawQty = parseInt(item.qty, 10);
              const numQty = isNaN(rawQty) ? 1 : Math.max(1, Math.min(10, rawQty));
              const numPrice = Math.max(0, parseFloat(item.price) || 0);

              return (
                <div
                  key={item.id}
                  onTouchStart={(e) => handleTouchStart(e, item)}
                  onTouchMove={(e) => handleTouchMove(e, item.id)}
                  onTouchEnd={() => handleTouchEnd(item)}
                  className="relative overflow-hidden rounded-xl touch-pan-y"
                >
                  {/* Swipe reveal background indicator */}
                  {swipingItemId === item.id && (
                    <div className="absolute inset-0 flex items-center justify-between px-4 rounded-xl pointer-events-none transition-colors">
                      {/* Swipe Right background -> Favorite / Flag */}
                      <div className={`flex items-center gap-1.5 font-bold text-xs ${swipeOffset > 40 ? 'text-emerald-500 opacity-100' : 'text-slate-400 opacity-40'}`}>
                        <Star className="w-5 h-5 text-emerald-400 fill-emerald-400" />
                        <span className="hidden sm:inline">Favorite</span>
                      </div>
                      {/* Swipe Left background -> Delete (with confirm) */}
                      <div className={`flex items-center gap-1.5 font-bold text-xs ${swipeOffset < -40 ? 'text-rose-500 opacity-100' : 'text-slate-400 opacity-40'}`}>
                        <span className="hidden sm:inline">Delete</span>
                        <Trash2 className="w-5 h-5 text-rose-500" />
                      </div>
                    </div>
                  )}

                  {/* div1: Item Row Container */}
                  <div
                    style={{
                      transform: swipingItemId === item.id ? `translateX(${swipeOffset}px)` : 'translateX(0px)',
                      transition: swipingItemId === item.id ? 'none' : 'transform 0.2s ease-out'
                    }}
                    className={`relative overflow-hidden rounded-xl border transition-all p-2.5 space-y-2 ${
                      item.flagged
                        ? theme === 'light'
                          ? 'bg-emerald-50/90 border-emerald-400 shadow-md shadow-emerald-100 ring-1 ring-emerald-400/50'
                          : 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                        : theme === 'light'
                        ? 'bg-white border-slate-200 shadow-sm'
                        : 'bg-slate-800 border-slate-700/80 shadow-sm'
                    }`}
                  >
                    {/* Item Name Input with clean uppercase styling */}
                    <div>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value.toUpperCase())}
                        placeholder="ITEM"
                        className={`w-full bg-transparent font-bold text-xs uppercase tracking-wide outline-none border-b border-transparent focus:border-emerald-500 transition py-0.5 ${
                          theme === 'light' ? 'text-slate-900 placeholder:text-slate-400' : 'text-slate-100 placeholder:text-slate-500'
                        }`}
                      />
                    </div>

                    {/* css-grid div2 items-section (6 cols layout: div2: 2 cols, div3: 2 cols, div4 & div5: 2 cols) */}
                    <div className={`grid grid-cols-6 items-center gap-2 pt-1.5 border-t ${
                      theme === 'light' ? 'border-slate-100' : 'border-slate-700/40'
                    }`}>
                      {/* div2: quantity item-section (Cols 1-2) */}
                      <div className={`col-span-2 h-9 flex items-center rounded-lg border p-0.5 ${
                        theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-700'
                      }`}>
                        <button
                          onClick={() => {
                            const currentQty = parseInt(item.qty, 10) || 1;
                            if (currentQty > 1) {
                              handleUpdateItem(item.id, 'qty', currentQty - 1);
                            }
                          }}
                          className={`w-7 h-full rounded font-bold flex items-center justify-center active:scale-90 transition disabled:opacity-30 shrink-0 ${
                            theme === 'light'
                              ? 'bg-white text-slate-700 hover:bg-slate-50 shadow-xs'
                              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                          }`}
                          disabled={(parseInt(item.qty, 10) || 1) <= 1}
                          title="Decrease Quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="1"
                          max="10"
                          value={item.qty ?? ''}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          onBlur={(e) => handleBlurQty(item.id, e.target.value)}
                          className={`flex-1 text-center bg-transparent font-bold text-xs outline-none ${
                            theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                          }`}
                        />
                        <button
                          onClick={() => {
                            const currentQty = parseInt(item.qty, 10) || 1;
                            if (currentQty < 10) {
                              handleUpdateItem(item.id, 'qty', currentQty + 1);
                            }
                          }}
                          className="w-7 h-full rounded bg-emerald-600 text-white font-bold flex items-center justify-center hover:bg-emerald-500 active:scale-90 transition disabled:opacity-40 shrink-0 shadow-xs"
                          disabled={(parseInt(item.qty, 10) || 1) >= 10}
                          title="Increase Quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* div3: price item-section (Cols 3-4) */}
                      <div className={`col-span-2 h-9 flex items-center justify-between gap-1 rounded-lg px-2 border transition-colors ${
                        item.price === '' || (parseFloat(item.price) || 0) < 10
                          ? 'border-emerald-500/70 bg-emerald-500/10'
                          : theme === 'light'
                          ? 'bg-slate-50 border-slate-200'
                          : 'bg-slate-900/60 border-slate-700/80'
                      }`}>
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <span className={`text-xs font-semibold select-none shrink-0 ${
                            theme === 'light' ? 'text-slate-500' : 'text-slate-400'
                          }`}>{activeSymbol}</span>
                          <input
                            type="number"
                            inputMode="numeric"
                            min="10"
                            max="25000"
                            maxLength={5}
                            value={item.price ?? ''}
                            onChange={(e) => handlePriceChange(item.id, e.target.value)}
                            onBlur={(e) => handleBlurPrice(item.id, e.target.value)}
                            placeholder="Unit Price *"
                            className={`w-full min-w-0 bg-transparent text-xs font-semibold outline-none placeholder:text-emerald-500/70 ${
                              theme === 'light' ? 'text-slate-900' : 'text-slate-100'
                            }`}
                          />
                        </div>
                        {/* Grey clear/delete price button */}
                        {item.price !== '' && (
                          <button
                            type="button"
                            onClick={() => handleUpdateItem(item.id, 'price', '')}
                            className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition active:scale-90 ${
                              theme === 'light'
                                ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-200/60'
                                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                            }`}
                            title="Clear price"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* div4 & div5: subtotal and balance stack (Cols 5-6) */}
                      <div className="col-span-2 flex flex-col justify-center items-end text-right">
                        {/* div4: subtotal item-section */}
                        <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                          {activeSymbol}{item.subtotal.toLocaleString()}
                        </span>
                        {/* div5: balance item-section (Running cumulative sum without "Bal: " label) */}
                        <span className={`text-[10px] font-mono leading-tight ${
                          theme === 'light' ? 'text-slate-400' : 'text-slate-400'
                        }`}>
                          {activeSymbol}{item.cumulativeBalance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* div3: TOTAL SECTION & div4: BOTTOM BAR (Sticky Footer Grid Layout) */}
      <footer className={`fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t shadow-2xl transition-colors ${
        theme === 'light'
          ? 'bg-white/95 border-slate-200'
          : 'bg-slate-850/95 border-slate-700/80'
      }`}>
        <div className="max-w-md mx-auto px-4 py-2.5 space-y-2">
          {/* div3: total-section (Row 3 in parent layout) */}
          <div className="grid grid-cols-6 items-center text-xs">
            {/* div10: items bottom-bar (Cols 1-3) */}
            <div className="col-span-3 flex items-center">
              <span className={`text-[11px] px-2 py-0.5 rounded-md font-mono ${
                theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
              }`}>
                {cartTotals.activeItemCount} {cartTotals.activeItemCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {/* div11: grand-total bottom-bar (Cols 4-6) */}
            <div className="col-span-3 flex items-center justify-end gap-1.5">
              <span className={`font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Total:
              </span>
              <span className={`font-bold text-base font-mono ${theme === 'light' ? 'text-emerald-700' : 'text-emerald-400'}`}>
                {activeSymbol}{cartTotals.subtotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* div4: bottom-bar (Row 4 in parent layout) */}
          <div className="grid grid-cols-6 gap-2">
            {/* div12: compare-button bottom-bar (Cols 1-3) */}
            <div className="col-span-3">
              <button
                onClick={() => setIsCompareOpen(true)}
                className={`w-full py-2 px-3 font-bold text-xs rounded-xl border flex items-center justify-center gap-1.5 min-h-[48px] touch-manipulation transition ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                    : 'bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 border-slate-700'
                }`}
              >
                <Scale className="w-4 h-4 text-emerald-500" />
                <span>Compare Deals</span>
              </button>
            </div>

            {/* div13: add-button bottom-bar (Cols 4-6) */}
            <div className="col-span-3">
              <button
                onClick={() => handleAddItem()}
                className={`w-full py-2 px-3 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 min-h-[48px] touch-manipulation transition ${
                  hasIncompleteItems
                    ? theme === 'light' ? 'bg-slate-300 text-slate-500' : 'bg-slate-700 text-slate-400'
                    : 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                }`}
                title={hasIncompleteItems ? 'Fill in Quantity and Price for existing items to add more' : 'Add New Item Row'}
              >
                <Plus className="w-4 h-4" />
                <span>Add Item Row</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Long-Press Action Sheet Modal */}
      {actionSheetItem && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex flex-col justify-end p-4 animate-fadeIn">
          <div className={`rounded-3xl border p-4 max-w-md mx-auto w-full space-y-2.5 shadow-2xl transition-colors ${
            theme === 'light' ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-800 border-slate-700 text-slate-100'
          }`}>
            <div className="text-center pb-1">
              <p className="text-xs font-semibold truncate">{actionSheetItem.name || 'Selected Item'}</p>
              <p className={`text-[11px] ${theme === 'light' ? 'text-slate-400' : 'text-slate-400'}`}>Choose action for this item</p>
            </div>

            {/* Toggle Flag / Favorite (Star) Button */}
            <button
              onClick={() => {
                handleToggleFlag(actionSheetItem.id);
                setActionSheetItem(null);
              }}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition ${
                actionSheetItem.flagged
                  ? 'bg-emerald-500/20 text-emerald-500 border-emerald-500/40'
                  : theme === 'light'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-slate-700 text-slate-200 border-slate-600'
              }`}
            >
              <Star className={`w-4 h-4 ${actionSheetItem.flagged ? 'fill-emerald-400 text-emerald-400' : ''}`} />
              <span>{actionSheetItem.flagged ? 'Remove Highlight / Flag' : 'Highlight / Flag Item'}</span>
            </button>

            {/* Delete Item Option */}
            <button
              onClick={() => {
                const target = actionSheetItem;
                setActionSheetItem(null);
                setDeleteConfirmItem(target);
              }}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 bg-rose-500/15 text-rose-500 border border-rose-500/30 hover:bg-rose-500/25 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Item Row</span>
            </button>

            {/* Cancel Button */}
            <button
              onClick={() => setActionSheetItem(null)}
              className={`w-full py-2 px-4 rounded-xl font-medium text-xs transition ${
                theme === 'light' ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-700/50'
              }`}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Comparison Drawer Modal */}
      {isCompareOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-fadeIn">
          <div className={`rounded-t-3xl border-t p-4 max-w-md mx-auto w-full max-h-[90vh] overflow-y-auto shadow-2xl transition-colors ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-slate-800 border-slate-700 text-slate-100'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b mb-3 ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700'
            }`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/20 text-indigo-500 rounded-xl">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h2 className={`font-bold text-sm ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Unit & Promo Compare</h2>
                  <p className={`text-[11px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Compare 2 options & add winner</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Reset / Clear Compare Button */}
                <button
                  onClick={handleClearCompare}
                  className={`p-1.5 rounded-full transition ${
                    theme === 'light'
                      ? 'text-slate-400 hover:text-rose-600 bg-slate-100'
                      : 'text-slate-400 hover:text-rose-400 bg-slate-700/50'
                  }`}
                  title="Clear comparison fields"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsCompareOpen(false)}
                  className={`p-1.5 rounded-full ${
                    theme === 'light'
                      ? 'text-slate-400 hover:text-slate-800 bg-slate-100'
                      : 'text-slate-400 hover:text-white bg-slate-700/50'
                  }`}
                  title="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Option A Card */}
            <div className={`p-3 rounded-2xl border transition-all mb-3 space-y-2 ${
              comparisonResults.winner === 'A'
                ? theme === 'light'
                  ? 'bg-emerald-50/90 border-emerald-400 shadow-md shadow-emerald-100 ring-1 ring-emerald-400/50'
                  : 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                : theme === 'light'
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-850 border-slate-700'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Option A</span>
                {comparisonResults.winner === 'A' && (
                  <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-emerald-400 text-emerald-400" /> Best Value!
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Product A (e.g. 6-Pack)"
                value={compA.name}
                onChange={(e) => setCompA({ ...compA, name: e.target.value.toUpperCase() })}
                className={`w-full text-xs uppercase font-semibold rounded-xl px-2.5 py-1.5 border outline-none focus:border-emerald-500 transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400'
                    : 'bg-slate-900 text-slate-100 border-slate-700'
                }`}
              />
              {/* Swapped Order: Qty / Size -> Price -> Unit */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="25"
                    placeholder="Qty"
                    value={compA.unit === 'PACK' ? '1' : compA.qty}
                    disabled={compA.unit === 'PACK'}
                    onChange={(e) => {
                      if (compA.unit === 'PACK') return;
                      let val = e.target.value;
                      if (val !== '') {
                        let num = parseInt(val, 10);
                        if (!isNaN(num) && num > 25) val = '25';
                      }
                      setCompA({ ...compA, qty: val });
                    }}
                    onBlur={(e) => {
                      if (compA.unit === 'PACK') return;
                      if (e.target.value === '') return;
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 1) num = 1;
                      if (num > 25) num = 25;
                      setCompA({ ...compA, qty: num.toString() });
                    }}
                    className={`w-full text-xs font-bold rounded-xl px-2 py-2 border outline-none transition-colors ${
                      compA.unit === 'PACK'
                        ? theme === 'light' ? 'bg-slate-200 text-slate-400 border-slate-300' : 'bg-slate-800 text-slate-400 border-slate-700'
                        : theme === 'light' ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-700'
                    }`}
                  />
                </div>
                <div className={`flex items-center rounded-xl px-2 border focus-within:border-indigo-500 ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
                }`}>
                  <span className={`text-xs font-semibold select-none mr-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{activeSymbol}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="25000"
                    placeholder="Unit Price"
                    value={compA.price}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val !== '') {
                        let num = parseInt(val, 10);
                        if (!isNaN(num) && num > 25000) val = '25000';
                      }
                      setCompA({ ...compA, price: val });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') return;
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 10) num = 10;
                      if (num > 25000) num = 25000;
                      setCompA({ ...compA, price: num.toString() });
                    }}
                    className={`w-full bg-transparent text-xs font-bold py-2 outline-none ${
                      theme === 'light' ? 'text-slate-900 placeholder:text-slate-400' : 'text-slate-100'
                    }`}
                  />
                </div>
                <div>
                  <select
                    value={compA.unit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setCompA({
                        ...compA,
                        unit: newUnit,
                        qty: newUnit === 'PACK' ? '1' : compA.qty
                      });
                    }}
                    className={`w-full text-xs font-semibold rounded-xl px-1.5 py-2 border outline-none h-full transition-colors ${
                      theme === 'light'
                        ? 'bg-white text-indigo-600 border-slate-200'
                        : 'bg-slate-900 text-indigo-300 border-slate-700'
                    }`}
                  >
                    {Object.keys(UNIT_TYPES).map(u => (
                      <option key={u} value={u}>{UNIT_TYPES[u].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Option B Card */}
            <div className={`p-3 rounded-2xl border transition-all mb-3 space-y-2 ${
              comparisonResults.winner === 'B'
                ? theme === 'light'
                  ? 'bg-emerald-50/90 border-emerald-400 shadow-md shadow-emerald-100 ring-1 ring-emerald-400/50'
                  : 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                : theme === 'light'
                ? 'bg-slate-50 border-slate-200'
                : 'bg-slate-850 border-slate-700'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-500 uppercase tracking-wider">Option B</span>
                {comparisonResults.winner === 'B' && (
                  <span className="bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-emerald-400 text-emerald-400" /> Best Value!
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Product B (e.g. Single Can)"
                value={compB.name}
                onChange={(e) => setCompB({ ...compB, name: e.target.value.toUpperCase() })}
                className={`w-full text-xs uppercase font-semibold rounded-xl px-2.5 py-1.5 border outline-none focus:border-sky-500 transition-colors ${
                  theme === 'light'
                    ? 'bg-white text-slate-900 border-slate-200 placeholder:text-slate-400'
                    : 'bg-slate-900 text-slate-100 border-slate-700'
                }`}
              />
              {/* Swapped Order: Qty / Size -> Price -> Unit */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="25"
                    placeholder="Qty"
                    value={compB.unit === 'PACK' ? '1' : compB.qty}
                    disabled={compB.unit === 'PACK'}
                    onChange={(e) => {
                      if (compB.unit === 'PACK') return;
                      let val = e.target.value;
                      if (val !== '') {
                        let num = parseInt(val, 10);
                        if (!isNaN(num) && num > 25) val = '25';
                      }
                      setCompB({ ...compB, qty: val });
                    }}
                    onBlur={(e) => {
                      if (compB.unit === 'PACK') return;
                      if (e.target.value === '') return;
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 1) num = 1;
                      if (num > 25) num = 25;
                      setCompB({ ...compB, qty: num.toString() });
                    }}
                    className={`w-full text-xs font-bold rounded-xl px-2 py-2 border outline-none transition-colors ${
                      compB.unit === 'PACK'
                        ? theme === 'light' ? 'bg-slate-200 text-slate-400 border-slate-300' : 'bg-slate-800 text-slate-400 border-slate-700'
                        : theme === 'light' ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-900 text-slate-100 border-slate-700'
                    }`}
                  />
                </div>
                <div className={`flex items-center rounded-xl px-2 border focus-within:border-sky-500 ${
                  theme === 'light' ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
                }`}>
                  <span className={`text-xs font-semibold select-none mr-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{activeSymbol}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="25000"
                    placeholder="Unit Price"
                    value={compB.price}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val !== '') {
                        let num = parseInt(val, 10);
                        if (!isNaN(num) && num > 25000) val = '25000';
                      }
                      setCompB({ ...compB, price: val });
                    }}
                    onBlur={(e) => {
                      if (e.target.value === '') return;
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 10) num = 10;
                      if (num > 25000) num = 25000;
                      setCompB({ ...compB, price: num.toString() });
                    }}
                    className={`w-full bg-transparent text-xs font-bold py-2 outline-none ${
                      theme === 'light' ? 'text-slate-900 placeholder:text-slate-400' : 'text-slate-100'
                    }`}
                  />
                </div>
                <div>
                  <select
                    value={compB.unit}
                    onChange={(e) => {
                      const newUnit = e.target.value;
                      setCompB({
                        ...compB,
                        unit: newUnit,
                        qty: newUnit === 'PACK' ? '1' : compB.qty
                      });
                    }}
                    className={`w-full text-xs font-semibold rounded-xl px-1.5 py-2 border outline-none h-full transition-colors ${
                      theme === 'light'
                        ? 'bg-white text-sky-600 border-slate-200'
                        : 'bg-slate-900 text-sky-300 border-slate-700'
                    }`}
                  >
                    {Object.keys(UNIT_TYPES).map(u => (
                      <option key={u} value={u}>{UNIT_TYPES[u].label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Comparison Result Summary */}
            {comparisonResults.winner ? (
              <div className={`p-3 rounded-2xl border mb-3 space-y-2 shadow-md ${
                theme === 'light'
                  ? 'bg-emerald-50/90 border-emerald-300'
                  : 'bg-emerald-950/40 border-emerald-500/50 shadow-emerald-950/20'
              }`}>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-emerald-600 dark:text-emerald-300 text-xs flex items-center gap-1.5">
                    <Star className="w-4 h-4 fill-emerald-400 text-emerald-400 shrink-0" />
                    {comparisonResults.winner === 'TIED'
                      ? 'Both Options Offer Equal Value!'
                      : `Option ${comparisonResults.winner} is ${comparisonResults.percentDiff}% Cheaper!`}
                  </span>
                  {comparisonResults.winner !== 'TIED' && comparisonResults.savingsAmount > 0 && (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 pl-5.5">
                      {CURRENCY_SYMBOL}{comparisonResults.savingsAmount.toLocaleString()} savings relative to comparative size
                    </span>
                  )}
                </div>
                {comparisonResults.normalizationText && (
                  <p className={`text-[11px] leading-snug p-2 rounded-xl border ${
                    theme === 'light'
                      ? 'bg-white/80 text-slate-700 border-slate-200'
                      : 'bg-slate-900/60 text-slate-300 border-slate-800'
                  }`}>
                    {comparisonResults.normalizationText}
                  </p>
                )}
                {comparisonResults.winner !== 'TIED' && (
                  <button
                    onClick={handleAddWinnerToCart}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Winner (Option {comparisonResults.winner}) to Cart</span>
                  </button>
                )}
              </div>
            ) : !comparisonResults.compatible ? (
              <div className="p-2.5 bg-rose-500/10 rounded-xl text-center text-[11px] text-rose-600 dark:text-rose-300 border border-rose-500/30 mb-3">
                Cannot compare incompatible unit types (e.g. Weight vs Volume vs Units).
              </div>
            ) : (
              <div className={`p-2.5 rounded-xl text-center text-[11px] border mb-3 ${
                theme === 'light'
                  ? 'bg-slate-50 text-slate-500 border-slate-200'
                  : 'bg-slate-900/80 text-slate-400 border-slate-800'
              }`}>
                Enter valid prices and quantities to analyze true unit cost.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Item Confirmation Dialog */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`rounded-3xl border p-5 max-w-xs w-full text-center space-y-4 shadow-2xl ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-slate-800 border-slate-700 text-white'
          }`}>
            <div className="w-12 h-12 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Delete Item?</h3>
              <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Are you sure you want to remove <span className={`font-semibold ${theme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>"{deleteConfirmItem.name || 'this item'}"</span> from your cart?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmItem(null)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleHardDelete(deleteConfirmItem.id);
                  setDeleteConfirmItem(null);
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS / Safari Manual PWA Install Guide Modal */}
      {showIosInstallModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className={`rounded-3xl border p-5 max-w-xs w-full space-y-4 shadow-2xl text-left ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-slate-800 border-slate-700 text-slate-100'
          }`}>
            <div className={`flex items-center justify-between pb-2 border-b ${
              theme === 'light' ? 'border-slate-200' : 'border-slate-700'
            }`}>
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-500 rounded-xl">
                  <Download className="w-4 h-4" />
                </div>
                <h3 className={`font-bold text-sm ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Install App (PWA)</h3>
              </div>
              <button
                onClick={() => setShowIosInstallModal(false)}
                className="p-1 text-slate-400 hover:opacity-75 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className={`text-xs space-y-2.5 ${theme === 'light' ? 'text-slate-600' : 'text-slate-300'}`}>
              <p>To install on your mobile device home screen:</p>
              <ol className={`list-decimal list-inside space-y-1.5 text-[11px] ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                <li>Tap the browser <strong>Share</strong> button (or three dots menu <span className="font-bold">⋮</span>).</li>
                <li>Scroll down and select <strong>"Add to Home Screen"</strong>.</li>
                <li>Tap <strong>Add</strong> to launch in standalone fullscreen mode anytime!</li>
              </ol>
            </div>
            <button
              onClick={() => setShowIosInstallModal(false)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl"
            >
              Got it!
            </button>
          </div>
        </div>
      )}

      {/* Clear Trip Confirmation Dialog */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`rounded-3xl border p-5 max-w-xs w-full text-center space-y-4 shadow-2xl ${
            theme === 'light'
              ? 'bg-white border-slate-200 text-slate-900'
              : 'bg-slate-800 border-slate-700 text-white'
          }`}>
            <div className="w-12 h-12 bg-rose-500/20 text-rose-500 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`font-bold text-base ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Reset Shopping Trip?</h3>
              <p className={`text-xs mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                Are you sure you want to reset your shopping list? This will clear all items.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl transition ${
                  theme === 'light'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
