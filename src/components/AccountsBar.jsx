import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Landmark, CreditCard, Wallet, PiggyBank, Plus, X } from 'lucide-react';

export function AccountsBar() {
  const { accounts, currency, addAccount } = useExpense();
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
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
    addAccount({
      name,
      type,
      balance: parseFloat(balance) || 0,
      creditLimit: parseFloat(creditLimit) || 0,
      color
    });
    setName('');
    setBalance('');
    setCreditLimit('');
    setShowAddModal(false);
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h3 className="font-heading" style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
            Payment Accounts & Credit Cards
          </h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Track cash, bank balances, and available credit card limits
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={() => setShowAddModal(true)}
          style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '10px' }}
        >
          <Plus size={14} /> Add Account
        </button>
      </div>

      {/* Accounts Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '12px'
      }}>
        {accounts.map((acc) => {
          const Icon = getAccountIcon(acc.type);
          const isCard = acc.type === 'card';
          const isNegative = acc.balance < 0;

          const limit = parseFloat(acc.creditLimit) || 0;
          const usedDebt = Math.abs(acc.balance);
          const availableCredit = limit > 0 ? Math.max(0, limit - usedDebt) : 0;
          const usedPercent = limit > 0 ? Math.min(100, Math.round((usedDebt / limit) * 100)) : 0;

          return (
            <div
              key={acc.id}
              className="glass-card"
              style={{
                padding: '16px 18px',
                borderRadius: '16px',
                borderLeft: `4px solid ${acc.color || '#6366f1'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>{acc.name}</span>
                <Icon size={18} color={acc.color || '#6366f1'} />
              </div>

              {/* Balance Amount */}
              <div className="font-heading" style={{
                fontSize: '1.3rem',
                fontWeight: '800',
                color: isNegative ? 'var(--accent-rose)' : 'var(--text-main)'
              }}>
                {isNegative ? '-' : ''}{currency}{Math.abs(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>

              {/* Credit Card Specific Credit Limit Info */}
              {isCard && limit > 0 ? (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Avail: <strong style={{ color: '#10b981' }}>{currency}{availableCredit.toLocaleString()}</strong></span>
                    <span style={{ color: 'var(--text-dim)' }}>Limit: {currency}{limit.toLocaleString()}</span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${usedPercent}%`,
                      height: '100%',
                      background: usedPercent > 80 ? '#f43f5e' : '#06b6d4'
                    }} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'capitalize', marginTop: '4px' }}>
                  {acc.type} account
                </div>
              )}
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
                  placeholder="e.g. Amazon Pay Card / HDFC Bank"
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
                  <option value="savings" style={{ background: '#0f172a' }}>Savings Account</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Initial Balance / Debt</label>
                <input
                  type="number"
                  step="0.01"
                  className="glass-input"
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00 (use negative for card debt)"
                />
              </div>

              {type === 'card' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: '#06b6d4' }}>
                    Credit Card Total Limit ({currency})
                  </label>
                  <input
                    type="number"
                    className="glass-input"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit(e.target.value)}
                    placeholder="e.g. 100000"
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Badge Theme Color</label>
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
