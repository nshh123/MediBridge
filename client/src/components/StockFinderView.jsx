import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MapPin,
  Clock,
  ShoppingBag,
  Phone,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function StockFinderView() {
  const { user, authFetch, addToast } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [district, setDistrict] = useState('ALL');
  const [category, setCategory] = useState('ALL');
  const [insurance, setInsurance] = useState('ALL');
  const [sortBy, setSortBy] = useState('price_asc');
  const [stockItems, setStockItems] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        district,
        category,
        insurance,
        sortBy
      });
      const res = await fetch(`/api/pharmacies/stock?${params.toString()}`);
      const data = await res.json();
      setStockItems(data.items || []);
    } catch (err) {
      console.error('Failed to load stock:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, district, category, insurance, sortBy]);

  const fetchReservations = useCallback(async () => {
    try {
      const data = await authFetch('/api/pharmacies/reservations');
      setReservations(data.reservations || []);
    } catch {
      // ignore if unauthenticated
    }
  }, [authFetch]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations, user]);

  const handleReserve = async (item) => {
    setReservingId(item.inventory_id);
    try {
      const data = await authFetch('/api/pharmacies/reserve', {
        method: 'POST',
        body: JSON.stringify({
          inventoryId: item.inventory_id,
          quantity: 1
        })
      });
      addToast(
        `Reservation ${data.reservation.reservationCode} Confirmed!`,
        `RabbitMQ dispatched SMS & Email pickup PIN for ${item.brand_name} at ${item.pharmacy_name}.`,
        'success'
      );
      await fetchStock();
      await fetchReservations();
      setCartOpen(true);
    } catch (err) {
      addToast('Reservation Failed', err.message, 'error');
    } finally {
      setReservingId(null);
    }
  };

  const handleFulfillReservation = async (resId, status) => {
    try {
      const data = await authFetch(`/api/pharmacies/reservations/${resId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      addToast('Reservation Updated', data.message, 'success');
      await fetchReservations();
      await fetchStock();
    } catch (err) {
      addToast('Action Denied (RBAC)', err.message, 'error');
    }
  };

  const activeReservedCount = reservations.filter((r) => r.status === 'RESERVED').length;
  const totalReservedRwf = reservations
    .filter((r) => r.status === 'RESERVED')
    .reduce((sum, r) => sum + Number(r.total_price_rwf || 0), 0);

  return (
    <div className="space-y-6 pb-16">
      {/* Hero Banner & Search Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-teal-500/20">
        <div className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Stop Visiting 5 Pharmacies for Out-of-Stock Medicine
          </h1>
          <p className="text-sm text-slate-300 mt-1.5 max-w-2xl">
            Search verified stock across Gasabo, Nyarugenge, and Kicukiro pharmacies, filter by RSSB/MMI/Radiant insurance acceptance, and reserve scarce medicines with instant RabbitMQ SMS pickup codes.
          </p>
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drug (e.g., Augmentin, Coartem, Lantus Insulin, Amlodipine)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/90 border border-slate-700 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:border-teal-400"
            />
          </div>

          <select
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            className="rounded-xl bg-slate-950/90 border border-slate-700 px-3 py-2.5 text-sm text-white"
          >
            <option value="ALL">All Kigali Districts</option>
            <option value="Gasabo">Gasabo District</option>
            <option value="Nyarugenge">Nyarugenge District</option>
            <option value="Kicukiro">Kicukiro District</option>
          </select>

          <select
            value={insurance}
            onChange={(e) => setInsurance(e.target.value)}
            className="rounded-xl bg-slate-950/90 border border-slate-700 px-3 py-2.5 text-sm text-white"
          >
            <option value="ALL">All Insurances (RSSB/MMI/Radiant)</option>
            <option value="RSSB">RSSB (Rama) Accepted</option>
            <option value="MMI">MMI Accepted</option>
            <option value="RADIANT">Radiant Accepted</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-xl bg-slate-950/90 border border-slate-700 px-3 py-2.5 text-sm text-white"
          >
            <option value="price_asc">Sort: Lowest Price (RWF)</option>
            <option value="stock_desc">Sort: Highest Stock Quantity</option>
            <option value="expiry_asc">Sort: Near-Expiry Discounts First</option>
          </select>
        </div>

        {/* Category Quick Pills */}
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">Therapeutic Class:</span>
          {['ALL', 'Antibiotic', 'Antimalarial', 'Endocrine / Antidiabetic', 'Cardiovascular', 'Respiratory', 'Analgesic / Antipyretic'].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                category === cat
                  ? 'bg-teal-500 text-slate-950'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cat === 'ALL' ? 'All Classes' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Full-Width Stock Results Grid */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-slate-800 text-base flex items-center gap-2.5">
            <span>Verified Pharmacy Inventory Batches</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold whitespace-nowrap">
              {stockItems.length} batches found
            </span>
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
            Loading live pharmacy stock...
          </div>
        ) : stockItems.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
            No matching medication batches found. Try clearing filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stockItems.map((item) => (
              <div
                key={item.inventory_id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="inline-block text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-700 mb-1">
                        {item.category}
                      </span>
                      <h3 className="font-extrabold text-slate-900 text-base">
                        {item.brand_name}
                      </h3>
                      <p className="text-xs font-medium text-slate-600">
                        {item.generic_name} • {item.strength} ({item.dosage_form})
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      {item.discount_percent > 0 && (
                        <div className="text-[11px] line-through text-slate-400">
                          {item.unit_price_rwf.toLocaleString()} RWF
                        </div>
                      )}
                      <div className="text-lg font-extrabold text-teal-700">
                        {item.effective_price_rwf.toLocaleString()} <span className="text-xs">RWF</span>
                      </div>
                      {item.discount_percent > 0 && (
                        <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          -{item.discount_percent}% Near-Expiry Redistribution
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                    {item.description}
                  </p>

                  {/* Pharmacy Card Info */}
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-800 flex items-center gap-1 truncate">
                        <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                        <span className="truncate">{item.pharmacy_name}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold whitespace-nowrap">
                        {item.district}
                      </span>
                    </div>
                    <div className="text-slate-500 flex items-center justify-between gap-2">
                      <span className="truncate">{item.address}</span>
                      <span className="font-mono text-[11px] flex items-center gap-1 whitespace-nowrap">
                        <Phone className="w-3 h-3" />
                        {item.pharmacy_phone}
                      </span>
                    </div>

                    {/* Insurance & Stock Status Pills */}
                    <div className="flex items-center justify-between pt-1.5 flex-wrap gap-1">
                      <div className="flex items-center gap-1">
                        {item.accepts_rssb === 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-200">
                            RSSB
                          </span>
                        )}
                        {item.accepts_mmi === 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-200">
                            MMI
                          </span>
                        )}
                        {item.accepts_radiant === 1 && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                            RADIANT
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.stock_quantity > item.reorder_level
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {item.stock_quantity} in stock
                        </span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          Exp: {item.expiry_date}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {item.operating_hours}
                  </span>

                  <button
                    onClick={() => handleReserve(item)}
                    disabled={reservingId === item.inventory_id || item.stock_quantity <= 0}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-teal-600 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {reservingId === item.inventory_id
                      ? 'Reserving...'
                      : 'Reserve 6h Pickup'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Bottom-Right Reservations Cart Pill */}
      <button
        onClick={() => setCartOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-3 rounded-full bg-slate-900 hover:bg-teal-600 text-white shadow-2xl border border-slate-700 transition-all hover:scale-105 cursor-pointer group"
      >
        <div className="relative flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-teal-400 group-hover:text-white transition" />
          <span className=" -top-2 -right-2 ml-1 px-1.5 py-0.5 rounded-full bg-teal-500 group-hover:bg-slate-950 text-slate-950 group-hover:text-teal-300 text-[10px] font-extrabold">
            {reservations.length}
          </span>
        </div>
        <div className="text-left leading-tight pr-1">
          <div className="text-xs font-extrabold whitespace-nowrap">
            Active Reservations
          </div>
          <div className="text-[10px] text-slate-300 group-hover:text-teal-100 font-mono whitespace-nowrap">
            {activeReservedCount} pending • {totalReservedRwf.toLocaleString()} RWF
          </div>
        </div>
      </button>

      {/* Slide-Over Reservations Cart Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl border-l border-slate-200 flex flex-col justify-between animate-in slide-in-from-right">
            {/* Cart Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base">
                    Active Stock Reservations
                  </h3>
                  <p className="text-xs text-slate-400">
                    {user?.role === 'PATIENT'
                      ? 'Your reserved medicines & SMS pickup codes'
                      : 'Pharmacy reservations & fulfillment queue'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {reservations.length === 0 ? (
                <div className="text-xs text-slate-500 py-16 text-center space-y-2">
                  <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
                  <p>No active reservations yet.</p>
                  <p className="text-[11px] text-slate-400">
                    Click "Reserve 6h Pickup" on any medication card to add it here.
                  </p>
                </div>
              ) : (
                reservations.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {r.reservation_code}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'RESERVED'
                            ? 'bg-amber-100 text-amber-800'
                            : r.status === 'DISPENSED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 text-sm">
                      {r.quantity}x {r.brand_name} ({r.generic_name})
                    </div>
                    <div className="text-slate-600 flex items-center justify-between">
                      <span>{r.pharmacy_name} ({r.district})</span>
                      <span className="font-extrabold text-slate-900">
                        {Number(r.total_price_rwf).toLocaleString()} RWF
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Patient: <span className="font-semibold text-slate-700">{r.patient_name}</span> ({r.patient_phone})
                    </div>

                    {(user?.role === 'PHARMACIST' || user?.role === 'ADMIN') && r.status === 'RESERVED' && (
                      <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                        <button
                          onClick={() => handleFulfillReservation(r.id, 'DISPENSED')}
                          className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                        >
                          Mark Dispensed
                        </button>
                        <button
                          onClick={() => handleFulfillReservation(r.id, 'CANCELLED')}
                          className="py-1.5 px-2.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-[11px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer Summary */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <div>
                <div className="text-slate-500">Pending Pickup Total</div>
                <div className="text-base font-extrabold text-slate-900">
                  {totalReservedRwf.toLocaleString()} RWF
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
              >
                Continue Browsing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
