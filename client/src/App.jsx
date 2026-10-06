import React, { useState, useEffect } from 'react';
import Navbar, { NAV_ITEMS_BY_ROLE } from './components/Navbar.jsx';
import LoginOAuthModal from './components/LoginOAuthModal.jsx';
import StockFinderView from './components/StockFinderView.jsx';
import PrescriptionsView from './components/PrescriptionsView.jsx';
import InventoryManagerView from './components/InventoryManagerView.jsx';
import AiClinicalAssistant from './components/AiClinicalAssistant.jsx';
import NotificationsView from './components/NotificationsView.jsx';
import RabbitMqConsoleView from './components/RabbitMqConsoleView.jsx';
import SystemArchitectureView from './components/SystemArchitectureView.jsx';
import ToastContainer from './components/ToastContainer.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function App() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('stock');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const currentRole = user?.role || 'PATIENT';

  // Automatically redirect to 'stock' if the user switches to a role that cannot access the current tab
  useEffect(() => {
    const tabConfig = NAV_ITEMS_BY_ROLE.find((item) => item.id === activeTab);
    if (tabConfig && !tabConfig.allowedRoles.includes(currentRole)) {
      setActiveTab('stock');
    }
  }, [currentRole, activeTab]);

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
            Initializing MediBridge Hybrid Persistence &amp; OAuth2 Session...
          </div>
        ) : (
          <>
            {activeTab === 'stock' && <StockFinderView />}
            {activeTab === 'prescriptions' && <PrescriptionsView />}
            {activeTab === 'inventory' && ['PHARMACIST', 'ADMIN'].includes(currentRole) && (
              <InventoryManagerView />
            )}
            {activeTab === 'ai' && <AiClinicalAssistant />}
            {activeTab === 'notifications' && <NotificationsView />}
            {activeTab === 'broker' && currentRole === 'ADMIN' && (
              <RabbitMqConsoleView />
            )}
            {activeTab === 'architecture' && currentRole === 'ADMIN' && (
              <SystemArchitectureView />
            )}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-4 px-4 text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>MediBridge Rwanda</strong> — Right Medicine, Right Pharmacy, Right Now.
          </div>
          <a
            href="https://github.com/nshh123"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-500 hover:text-teal-600 font-semibold transition"
          >
            Copyright @nshh123
          </a>
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
