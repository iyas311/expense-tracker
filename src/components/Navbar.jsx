import React from 'react';
import { useExpense } from '../context/ExpenseContext';
import {
  Sparkles,
  Lock,
  Settings,
  Download,
  Bot,
  LayoutDashboard,
  Receipt,
  PieChart,
  Repeat,
  RefreshCw
} from 'lucide-react';

export function Navbar({ onOpenSettings, onOpenChat, activeTab, setActiveTab }) {
  const { logout, currency, netWorth, totalIncome, totalExpenses, exportData, isSyncing, refreshCloudData, currentVault } = useExpense();

  return (
    <>
      {/* Top Navbar */}
      <header style={{
        background: 'rgba(15, 22, 41, 0.85)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border-light)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div className="app-container" style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          
          {/* Logo & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
            }}>
              <Sparkles size={24} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 className="font-heading" style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
                  EXPENSIA <span className="text-gradient-cyan">AI</span>
                </h1>
                {currentVault && (
                  <span className="badge" style={{
                    background: currentVault.isAdmin ? 'rgba(6, 182, 212, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: currentVault.isAdmin ? '#06b6d4' : '#10b981',
                    fontSize: '0.68rem',
                    border: `1px solid ${currentVault.isAdmin ? 'rgba(6, 182, 212, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                  }}>
                    {currentVault.name}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                Smart Personal Expense Tracker
              </p>
            </div>
          </div>

          {/* Desktop Nav Items */}
          <div className="desktop-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {[
              { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
              { id: 'transactions', label: 'Transactions', icon: Receipt },
              { id: 'budgets', label: 'Budgets & Categories', icon: PieChart },
              { id: 'subscriptions', label: 'Recurring Bills', icon: Repeat }
            ].map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={isActive ? 'btn-cyan' : 'btn-secondary'}
                  style={{ fontSize: '0.85rem', padding: '8px 14px', borderRadius: '12px' }}
                >
                  <Icon size={16} /> {item.label}
                </button>
              );
            })}
          </div>

          {/* Header Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* AI Assistant Button */}
            <button
              onClick={onOpenChat}
              className="btn-gradient"
              style={{
                padding: '9px 15px',
                fontSize: '0.85rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)'
              }}
            >
              <Bot size={18} />
              <span className="hide-mobile">AI Assistant</span>
            </button>

            {/* Refresh / Sync Cloud DB */}
            <button
              onClick={refreshCloudData}
              className="btn-secondary"
              title="Sync Fresh Cloud DB Data"
              style={{ padding: '9px', borderRadius: '12px' }}
            >
              <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} color={isSyncing ? '#06b6d4' : 'currentColor'} />
            </button>

            {/* Export Data */}
            <button
              onClick={exportData}
              className="btn-secondary"
              title="Export CSV Spreadsheet"
              style={{ padding: '9px', borderRadius: '12px' }}
            >
              <Download size={18} />
            </button>

            {/* Settings Modal */}
            <button
              onClick={onOpenSettings}
              className="btn-secondary"
              title="AI & App Settings"
              style={{ padding: '9px', borderRadius: '12px' }}
            >
              <Settings size={18} />
            </button>

            {/* Lock App */}
            <button
              onClick={logout}
              className="btn-secondary"
              title="Lock App Vault"
              style={{ padding: '9px', borderRadius: '12px', color: 'var(--accent-rose)' }}
            >
              <Lock size={18} />
            </button>
          </div>

        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(15, 22, 41, 0.95)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'around',
        alignItems: 'center',
        padding: '10px 0',
        zIndex: 99
      }} className="mobile-nav">
        {[
          { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
          { id: 'transactions', label: 'History', icon: Receipt },
          { id: 'budgets', label: 'Budgets', icon: PieChart },
          { id: 'subscriptions', label: 'Bills', icon: Repeat }
        ].map(item => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                background: 'none',
                border: 'none',
                color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                fontWeight: isActive ? '700' : '500',
                cursor: 'pointer',
                flex: 1
              }}
            >
              <Icon size={20} color={isActive ? '#06b6d4' : '#94a3b8'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hide-mobile { display: none !important; }
          .mobile-nav { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
