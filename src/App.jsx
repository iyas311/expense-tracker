import React, { useState, Suspense, lazy } from 'react';
import { ExpenseProvider, useExpense } from './context/ExpenseContext';
import { PasscodeModal } from './components/PasscodeModal';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { AccountsBar } from './components/AccountsBar';
import { QuickAiBar } from './components/QuickAiBar';
import { TransactionModal } from './components/TransactionModal';
import { TransactionList } from './components/TransactionList';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WifiOff, RotateCcw } from 'lucide-react';

// Resilient lazy import that auto-refreshes if new build hashes change on deployment
function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      return await importer();
    } catch (err) {
      const msg = err?.message || '';
      if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
        const reloaded = sessionStorage.getItem('et_chunk_auto_reloaded');
        if (!reloaded) {
          sessionStorage.setItem('et_chunk_auto_reloaded', 'true');
          window.location.reload();
          return new Promise(() => {}); // pause until page reloads
        }
      }
      throw err;
    }
  });
}

// Lazy loaded secondary components & modals (reduces initial bundle size)
const AnalyticsDashboard = lazyWithRetry(() => import('./components/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
const DebtTracker = lazyWithRetry(() => import('./components/DebtTracker').then(m => ({ default: m.DebtTracker })));
const BudgetCategoryManager = lazyWithRetry(() => import('./components/BudgetCategoryManager').then(m => ({ default: m.BudgetCategoryManager })));
const BudgetReport = lazyWithRetry(() => import('./components/BudgetReport').then(m => ({ default: m.BudgetReport })));
const AdminDashboard = lazyWithRetry(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const SubscriptionsTracker = lazyWithRetry(() => import('./components/SubscriptionsTracker').then(m => ({ default: m.SubscriptionsTracker })));
const ApiKeyModal = lazyWithRetry(() => import('./components/ApiKeyModal').then(m => ({ default: m.ApiKeyModal })));
const AiChatbotModal = lazyWithRetry(() => import('./components/AiChatbotModal').then(m => ({ default: m.AiChatbotModal })));
const LogViewer = lazyWithRetry(() => import('./components/LogViewer').then(m => ({ default: m.LogViewer })));

const LoadingFallback = () => (
  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
    <div style={{
      width: '24px',
      height: '24px',
      margin: '0 auto 8px',
      border: '2px solid rgba(6, 182, 212, 0.2)',
      borderTopColor: '#06b6d4',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    Loading...
  </div>
);

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const { isOffline, currentVault, deletedTxUndo, undoDeleteTransaction, currency } = useExpense();

  return (
    <div className="app-layout">
      <PasscodeModal />

      {/* Offline Banner */}
      {isOffline && (
        <div style={{ background: 'rgba(245,158,11,0.15)', border: 'none', borderBottom: '1px solid rgba(245,158,11,0.35)', padding: '8px 16px', textAlign: 'center', fontSize: '0.8rem', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <WifiOff size={14} /> Running in offline mode — changes saved locally only.
        </div>
      )}

      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
      />

      <main className="app-container" style={{ paddingBottom: '90px' }}>
        {/* TAB 1: DASHBOARD (Home) */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <ErrorBoundary fallbackTitle="Quick Entry issue">
              <QuickAiBar onOpenManualAdd={() => setIsManualModalOpen(true)} />
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Summary cards issue">
              <SummaryCards />
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Accounts overview issue">
              <AccountsBar />
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Analytics charts issue">
              <Suspense fallback={<LoadingFallback />}>
                <AnalyticsDashboard />
              </Suspense>
            </ErrorBoundary>

            <ErrorBoundary fallbackTitle="Transactions list issue">
              <TransactionList showNotes={false} />
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 2: TRANSACTIONS (History) */}
        {activeTab === 'transactions' && (
          <div className="animate-fade-in">
            <ErrorBoundary fallbackTitle="Quick Entry issue">
              <QuickAiBar onOpenManualAdd={() => setIsManualModalOpen(true)} />
            </ErrorBoundary>
            <ErrorBoundary fallbackTitle="Transactions list issue">
              <TransactionList showNotes={true} />
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 3: BUDGETS & CATEGORIES */}
        {activeTab === 'budgets' && (
          <div className="animate-fade-in">
            <ErrorBoundary fallbackTitle="Budgets section issue">
              <Suspense fallback={<LoadingFallback />}>
                <BudgetReport />
                <BudgetCategoryManager />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 4: RECURRING BILLS */}
        {activeTab === 'subscriptions' && (
          <div className="animate-fade-in">
            <ErrorBoundary fallbackTitle="Debts & Subscriptions issue">
              <Suspense fallback={<LoadingFallback />}>
                <DebtTracker />
                <SubscriptionsTracker />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}

        {/* TAB 5: ADMIN DASHBOARD */}
        {activeTab === 'admin' && currentVault?.isAdmin && (
          <div className="animate-fade-in">
            <ErrorBoundary fallbackTitle="Admin dashboard issue">
              <Suspense fallback={<LoadingFallback />}>
                <AdminDashboard />
              </Suspense>
            </ErrorBoundary>
          </div>
        )}
      </main>

      <TransactionModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} />
      
      <Suspense fallback={null}>
        {isSettingsOpen && (
          <ApiKeyModal 
            isOpen={isSettingsOpen} 
            onClose={() => setIsSettingsOpen(false)} 
            onOpenLogs={() => { setIsSettingsOpen(false); setIsLogViewerOpen(true); }} 
            onOpenAdmin={() => { setIsSettingsOpen(false); setActiveTab('admin'); }} 
          />
        )}
        {isChatOpen && (
          <AiChatbotModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
        )}
        {isLogViewerOpen && (
          <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
        )}
      </Suspense>

      {/* Floating 5-Second Deletion Undo Snackbar */}
      {deletedTxUndo && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(59, 130, 246, 0.5)',
          borderRadius: '14px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          zIndex: 99999,
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(12px)'
        }}>
          <span style={{ fontSize: '0.82rem', color: '#fff' }}>
            Deleted: <strong>{deletedTxUndo.description || 'Transaction'}</strong> ({currency}{deletedTxUndo.amount})
          </span>
          <button
            type="button"
            onClick={undoDeleteTransaction}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              padding: '5px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '0.78rem'
            }}
          >
            <RotateCcw size={13} /> Undo
          </button>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ExpenseProvider>
      <MainApp />
    </ExpenseProvider>
  );
}
