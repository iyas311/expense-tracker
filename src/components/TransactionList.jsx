import React, { useState, useEffect } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Search, Trash2, ArrowUpRight, ArrowDownRight, ArrowLeftRight, FileText, Calendar, Pencil, X, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download } from 'lucide-react';

export function TransactionList({ showNotes = false }) {
  const {
    transactions,
    filteredTransactions: timeFilteredTransactions,
    categories,
    accounts,
    currency,
    deleteTransaction,
    editTransaction,
    timeRange,
    setTimeRange,
    selectedMonth,
    setSelectedMonth,
    selectedDate,
    setSelectedDate
  } = useExpense();

  const [searchTerm, setSearchTerm] = useState('');
  const [searchAllTime, setSearchAllTime] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(showNotes ? 25 : 10);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  const getCategory = (catId) => categories.find(c => c.id === catId) || { name: 'Transfer', color: '#6366f1' };
  const getAccount = (accId) => accounts.find(a => a.id === accId) || { name: 'Account' };

  const matchesSearchTerm = (t, term) => {
    if (!term || !term.trim()) return true;
    const clean = term.trim().toLowerCase().replace(/^[₹$€£\s]+/, '');
    if (!clean) return true;

    const amtStr = t.amount !== undefined && t.amount !== null ? String(t.amount) : '';
    const amtFixed = t.amount !== undefined && t.amount !== null ? Number(t.amount).toFixed(2) : '';
    const formattedAmt = t.amount !== undefined && t.amount !== null ? Number(t.amount).toLocaleString('en-IN') : '';
    const catName = getCategory(t.categoryId)?.name?.toLowerCase() || '';
    const accName = getAccount(t.accountId)?.name?.toLowerCase() || '';

    return t.description?.toLowerCase().includes(clean) ||
           t.notes?.toLowerCase().includes(clean) ||
           amtStr.includes(clean) ||
           amtFixed.includes(clean) ||
           formattedAmt.includes(clean) ||
           (t.date && t.date.includes(clean)) ||
           catName.includes(clean) ||
           accName.includes(clean);
  };

  const activeSource = (searchAllTime || timeRange === 'all_time') ? (transactions || []) : (timeFilteredTransactions || transactions || []);

  const checkTypeMatch = (t, typeFilter) => {
    if (typeFilter === 'all') return true;
    if (typeFilter === 'transfer') return t.type === 'transfer' || t.type.startsWith('transfer_');
    if (typeFilter === 'transfer_internal') return Boolean(t.transferId) || t.type === 'transfer';
    if (typeFilter === 'transfer_out') return t.type === 'transfer_out' && !t.transferId;
    if (typeFilter === 'transfer_in') return t.type === 'transfer_in' && !t.transferId;
    return t.type === typeFilter;
  };

  const displayTransactions = activeSource.filter(t => {
    const sMatch = matchesSearchTerm(t, searchTerm);
    const matchesCat = selectedCategory === 'all' || t.categoryId === selectedCategory;
    const matchesAcc = selectedAccount === 'all' || t.accountId === selectedAccount;
    const matchesType = checkTypeMatch(t, selectedType);
    return sMatch && matchesCat && matchesAcc && matchesType;
  });

  // Check if matches exist across All Time when current period has 0
  const allTimeMatchesCount = (searchTerm.trim() && !searchAllTime && timeRange !== 'all_time')
    ? (transactions || []).filter(t => {
        const sMatch = matchesSearchTerm(t, searchTerm);
        const matchesCat = selectedCategory === 'all' || t.categoryId === selectedCategory;
        const matchesAcc = selectedAccount === 'all' || t.accountId === selectedAccount;
        const matchesType = checkTypeMatch(t, selectedType);
        return sMatch && matchesCat && matchesAcc && matchesType;
      }).length
    : 0;

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, selectedAccount, selectedType, timeRange, pageSize, searchAllTime]);

  const totalItems = displayTransactions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedTransactions = displayTransactions.slice(startIndex, endIndex);

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

  const getPeriodLabel = () => {
    switch (timeRange) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'this_week': return 'This Week';
      case 'this_month': return 'This Month';
      case 'all_time': return 'All Time';
      case 'custom_month': {
        const [year, month] = (selectedMonth || '').split('-');
        if (!year || !month) return 'Custom Month';
        return new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      }
      case 'custom_date': {
        if (!selectedDate) return 'Custom Date';
        return new Date(selectedDate + 'T00:00:00').toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      default: return timeRange.replace('_', ' ');
    }
  };

  const handleExportFilteredCsv = () => {
    if (displayTransactions.length === 0) return;
    const headers = ['Date', 'Description', 'Amount', 'Type', 'Category', 'Account', 'Notes'];
    const rows = displayTransactions.map(t => {
      const cat = getCategory(t.categoryId)?.name || 'General';
      const acc = getAccount(t.accountId)?.name || 'Account';
      return [
        `"${t.date || ''}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount,
        `"${t.type || ''}"`,
        `"${cat.replace(/"/g, '""')}"`,
        `"${acc.replace(/"/g, '""')}"`,
        `"${(t.notes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `transactions_${timeRange}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="glass-card" style={{ marginBottom: '24px' }}>
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '10px' }}>
          <div className="section-title">
            <h3 className="font-heading">Transaction History</h3>
            <p>
              Showing {totalItems > 0 ? `${startIndex + 1}–${endIndex} of ${totalItems}` : '0'} records · <strong style={{ color: '#38bdf8' }}>{getPeriodLabel()}</strong>
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportFilteredCsv}
            disabled={displayTransactions.length === 0}
            className="btn-secondary"
            style={{
              fontSize: '0.78rem',
              padding: '6px 12px',
              borderRadius: '10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              opacity: displayTransactions.length === 0 ? 0.4 : 1,
              cursor: displayTransactions.length === 0 ? 'not-allowed' : 'pointer'
            }}
            title="Export currently filtered transactions to CSV"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', width: '100%', paddingBottom: '4px' }}>
          {/* Time Period Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <select
              className="glass-input"
              style={{
                width: 'auto',
                fontSize: '0.82rem',
                flexShrink: 0,
                color: '#38bdf8',
                fontWeight: '700',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                background: 'rgba(56, 189, 248, 0.1)'
              }}
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
              title="Filter transactions by time period"
            >
              <option value="this_month" style={{ background: '#0f172a', color: '#fff' }}>📅 This Month</option>
              <option value="today" style={{ background: '#0f172a', color: '#fff' }}>📅 Today</option>
              <option value="yesterday" style={{ background: '#0f172a', color: '#fff' }}>📅 Yesterday</option>
              <option value="this_week" style={{ background: '#0f172a', color: '#fff' }}>📅 This Week</option>
              <option value="all_time" style={{ background: '#0f172a', color: '#fff' }}>📅 All Time</option>
              <option value="custom_month" style={{ background: '#0f172a', color: '#fff' }}>📅 Select Month...</option>
              <option value="custom_date" style={{ background: '#0f172a', color: '#fff' }}>📅 Select Date...</option>
            </select>

            {timeRange === 'custom_month' && (
              <input
                type="month"
                className="glass-input"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8rem', color: '#fff' }}
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
              />
            )}

            {timeRange === 'custom_date' && (
              <input
                type="date"
                className="glass-input"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8rem', color: '#fff' }}
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
              />
            )}
          </div>

          <div style={{ position: 'relative', flex: '1 1 160px', minWidth: '140px' }}>
            <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text" className="glass-input"
              style={{ paddingLeft: '34px', paddingRight: searchTerm ? '30px' : '12px', fontSize: '0.85rem' }}
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search description, amount (e.g. 525)..."
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                  background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 4px', fontSize: '0.75rem'
                }}
              >
                ✕
              </button>
            )}
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
            <option value="transfer" style={{ background: '#0f172a' }}>All Transfers</option>
            <option value="transfer_out" style={{ background: '#0f172a' }}>Transfer Out (Lent / Sent)</option>
            <option value="transfer_in" style={{ background: '#0f172a' }}>Transfer In (Repaid / Received)</option>
            <option value="transfer_internal" style={{ background: '#0f172a' }}>Transfer (Internal)</option>
          </select>
        </div>
      </div>

      {displayTransactions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
          <FileText size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
          {allTimeMatchesCount > 0 ? (
            <div>
              <p style={{ marginBottom: '10px' }}>No transactions found in <strong style={{ color: '#38bdf8' }}>{getPeriodLabel()}</strong> matching "{searchTerm}".</p>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(6, 182, 212, 0.12)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                padding: '10px 18px',
                borderRadius: '14px',
                flexWrap: 'wrap',
                justifyContent: 'center'
              }}>
                <span style={{ fontSize: '0.82rem', color: '#38bdf8', fontWeight: '600' }}>
                  Found {allTimeMatchesCount} matching record(s) in All Time (e.g. earlier dates/years)
                </span>
                <button
                  type="button"
                  onClick={() => { setTimeRange('all_time'); setSearchAllTime(true); }}
                  className="btn-cyan"
                  style={{ fontSize: '0.78rem', padding: '6px 14px', borderRadius: '10px' }}
                >
                  View in All Time
                </button>
              </div>
            </div>
          ) : (
            <p>No transactions found for the selected filters.</p>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {paginatedTransactions.map((tx) => {
            const cat = getCategory(tx.categoryId);
            const acc = getAccount(tx.accountId);
            const isInternal = Boolean(tx.transferId) || tx.type === 'transfer';
            const isTransferOut = tx.type === 'transfer_out' && !tx.transferId;
            const isTransferIn = tx.type === 'transfer_in' && !tx.transferId;
            const isTransfer = isInternal || isTransferOut || isTransferIn || tx.type.startsWith('transfer');
            const isIncome = tx.type === 'income';
            const isEditing = editingId === tx.id;

            let iconBg = 'rgba(244,63,94,0.12)';
            let iconBorder = 'rgba(244,63,94,0.3)';
            let iconColor = '#f43f5e';
            let amtColor = '#f43f5e';
            let amtPrefix = '-';
            let transferBadgeText = null;
            let transferBadgeColor = '#6366f1';
            let transferBadgeBg = 'rgba(99,102,241,0.15)';

            if (isInternal) {
              iconBg = 'rgba(99,102,241,0.12)';
              iconBorder = 'rgba(99,102,241,0.3)';
              iconColor = '#6366f1';
              amtColor = '#6366f1';
              amtPrefix = tx.type === 'transfer_out' ? '-' : (tx.type === 'transfer_in' ? '+' : '⇄');
              transferBadgeText = 'Transfer';
              transferBadgeColor = '#6366f1';
              transferBadgeBg = 'rgba(99,102,241,0.15)';
            } else if (isTransferOut) {
              iconBg = 'rgba(244,63,94,0.12)';
              iconBorder = 'rgba(244,63,94,0.3)';
              iconColor = '#f43f5e';
              amtColor = '#f43f5e';
              amtPrefix = '-';
              transferBadgeText = 'Transfer Out';
              transferBadgeColor = '#f43f5e';
              transferBadgeBg = 'rgba(244,63,94,0.15)';
            } else if (isTransferIn) {
              iconBg = 'rgba(16,185,129,0.12)';
              iconBorder = 'rgba(16,185,129,0.3)';
              iconColor = '#10b981';
              amtColor = '#10b981';
              amtPrefix = '+';
              transferBadgeText = 'Transfer In';
              transferBadgeColor = '#10b981';
              transferBadgeBg = 'rgba(16,185,129,0.15)';
            } else if (isIncome) {
              iconBg = 'rgba(16,185,129,0.12)';
              iconBorder = 'rgba(16,185,129,0.3)';
              iconColor = '#10b981';
              amtColor = '#10b981';
              amtPrefix = '+';
            } else {
              iconBg = 'rgba(244,63,94,0.12)';
              iconBorder = 'rgba(244,63,94,0.3)';
              iconColor = '#f43f5e';
              amtColor = '#f43f5e';
              amtPrefix = '-';
            }

            if (isEditing) {
              return (
                <div key={tx.id} style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.35)', borderRadius: '16px', padding: '16px 18px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Description</label>
                      <input className="glass-input" style={{ fontSize: '0.85rem' }} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px', fontWeight: '600' }}>Type</label>
                      <select
                        className="glass-input"
                        style={{ fontSize: '0.82rem', fontWeight: '700', color: editForm.type?.startsWith('transfer') ? '#818cf8' : editForm.type === 'income' ? '#10b981' : '#f43f5e' }}
                        value={editForm.type}
                        onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))}
                      >
                        <option value="expense" style={{ background: '#0f172a' }}>Expense</option>
                        <option value="income" style={{ background: '#0f172a' }}>Income</option>
                        <option value="transfer_out" style={{ background: '#0f172a' }}>Transfer Out (Lent / Sent)</option>
                        <option value="transfer_in" style={{ background: '#0f172a' }}>Transfer In (Repaid / Received)</option>
                        <option value="transfer" style={{ background: '#0f172a' }}>Transfer (Internal)</option>
                      </select>
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
                    {isTransfer ? <ArrowLeftRight size={18} color={iconColor} /> : isIncome ? <ArrowUpRight size={18} color="#10b981" /> : <ArrowDownRight size={18} color="#f43f5e" />}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ fontSize: '0.95rem', fontWeight: '700', marginBottom: '4px', lineHeight: '1.2' }}>{tx.description}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
                      <span className="badge" style={{ background: `${cat.color}20`, color: cat.color, border: `1px solid ${cat.color}40`, padding: '2px 8px', fontSize: '0.7rem' }}>{cat.name}</span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>• {acc.name}</span>
                      {transferBadgeText && (
                        <span className="badge" style={{ background: transferBadgeBg, color: transferBadgeColor, border: `1px solid ${transferBadgeColor}40`, fontSize: '0.65rem' }}>
                          {transferBadgeText}
                        </span>
                      )}
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
                    {!tx.transferId && (
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

      {/* ─── Pagination Bar ─── */}
      {totalItems > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid rgba(255, 255, 255, 0.07)',
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          {/* Rows per page selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Rows per page:</span>
            <select
              className="glass-input"
              style={{ padding: '4px 8px', fontSize: '0.76rem', width: 'auto', borderRadius: '8px' }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10} style={{ background: '#0f172a' }}>10</option>
              <option value={25} style={{ background: '#0f172a' }}>25</option>
              <option value={50} style={{ background: '#0f172a' }}>50</option>
              <option value={100} style={{ background: '#0f172a' }}>100</option>
            </select>
            <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
              ({startIndex + 1}–{endIndex} of {totalItems})
            </span>
          </div>

          {/* Navigation Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              className="btn-secondary"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(1)}
              title="First Page"
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                opacity: safeCurrentPage === 1 ? 0.35 : 1,
                cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={safeCurrentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              title="Previous Page"
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                opacity: safeCurrentPage === 1 ? 0.35 : 1,
                cursor: safeCurrentPage === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronLeft size={14} />
            </button>

            <span style={{ padding: '0 8px', fontWeight: '600', color: 'var(--text-main)', fontSize: '0.78rem' }}>
              Page {safeCurrentPage} of {totalPages}
            </span>

            <button
              type="button"
              className="btn-secondary"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              title="Next Page"
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                opacity: safeCurrentPage >= totalPages ? 0.35 : 1,
                cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronRight size={14} />
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              title="Last Page"
              style={{
                padding: '5px 8px',
                borderRadius: '8px',
                opacity: safeCurrentPage >= totalPages ? 0.35 : 1,
                cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
