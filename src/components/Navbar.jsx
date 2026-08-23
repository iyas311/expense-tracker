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
        zIndex: 100,
        paddingTop: 'env(safe-area-inset-top, 0px)'
      }}>
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '1280px', margin: '0 auto' }}>
          
          {/* Logo & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <div className="brand-logo-container" style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)',
              flexShrink: 0
            }}>
              <Sparkles size={24} color="#ffffff" />
            </div>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h1 className="font-heading brand-title" style={{ fontSize: '1.25rem', fontWeight: '800', letterSpacing: '-0.5px' }}>
                  EXPENSIA <span className="text-gradient-cyan">AI</span>
                </h1>
                {currentVault && (
                  <span className="badge" style={{
                    background: currentVault.isAdmin ? 'rgba(6, 182, 212, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: currentVault.isAdmin ? '#06b6d4' : '#10b981',
                    fontSize: '0.68rem',
                    border: `1px solid ${currentVault.isAdmin ? 'rgba(6, 182, 212, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    whiteSpace: 'nowrap'
                  }}>
                    {currentVault.name}
                  </span>
                )}
              </div>
              <p className="hide-mobile" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '500' }}>
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
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* AI Assistant Button */}
            <button
              onClick={onOpenChat}
              className="btn-gradient ai-btn"
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
              className="btn-secondary hide-mobile"
              title="Sync Fresh Cloud DB Data"
              style={{ padding: '9px', borderRadius: '12px' }}
            >
              <RefreshCw size={18} className={isSyncing ? 'animate-spin' : ''} color={isSyncing ? '#06b6d4' : 'currentColor'} />
            </button>

            {/* Export Data */}
            <button
              onClick={exportData}
              className="btn-secondary hide-mobile"
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
        paddingTop: '10px',
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
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
          
          /* Prevent header congestion */
          .brand-logo-container { width: 32px !important; height: 32px !important; border-radius: 10px !important; }
          .brand-logo-container svg { width: 18px !important; height: 18px !important; }
          .brand-title { font-size: 1.1rem !important; }
          .header-actions { gap: 6px !important; flex-shrink: 0; }
          .ai-btn { padding: 9px !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>
    </>
  );
}
