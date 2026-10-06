import React, { useState, useEffect, useCallback } from 'react';
import {
  PackageCheck,
  PlusCircle,
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function InventoryManagerView() {
  const { user, authFetch, addToast } = useAuth();
  const [inventory, setInventory] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    pharmacyId: 'phm_01',
    medicationId: 'med_01',
    batchNumber: `BATCH-${Math.floor(1000 + Math.random() * 9000)}`,
    stockQuantity: 45,
    reorderLevel: 15,
    unitPriceRwf: 8200,
    expiryDate: '2027-09-15',
    discountPercent: 0
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [stockRes, catRes] = await Promise.all([
        fetch('/api/pharmacies/stock?sortBy=expiry_asc').then((r) => r.json()),
        fetch('/api/pharmacies/catalog').then((r) => r.json())
      ]);
      setInventory(stockRes.items || []);
      setPharmacies(catRes.pharmacies || []);
      setMedications(catRes.medications || []);
    } catch (err) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddBatch = async (e) => {
    e.preventDefault();
    try {
      await authFetch('/api/pharmacies/inventory', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      addToast(
        'Inventory Batch Added!',
        `Added batch ${form.batchNumber} to Relational SQL table pharmacy_inventory.`,
        'success'
      );
      setForm({
        ...form,
        batchNumber: `BATCH-${Math.floor(1000 + Math.random() * 9000)}`
      });
      await loadData();
    } catch (err) {
      addToast('RBAC Permission Denied', err.message, 'error');
    }
  };

  const handleQuickAdjust = async (invId, delta, currentQty) => {
    const nextQty = Math.max(0, currentQty + delta);
    try {
      await authFetch(`/api/pharmacies/inventory/${invId}`, {
        method: 'PATCH',
        body: JSON.stringify({ stockQuantity: nextQty })
      });
      addToast('Stock Adjusted', `Updated stock quantity to ${nextQty} units.`, 'success');
      await loadData();
    } catch (err) {
      addToast('RBAC Permission Denied', err.message, 'error');
    }
  };

  const handleBroadcastExpiry = async (item) => {
    try {
      const res = await authFetch(`/api/pharmacies/inventory/${item.inventory_id}/broadcast-expiry`, {
        method: 'POST',
        body: JSON.stringify({ discountPercent: 25 })
      });
      addToast(
        'RabbitMQ Near-Expiry Broadcast Sent!',
        res.message,
        'success'
      );
      await loadData();
    } catch (err) {
      addToast('RBAC Permission Denied', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-200 mb-1.5">
            <PackageCheck className="w-3.5 h-3.5" />
            Pharmacist Inventory & Near-Expiry Redistribution Hub
          </span>
          <h1 className="text-xl font-extrabold text-slate-900">
            Pharmacy Batch Ledger & Anti-Wastage Expiry Alerts
          </h1>
          <p className="text-xs text-slate-600 mt-0.5">
            Manage Relational SQL stock batches (`pharmacy_inventory`), monitor low-stock reorder thresholds, and broadcast near-expiry discounts across partner clinics via RabbitMQ.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 self-start cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Ledger
        </button>
      </div>

      {user?.role !== 'PHARMACIST' && user?.role !== 'ADMIN' && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-2">
          <span>
            <strong>RBAC Note:</strong> You are currently signed in as <strong>{user?.role}</strong>. Attempting to modify stock or broadcast expiry alerts will demonstrate <strong>HTTP 403 RBAC Enforcement</strong>. Switch to <strong>PHARMACIST</strong> or <strong>ADMIN</strong> in the top bar to perform write operations.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add New Batch Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
            <PlusCircle className="w-4 h-4 text-teal-600" />
            Register New Medication Stock Batch
          </h2>

          <form onSubmit={handleAddBatch} className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pharmacy Branch</label>
              <select
                value={form.pharmacyId}
                onChange={(e) => setForm({ ...form, pharmacyId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              >
                {pharmacies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.district})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Medication</label>
              <select
                value={form.medicationId}
                onChange={(e) => setForm({ ...form, medicationId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 bg-white"
              >
                {medications.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.brand_name} ({m.generic_name})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Batch Number</label>
                <input
                  type="text"
                  required
                  value={form.batchNumber}
                  onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Expiry Date</label>
                <input
                  type="date"
                  required
                  value={form.expiryDate}
                  onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Stock Qty</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.stockQuantity}
                  onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Unit Price (RWF)</label>
                <input
                  type="number"
                  min="100"
                  required
                  value={form.unitPriceRwf}
                  onChange={(e) => setForm({ ...form, unitPriceRwf: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Discount %</label>
                <input
                  type="number"
                  min="0"
                  max="80"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-teal-600 text-white font-bold transition cursor-pointer"
            >
              Insert Batch into Relational SQL Table
            </button>
          </form>
        </div>

        {/* Right 2/3: Inventory Batches Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm">
              Relational SQL Table: <code className="text-teal-700">pharmacy_inventory</code> ({inventory.length} rows)
            </h3>
            <span className="text-xs text-slate-500">Sorted by Expiry Date</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                  <th className="py-3 px-4">Medication & Batch</th>
                  <th className="py-3 px-4">Pharmacy</th>
                  <th className="py-3 px-4">Stock Level</th>
                  <th className="py-3 px-4">Price (RWF)</th>
                  <th className="py-3 px-4">Expiry & Alert Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventory.map((item) => (
                  <tr key={item.inventory_id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.brand_name}</div>
                      <div className="text-slate-500">{item.generic_name}</div>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        Batch: {item.batch_number}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{item.pharmacy_name}</div>
                      <div className="text-slate-500 text-[11px]">{item.district}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleQuickAdjust(item.inventory_id, -1, item.stock_quantity)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                        >
                          -
                        </button>
                        <span
                          className={`font-mono font-bold px-2 py-0.5 rounded ${
                            item.is_low_stock
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.stock_quantity}
                        </span>
                        <button
                          onClick={() => handleQuickAdjust(item.inventory_id, 5, item.stock_quantity)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 cursor-pointer"
                        >
                          +5
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {item.effective_price_rwf.toLocaleString()} RWF
                      </div>
                      {item.discount_percent > 0 && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          -{item.discount_percent}% Off
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[11px] text-slate-700 mb-1">
                        Exp: {item.expiry_date}
                      </div>
                      <button
                        onClick={() => handleBroadcastExpiry(item)}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 border border-amber-400/40 font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Megaphone className="w-3 h-3" />
                        Broadcast -25% Alert
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
