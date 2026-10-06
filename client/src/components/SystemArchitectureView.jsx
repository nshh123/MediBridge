import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  ShieldCheck,
  Gauge,
  Layout,
  RefreshCw,
  FileJson,
  Table,
  Smartphone,
  Tablet,
  Monitor
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function SystemArchitectureView() {
  const { user, authFetch, addToast } = useAuth();
  const [overview, setOverview] = useState(null);
  const [subTab, setSubTab] = useState('hybrid_db'); // 'hybrid_db' | 'rbac' | 'performance' | 'wireframes'

  const loadOverview = useCallback(async () => {
    try {
      const data = await authFetch('/api/system/overview');
      setOverview(data);
    } catch (err) {
      console.error('Failed to load system overview:', err);
    }
  }, [authFetch]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview, user]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await authFetch(`/api/system/users/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ roleName: newRole })
      });
      addToast('RBAC Role Updated', res.message, 'success');
      await loadOverview();
    } catch (err) {
      addToast('RBAC Admin Enforcement', err.message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'hybrid_db', label: '1. Relational SQL vs MongoDB NoSQL (Req 2 & 5)', icon: Database },
            { id: 'rbac', label: '2. RBAC Authorization Matrix (Req 8)', icon: ShieldCheck },
            { id: 'performance', label: '3. Performance & Cache Telemetry (Req 6)', icon: Gauge },
            { id: 'wireframes', label: '4. Responsive Wireframes & SDLC Blueprint (Req 1-4)', icon: Layout }
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  subTab === t.id
                    ? 'bg-slate-900 text-white shadow'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        <button
          onClick={loadOverview}
          className="px-3 py-2 rounded-xl bg-teal-50 text-teal-800 border border-teal-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Telemetry
        </button>
      </div>

      {/* SUBTAB 1: Hybrid Relational + Non-Relational Persistence Inspector */}
      {subTab === 'hybrid_db' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Relational Database (SQL) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {overview.relationalDb.engine}
                </h2>
              </div>
              <span className="text-xs font-mono bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-bold">
                ACID + Foreign Keys ON
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs">
              {Object.entries(overview.relationalDb.tableCounts || {}).map(([tbl, count]) => (
                <div key={tbl} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-mono text-[11px] text-slate-500 truncate">{tbl}</div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">{count} rows</div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5">
                Active B-Tree Indexes (Requirement 2c & 6):
              </div>
              <div className="flex flex-wrap gap-1.5">
                {overview.relationalDb.indexesActive?.map((idx) => (
                  <span
                    key={idx}
                    className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    {idx}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5">
                Sample Relational Join Result (<code className="text-teal-700">users JOIN roles</code>):
              </div>
              <div className="bg-slate-900 text-slate-100 rounded-xl p-3 font-mono text-[11px] overflow-x-auto max-h-56">
                <pre>{JSON.stringify(overview.relationalDb.sampleUsers, null, 2)}</pre>
              </div>
            </div>
          </div>

          {/* Right: Non-Relational Document Database (MongoDB) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  {overview.nonRelationalDb.engine}
                </h2>
              </div>
              <span className="text-xs font-mono bg-indigo-100 text-indigo-800 px-2.5 py-1 rounded-full font-bold">
                Document Store
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-xs">
              {overview.nonRelationalDb.collections?.map((col) => (
                <div key={col.name} className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-mono text-[11px] text-indigo-700 font-bold truncate">
                    {col.name}
                  </div>
                  <div className="text-lg font-extrabold text-slate-900 mt-0.5">
                    {col.count} docs
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5">
                Live MongoDB Document Sample (<code className="text-indigo-700">db.prescriptions.findOne()</code>):
              </div>
              <div className="bg-slate-900 text-emerald-300 rounded-xl p-3 font-mono text-[11px] overflow-x-auto max-h-48">
                <pre>{JSON.stringify(overview.nonRelationalDb.samplePrescriptions?.[0], null, 2)}</pre>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1.5">
                Live MongoDB Security & Audit Logs (<code className="text-indigo-700">db.clinical_audit_logs.find()</code>):
              </div>
              <div className="bg-slate-900 text-amber-200 rounded-xl p-3 font-mono text-[11px] overflow-x-auto max-h-40">
                <pre>{JSON.stringify(overview.nonRelationalDb.sampleAuditLogs?.slice(0, 4), null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: RBAC Authorization Model & User Role Administration */}
      {subTab === 'rbac' && overview && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.values(overview.rbacModel || {}).map((role) => (
              <div
                key={role.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-slate-900">{role.name}</span>
                  <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                    {role.permissions.length} perms
                  </span>
                </div>
                <p className="text-xs text-slate-500">{role.description}</p>
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                  {role.permissions.map((perm) => (
                    <span
                      key={perm}
                      className="font-mono text-[10px] px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200"
                    >
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-1">
              RBAC User Directory & Role Assignment (Requirement 8)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Only users with the <strong>ADMIN</strong> role can modify user roles below. If you are logged in as Patient/Doctor/Pharmacist, clicking a role button will trigger a live <strong>403 Forbidden RBAC rejection</strong> and log a security event in MongoDB.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Auth Provider</th>
                    <th className="py-2.5 px-3">Current RBAC Role</th>
                    <th className="py-2.5 px-3">Assign Role (Admin Only)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.relationalDb.sampleUsers?.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{u.full_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{u.email}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px]">{u.oauth_provider}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full font-bold bg-slate-900 text-white text-[10px]">
                          {u.role_name}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          {['PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN'].map((rName) => (
                            <button
                              key={rName}
                              onClick={() => handleRoleChange(u.id, rName)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                                u.role_name === rName
                                  ? 'bg-teal-600 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {rName}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: Performance & Caching Telemetry */}
      {subTab === 'performance' && overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base">
              LRU Cache & Query Latency Telemetry (Requirement 6)
            </h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200">
                <div className="text-[11px] text-teal-700 font-bold uppercase">Cache Hit Rate</div>
                <div className="text-2xl font-extrabold text-teal-900 mt-1">
                  {overview.performance?.cache?.hitRatePercent}%
                </div>
                <div className="text-[11px] text-teal-700">
                  {overview.performance?.cache?.cacheHits} hits / {overview.performance?.cache?.cacheMisses} misses
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200">
                <div className="text-[11px] text-indigo-700 font-bold uppercase">Avg API Latency</div>
                <div className="text-2xl font-extrabold text-indigo-900 mt-1">
                  {overview.performance?.latency?.avgLatencyMs} ms
                </div>
                <div className="text-[11px] text-indigo-700">Target SLA: &lt; 100ms</div>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <div className="text-[11px] text-amber-800 font-bold uppercase">p95 Latency</div>
                <div className="text-2xl font-extrabold text-amber-900 mt-1">
                  {overview.performance?.latency?.p95LatencyMs} ms
                </div>
                <div className="text-[11px] text-amber-800">95th Percentile</div>
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-2">
                Active Performance Optimizations:
              </div>
              <ul className="space-y-1.5 text-xs text-slate-700">
                {overview.performance?.optimizationsEnabled?.map((opt, i) => (
                  <li key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-200 font-medium">
                    ✓ {opt}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-base mb-3">
              Recent API Request Latency Profiler Log
            </h3>
            <div className="space-y-2 max-h-80 overflow-y-auto text-xs font-mono">
              {overview.performance?.latency?.recentRequests?.map((req, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-slate-900 mr-2">{req.method}</span>
                    <span className="text-slate-700">{req.route}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]">
                      Cache: {req.cacheStatus}
                    </span>
                    <span className="font-bold text-teal-700">{req.durationMs} ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: Responsive Wireframes & Multi-Device Layout Blueprint (Requirement 3) */}
      {subTab === 'wireframes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h2 className="text-lg font-extrabold text-slate-900 mb-1">
              Requirement 3: Responsive Multi-Device Wireframes & Layout Adaptability
            </h2>
            <p className="text-xs text-slate-600 mb-5">
              MediBridge implements a Mobile-First Responsive Grid using Tailwind CSS breakpoints (<code className="text-teal-700">sm: 640px</code>, <code className="text-teal-700">md: 768px</code>, <code className="text-teal-700">lg: 1024px</code>). Below are the interactive structural wireframes across Mobile, Tablet, and Desktop viewports.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Mobile Wireframe (375px) */}
              <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-3 border-b border-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-teal-600" />
                      Mobile Viewport (375px)
                    </span>
                    <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded">1-Column Stack</span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-800 text-white flex justify-between">
                      <span>[Logo] MediBridge</span>
                      <span>[≡ Drawer]</span>
                    </div>
                    <div className="p-2 rounded bg-teal-100 text-teal-900 border border-teal-300">
                      [Role Switcher Strip: Patient | Doctor]
                    </div>
                    <div className="p-2.5 rounded bg-white border border-slate-300">
                      [Search Input Full-Width]<br />
                      [District Dropdown Stacked]<br />
                      [Insurance Pill Scroll]
                    </div>
                    <div className="p-3 rounded bg-white border border-slate-300 space-y-1">
                      <div className="font-bold">[Medication Card #1]</div>
                      <div>Augmentin 625mg — 8,500 RWF</div>
                      <div className="p-1.5 rounded bg-slate-900 text-white text-center">
                        [Full-Width Touch CTA: Reserve]
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-white border border-slate-300">
                      [Stacked Reservations Panel Below]
                    </div>
                  </div>
                </div>
              </div>

              {/* Tablet Wireframe (768px) */}
              <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-3 border-b border-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Tablet className="w-4 h-4 text-indigo-600" />
                      Tablet Viewport (768px - md)
                    </span>
                    <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded">2-Column Grid</span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-800 text-white flex justify-between">
                      <span>[MediBridge Header]</span>
                      <span>[OAuth2 Session]</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded bg-white border border-slate-300">[Search Input]</div>
                      <div className="p-2 rounded bg-white border border-slate-300">[District + Sort]</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-3 rounded bg-white border border-slate-300">
                        [Stock Card Col 1]<br />Goodlife Pharmacy
                      </div>
                      <div className="p-3 rounded bg-white border border-slate-300">
                        [Stock Card Col 2]<br />Kipharma Central
                      </div>
                    </div>
                    <div className="p-2.5 rounded bg-white border border-slate-300">
                      [2-Column E-Prescription Verification Split]
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Wireframe (1280px+) */}
              <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 pb-3 border-b border-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Monitor className="w-4 h-4 text-emerald-600" />
                      Desktop Viewport (1280px - lg)
                    </span>
                    <span className="font-mono text-[10px] bg-slate-200 px-2 py-0.5 rounded">3-Column Asymmetric</span>
                  </div>
                  <div className="mt-3 space-y-2 text-[11px] font-mono">
                    <div className="p-2 rounded bg-slate-900 text-white flex justify-between">
                      <span>[Logo]</span>
                      <span>[6 Horizontal Feature Tabs]</span>
                    </div>
                    <div className="p-2 rounded bg-teal-950 text-teal-200 flex justify-between">
                      <span>[Hero Banner + 5-Col Filter Bar]</span>
                      <span>[X-Cache Badge]</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2 p-3 rounded bg-white border border-slate-300 space-y-1">
                        <div className="font-bold">[Left 2/3 Workspace]</div>
                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="p-2 bg-slate-100 rounded">[Batch Card A]</div>
                          <div className="p-2 bg-slate-100 rounded">[Batch Card B]</div>
                        </div>
                      </div>
                      <div className="p-3 rounded bg-white border border-slate-300">
                        <div className="font-bold">[Right 1/3 Panel]</div>
                        <div>Live Reservations &amp; RabbitMQ Stream</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
