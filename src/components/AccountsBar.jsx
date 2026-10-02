import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExpense } from '../context/ExpenseContext';
import { Landmark, CreditCard, Wallet, PiggyBank, Plus, X, Edit2, Trash2, CalendarDays, AlertCircle } from 'lucide-react';

export function AccountsBar() {
  const { accounts, currency, addAccount, editAccount, deleteAccount, creditCardLimit, setCreditCardLimit } = useExpense();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitInput, setLimitInput] = useState('');
  
  // Form State (used for both add and edit)
  const [editingId, setEditingId] = useState(null);
  const [originalAcc, setOriginalAcc] = useState(null);
  const [currentComputedBalance, setCurrentComputedBalance] = useState('');

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
    setOriginalAcc(null);
    setName('');
    setType('bank');
    setBalance('');
    setCurrentComputedBalance('');
    setCreditLimit('');
    setColor('#06b6d4');
    setStatementDay('');
    setDueDay('');
    setDueMonthOffset('1');
    setShowAddModal(true);
  };

  const openEdit = (acc) => {
    setEditingId(acc.id);
    setOriginalAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.initialBalance || 0);
    setCurrentComputedBalance(acc.balance || 0);
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
    
    let finalInitialBalance = parseFloat(balance) || 0;
    let finalCurrentBalance = parseFloat(balance) || 0;

    if (editingId && originalAcc) {
      const newCurrentStr = currentComputedBalance.toString();
      if (newCurrentStr.trim() !== '') {
        const newCurrentNum = parseFloat(currentComputedBalance) || 0;
        const delta = newCurrentNum - originalAcc.balance;
        finalInitialBalance = (originalAcc.initialBalance || 0) + delta;
        finalCurrentBalance = newCurrentNum;
      }
    }
    
    const payload = {
      name,
      type,
      balance: finalCurrentBalance,
      initialBalance: finalInitialBalance,
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

  const cardAccounts = accounts.filter(a => a.type === 'card');
  const totalCardSpent = cardAccounts.reduce((sum, a) => sum + (a.balance < 0 ? Math.abs(a.balance) : 0), 0);
  const sumOfCardLimits = cardAccounts.reduce((sum, a) => sum + (parseFloat(a.creditLimit) || 0), 0);
  const effectiveLimit = creditCardLimit > 0 ? creditCardLimit : sumOfCardLimits;
  const percentUsed = effectiveLimit > 0 ? Math.min(100, Math.round((totalCardSpent / effectiveLimit) * 100)) : 0;
  const remainingLimit = effectiveLimit - totalCardSpent;

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

      {/* ─── Total Credit Cards Spent & Limit Bar ─── */}
      {cardAccounts.length > 0 && (
        <div className="glass-card" style={{
          marginBottom: '16px',
          padding: '14px 18px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.88) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.28)'
        }}>
          {/* Top Line: Title + Limit Setting Trigger */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '6px', borderRadius: '8px' }}>
                <CreditCard size={18} color="#818cf8" />
              </div>
              <div>
                <span style={{ fontSize: '0.88rem', fontWeight: '700', color: '#fff' }}>
                  Total Credit Cards Spent
                </span>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginLeft: '6px' }}>
                  ({cardAccounts.length} card{cardAccounts.length > 1 ? 's' : ''})
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Limit: <strong style={{ color: '#fff' }}>{effectiveLimit > 0 ? `${currency}${effectiveLimit.toLocaleString('en-IN')}` : 'Not set'}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setLimitInput(effectiveLimit > 0 ? String(effectiveLimit) : '');
                  setShowLimitModal(true);
                }}
                className="btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '0.72rem',
                  borderRadius: '8px',
                  color: '#818cf8',
                  border: '1px solid rgba(129, 140, 248, 0.3)',
                  background: 'rgba(99, 102, 241, 0.1)'
                }}
              >
                {effectiveLimit > 0 ? 'Edit Limit' : 'Set Limit'}
              </button>
            </div>
          </div>

          {/* Amount & Utilization % */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <span className="font-heading" style={{ fontSize: '1.6rem', fontWeight: '800', color: percentUsed > 80 ? '#f43f5e' : '#818cf8', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {currency}{totalCardSpent.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
              {effectiveLimit > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                  spent of {currency}{effectiveLimit.toLocaleString('en-IN')}
                </span>
              )}
            </div>

            {effectiveLimit > 0 && (
              <span style={{
                fontSize: '0.82rem',
                fontWeight: '700',
                color: percentUsed > 80 ? '#f43f5e' : percentUsed > 60 ? '#f59e0b' : '#10b981'
              }}>
                {percentUsed}% used
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {effectiveLimit > 0 ? (
            <div>
              <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden', marginBottom: '6px' }}>
                <div style={{
                  width: `${Math.min(100, percentUsed)}%`,
                  height: '100%',
                  background: percentUsed > 80 ? '#f43f5e' : percentUsed > 60 ? '#f59e0b' : 'linear-gradient(90deg, #818cf8 0%, #06b6d4 100%)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                <span>
                  Remaining limit: <strong style={{ color: remainingLimit >= 0 ? '#10b981' : '#f43f5e' }}>{currency}{Math.max(0, remainingLimit).toLocaleString('en-IN')}</strong>
                  {remainingLimit < 0 && <span style={{ color: '#f43f5e' }}> (Over by {currency}{Math.abs(remainingLimit).toLocaleString('en-IN')})</span>}
                </span>
                <span style={{ color: percentUsed > 80 ? '#f43f5e' : 'var(--text-dim)' }}>
                  {percentUsed > 80 ? '⚠️ High utilization' : '✓ Normal'}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.74rem', color: 'var(--text-dim)', paddingTop: '2px' }}>
              Click <strong>Set Limit</strong> above to configure your total credit limit and see your progress bar.
            </div>
          )}
        </div>
      )}

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

              {isCard && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {limit > 0 ? (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--text-dim)' }}>Avail: <strong style={{ color: '#10b981' }}>{currency}{availableCredit.toLocaleString()}</strong></span>
                        <span style={{ color: 'var(--text-dim)' }}>Limit: {currency}{limit.toLocaleString()} <span style={{ color: usedPercent > 80 ? '#f43f5e' : 'var(--text-dim)', fontWeight: 'bold' }}>({usedPercent}%)</span></span>
                      </div>
                      <div style={{ width: '100%', height: '5px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden', marginBottom: '6px' }}>
                        <div style={{ width: `${usedPercent}%`, height: '100%', background: usedPercent > 80 ? '#f43f5e' : usedPercent > 60 ? '#f59e0b' : '#06b6d4' }} />
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openEdit(acc)}
                      style={{
                        width: '100%',
                        padding: '4px 8px',
                        fontSize: '0.72rem',
                        color: '#38bdf8',
                        background: 'rgba(6, 182, 212, 0.08)',
                        border: '1px dashed rgba(6, 182, 212, 0.3)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      + Set card limit
                    </button>
                  )}
                </div>
              )}
              {!isCard && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', textTransform: 'capitalize', marginTop: '4px' }}>
                  {acc.type} account
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddModal && createPortal(
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
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>
                  {editingId ? 'Edit Current Balance (Auto-adjusts base)' : 'Initial Balance / Debt'}
                </label>
                <input 
                  type="number" 
                  step="0.01" 
                  className="glass-input" 
                  value={editingId ? currentComputedBalance : balance} 
                  onChange={(e) => {
                    if (editingId) {
                      setCurrentComputedBalance(e.target.value);
                    } else {
                      setBalance(e.target.value);
                    }
                  }} 
                  placeholder="0.00 (use negative for card debt)" 
                />
                {editingId && <div style={{ fontSize: '0.7rem', color: '#10b981', marginTop: '4px' }}>Changing this mathematically shifts your underlying initial balance so everything adds up perfectly.</div>}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>Badge Theme Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: color, fontWeight: '700' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                    {color}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  {[
                    '#8b5cf6', '#a855f7', '#7e22ce', '#6366f1', '#4f46e5', '#3730a3',
                    '#ec4899', '#f43f5e', '#e11d48', '#be123c', '#fb7185', '#f472b6',
                    '#06b6d4', '#0891b2', '#0284c7', '#38bdf8', '#3b82f6', '#2563eb',
                    '#14b8a6', '#0d9488', '#10b981', '#059669', '#22c55e', '#16a34a',
                    '#84cc16', '#eab308', '#f59e0b', '#d97706', '#f97316', '#ea580c',
                    '#b45309', '#9a3412', '#78350f', '#64748b', '#475569', '#71717a'
                  ].map(c => (
                    <div
                      key={c}
                      onClick={() => setColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        border: color === c ? '3px solid #ffffff' : '1.5px solid rgba(255,255,255,0.1)',
                        boxShadow: color === c ? `0 0 12px ${c}` : 'none',
                        transition: 'all 0.15s ease'
                      }}
                    />
                  ))}
                  {/* Custom Hex Color Picker */}
                  <label
                    title="Custom Color"
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '2px solid rgba(255,255,255,0.4)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    <input
                      type="color"
                      value={color.startsWith('#') && color.length === 7 ? color : '#06b6d4'}
                      onChange={(e) => setColor(e.target.value)}
                      style={{
                        position: 'absolute',
                        opacity: 0,
                        width: '100%',
                        height: '100%',
                        cursor: 'pointer'
                      }}
                    />
                  </label>
                </div>
              </div>

              <button type="submit" className="btn-gradient" style={{ width: '100%' }}>
                {editingId ? 'Save Changes' : 'Add Account'}
              </button>
            </form>
          </div>
        </div>
      , document.body)}

      {/* ─── Set Total Credit Limit Modal ─── */}
      {showLimitModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '340px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={18} color="#818cf8" />
                <h3 className="font-heading" style={{ fontSize: '1.05rem', margin: 0 }}>Total Credit Card Limit</h3>
              </div>
              <button className="btn-secondary" onClick={() => setShowLimitModal(false)} style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.4 }}>
              Set your total target spending limit across all your credit cards.
            </p>

            <form onSubmit={(e) => {
              e.preventDefault();
              setCreditCardLimit(limitInput);
              setShowLimitModal(false);
            }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Total Limit ({currency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="glass-input"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="e.g. 100000"
                  autoFocus
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '18px', flexWrap: 'wrap' }}>
                {[25000, 50000, 100000, 200000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setLimitInput(String(val))}
                    className="btn-secondary"
                    style={{ fontSize: '0.72rem', padding: '4px 8px', borderRadius: '6px' }}
                  >
                    {currency}{val >= 100000 ? `${val / 100000}L` : `${val / 1000}k`}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowLimitModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '9px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-gradient"
                  style={{ flex: 1, padding: '9px' }}
                >
                  Save Limit
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
