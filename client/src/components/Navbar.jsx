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
  X,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const ROLE_BADGE_STYLES = {
  PATIENT: 'bg-teal-500/20 text-teal-200 border-teal-400/40',
  DOCTOR: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
  PHARMACIST: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  ADMIN: 'bg-purple-500/20 text-purple-200 border-purple-400/40'
};

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal }) {
  const { user, authMechanism, demoAccounts, loginWithOAuth2Flow, loginWithPassword } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const navItems = [
    { id: 'stock', label: 'Live Stock Finder', icon: Pill, badge: 'SQL + Cache' },
    { id: 'prescriptions', label: 'E-Prescriptions', icon: FileCheck2, badge: 'MongoDB' },
    { id: 'inventory', label: 'Pharmacy Inventory', icon: PackageCheck, badge: 'Pharmacist' },
    { id: 'ai', label: 'AI Clinical Triage', icon: BrainCircuit, badge: 'Bonus AI' },
    { id: 'broker', label: 'RabbitMQ Broker', icon: Radio, badge: 'SMS/Email' },
    { id: 'architecture', label: 'Hybrid DB & RBAC', icon: Database, badge: 'SDLC & QA' }
  ];

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
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg border-b border-slate-800">
      {/* Top RBAC & OAuth2 Inspector Strip */}
      <div className="bg-slate-950/90 border-b border-slate-800/80 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-300">
            <span className="inline-flex items-center gap-1 text-teal-400 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              RBAC & OAuth2 Live Session:
            </span>
            {user && (
              <>
                <span className="font-medium text-white">{user.fullName}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${ROLE_BADGE_STYLES[user.role] || ''}`}>
                  {user.role}
                </span>
                <span className="hidden md:inline-flex items-center gap-1 text-slate-400 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  <KeyRound className="w-3 h-3 text-amber-400" />
                  {authMechanism}
                </span>
              </>
            )}
          </div>

          {/* 1-Click Role Switcher for Grading / Demonstration */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 hidden sm:inline">1-Click Role Switch:</span>
            {demoAccounts.slice(0, 4).map((acc) => {
              const isActive = user?.email === acc.email;
              return (
                <button
                  key={acc.id}
                  disabled={switchingRole}
                  onClick={() => handleQuickRoleSwitch(acc)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-teal-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                  title={`Switch to ${acc.full_name} (${acc.role_name})`}
                >
                  {acc.role_name}
                </button>
              );
            })}
            <button
              onClick={onOpenAuthModal}
              className="ml-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
            >
              <UserCheck className="w-3 h-3" />
              OAuth2 / Login Studio
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div
          onClick={() => setActiveTab('stock')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-105 transition">
            <Pill className="w-5 h-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight text-white">
                MediBridge
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                Rwanda Health Network
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Smart E-Prescription, Live Pharmacy Stock & Expiry Alert Platform
            </p>
          </div>
        </div>

        {/* Desktop Navigation Pills */}
        <nav className="hidden lg:flex items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${
                  active
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    active
                      ? 'bg-slate-950/20 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-900 border-t border-slate-800 px-4 py-3 space-y-1.5">
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
                className={`w-full px-3 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-between transition ${
                  active
                    ? 'bg-teal-500 text-slate-950'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4" />
                  {item.label}
                </span>
                <span className="text-xs font-mono opacity-80">{item.badge}</span>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
}
