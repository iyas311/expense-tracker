import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Search, Filter, Trash2, ArrowUpRight, ArrowDownRight, FileText, Calendar } from 'lucide-react';

export function TransactionList() {
  const { transactions, filteredTransactions: timeFilteredTransactions, categories, accounts, currency, deleteTransaction, timeRange } = useExpense();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  const displayTransactions = (timeFilteredTransactions || transactions).filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (t.notes && t.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCat = selectedCategory === 'all' || t.categoryId === selectedCategory;
    const matchesAcc = selectedAccount === 'all' || t.accountId === selectedAccount;
    const matchesType = selectedType === 'all' || t.type === selectedType;

    return matchesSearch && matchesCat && matchesAcc && matchesType;
  });

  const getCategory = (catId) => categories.find(c => c.id === catId) || { name: 'General', color: '#64748b' };
  const getAccount = (accId) => accounts.find(a => a.id === accId) || { name: 'Account' };

  return (
    <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>Transaction History</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {displayTransactions.length} records for selected period ({timeRange.replace('_', ' ')})
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', maxWidth: '600px' }}>
          {/* Search Input */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              className="glass-input"
              style={{ paddingLeft: '36px', fontSize: '0.85rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search description..."
            />
          </div>

          {/* Category Filter */}
          <select
            className="glass-input"
            style={{ width: 'auto', fontSize: '0.85rem' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all" style={{ background: '#0f172a' }}>All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>{c.name}</option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            className="glass-input"
            style={{ width: 'auto', fontSize: '0.85rem' }}
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
          >
            <option value="all" style={{ background: '#0f172a' }}>All Types</option>
            <option value="expense" style={{ background: '#0f172a' }}>Expenses Only</option>
            <option value="income" style={{ background: '#0f172a' }}>Income Only</option>
          </select>
        </div>
      </div>

      {/* Transaction Table / List */}
      {displayTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          <p>No transactions found for the selected period / filters.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {displayTransactions.map((tx) => {
            const cat = getCategory(tx.categoryId);
            const acc = getAccount(tx.accountId);
            const isExpense = tx.type === 'expense';

            return (
              <div
                key={tx.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-light)',
                  borderRadius: '16px',
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Left: Icon & Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px',
                    background: isExpense ? 'rgba(244, 63, 94, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                    border: `1px solid ${isExpense ? 'rgba(244, 63, 94, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {isExpense ? <ArrowDownRight size={20} color="#f43f5e" /> : <ArrowUpRight size={20} color="#10b981" />}
                  </div>

                  <div>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '4px' }}>
                      {tx.description}
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span className="badge" style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40` }}>
                        {cat.name}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        • {acc.name}
                      </span>
                      {tx.notes && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', italic: 'true' }}>
                          ("{tx.notes}")
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Date, Amount & Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="font-heading" style={{
                      fontSize: '1.1rem',
                      fontWeight: '800',
                      color: isExpense ? '#f43f5e' : '#10b981'
                    }}>
                      {isExpense ? '-' : '+'}{currency}{tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '2px' }}>
                      <Calendar size={12} /> {tx.date}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTransaction(tx.id)}
                    className="btn-secondary"
                    title="Delete Transaction"
                    style={{ padding: '8px', color: 'var(--text-dim)', border: 'none', borderRadius: '10px' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
