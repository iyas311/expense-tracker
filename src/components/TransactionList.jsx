import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Search, Trash2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, FileText, Calendar, Pencil, X, Check } from 'lucide-react';

export function TransactionList({ showNotes = false }) {
  const { transactions, filteredTransactions: timeFilteredTransactions, categories, accounts, currency, deleteTransaction, editTransaction, timeRange } = useExpense();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const displayTransactions = (timeFilteredTransactions || transactions).filter(t => {
    const matchesSearch = t.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          t.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCat = selectedCategory === 'all' || t.categoryId === selectedCategory;
    const matchesAcc = selectedAccount === 'all' || t.accountId === selectedAccount;
    const matchesType = selectedType === 'all' || t.type === selectedType;
    return matchesSearch && matchesCat && matchesAcc && matchesType;
  });

  const getCategory = (catId) => categories.find(c => c.id === catId) || { name: 'Transfer', color: '#6366f1' };
  const getAccount = (accId) => accounts.find(a => a.id === accId) || { name: 'Account' };

  const startEdit = (tx) => {
    setEditingId(tx.id);
    setEditForm({
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      categoryId: tx.categoryId || categories[0]?.id,
      accountId: tx.accountId,
      date: tx.date,
      notes: tx.notes || ''
    });
  };

  const saveEdit = () => {
    editTransaction(editingId, { ...editForm, amount: parseFloat(editForm.amount) });
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div className="glass-card" style={{ marginBottom: '24px' }}>
      <div className="section-header">
        <div className="section-title">
          <h3 className="font-heading">Transaction History</h3>
          <p>
            Showing {displayTransactions.length} records · {timeRange.replace('_', ' ')}
          </p>
        </div>

        {/* Filters */}
        <div className="hide-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch', width: '100%', maxWidth: '680px', paddingBottom: '4px' }}>
          <div style={{ position: 'relative', flexShrink: 0, width: '180px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text" className="glass-input"
              style={{ paddingLeft: '34px', fontSize: '0.85rem' }}
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search..."
            />
          </div>
          <select className="glass-input" style={{ width: 'auto', fontSize: '0.82rem', flexShrink: 0 }} value={selectedAccount} onChange={e => setSelectedAccount(e.target.value)}>
            <option value="all" style={{ background: '#0f172a' }}>All Accounts</option>
            {accounts.map(a => <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name}</option>)}
          </select>
          <select className="glass-input" style={{ width: 'auto', fontSize: '0.82rem', flexShrink: 0 }} value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
            <option value="all" style={{ background: '#0f172a' }}>All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>{c.name}</option>)}
          </select>
          <select className="glass-input" style={{ width: 'auto', fontSize: '0.82rem', flexShrink: 0 }} value={selectedType} onChange={e => setSelectedType(e.target.value)}>
            <option value="all" style={{ background: '#0f172a' }}>All Types</option>
            <option value="expense" style={{ background: '#0f172a' }}>Expenses</option>
            <option value="income" style={{ background: '#0f172a' }}>Income</option>
            <option value="transfer" style={{ background: '#0f172a' }}>Transfers</option>
          </select>
        </div>
      </div>

      {displayTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p>No transactions found for the selected filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayTransactions.map((tx) => {
            const cat = getCategory(tx.categoryId);
            const acc = getAccount(tx.accountId);
            const isTransfer = tx.type === 'transfer';
            const isIncome = tx.type === 'income';
            const isEditing = editingId === tx.id;

            const iconBg = isTransfer
              ? 'rgba(99,102,241,0.12)'
              : isIncome ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)';
            const iconBorder = isTransfer
              ? 'rgba(99,102,241,0.3)'
              : isIncome ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)';
            const amtColor = isTransfer ? '#6366f1' : isIncome ? '#10b981' : '#f43f5e';
            const amtPrefix = isTransfer ? '⇄' : isIncome ? '+' : '-';

            if (isEditing) {
              return (
                <div key={tx.id} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '16px', padding: '16px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Description</label>
                      <input className="glass-input" style={{ fontSize: '0.85rem' }} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Amount</label>
                      <input type="number" step="0.01" className="glass-input" style={{ fontSize: '0.85rem' }} value={editForm.amount} onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Category</label>
                      <select className="glass-input" style={{ fontSize: '0.82rem' }} value={editForm.categoryId} onChange={e => setEditForm(f => ({ ...f, categoryId: e.target.value }))}>
                        {categories.map(c => <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Account</label>
                      <select className="glass-input" style={{ fontSize: '0.82rem' }} value={editForm.accountId} onChange={e => setEditForm(f => ({ ...f, accountId: e.target.value }))}>
                        {accounts.map(a => <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Date</label>
                      <input type="date" className="glass-input" style={{ fontSize: '0.82rem' }} value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Notes</label>
                      <input type="text" className="glass-input" style={{ fontSize: '0.85rem' }} placeholder="Optional details..." value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button onClick={cancelEdit} className="btn-secondary" style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={saveEdit} className="btn-gradient" style={{ padding: '7px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Check size={14} /> Save
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={tx.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', transition: 'all 0.2s ease' }}>
                {/* Left */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: iconBg, border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                    {isTransfer ? <ArrowLeftRight size={18} color="#6366f1" /> : isIncome ? <ArrowUpRight size={18} color="#10b981" /> : <ArrowDownRight size={18} color="#f43f5e" />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '4px', lineHeight: '1.2' }}>{tx.description}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                      <span className="badge" style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40`, padding: '2px 8px', fontSize: '0.7rem' }}>{cat.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>• {acc.name}</span>
                      {isTransfer && <span className="badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#6366f1', fontSize: '0.65rem' }}>Transfer</span>}
                    </div>
                    {showNotes && tx.notes && (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px', lineHeight: '1.4' }}>
                        <span style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: '1px' }}>📝</span>
                        <span>{tx.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-heading" style={{ fontSize: '1.05rem', fontWeight: '800', color: amtColor, whiteSpace: 'nowrap' }}>
                      {amtPrefix}{currency}{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '4px', whiteSpace: 'nowrap' }}>
                      <Calendar size={10} /> {tx.date}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {!isTransfer && (
                      <button onClick={() => startEdit(tx)} className="btn-secondary" title="Edit" style={{ padding: '6px', color: '#6366f1', border: 'none', borderRadius: '8px' }}>
                        <Pencil size={13} />
                      </button>
                    )}
                    <button onClick={() => deleteTransaction(tx.id)} className="btn-secondary" title="Delete" style={{ padding: '6px', color: 'var(--text-dim)', border: 'none', borderRadius: '8px' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
