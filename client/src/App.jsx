import React, { useState } from 'react';
import Navbar from './components/Navbar.jsx';
import LoginOAuthModal from './components/LoginOAuthModal.jsx';
import StockFinderView from './components/StockFinderView.jsx';
import PrescriptionsView from './components/PrescriptionsView.jsx';
import InventoryManagerView from './components/InventoryManagerView.jsx';
import AiClinicalAssistant from './components/AiClinicalAssistant.jsx';
import RabbitMqConsoleView from './components/RabbitMqConsoleView.jsx';
import SystemArchitectureView from './components/SystemArchitectureView.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState('stock');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {loading ? (
          <div className="p-16 text-center text-slate-500 font-medium">
            Initializing MediBridge Hybrid Persistence & OAuth2 Session...
          </div>
        ) : (
          <>
            {activeTab === 'stock' && <StockFinderView />}
            {activeTab === 'prescriptions' && <PrescriptionsView />}
            {activeTab === 'inventory' && <InventoryManagerView />}
            {activeTab === 'ai' && <AiClinicalAssistant />}
            {activeTab === 'broker' && <RabbitMqConsoleView />}
            {activeTab === 'architecture' && <SystemArchitectureView />}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>MediBridge Rwanda</strong> — Web Technology Final Project (2026-2027) • Instructor: Jeremie U. Tuyisenge
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Stack: React + Node/Express + PostgreSQL/SQLite + MongoDB + RabbitMQ + OAuth2 + RBAC
          </div>
        </div>
      </footer>

      <LoginOAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
      <ToastContainer />
    </div>
  );
}
