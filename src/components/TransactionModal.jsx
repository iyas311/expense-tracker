import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { X, Plus, DollarSign } from 'lucide-react';

export function TransactionModal({ isOpen, onClose }) {
  const { categories, accounts, addTransaction } = useExpense();
  
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('expense');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-1');
  const [accountId, setAccountId] = useState(accounts[0]?.id || 'acc-1');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim() || !amount) return;

    addTransaction({
      description,
      amount: parseFloat(amount),
      type,
      categoryId,
      accountId,
      date,
      notes
    });

    // Reset & Close
    setDescription('');
    setAmount('');
    setNotes('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="font-heading" style={{ fontSize: '1.3rem' }}>Add New Transaction</h3>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Type Selector Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
            <button
              type="button"
              className={type === 'expense' ? 'btn-gradient' : 'btn-secondary'}
              onClick={() => setType('expense')}
              style={{
                background: type === 'expense' ? 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)' : '',
                borderRadius: '12px'
              }}
            >
              Expense
            </button>
            <button
              type="button"
              className={type === 'income' ? 'btn-gradient' : 'btn-secondary'}
              onClick={() => setType('income')}
              style={{
                background: type === 'income' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : '',
                borderRadius: '12px'
              }}
            >
              Income
            </button>
          </div>

          {/* Amount */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              className="glass-input"
              style={{ fontSize: '1.4rem', fontWeight: '700' }}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Description / Merchant Name
            </label>
            <input
              type="text"
              className="glass-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Grocery Store, Chipotle, Salary"
              required
            />
          </div>

          {/* Category & Account */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                Category
              </label>
              <select
                className="glass-input"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.filter(c => c.type === type).map(c => (
                  <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
                Payment Account
              </label>
              <select
                className="glass-input"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>
                    {a.name} ({a.balance < 0 ? '-' : ''}${Math.abs(a.balance)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Date
            </label>
            <input
              type="date"
              className="glass-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>
              Notes (Optional)
            </label>
            <input
              type="text"
              className="glass-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tag or detail"
            />
          </div>

          <button type="submit" className="btn-gradient" style={{ width: '100%', padding: '14px' }}>
            Add Transaction
          </button>
        </form>
      </div>
    </div>
  );
}
