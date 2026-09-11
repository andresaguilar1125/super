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
  CheckCircle2
} from 'lucide-react';

const CURRENCY_SYMBOL = '₡';

const UNIT_TYPES = {
  UNITS: { label: 'Units/Packs', base: 'unit', factor: 1 },
  G: { label: 'Grams (g)', base: 'g', factor: 1 },
  KG: { label: 'Kilograms (kg)', base: 'g', factor: 1000 },
  ML: { label: 'Milliliters (ml)', base: 'ml', factor: 1 },
  L: { label: 'Liters (l)', base: 'ml', factor: 1000 },
  GAL: { label: 'Gallons (gal)', base: 'ml', factor: 3785.41 },
};

const INITIAL_CARTS = [
  {
    id: 'cart-1',
    name: 'Main Grocery',
    color: 'emerald',
    items: [
      { id: '1', name: 'Fresh Milk 2L', qty: 1, price: 1450, flagged: false },
      { id: '2', name: 'Whole Wheat Bread', qty: 2, price: 1200, flagged: true },
      { id: '3', name: 'Organic Eggs 12pk', qty: 1, price: 2100, flagged: false }
    ]
  },
  {
    id: 'cart-2',
    name: 'Office Supplies',
    color: 'sky',
    items: [
      { id: '101', name: 'Espresso Pods 30pk', qty: 1, price: 8500, flagged: true },
      { id: '102', name: 'Paper Towels 6pk', qty: 2, price: 2900, flagged: false }
    ]
  }
];

export default function App() {
  const [carts, setCarts] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_carts_v5');
      return saved ? JSON.parse(saved) : INITIAL_CARTS;
    } catch (e) {
      return INITIAL_CARTS;
    }
  });

  const [activeCartId, setActiveCartId] = useState('cart-1');
  const [hasSecondCart, setHasSecondCart] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_has_second_cart_v5');
      return saved !== null ? JSON.parse(saved) : false; // Default to single cart
    } catch (e) {
      return false;
    }
  });

  // UI state
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [filterFlagged, setFilterFlagged] = useState(false);

  // Unit comparison engine state
  const [compA, setCompA] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_comp_a_v5');
      return saved ? JSON.parse(saved) : { name: 'Bulk Pack', price: '2000', qty: '1', unit: 'G', packCount: '1' };
    } catch (e) {
      return { name: 'Bulk Pack', price: '2000', qty: '1', unit: 'G', packCount: '1' };
    }
  });
  const [compB, setCompB] = useState(() => {
    try {
      const saved = localStorage.getItem('smart_grocery_comp_b_v5');
      return saved ? JSON.parse(saved) : { name: 'Single Unit', price: '310', qty: '1', unit: 'UNITS', packCount: '1' };
    } catch (e) {
      return { name: 'Single Unit', price: '310', qty: '1', unit: 'UNITS', packCount: '1' };
    }
  });

  // Touch gesture ref tracking
  const touchStartPos = useRef({ x: 0, y: 0 });
  const [swipingItemId, setSwipingItemId] = useState(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  useEffect(() => {
    try {
      localStorage.setItem('smart_grocery_carts_v5', JSON.stringify(carts));
      localStorage.setItem('smart_grocery_has_second_cart_v5', JSON.stringify(hasSecondCart));
      localStorage.setItem('smart_grocery_comp_a_v5', JSON.stringify(compA));
      localStorage.setItem('smart_grocery_comp_b_v5', JSON.stringify(compB));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
    }
  }, [carts, hasSecondCart, compA, compB]);

  const activeSymbol = CURRENCY_SYMBOL;

  const activeCart = useMemo(() => {
    return carts.find(c => c.id === activeCartId) || carts[0];
  }, [carts, activeCartId]);

  const cartTotals = useMemo(() => {
    const calcSubtotal = (cart) => {
      if (!cart) return 0;
      return cart.items.reduce((acc, item) => {
        const q = Number(item.qty) || 0;
        const p = Number(item.price) || 0;
        return acc + (q * p);
      }, 0);
    };

    const cart1Subtotal = calcSubtotal(carts[0]);
    const cart2Subtotal = hasSecondCart ? calcSubtotal(carts[1]) : 0;

    const totalFlaggedCount = carts.reduce((acc, cart) => {
      if (cart.id === 'cart-2' && !hasSecondCart) return acc;
      return acc + cart.items.filter(i => i.flagged).length;
    }, 0);

    const grandTotal = cart1Subtotal + cart2Subtotal;
    const activeItemCount = (activeCart?.items || []).filter(i => (parseInt(i.qty) || 0) > 0).length;

    return {
      cart1Subtotal,
      cart2Subtotal,
      grandTotal,
      activeItemCount,
      activeSubtotal: activeCartId === 'cart-1' ? cart1Subtotal : cart2Subtotal,
      totalFlaggedCount
    };
  }, [carts, hasSecondCart, activeCartId, activeCart]);

  const handleAddItem = (name = '', price = '') => {
    const newItem = {
      id: Date.now().toString(),
      name: name, // Empty string default so placeholder shows
      qty: 1,
      price: price !== '' ? price : '',
      flagged: false
    };

    setCarts(prev => prev.map(cart => {
      if (cart.id === activeCartId) {
        return { ...cart, items: [newItem, ...cart.items] };
      }
      return cart;
    }));
  };

  const handleUpdateItem = (itemId, field, value) => {
    setCarts(prev => prev.map(cart => {
      if (cart.id === activeCartId) {
        return {
          ...cart,
          items: cart.items.map(item => {
            if (item.id === itemId) {
              return { ...item, [field]: value };
            }
            return item;
          })
        };
      }
      return cart;
    }));
  };

  // Price validation clamping between 10 ₡ and 25,000 ₡
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

  // Quantity validation clamping between 0 and 25 (0 for soft-deleted state)
  const handleQtyChange = (itemId, val) => {
    if (val === '') {
      handleUpdateItem(itemId, 'qty', '');
      return;
    }
    let num = parseInt(val, 10);
    if (isNaN(num)) return;
    if (num < 0) num = 0;
    if (num > 25) num = 25;
    handleUpdateItem(itemId, 'qty', num);
  };

  const handleBlurQty = (itemId, rawQty) => {
    if (rawQty === '' || rawQty === null || rawQty === undefined) {
      handleUpdateItem(itemId, 'qty', 1);
      return;
    }
    let numeric = parseInt(rawQty, 10);
    if (isNaN(numeric) || numeric < 0) {
      numeric = 0;
    } else if (numeric > 25) {
      numeric = 25;
    }
    handleUpdateItem(itemId, 'qty', numeric);
  };

  // Soft-delete mechanism: set quantity to 0 instead of removing row array item
  // keeping item line intact so user can easily re-increment it without re-typing.
  const handleSoftDelete = (itemId) => {
    handleUpdateItem(itemId, 'qty', 0);
  };

  // Direct hard-delete (permanent removal if needed)
  const handleHardDelete = (itemId) => {
    setCarts(prev => prev.map(cart => {
      if (cart.id === activeCartId) {
        return {
          ...cart,
          items: cart.items.filter(item => item.id !== itemId)
        };
      }
      return cart;
    }));
  };

  const handleToggleFlag = (itemId) => {
    setCarts(prev => prev.map(cart => {
      if (cart.id === activeCartId) {
        return {
          ...cart,
          items: cart.items.map(item => {
            if (item.id === itemId) {
              return { ...item, flagged: !item.flagged };
            }
            return item;
          })
        };
      }
      return cart;
    }));
  };

  const handleClearAll = () => {
    setCarts([
      { id: 'cart-1', name: 'Main Grocery', color: 'emerald', items: [] },
      { id: 'cart-2', name: 'Office Supplies', color: 'sky', items: [] }
    ]);
    setIsClearModalOpen(false);
  };

  const handleTouchStart = (e, itemId) => {
    touchStartPos.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    setSwipingItemId(itemId);
  };

  const handleTouchMove = (e, itemId) => {
    if (swipingItemId !== itemId) return;
    const deltaX = e.touches[0].clientX - touchStartPos.current.x;
    const deltaY = Math.abs(e.touches[0].clientY - touchStartPos.current.y);

    if (deltaY < 30) {
      setSwipeOffset(deltaX);
    }
  };

  const handleTouchEnd = (itemId) => {
    if (swipingItemId === itemId) {
      if (swipeOffset < -80) {
        // Swipe Left -> Soft Delete (sets quantity = 0)
        handleSoftDelete(itemId);
      } else if (swipeOffset > 80) {
        // Swipe Right -> Toggle Cashier Flag
        handleToggleFlag(itemId);
      }
    }
    setSwipingItemId(null);
    setSwipeOffset(0);
  };

  const comparisonResults = useMemo(() => {
    const pA = Math.max(0, parseFloat(compA.price) || 0);
    const qA = parseFloat(compA.qty) || 1;
    const packA = parseFloat(compA.packCount) || 1;
    const typeA = UNIT_TYPES[compA.unit] || UNIT_TYPES.UNITS;

    const pB = Math.max(0, parseFloat(compB.price) || 0);
    const qB = parseFloat(compB.qty) || 1;
    const packB = parseFloat(compB.packCount) || 1;
    const typeB = UNIT_TYPES[compB.unit] || UNIT_TYPES.UNITS;

    const compatible = typeA.base === typeB.base;

    const totalBaseA = qA * packA * typeA.factor;
    const totalBaseB = qB * packB * typeB.factor;

    const unitPriceA = totalBaseA > 0 ? pA / totalBaseA : 0;
    const unitPriceB = totalBaseB > 0 ? pB / totalBaseB : 0;

    let winner = null;
    let percentDiff = 0;
    let normalizationText = null;

    if (pA > 0 && pB > 0 && totalBaseA > 0 && totalBaseB > 0 && compatible) {
      if (unitPriceA < unitPriceB) {
        winner = 'A';
        percentDiff = Math.round(((unitPriceB - unitPriceA) / unitPriceB) * 100);
      } else if (unitPriceB < unitPriceA) {
        winner = 'B';
        percentDiff = Math.round(((unitPriceA - unitPriceB) / unitPriceA) * 100);
      } else {
        winner = 'TIED';
      }

      // Compute cross-unit weight/volume normalization details:
      // Show how much of Option B is needed to match Option A (or vice versa) and total cost
      const ratioBtoA = totalBaseA / totalBaseB;
      const costBToMatchA = Math.round(pB * ratioBtoA);
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
    if (!activeCart) return [];
    if (filterFlagged) {
      return activeCart.items.filter(i => i.flagged);
    }
    return activeCart.items;
  }, [activeCart, filterFlagged]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-800/95 backdrop-blur-md border-b border-slate-700/60 shadow-lg">
        <div className="max-w-md mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight tracking-tight text-white flex items-center gap-1.5">
                Smart Grocery
              </h1>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            {/* Flagged Filter Toggle Button */}
            <button
              onClick={() => setFilterFlagged(!filterFlagged)}
              className={`px-2 py-1.5 rounded-lg border text-xs flex items-center gap-1 transition ${
                filterFlagged
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Filter Flagged Items"
            >
              <Star className={`w-3.5 h-3.5 ${filterFlagged || cartTotals.totalFlaggedCount > 0 ? 'fill-amber-400 text-amber-400' : ''}`} />
              <span className="text-[11px] font-mono">({cartTotals.totalFlaggedCount})</span>
            </button>

            {/* Clear Trip Reset Button */}
            <button
              onClick={() => setIsClearModalOpen(true)}
              className="p-1.5 text-slate-400 hover:text-rose-400 active:bg-rose-500/10 rounded-lg transition"
              title="Clear Shopping Trip"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cart Switcher Tabs */}
        <div className="max-w-md mx-auto px-3 pb-2 flex items-center gap-2">
          <button
            onClick={() => setActiveCartId('cart-1')}
            className={`flex-1 py-1.5 px-3 rounded-xl font-medium text-xs flex items-center justify-between border transition-all ${
              activeCartId === 'cart-1'
                ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-900/30 font-semibold'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className={`w-2 h-2 rounded-full ${activeCartId === 'cart-1' ? 'bg-white' : 'bg-emerald-400'}`}></span>
              <span className="truncate">{carts[0]?.name || 'Main Cart'}</span>
            </div>
            <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-black/20 rounded-md font-mono">
              {activeSymbol}{cartTotals.cart1Subtotal.toLocaleString()}
            </span>
          </button>

          {hasSecondCart ? (
            <button
              onClick={() => setActiveCartId('cart-2')}
              className={`flex-1 py-1.5 px-3 rounded-xl font-medium text-xs flex items-center justify-between border transition-all ${
                activeCartId === 'cart-2'
                  ? 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-900/30 font-semibold'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate">
                <span className={`w-2 h-2 rounded-full ${activeCartId === 'cart-2' ? 'bg-white' : 'bg-sky-400'}`}></span>
                <span className="truncate">{carts[1]?.name || 'Cart 2'}</span>
              </div>
              <span className="ml-1 px-1.5 py-0.5 text-[10px] bg-black/20 rounded-md font-mono">
                {activeSymbol}{cartTotals.cart2Subtotal.toLocaleString()}
              </span>
            </button>
          ) : (
            <button
              onClick={() => {
                setHasSecondCart(true);
                setActiveCartId('cart-2');
              }}
              className="py-1.5 px-3 rounded-xl font-medium text-xs bg-slate-800/80 text-slate-400 border border-dashed border-slate-600 hover:border-slate-400 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>2nd Cart</span>
            </button>
          )}

          {hasSecondCart && (
            <button
              onClick={() => {
                setHasSecondCart(false);
                setActiveCartId('cart-1');
              }}
              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg text-xs"
              title="Remove 2nd Cart"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {}
      <main className="max-w-md mx-auto w-full px-4 pt-3 flex-1">
        {/* Item List */}
        {visibleItems.length === 0 ? (
          <div className="py-12 text-center rounded-3xl bg-slate-800/40 border border-slate-800 border-dashed">
            <ShoppingCart className="w-12 h-12 mx-auto text-slate-600 mb-2" />
            <p className="text-slate-400 font-medium">Cart is empty</p>
            <p className="text-slate-500 text-xs mt-1">Tap "+ Add New Item Row" below to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleItems.map((item) => {
              const rawQty = parseInt(item.qty);
              const numQty = isNaN(rawQty) ? 0 : Math.max(0, Math.min(25, rawQty));
              const numPrice = Math.max(0, parseFloat(item.price) || 0);
              const isZeroQty = numQty === 0;
              const rowTotal = numQty * numPrice;

              return (
                <div
                  key={item.id}
                  onTouchStart={(e) => handleTouchStart(e, item.id)}
                  onTouchMove={(e) => handleTouchMove(e, item.id)}
                  onTouchEnd={() => handleTouchEnd(item.id)}
                  style={{
                    transform: swipingItemId === item.id ? `translateX(${swipeOffset}px)` : 'translateX(0px)',
                    transition: swipingItemId === item.id ? 'none' : 'transform 0.2s ease-out'
                  }}
                  className={`relative overflow-hidden rounded-xl border transition-all ${
                    isZeroQty
                      ? 'bg-slate-900/60 border-slate-800 opacity-60'
                      : item.flagged
                      ? 'bg-slate-800/90 border-amber-500/60 shadow-md shadow-amber-950/20'
                      : 'bg-slate-800 border-slate-700/80 shadow-sm'
                  }`}
                >
                  <div className="p-2">
                    {/* Top Row: Description & Row Actions */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleUpdateItem(item.id, 'name', e.target.value)}
                        placeholder="Item name..."
                        className="flex-1 bg-transparent font-medium text-xs text-slate-100 outline-none border-b border-transparent focus:border-emerald-500 transition"
                      />

                      {/* Flag Toggle Star */}
                      <button
                        onClick={() => handleToggleFlag(item.id)}
                        className={`p-1.5 rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center ${
                          item.flagged
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            : 'bg-slate-700/50 text-slate-500 hover:text-slate-300'
                        }`}
                        title="Flag for Cashier"
                      >
                        <Star className={`w-4 h-4 ${item.flagged ? 'fill-current' : ''}`} />
                      </button>

                      {/* Soft Delete Action Button (sets quantity = 0) */}
                      <button
                        onClick={() => handleSoftDelete(item.id)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 active:bg-rose-500/10 rounded-lg transition min-w-[36px] min-h-[36px] flex items-center justify-center"
                        title="Remove Item (Set to 0)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Bottom Row: Quantity Stepper (1-25), Fixed Price Input (10-25k CRC), Row Total */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-700/40">
                      {/* Quantity Controls (Bounded 0 to 25) */}
                      <div className="flex items-center bg-slate-900/90 rounded-lg border border-slate-700 p-0.5 shrink-0">
                        <button
                          onClick={() => {
                            const currentQty = parseInt(item.qty) || 0;
                            if (currentQty > 0) {
                              handleUpdateItem(item.id, 'qty', currentQty - 1);
                            }
                          }}
                          className="w-7 h-7 rounded bg-slate-800 text-slate-200 font-bold flex items-center justify-center hover:bg-slate-700 active:scale-90 transition disabled:opacity-30"
                          disabled={(parseInt(item.qty) || 0) <= 0}
                          title="Decrease Quantity"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="0"
                          max="25"
                          value={item.qty ?? ''}
                          onChange={(e) => handleQtyChange(item.id, e.target.value)}
                          onBlur={(e) => handleBlurQty(item.id, e.target.value)}
                          className={`w-8 text-center bg-transparent font-bold text-xs outline-none ${
                            (parseInt(item.qty) || 0) === 0 ? 'text-slate-500 line-through' : 'text-slate-100'
                          }`}
                        />
                        <button
                          onClick={() => {
                            const currentQty = parseInt(item.qty) || 0;
                            if (currentQty < 25) {
                              handleUpdateItem(item.id, 'qty', currentQty + 1);
                            }
                          }}
                          className="w-7 h-7 rounded bg-emerald-600 text-white font-bold flex items-center justify-center hover:bg-emerald-500 active:scale-90 transition disabled:opacity-40"
                          disabled={(parseInt(item.qty) || 0) >= 25}
                          title="Increase Quantity"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Fixed Price Input (Range 10 - 25000 CRC) */}
                      <div className="w-28 shrink-0 flex items-center gap-1 bg-slate-900/60 rounded-lg px-2 py-0.5 border border-slate-700/80">
                        <span className="text-xs font-semibold text-slate-400 select-none">{activeSymbol}</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          min="10"
                          max="25000"
                          maxLength={5}
                          value={item.price ?? ''}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          onBlur={(e) => handleBlurPrice(item.id, e.target.value)}
                          placeholder="10-25k"
                          className="w-full bg-transparent text-xs font-semibold text-slate-100 outline-none"
                        />
                      </div>

                      {/* Calculated Row Total */}
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-emerald-400 font-mono">
                          {activeSymbol}{rowTotal.toLocaleString()}
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

      {}
      {isCompareOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end animate-fadeIn">
          <div className="bg-slate-800 rounded-t-3xl border-t border-slate-700 p-4 max-w-md mx-auto w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-700 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-500/20 text-indigo-400 rounded-xl">
                  <Scale className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-sm text-white">Unit & Promo Compare</h2>
                  <p className="text-[11px] text-slate-400">Compare 2 options & add winner</p>
                </div>
              </div>
              <button
                onClick={() => setIsCompareOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-700/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Option A Card */}
            <div className="bg-slate-850 p-3 rounded-2xl border border-slate-700 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Option A</span>
                {comparisonResults.winner === 'A' && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Best Value!
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Product A (e.g. 6-Pack)"
                value={compA.name}
                onChange={(e) => setCompA({ ...compA, name: e.target.value })}
                className="w-full bg-slate-900 text-xs text-slate-100 rounded-xl px-2.5 py-1.5 border border-slate-700 outline-none focus:border-indigo-500"
              />
              {/* Swapped Order: Qty / Size -> Price -> Unit */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="25"
                    placeholder="Qty (1-25)"
                    value={compA.qty}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val !== '') {
                        let num = parseInt(val, 10);
                        if (!isNaN(num) && num > 25) val = '25';
                      }
                      setCompA({ ...compA, qty: val });
                    }}
                    onBlur={(e) => {
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 1) num = 1;
                      if (num > 25) num = 25;
                      setCompA({ ...compA, qty: num.toString() });
                    }}
                    className="w-full bg-slate-900 text-xs font-bold text-slate-100 rounded-xl px-2 py-2 border border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="25000"
                    placeholder="Price (10-25k)"
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
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 10) num = 10;
                      if (num > 25000) num = 25000;
                      setCompA({ ...compA, price: num.toString() });
                    }}
                    className="w-full bg-slate-900 text-xs font-bold text-slate-100 rounded-xl px-2 py-2 border border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <select
                    value={compA.unit}
                    onChange={(e) => setCompA({ ...compA, unit: e.target.value })}
                    className="w-full bg-slate-900 text-xs text-indigo-300 font-semibold rounded-xl px-1.5 py-2 border border-slate-700 outline-none h-full"
                  >
                    {Object.keys(UNIT_TYPES).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Option B Card */}
            <div className="bg-slate-850 p-3 rounded-2xl border border-slate-700 mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider">Option B</span>
                {comparisonResults.winner === 'B' && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Best Value!
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="Product B (e.g. Single Can)"
                value={compB.name}
                onChange={(e) => setCompB({ ...compB, name: e.target.value })}
                className="w-full bg-slate-900 text-xs text-slate-100 rounded-xl px-2.5 py-1.5 border border-slate-700 outline-none focus:border-sky-500"
              />
              {/* Swapped Order: Qty / Size -> Price -> Unit */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="25"
                    placeholder="Qty (1-25)"
                    value={compB.qty}
                    onChange={(e) => {
                      let val = e.target.value;
                      if (val !== '') {
                        let num = parseInt(val, 10);
                        if (!isNaN(num) && num > 25) val = '25';
                      }
                      setCompB({ ...compB, qty: val });
                    }}
                    onBlur={(e) => {
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 1) num = 1;
                      if (num > 25) num = 25;
                      setCompB({ ...compB, qty: num.toString() });
                    }}
                    className="w-full bg-slate-900 text-xs font-bold text-slate-100 rounded-xl px-2 py-2 border border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="10"
                    max="25000"
                    placeholder="Price (10-25k)"
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
                      let num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 10) num = 10;
                      if (num > 25000) num = 25000;
                      setCompB({ ...compB, price: num.toString() });
                    }}
                    className="w-full bg-slate-900 text-xs font-bold text-slate-100 rounded-xl px-2 py-2 border border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <select
                    value={compB.unit}
                    onChange={(e) => setCompB({ ...compB, unit: e.target.value })}
                    className="w-full bg-slate-900 text-xs text-sky-300 font-semibold rounded-xl px-1.5 py-2 border border-slate-700 outline-none h-full"
                  >
                    {Object.keys(UNIT_TYPES).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Comparison Result Summary */}
            {comparisonResults.winner ? (
              <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-500/40 mb-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-emerald-300 text-xs">
                    {comparisonResults.winner === 'TIED'
                      ? 'Both Options Offer Equal Value!'
                      : `Option ${comparisonResults.winner} is ${comparisonResults.percentDiff}% Cheaper!`}
                  </span>
                </div>
                {comparisonResults.normalizationText && (
                  <p className="text-[11px] text-slate-300 leading-snug bg-slate-900/60 p-2 rounded-xl border border-slate-800">
                    {comparisonResults.normalizationText}
                  </p>
                )}
                {comparisonResults.winner !== 'TIED' && (
                  <button
                    onClick={handleAddWinnerToCart}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Winner (Option {comparisonResults.winner}) to {activeCart.name}</span>
                  </button>
                )}
              </div>
            ) : !comparisonResults.compatible ? (
              <div className="p-2.5 bg-rose-950/40 rounded-xl text-center text-[11px] text-rose-300 border border-rose-900/60 mb-3">
                Cannot compare incompatible unit types (e.g. Weight vs Volume vs Units).
              </div>
            ) : (
              <div className="p-2.5 bg-slate-900/80 rounded-xl text-center text-[11px] text-slate-400 border border-slate-800 mb-3">
                Enter valid prices and quantities to analyze true unit cost.
              </div>
            )}
          </div>
        </div>
      )}

      {}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-3xl border border-slate-700 p-5 max-w-xs w-full text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto border border-rose-500/30">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Reset Shopping Trip?</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to reset all carts? This will clear all items across both carts.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-bold rounded-xl"
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

      {/* Sticky Bottom Summary and Actions Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-slate-850/95 backdrop-blur-lg border-t border-slate-700/80 shadow-2xl">
        <div className="max-w-md mx-auto px-3 py-2 space-y-2">
          {/* Summary Row: active cart items, active cart subtotal, and grand total across carts */}
          <div className="flex items-center justify-between text-xs px-1 text-slate-300">
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-400">
                {activeCart.name}:
              </span>
              <span className="font-bold text-white font-mono">
                {activeSymbol}{cartTotals.activeSubtotal.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-md font-mono">
                {cartTotals.activeItemCount} {cartTotals.activeItemCount === 1 ? 'item' : 'items'}
              </span>
            </div>

            {hasSecondCart && (
              <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                <span className="text-slate-400 font-medium">Grand:</span>
                <span className="font-bold text-emerald-400 font-mono text-sm">
                  {activeSymbol}{cartTotals.grandTotal.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsCompareOpen(true)}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 flex items-center justify-center gap-1.5 min-h-[48px] touch-manipulation transition"
            >
              <Scale className="w-4 h-4 text-indigo-400" />
              <span>Compare Deals</span>
            </button>

            <button
              onClick={() => handleAddItem()}
              className="flex-[1.4] py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-1.5 min-h-[48px] touch-manipulation transition"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add New Item Row</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}