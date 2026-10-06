import React, { useState } from 'react';
import {
  Pill,
  FileCheck2,
  PackageCheck,
  BrainCircuit,
  Bell,
  Radio,
  Database,
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

export const NAV_ITEMS_BY_ROLE = [
  {
    id: 'stock',
    label: 'Stock Finder',
    icon: Pill,
    allowedRoles: ['PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN']
  },
  {
    id: 'prescriptions',
    label: 'E-Prescriptions',
    icon: FileCheck2,
    allowedRoles: ['PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN']
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: PackageCheck,
    allowedRoles: ['PHARMACIST', 'ADMIN']
  },
  {
    id: 'ai',
    label: 'AI Triage',
    icon: BrainCircuit,
    allowedRoles: ['PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN']
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    allowedRoles: ['PATIENT', 'DOCTOR', 'PHARMACIST', 'ADMIN']
  },
  {
    id: 'broker',
    label: 'RabbitMQ',
    icon: Radio,
    allowedRoles: ['ADMIN']
  },
  {
    id: 'architecture',
    label: 'Hybrid DB & RBAC',
    icon: Database,
    allowedRoles: ['ADMIN']
  }
];

export default function Navbar({ activeTab, setActiveTab, onOpenAuthModal }) {
  const { user, demoAccounts, loginWithOAuth2Flow, loginWithPassword } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [switchingRole, setSwitchingRole] = useState(false);

  const currentRole = user?.role || 'PATIENT';
  const visibleNavItems = NAV_ITEMS_BY_ROLE.filter((item) =>
    item.allowedRoles.includes(currentRole)
  );

  // Pick 1 representative demo account per unique RBAC role
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

  const shortUserName = user?.fullName
    ? user.fullName.split('(')[0].split(',')[0].trim()
    : '';

  return (
    <header className="sticky top-0 z-40 w-full overflow-x-hidden bg-slate-950/95 backdrop-blur-md text-white shadow-lg border-b border-slate-800/80">
      {/* Row 1: Brand Identity (Left) + Segmented Navigation Pills (Right) */}
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <div
          onClick={() => setActiveTab('stock')}
          className="flex items-center gap-2.5 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center shadow-md shadow-teal-500/20 group-hover:scale-105 transition">
            <Pill className="w-4 h-4 text-slate-950 stroke-[2.5]" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-tight text-white">
                MediBridge
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                RW
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block whitespace-nowrap">
              Smart Pharmacy Network
            </p>
          </div>
        </div>

        {/* Desktop Segmented Navigation Pills */}
        <nav className="hidden lg:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800/90 gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
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

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 hover:bg-slate-800"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Row 2: Active User Session (Left) + Quick RBAC Switch & OAuth2 Studio (Right) */}
      <div className="bg-slate-900/75 border-t border-slate-800/70 px-4 py-1.5 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          {/* Left: Current Active User Badge */}
          <div className="flex items-center gap-2">
            {user && (
              <div
                className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 px-2.5 py-0.5 rounded-lg"
                title={user.fullName}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                  {shortUserName}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border whitespace-nowrap ${
                    ROLE_BADGE_STYLES[user.role] || ''
                  }`}
                >
                  {user.role}
                </span>
              </div>
            )}
          </div>

          {/* Right: 4-Role Switcher + OAuth2 Studio Button */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px] font-medium hidden sm:inline">
              Quick RBAC Switch:
            </span>
            {uniqueRoleAccounts.map((acc) => {
              const isActive = user?.role === acc.role_name;
              return (
                <button
                  key={acc.id}
                  disabled={switchingRole}
                  onClick={() => handleQuickRoleSwitch(acc)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition whitespace-nowrap cursor-pointer ${
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

            <button
              onClick={onOpenAuthModal}
              className="ml-1 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition whitespace-nowrap cursor-pointer"
            >
              <UserCheck className="w-3 h-3 shrink-0" />
              <span>OAuth2 Studio</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsive Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-slate-950 border-t border-slate-800 px-4 py-3 space-y-1.5">
          {visibleNavItems.map((item) => {
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
