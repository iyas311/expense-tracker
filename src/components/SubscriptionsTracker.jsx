import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExpense } from '../context/ExpenseContext';
import { Repeat, Plus, Calendar, CreditCard, X, CheckCircle } from 'lucide-react';

export function SubscriptionsTracker() {
  const { subscriptions, categories, accounts, currency, addSubscription } = useExpense();

  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat-5');
  const [accountId, setAccountId] = useState(accounts[0]?.id || 'acc-1');
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [nextDueDate, setNextDueDate] = useState('');

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;

    addSubscription({
      name,
      amount: parseFloat(amount),
      categoryId,
      accountId,
      billingCycle,
      nextDueDate: nextDueDate || new Date().toISOString().split('T')[0]
    });

    setName('');
    setAmount('');
    setShowAddModal(false);
  };

  const getCategory = (catId) => categories.find(c => c.id === catId) || { name: 'Subscriptions', color: '#8b5cf6' };
  const getAccount = (accId) => accounts.find(a => a.id === accId) || { name: 'Account' };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div className="section-header">
        <div className="section-title">
          <h3 className="font-heading">Recurring Bills & Subscriptions</h3>
          <p>
            Never miss a payment with automatic due date tracking
          </p>
        </div>

        <button
          className="btn-secondary"
          onClick={() => setShowAddModal(true)}
          style={{ fontSize: '0.8rem', padding: '8px 14px' }}
        >
          <Plus size={14} /> Add Subscription
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {subscriptions.map(sub => {
          const cat = getCategory(sub.categoryId);
          const acc = getAccount(sub.accountId);

          return (
            <div
              key={sub.id}
              className="glass-card"
              style={{
                borderRadius: '18px',
                borderLeft: `4px solid ${cat.color || '#8b5cf6'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '700' }}>{sub.name}</h4>
                <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#8b5cf6', textTransform: 'capitalize' }}>
                  {sub.billingCycle}
                </span>
              </div>

              <div className="font-heading" style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)', marginBottom: '10px' }}>
                {currency}{sub.amount.toFixed(2)}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontWeight: '400', marginLeft: '4px' }}>
                  / {sub.billingCycle}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>Paid via: <strong style={{ color: 'var(--text-main)' }}>{acc.name}</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> Due {sub.nextDueDate}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Subscription Modal */}
      {showAddModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">Track New Subscription</h3>
              <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Service / Bill Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Netflix, Rent, Electricity"
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Billing Amount ({currency})</label>
                <input
                  type="number"
                  step="0.01"
                  className="glass-input"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="15.99"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Billing Cycle</label>
                  <select
                    className="glass-input"
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value)}
                  >
                    <option value="monthly" style={{ background: '#0f172a' }}>Monthly</option>
                    <option value="yearly" style={{ background: '#0f172a' }}>Yearly</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Next Due Date</label>
                  <input
                    type="date"
                    className="glass-input"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn-gradient" style={{ width: '100%' }}>
                Save Subscription
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
