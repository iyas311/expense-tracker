import React, { useState, useEffect, useRef } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { X, ArrowLeftRight, Sparkles } from 'lucide-react';

export function TransactionModal({ isOpen, onClose }) {
  const { categories, accounts, currency, addTransaction, addTransfer, transactions } = useExpense();

  const [type, setType] = useState('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-1');
  const [accountId, setAccountId] = useState(accounts[0]?.id || 'acc-1');
  const [toAccountId, setToAccountId] = useState(accounts[1]?.id || 'acc-2');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const descRef = useRef(null);

  // AI Smart Category Suggestions from past transactions
  useEffect(() => {
    if (!description.trim() || description.length < 2) {
      setSuggestions([]);
      return;
    }
    const lower = description.toLowerCase();
    const matchedCatIds = new Set();
    for (const tx of transactions) {
      if (tx.description?.toLowerCase().includes(lower) && tx.categoryId) {
        matchedCatIds.add(tx.categoryId);
        if (matchedCatIds.size >= 3) break;
      }
    }
    const matched = categories.filter(c => matchedCatIds.has(c.id) && c.type !== 'income');
    setSuggestions(matched);
  }, [description, transactions, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    if (type === 'transfer') {
      if (fromAccountId === toAccountId) return alert('Please select different accounts for transfer.');
      addTransfer({ fromAccountId: accountId, toAccountId, amount: parseFloat(amount), date, notes });
    } else {
      if (!description.trim()) return;
      addTransaction({ description, amount: parseFloat(amount), type, categoryId, accountId, date, notes });
    }
    resetAndClose();
  };

  const resetAndClose = () => {
    setDescription(''); setAmount(''); setNotes(''); setType('expense');
    setCategoryId(categories[0]?.id || 'cat-1');
    setAccountId(accounts[0]?.id || 'acc-1');
    setSuggestions([]);
    onClose();
  };

  const filteredCategories = categories.filter(c => c.type === type || (type === 'transfer' && c.type === 'expense'));

  const typeColors = {
    expense: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
    income: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    transfer: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="font-heading" style={{ fontSize: '1.3rem' }}>Add Transaction</h3>
          <button className="btn-secondary" onClick={resetAndClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '18px' }}>
            {['expense', 'income', 'transfer'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  padding: '10px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '700',
                  fontSize: '0.82rem',
                  background: type === t ? typeColors[t] : 'rgba(255,255,255,0.06)',
                  color: type === t ? '#fff' : 'var(--text-muted)',
                  transition: 'all 0.2s ease'
                }}
              >
                {t === 'transfer' ? <><ArrowLeftRight size={12} style={{ display: 'inline', marginRight: '4px' }} />Transfer</> : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Amount */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Amount ({currency})
            </label>
            <input
              type="number" step="0.01" className="glass-input"
              style={{ fontSize: '1.4rem', fontWeight: '700' }}
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00" required
            />
          </div>

          {/* Transfer: From/To Accounts */}
          {type === 'transfer' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>From Account</label>
                <select className="glass-input" value={accountId} onChange={e => setAccountId(e.target.value)}>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>
                      {a.name} ({currency}{a.balance.toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>To Account</label>
                <select className="glass-input" value={toAccountId} onChange={e => setToAccountId(e.target.value)}>
                  {accounts.filter(a => a.id !== accountId).map(a => (
                    <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>
                      {a.name} ({currency}{a.balance.toFixed(0)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <>
              {/* Description with AI Suggestions */}
              <div style={{ marginBottom: '16px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                  Description / Merchant
                </label>
                <input
                  ref={descRef}
                  type="text" className="glass-input"
                  value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Swiggy, Petrol, Salary" required
                />
                {/* Smart Category Suggestions */}
                {suggestions.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <Sparkles size={12} color="#06b6d4" />
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Suggested:</span>
                    {suggestions.map(cat => (
                      <button
                        key={cat.id} type="button"
                        onClick={() => setCategoryId(cat.id)}
                        style={{
                          padding: '3px 10px', borderRadius: '20px', border: `1px solid ${cat.color}60`,
                          background: categoryId === cat.id ? `${cat.color}30` : `${cat.color}12`,
                          color: cat.color, fontSize: '0.72rem', cursor: 'pointer',
                          fontWeight: '600', transition: 'all 0.2s ease'
                        }}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Category & Account */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Category</label>
                  <select className="glass-input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                    {filteredCategories.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Account</label>
                  <select className="glass-input" value={accountId} onChange={e => setAccountId(e.target.value)}>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>
                        {a.name} ({currency}{a.balance.toFixed(0)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Date</label>
            <input type="date" className="glass-input" value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Notes (Optional)</label>
            <input type="text" className="glass-input" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tag or detail" />
          </div>

          <button type="submit" className="btn-gradient" style={{ width: '100%', padding: '14px', background: typeColors[type] }}>
            {type === 'transfer' ? '🔄 Confirm Transfer' : type === 'income' ? '+ Add Income' : '− Add Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
