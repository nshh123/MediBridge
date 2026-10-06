import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  MapPin,
  ShieldCheck,
  Clock,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Zap,
  RefreshCw,
  Phone
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
  const [cacheStatus, setCacheStatus] = useState('MISS');
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reservingId, setReservingId] = useState(null);

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
      setCacheStatus(data.cacheStatus || res.headers.get('X-Cache') || 'MISS');
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

  return (
    <div className="space-y-6">
      {/* Hero Banner & Search Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-teal-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Real-Time Kigali Pharmacy Stock & Price Comparison
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Stop Visiting 5 Pharmacies for Out-of-Stock Medicine
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Search verified stock across Gasabo, Nyarugenge, and Kicukiro pharmacies, filter by RSSB/MMI/Radiant insurance acceptance, and reserve scarce medicines with instant RabbitMQ SMS pickup codes.
            </p>
          </div>

          {/* Performance & LRU Cache Status Badge (Req 6) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 shrink-0 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              cacheStatus === 'HIT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
            }`}>
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                Query Performance (Req 6)
              </div>
              <div className="text-xs font-mono font-bold flex items-center gap-2 mt-0.5">
                <span>X-Cache: {cacheStatus}</span>
                <button
                  onClick={fetchStock}
                  className="text-teal-400 hover:text-teal-300 inline-flex items-center gap-1 cursor-pointer"
                  title="Re-run query to observe LRU Cache HIT"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
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

      {/* Main Content Grid: Stock Results (Left 2/3) + Active Reservations (Right 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <span>Verified Pharmacy Inventory Batches</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">
                {stockItems.length} batches found
              </span>
            </h2>
            <span className="text-xs text-slate-500 font-mono">
              Source: Relational SQL (JOIN pharmacy_inventory + medications + pharmacies)
            </span>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-teal-600" />
                          {item.pharmacy_name}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                          {item.district} / {item.sector}
                        </span>
                      </div>
                      <div className="text-slate-500 flex items-center justify-between">
                        <span>{item.address}</span>
                        <span className="font-mono text-[11px] flex items-center gap-1">
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

        {/* Right Column: Live Reservations & Pickup Queue */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Active Stock Reservations
                </h3>
                <p className="text-xs text-slate-500">
                  {user?.role === 'PATIENT'
                    ? 'Your reserved medicines & SMS pickup codes'
                    : 'All pharmacy reservations (Pharmacist/Admin fulfillment)'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                {reservations.length}
              </span>
            </div>

            <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
              {reservations.length === 0 ? (
                <div className="text-xs text-slate-500 py-8 text-center">
                  No reservations yet. Click "Reserve 6h Pickup" on any medication card to test!
                </div>
              ) : (
                reservations.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs"
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

                    <div className="font-bold text-slate-900">
                      {r.quantity}x {r.brand_name} ({r.generic_name})
                    </div>
                    <div className="text-slate-600 flex items-center justify-between">
                      <span>{r.pharmacy_name} ({r.district})</span>
                      <span className="font-bold text-slate-900">
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
          </div>
        </div>
      </div>
    </div>
  );
}
