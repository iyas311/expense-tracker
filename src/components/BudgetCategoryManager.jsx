import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExpense } from '../context/ExpenseContext';
import { PieChart, Plus, Edit2, Trash2, AlertCircle, CheckCircle2, SlidersHorizontal, X, Sparkles } from 'lucide-react';

export function BudgetCategoryManager() {
  const { categories, filteredTransactions, currency, addCategory, updateCategory, deleteCategory, updateCategoryBudget } = useExpense();
  
  const [showAddCatModal, setShowAddCatModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'expense', 'income'

  // Add form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('expense');
  const [newCatBudget, setNewCatBudget] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8b5cf6');

  // Edit form state
  const [editCatForm, setEditCatForm] = useState({
    name: '',
    type: 'expense',
    budgetCap: '',
    color: '#8b5cf6'
  });

  const colorPalette = [
    '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', 
    '#3b82f6', '#7e22ce', '#4f46e5', '#14b8a6', '#84cc16', '#ea580c', '#e11d48', '#64748b'
  ];

  // Calculate actual spending per category for selected period
  const getCategoryAmount = (cat) => {
    return filteredTransactions
      .filter(t => t.categoryId === cat.id && t.type === cat.type)
      .reduce((sum, t) => sum + t.amount, 0);
  };

  const handleCreateCategory = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory({
      name: newCatName.trim(),
      type: newCatType,
      budgetCap: newCatType === 'expense' ? (parseFloat(newCatBudget) || 0) : 0,
      color: newCatColor
    });
    setNewCatName('');
    setNewCatType('expense');
    setNewCatBudget('');
    setShowAddCatModal(false);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCategory(cat);
    setEditCatForm({
      name: cat.name || '',
      type: cat.type || 'expense',
      budgetCap: (cat.budgetCap !== undefined ? cat.budgetCap : 0).toString(),
      color: cat.color || '#8b5cf6'
    });
  };

  const handleSaveEditCategory = (e) => {
    e.preventDefault();
    if (!editingCategory || !editCatForm.name.trim()) return;
    updateCategory({
      id: editingCategory.id,
      name: editCatForm.name.trim(),
      type: editCatForm.type || 'expense',
      budgetCap: editCatForm.type === 'expense' ? (parseFloat(editCatForm.budgetCap) || 0) : 0,
      color: editCatForm.color || '#8b5cf6'
    });
    setEditingCategory(null);
  };

  const handleDeleteCategory = (catId, catName) => {
    if (window.confirm(`Are you sure you want to delete the category "${catName}"? Existing transactions will retain their data.`)) {
      deleteCategory(catId);
      if (editingCategory?.id === catId) setEditingCategory(null);
    }
  };

  const handleAutoCalculateBudgets = () => {
    // Auto-calculate budget based on recent spending average + 25% buffer
    categories.forEach(cat => {
      if (cat.type === 'expense') {
        const spent = getCategoryAmount(cat);
        const suggestedBudget = Math.max(100, Math.ceil((spent * 1.25) / 10) * 10);
        updateCategoryBudget(cat.id, suggestedBudget, true);
      }
    });
    alert('✨ AI Auto-Calculated budgets updated based on historical spending trends!');
  };

  const filteredCategories = categories.filter(c => {
    if (typeFilter === 'all') return true;
    return c.type === typeFilter;
  });

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Header */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="section-title">
          <h3 className="font-heading">Categories & Budget Limits</h3>
          <p>
            Manage categories, edit monthly limits, and customize colors
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
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
            <Plus size={14} /> New Category
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'all', label: `All (${categories.length})` },
          { id: 'expense', label: `Expenses (${categories.filter(c => c.type === 'expense').length})` },
          { id: 'income', label: `Income (${categories.filter(c => c.type === 'income').length})` }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setTypeFilter(tab.id)}
            className={typeFilter === tab.id ? 'btn-cyan' : 'btn-secondary'}
            style={{ fontSize: '0.78rem', padding: '6px 14px', borderRadius: '10px' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '16px'
      }}>
        {filteredCategories.map(cat => {
          const isExpense = cat.type === 'expense';
          const amount = getCategoryAmount(cat);
          const cap = cat.budgetCap || 0;
          const percent = cap > 0 ? Math.min(100, Math.round((amount / cap) * 100)) : 0;
          const isOver = cap > 0 && amount > cap;
          const isWarning = cap > 0 && percent >= 75 && !isOver;

          let statusColor = '#10b981'; // Green
          if (isWarning) statusColor = '#f59e0b'; // Amber
          if (isOver) statusColor = '#f43f5e'; // Red

          return (
            <div
              key={cat.id}
              className="glass-card"
              style={{
                borderRadius: '18px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                  <div style={{
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: cat.color || '#8b5cf6',
                    boxShadow: `0 0 10px ${cat.color}`,
                    flexShrink: 0
                  }} />
                  <span style={{ fontSize: '1rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {cat.name}
                  </span>
                  <span className="badge" style={{
                    background: isExpense ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    color: isExpense ? '#f43f5e' : '#10b981',
                    fontSize: '0.62rem',
                    textTransform: 'uppercase',
                    fontWeight: '700'
                  }}>
                    {cat.type || 'expense'}
                  </span>
                  {cat.isAutoBudget && (
                    <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontSize: '0.62rem' }}>
                      Auto-AI
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleOpenEditCategory(cat)}
                    className="btn-secondary"
                    style={{ padding: '6px 8px', border: 'none', borderRadius: '8px', color: 'var(--text-muted)' }}
                    title="Edit Category & Budget"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="btn-secondary"
                    style={{ padding: '6px 8px', border: 'none', borderRadius: '8px', color: 'var(--text-dim)' }}
                    title="Delete Category"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Amount Progress */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                <div className="font-heading" style={{ fontSize: '1.2rem', fontWeight: '800', color: isExpense ? 'var(--text-main)' : '#10b981' }}>
                  {currency}{amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: '400', marginLeft: '4px' }}>
                    {isExpense ? 'spent' : 'received'}
                  </span>
                </div>
                {isExpense && (
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                    Cap: {cap > 0 ? `${currency}${cap.toLocaleString()}` : 'Uncapped'}
                  </div>
                )}
              </div>

              {/* Progress Meter for Expenses */}
              {isExpense && cap > 0 && (
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
              )}

              {/* Status Message */}
              {isExpense ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: cap > 0 ? statusColor : 'var(--text-dim)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {cap === 0 ? (
                      'No budget cap set'
                    ) : isOver ? (
                      <><AlertCircle size={14} /> Over budget by {currency}{(amount - cap).toFixed(2)}!</>
                    ) : isWarning ? (
                      <><AlertCircle size={14} /> Warning: {percent}% of budget spent</>
                    ) : (
                      <><CheckCircle2 size={14} /> {100 - percent}% remaining ({currency}{(cap - amount).toFixed(2)})</>
                    )}
                  </span>
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                  Total income logged in this category for selected period
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Category Modal */}
      {editingCategory && createPortal(
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">Edit Category</h3>
              <button type="button" className="btn-secondary" onClick={() => setEditingCategory(null)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEditCategory}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Category Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={editCatForm.name}
                  onChange={(e) => setEditCatForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Category Type</label>
                <select
                  className="glass-input"
                  value={editCatForm.type}
                  onChange={(e) => setEditCatForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="expense" style={{ background: '#0f172a' }}>Expense</option>
                  <option value="income" style={{ background: '#0f172a' }}>Income</option>
                </select>
              </div>

              {editCatForm.type === 'expense' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Monthly Spending Limit / Budget Cap ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="glass-input"
                    value={editCatForm.budgetCap}
                    onChange={(e) => setEditCatForm(f => ({ ...f, budgetCap: e.target.value }))}
                    placeholder="0 for uncapped"
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Badge Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {colorPalette.map(c => (
                    <div
                      key={c}
                      onClick={() => setEditCatForm(f => ({ ...f, color: c }))}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        border: editCatForm.color === c ? '3px solid #ffffff' : 'none',
                        boxShadow: editCatForm.color === c ? `0 0 10px ${c}` : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(editingCategory.id, editingCategory.name)}
                  className="btn-secondary"
                  style={{ color: '#f43f5e', padding: '10px 16px' }}
                >
                  <Trash2 size={16} /> Delete
                </button>
                <button type="submit" className="btn-gradient" style={{ flex: 1, padding: '10px 16px' }}>
                  💾 Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Add Custom Category Modal */}
      {showAddCatModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">Create Custom Category</h3>
              <button type="button" className="btn-secondary" onClick={() => setShowAddCatModal(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateCategory}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Category Name</label>
                <input
                  type="text"
                  className="glass-input"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Pet Care, Freelance, Gaming"
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Category Type</label>
                <select
                  className="glass-input"
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value)}
                >
                  <option value="expense" style={{ background: '#0f172a' }}>Expense</option>
                  <option value="income" style={{ background: '#0f172a' }}>Income</option>
                </select>
              </div>

              {newCatType === 'expense' && (
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Monthly Budget Limit ({currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="glass-input"
                    value={newCatBudget}
                    onChange={(e) => setNewCatBudget(e.target.value)}
                    placeholder="0 for uncapped"
                  />
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-muted)' }}>Category Badge Color</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {colorPalette.map(c => (
                    <div
                      key={c}
                      onClick={() => setNewCatColor(c)}
                      style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        background: c,
                        cursor: 'pointer',
                        border: newCatColor === c ? '3px solid #ffffff' : 'none',
                        boxShadow: newCatColor === c ? `0 0 10px ${c}` : 'none'
                      }}
                    />
                  ))}
                </div>
              </div>

              <button type="submit" className="btn-gradient" style={{ width: '100%', padding: '12px' }}>
                Create Category
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
