import React, { useState } from 'react';
import { ExpenseProvider } from './context/ExpenseContext';
import { PasscodeModal } from './components/PasscodeModal';
import { Navbar } from './components/Navbar';
import { SummaryCards } from './components/SummaryCards';
import { AccountsBar } from './components/AccountsBar';
import { QuickAiBar } from './components/QuickAiBar';
import { TransactionModal } from './components/TransactionModal';
import { TransactionList } from './components/TransactionList';
import { BudgetCategoryManager } from './components/BudgetCategoryManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SubscriptionsTracker } from './components/SubscriptionsTracker';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AiChatbotModal } from './components/AiChatbotModal';

function MainApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Vault Passcode Lock Screen */}
      <PasscodeModal />

      {/* Top Navbar & Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenChat={() => setIsChatOpen(true)}
      />

      <main className="app-container">
        {/* Quick Natural Language & Receipt Scanner Bar */}
        <QuickAiBar onOpenManualAdd={() => setIsManualModalOpen(true)} />

        {/* Global Summary Cards */}
        <SummaryCards />

        {/* Active Tab View Rendering */}
        {activeTab === 'dashboard' && (
          <>
            <AccountsBar />
            <AnalyticsDashboard />
            <TransactionList />
          </>
        )}

        {activeTab === 'transactions' && (
          <TransactionList />
        )}

        {activeTab === 'budgets' && (
          <BudgetCategoryManager />
        )}

        {activeTab === 'subscriptions' && (
          <SubscriptionsTracker />
        )}
      </main>

      {/* Modals */}
      <TransactionModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
      />

      <ApiKeyModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AiChatbotModal
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />
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
