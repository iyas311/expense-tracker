import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Landmark, CreditCard, Wallet, PiggyBank, Plus, X } from 'lucide-react';

export function AccountsBar() {
  const { accounts, currency, addAccount } = useExpense();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');
  const [color, setColor] = useState('#06b6d4');

  const getAccountIcon = (type) => {
    switch (type) {
      case 'card': return CreditCard;
      case 'cash': return Wallet;
      case 'savings': return PiggyBank;
      default: return Landmark;
    }
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    addAccount({ name, type, balance: parseFloat(balance) || 0, color });
    setName('');
    setBalance('');
    setShowAddModal(false);
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 className="font-heading" style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
          Payment Accounts & Wallets
        </h3>
        <button
          className="btn-secondary"
          onClick={() => setShowAddModal(true)}
          style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '10px' }}
        >
          <Plus size={14} /> Add Account
        </button>
      </div>

      {/* Accounts Horizontal Scroll Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
      }}>
        {accounts.map((acc) => {
          const Icon = getAccountIcon(acc.type);
          const isNegative = acc.balance < 0;
          return (
            <div
              key={acc.id}
              className="glass-card"
              style={{
                padding: '16px',
                borderRadius: '16px',
                borderLeft: `4px solid ${acc.color || '#6366f1'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--text-muted)' }}>{acc.name}</span>
                <Icon size={18} color={acc.color || '#6366f1'} />
              </div>
              <div className="font-heading" style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: isNegative ? 'var(--accent-rose)' : 'var(--text-main)'
              }}>
                {isNegative ? '-' : ''}{currency}{Math.abs(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'capitalize', marginTop: '4px' }}>
                {acc.type} account
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">Add Payment Account</h3>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Account Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chase Sapphire / Cash Wallet"
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Account Type</label>
                <select
                  className="glass-input"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="bank" style={{ background: '#0f172a' }}>Bank Account</option>
                  <option value="card" style={{ background: '#0f172a' }}>Credit Card</option>
                  <option value="cash" style={{ background: '#0f172a' }}>Cash Wallet</option>
                  <option value="savings" style={{ background: '#0f172a' }}>Savings / Investment</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Initial Balance</label>
                <input
                  type="number"
                  step="0.01"
                  className="glass-input"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00 (use negative for card debt)"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Theme Badge Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#6366f1', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'].map(c => (
                    <div
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        border: color === c ? '2px solid #ffffff' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-gradient" style={{ width: '100%' }}>
                Add Account
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
