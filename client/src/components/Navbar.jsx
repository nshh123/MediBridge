import React, { useState } from 'react';
import {
  Pill,
  FileCheck2,
  PackageCheck,
  BrainCircuit,
  Radio,
  Database,
  ShieldCheck,
  KeyRound,
  UserCheck,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_BADGE_STYLES = {
  PATIENT: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  DOCTOR: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  PHARMACIST: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  ADMIN: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
};

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal }) {
  const { user, authMechanism, demoAccounts, loginWithOAuth2Flow, loginWithPassword } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const navItems = [
    { id: 'stock', label: 'Stock Finder', icon: Pill },
    { id: 'prescriptions', label: 'E-Prescriptions', icon: FileCheck2 },
    { id: 'inventory', label: 'Inventory', icon: PackageCheck },
    { id: 'ai', label: 'AI Triage', icon: BrainCircuit },
    { id: 'broker', label: 'RabbitMQ', icon: Radio },
    { id: 'architecture', label: 'Hybrid DB & RBAC', icon: Database }
  ];

  // Pick exactly 1 representative demo account per unique RBAC role (PATIENT, DOCTOR, PHARMACIST, ADMIN)
  const uniqueRoleAccounts = ['PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN']
    .map((roleName) => demoAccounts.find((a) => a.role_name === roleName))
    .filter(Boolean);

  const handleQuickRoleSwitch = async (account) => {
    setSwitchingRole(true);
    try {
      if (account.oauth_provider && account.oauth_provider.includes('oauth2')) {
        await loginWithOAuth2Flow(account.email, account.oauth_provider);
      } else {
        await loginWithPassword(account.email, 'Password123!');
      }
    } finally {
      setSwitchingRole(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md text-white shadow-lg border-b border-slate-800/80">
      {/* Main Primary Navigation Row */}
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div
          onClick={() => setActiveTab('stock')}
          className="flex items-center gap-3 cursor-pointer group shrink-0"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-105 transition">
            <Pill className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                MediBridge
              </span>
              <span className="hidden xl:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                Rwanda
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block whitespace-nowrap">
              E-Prescription &amp; Stock Network
            </p>
          </div>
        </div>

        {/* Center Segmented Navigation Pills */}
        <nav className="hidden lg:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800/90 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                  active
                    ? 'bg-teal-500 text-slate-950 shadow-sm font-bold'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-slate-950' : 'text-teal-400/80'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right User Session & Auth Studio Button */}
        <div className="hidden md:flex items-center gap-2.5 shrink-0">
          {user && (
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                {user.fullName}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border whitespace-nowrap ${
                  ROLE_BADGE_STYLES[user.role] || ''
                }`}
              >
                {user.role}
              </span>
            </div>
          )}

          <button
            onClick={onOpenAuthModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition whitespace-nowrap cursor-pointer"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>OAuth2 Studio</span>
          </button>
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Clean Secondary Subbar for RBAC Role Switching & Auth Telemetry */}
      <div className="bg-slate-900/70 border-t border-slate-800/70 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-400">
            <span className="inline-flex items-center gap-1 text-teal-400 font-semibold whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5" />
              Active Auth Protocol:
            </span>
            <span className="inline-flex items-center gap-1 text-slate-300 font-mono text-[11px] bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 whitespace-nowrap">
              <KeyRound className="w-3 h-3 text-amber-400" />
              {authMechanism}
            </span>
          </div>

          {/* Deduplicated 4-Role Switcher */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">
              Quick RBAC Role Switch:
            </span>
            {uniqueRoleAccounts.map((acc) => {
              const isActive = user?.role === acc.role_name;
              return (
                <button
                  key={acc.id}
                  disabled={switchingRole}
                  onClick={() => handleQuickRoleSwitch(acc)}
                  className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-teal-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                  title={`Switch to ${acc.full_name} (${acc.role_name})`}
                >
                  {acc.role_name}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-t border-slate-800 px-4 py-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-between transition ${
                  active
                    ? 'bg-teal-500 text-slate-950 font-bold'
                    : 'text-slate-200 hover:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              onOpenAuthModal();
            }}
            className="w-full mt-2 px-3.5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white flex items-center justify-center gap-2"
          >
            <UserCheck className="w-4 h-4" />
            Open OAuth2 / Login Studio
          </button>
        </div>
      )}
    </header>
  );
}
