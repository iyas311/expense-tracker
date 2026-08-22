import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { PieChart, Plus, Edit2, AlertCircle, CheckCircle2, SlidersHorizontal, X, Sparkles } from 'lucide-react';

export function BudgetCategoryManager() {
  const { categories, transactions, currency, addCategory, updateCategoryBudget } = useExpense();
  
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingCatId, setEditingCatId] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatBudget, setNewCatBudget] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8b5cf6');

  // Edit budget modal state
  const [editCapInput, setEditCapInput] = useState('');

  // Calculate actual spending per category
  const getCategorySpent = (catId) => {
    return transactions
      .filter(t => t.categoryId === catId && t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName,
      type: 'expense',
      budgetCap: parseFloat(newCatBudget) || 0,
      color: newCatColor
    });
    setNewCatName('');
    setNewCatBudget('');
    setShowAddCatModal(false);
  };

  const handleUpdateBudget = (catId) => {
    updateCategoryBudget(catId, parseFloat(editCapInput) || 0, false);
    setEditingCatId(null);
  };

  const handleAutoCalculateBudgets = () => {
    // Auto-calculate budget based on recent spending average + 15% buffer
    categories.forEach(cat => {
      if (cat.type === 'expense') {
        const spent = getCategorySpent(cat.id);
        const suggestedBudget = Math.max(100, Math.ceil((spent * 1.25) / 10) * 10);
        updateCategoryBudget(cat.id, suggestedBudget, true);
      }
    });
    alert('✨ AI Auto-Calculated budgets updated based on historical spending trends!');
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>Category Budget Limits</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Monitor spending against monthly limits (Manual caps or AI auto-calculated)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleAutoCalculateBudgets}
            className="btn-cyan"
            style={{ fontSize: '0.8rem', padding: '8px 14px' }}
          >
            <Sparkles size={14} /> AI Auto-Budget
          </button>

          <button
            onClick={() => setShowAddCatModal(true)}
            className="btn-secondary"
            style={{ fontSize: '0.8rem', padding: '8px 14px' }}
          >
            <Plus size={14} /> Custom Category
          </button>
        </div>
      </div>

      {/* Category Budget Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px'
      }}>
        {categories.filter(c => c.type === 'expense').map(cat => {
          const spent = getCategorySpent(cat.id);
          const cap = cat.budgetCap || 0;
          const percent = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
          const isOver = cap > 0 && spent > cap;
          const isWarning = cap > 0 && percent >= 75 && !isOver;

          let statusColor = '#10b981'; // Green
          if (isWarning) statusColor = '#f59e0b'; // Amber
          if (isOver) statusColor = '#f43f5e'; // Red

          return (
            <div
              key={cat.id}
              className="glass-card"
              style={{
                padding: '20px',
                borderRadius: '18px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: cat.color || '#8b5cf6',
                    boxShadow: `0 0 10px ${cat.color}`
                  }} />
                  <span style={{ fontSize: '1rem', fontWeight: '700' }}>{cat.name}</span>
                  {cat.isAutoBudget && (
                    <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontSize: '0.65rem' }}>
                      Auto-AI
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    setEditingCatId(cat.id);
                    setEditCapInput(cat.budgetCap.toString());
                  }}
                  className="btn-secondary"
                  style={{ padding: '6px', border: 'none', borderRadius: '8px' }}
                  title="Edit Budget Cap"
                >
                  <Edit2 size={14} />
                </button>
              </div>

              {/* Amount Progress */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <div className="font-heading" style={{ fontSize: '1.2rem', fontWeight: '800' }}>
                  {currency}{spent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '400', marginLeft: '4px' }}>
                    spent
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                  Cap: {currency}{cap.toLocaleString()}
                </div>
              </div>

              {/* Progress Meter */}
              <div style={{
                width: '100%',
                height: '10px',
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                overflow: 'hidden',
                marginBottom: '10px'
              }}>
                <div style={{
                  width: `${percent}%`,
                  height: '100%',
                  background: statusColor,
                  borderRadius: '6px',
                  transition: 'width 0.4s ease'
                }} />
              </div>

              {/* Status Message */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                <span style={{ color: statusColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {isOver ? (
                    <><AlertCircle size={14} /> Over budget by {currency}{(spent - cap).toFixed(2)}!</>
                  ) : isWarning ? (
                    <><AlertCircle size={14} /> Warning: {percent}% of budget spent</>
                  ) : (
                    <><CheckCircle2 size={14} /> {100 - percent}% remaining ({currency}{(cap - spent).toFixed(2)})</>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Budget Cap Modal */}
      {editingCatId && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h4 className="font-heading">Edit Monthly Budget Cap</h4>
              <button className="btn-secondary" onClick={() => setEditingCatId(null)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>
                Monthly Spending Limit ({currency})
              </label>
              <input
                type="number"
                className="glass-input"
                value={editCapInput}
                onChange={(e) => setEditCapInput(e.target.value)}
                placeholder="e.g. 400"
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn-secondary" onClick={() => setEditingCatId(null)}>Cancel</button>
              <button className="btn-gradient" onClick={() => handleUpdateBudget(editingCatId)}>Save Cap</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Category Modal */}
      {showAddCatModal && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">Create Custom Category</h3>
              <button className="btn-secondary" onClick={() => setShowAddCatModal(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Category Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Pet Care, Gaming, Freelance"
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px' }}>Monthly Budget Limit ({currency})</label>
                <input
                  type="number"
                  className="glass-input"
                  value={newCatBudget}
                  onChange={(e) => setNewCatBudget(e.target.value)}
                  placeholder="e.g. 250"
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px' }}>Category Badge Color</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {['#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'].map(c => (
                    <div
                      key={c}
                      onClick={() => setNewCatColor(c)}
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        border: newCatColor === c ? '3px solid #ffffff' : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-gradient" style={{ width: '100%' }}>
                Create Category
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
