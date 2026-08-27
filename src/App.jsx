import React, { useState } from 'react';
import { ExpenseProvider, useExpense } from './context/ExpenseContext';
import { PasscodeModal } from './components/PasscodeModal';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { AccountsBar } from './components/AccountsBar';
import { DebtTracker } from './components/DebtTracker';
import { QuickAiBar } from './components/QuickAiBar';
import { TransactionModal } from './components/TransactionModal';
import { TransactionList } from './components/TransactionList';
import { BudgetCategoryManager } from './components/BudgetCategoryManager';
import { BudgetReport } from './components/BudgetReport';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SubscriptionsTracker } from './components/SubscriptionsTracker';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AiChatbotModal } from './components/AiChatbotModal';
import { LogViewer } from './components/LogViewer';
import { WifiOff } from 'lucide-react';

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);
  const { isOffline } = useExpense();

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
            <QuickAiBar onOpenManualAdd={() => setIsManualModalOpen(true)} />
            <SummaryCards />
            <DebtTracker />
            <AccountsBar />
            <AnalyticsDashboard />
            <TransactionList showNotes={false} />
          </div>
        )}

        {/* TAB 2: TRANSACTIONS (History) */}
        {activeTab === 'transactions' && (
          <div className="animate-fade-in">
            <QuickAiBar onOpenManualAdd={() => setIsManualModalOpen(true)} />
            <TransactionList showNotes={true} />
          </div>
        )}

        {/* TAB 3: BUDGETS & CATEGORIES */}
        {activeTab === 'budgets' && (
          <div className="animate-fade-in">
            <BudgetReport />
            <BudgetCategoryManager />
          </div>
        )}

        {/* TAB 4: RECURRING BILLS */}
        {activeTab === 'subscriptions' && (
          <div className="animate-fade-in">
            <SubscriptionsTracker />
          </div>
        )}
      </main>

      <TransactionModal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} />
      <ApiKeyModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} onOpenLogs={() => { setIsSettingsOpen(false); setIsLogViewerOpen(true); }} />
      <AiChatbotModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <LogViewer isOpen={isLogViewerOpen} onClose={() => setIsLogViewerOpen(false)} />
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
