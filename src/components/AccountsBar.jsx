import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Landmark, CreditCard, Wallet, PiggyBank, Plus, X, Edit2, Trash2, CalendarDays, AlertCircle } from 'lucide-react';

export function AccountsBar() {
  const { accounts, currency, addAccount, editAccount, deleteAccount } = useExpense();
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Form State (used for both add and edit)
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [type, setType] = useState('bank');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [color, setColor] = useState('#06b6d4');
  
  // Billing cycle fields
  const [statementDay, setStatementDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [dueMonthOffset, setDueMonthOffset] = useState('1');

  const getAccountIcon = (type) => {
    switch (type) {
      case 'card': return CreditCard;
      case 'cash': return Wallet;
      case 'savings': return PiggyBank;
      default: return Landmark;
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setType('bank');
    setBalance('');
    setCreditLimit('');
    setColor('#06b6d4');
    setStatementDay('');
    setDueDay('');
    setDueMonthOffset('1');
    setShowAddModal(true);
  };

  const openEdit = (acc) => {
    setEditingId(acc.id);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.initialBalance || 0);
    setCreditLimit(acc.creditLimit || 0);
    setColor(acc.color || '#06b6d4');
    setStatementDay(acc.statementDay || '');
    setDueDay(acc.dueDay || '');
    setDueMonthOffset(acc.dueMonthOffset !== undefined ? String(acc.dueMonthOffset) : '1');
    setShowAddModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this account? Transactions associated with it will lose their account link.")) {
      deleteAccount(id);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const payload = {
      name,
      type,
      balance: parseFloat(balance) || 0,
      initialBalance: parseFloat(balance) || 0,
      creditLimit: parseFloat(creditLimit) || 0,
      color,
      statementDay: statementDay ? parseInt(statementDay) : null,
      dueDay: dueDay ? parseInt(dueDay) : null,
      dueMonthOffset: parseInt(dueMonthOffset) || 1
    };

    if (editingId) {
      editAccount(editingId, payload);
    } else {
      addAccount(payload);
    }
    setShowAddModal(false);
  };

  const sortedAccounts = [...accounts].sort((a, b) => {
    if (a.type === 'card' && b.type !== 'card') return 1;
    if (a.type !== 'card' && b.type === 'card') return -1;
    return 0;
  });

  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="section-header">
        <div className="section-title">
          <h3 className="font-heading">Payment Accounts & Credit Cards</h3>
          <p>Track cash, bank balances, and available credit card limits</p>
        </div>
        <button
          className="btn-secondary"
          onClick={openAdd}
          style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '10px' }}
        >
          <Plus size={14} /> Add Account
        </button>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px'
      }}>
        {sortedAccounts.map((acc) => {
          const Icon = getAccountIcon(acc.type);
          const isCard = acc.type === 'card';
          const isNegative = acc.balance < 0;

          const limit = parseFloat(acc.creditLimit) || 0;
          const usedDebt = Math.abs(acc.balance);
          const availableCredit = limit > 0 ? Math.max(0, limit - usedDebt) : 0;
          const usedPercent = limit > 0 ? Math.min(100, Math.round((usedDebt / limit) * 100)) : 0;

          return (
            <div key={acc.id} className="glass-card" style={{ borderRadius: '16px', borderLeft: `4px solid ${acc.color || '#6366f1'}`, position: 'relative' }}>
              
              <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '4px' }}>
                <button onClick={() => openEdit(acc)} className="btn-secondary" style={{ padding: '4px', borderRadius: '6px' }}><Edit2 size={12} /></button>
                <button onClick={() => handleDelete(acc.id)} className="btn-secondary" style={{ padding: '4px', borderRadius: '6px' }}><Trash2 size={12} color="#f43f5e" /></button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', paddingRight: '50px' }}>
                <Icon size={18} color={acc.color || '#6366f1'} />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)' }}>{acc.name}</span>
              </div>

              <div className="font-heading" style={{ fontSize: '1.3rem', fontWeight: '800', color: isNegative ? 'var(--accent-rose)' : 'var(--text-main)' }}>
                {isNegative ? '-' : ''}{currency}{Math.abs(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>

              {isCard && limit > 0 ? (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>Avail: <strong style={{ color: '#10b981' }}>{currency}{availableCredit.toLocaleString()}</strong></span>
                    <span style={{ color: 'var(--text-dim)' }}>Limit: {currency}{limit.toLocaleString()} <span style={{ color: usedPercent > 80 ? '#f43f5e' : 'var(--text-dim)', fontWeight: 'bold' }}>({usedPercent}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                    <div style={{ width: `${usedPercent}%`, height: '100%', background: usedPercent > 80 ? '#f43f5e' : '#06b6d4' }} />
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

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">{editingId ? 'Edit Account' : 'Add Payment Account'}</h3>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Account Name</label>
                <input type="text" className="glass-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amazon Pay Card / HDFC Bank" required />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Account Type</label>
                <select className="glass-input" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="bank" style={{ background: '#0f172a' }}>Bank Account</option>
                  <option value="card" style={{ background: '#0f172a' }}>Credit Card</option>
                  <option value="cash" style={{ background: '#0f172a' }}>Cash Wallet</option>
                  <option value="savings" style={{ background: '#0f172a' }}>Savings Account</option>
                </select>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>{editingId ? 'Base / Initial Balance' : 'Initial Balance / Debt'}</label>
                <input type="number" step="0.01" className="glass-input" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00 (use negative for card debt)" />
                {editingId && <div style={{ fontSize: '0.7rem', color: '#f59e0b', marginTop: '4px' }}>Note: Changing this shifts your total running balance.</div>}
              </div>

              {type === 'card' && (
                <>
                  <div style={{ marginBottom: '14px' }}>
                    <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: '#06b6d4' }}>Credit Card Total Limit ({currency})</label>
                    <input type="number" className="glass-input" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="e.g. 100000" />
                  </div>
                  
                  <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px', marginBottom: '14px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)' }}>
                      <CalendarDays size={14} /> Billing Cycle (Optional)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'block' }}>Statement Date (1-31)</label>
                        <input type="number" min="1" max="31" className="glass-input" value={statementDay} onChange={e => setStatementDay(e.target.value)} placeholder="e.g. 15" />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'block' }}>Payment Due Date (1-31)</label>
                        <input type="number" min="1" max="31" className="glass-input" value={dueDay} onChange={e => setDueDay(e.target.value)} placeholder="e.g. 5" />
                      </div>
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '4px', display: 'block' }}>Due in which month?</label>
                      <select className="glass-input" value={dueMonthOffset} onChange={e => setDueMonthOffset(e.target.value)}>
                        <option value="0" style={{ background: '#0f172a' }}>Same month as statement</option>
                        <option value="1" style={{ background: '#0f172a' }}>Next month (e.g. Stmt 15th, Due 5th next mo)</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Badge Theme Color</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {['#6366f1', '#06b6d4', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6'].map(c => (
                    <div key={c} onClick={() => setColor(c)} style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, cursor: 'pointer', border: color === c ? '2px solid #ffffff' : 'none' }} />
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-gradient" style={{ width: '100%' }}>
                {editingId ? 'Save Changes' : 'Add Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
