import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExpense } from '../context/ExpenseContext';
import { HandCoins, Plus, Check, Trash2, X, ChevronDown, ChevronUp, AlertCircle, Clock, Edit2 } from 'lucide-react';

export function DebtTracker() {
  const { debts, addDebt, updateDebt, settleDebt, deleteDebt, currency, accounts, addTransaction, categories } = useExpense();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [settlingId, setSettlingId] = useState(null);
  const [settleInput, setSettleInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [settleAccountId, setSettleAccountId] = useState('');

  // Form state for Add
  const [form, setForm] = useState({
    personName: '', amount: '', direction: 'lent',
    reason: '', dueDate: '', notes: '', accountId: '', categoryId: ''
  });

  // Form state for Edit
  const [editForm, setEditForm] = useState({
    personName: '', amount: '', direction: 'lent',
    reason: '', dueDate: '', notes: '', settledAmount: ''
  });

  const handleOpenEdit = (debt) => {
    setEditingDebt(debt);
    setEditForm({
      personName: debt.personName || '',
      amount: debt.amount !== undefined ? debt.amount.toString() : '',
      direction: debt.direction || 'lent',
      reason: debt.reason || '',
      dueDate: debt.dueDate ? debt.dueDate.split('T')[0] : '',
      notes: debt.notes || '',
      settledAmount: debt.settledAmount !== undefined ? debt.settledAmount.toString() : '0'
    });
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editingDebt || !editForm.personName.trim() || !editForm.amount) return;
    const newAmt = parseFloat(editForm.amount) || 0;
    const newSettled = parseFloat(editForm.settledAmount) || 0;
    const newStatus = newSettled >= newAmt && newAmt > 0 ? 'settled' : newSettled > 0 ? 'partial' : 'pending';

    updateDebt({
      id: editingDebt.id,
      personName: editForm.personName.trim(),
      amount: newAmt,
      direction: editForm.direction,
      reason: editForm.reason.trim(),
      dueDate: editForm.dueDate || null,
      notes: editForm.notes.trim(),
      settledAmount: newSettled,
      status: newStatus
    });
    setEditingDebt(null);
  };

  const lentDebts = debts.filter(d => d.direction === 'lent' && d.status !== 'settled');
  const borrowedDebts = debts.filter(d => d.direction === 'borrowed' && d.status !== 'settled');
  const settledDebts = debts.filter(d => d.status === 'settled');

  const totalLent = lentDebts.reduce((s, d) => s + (d.amount - (d.settledAmount || 0)), 0);
  const totalBorrowed = borrowedDebts.reduce((s, d) => s + (d.amount - (d.settledAmount || 0)), 0);

  const today = new Date();

  const getDaysInfo = (dueDate) => {
    if (!dueDate) return null;
    const due = new Date(dueDate + 'T00:00:00');
    const diff = Math.round((due - today) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.personName.trim() || !form.amount) return;
    addDebt({
      personName: form.personName.trim(),
      amount: parseFloat(form.amount),
      direction: form.direction,
      reason: form.reason.trim(),
      dateCreated: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
      dueDate: form.dueDate || null,
      notes: form.notes.trim()
    });

    if (form.accountId) {
      const debtCat = categories.find(c => /loan|debt/i.test(c.name));
      const targetCatId = form.categoryId || debtCat?.id || categories.find(c => c.type === (form.direction === 'lent' ? 'expense' : 'income'))?.id || categories[0]?.id;

      addTransaction({
        description: form.direction === 'lent' ? `Lent to ${form.personName.trim()}` : `Borrowed from ${form.personName.trim()}`,
        amount: parseFloat(form.amount),
        type: form.direction === 'lent' ? 'transfer_out' : 'transfer_in',
        categoryId: null,
        accountId: form.accountId,
        date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
        notes: form.reason ? `Debt creation: ${form.reason.trim()}` : 'Debt creation'
      });
    }

    setForm({ personName: '', amount: '', direction: 'lent', reason: '', dueDate: '', notes: '', accountId: '', categoryId: '' });
    setShowAddModal(false);
  };

  // Group debts by person name (case-insensitive)
  const getAvatarBg = (name) => {
    const hues = [
      ['#3b82f6', '#1d4ed8'],
      ['#10b981', '#047857'],
      ['#8b5cf6', '#6d28d9'],
      ['#f59e0b', '#b45309'],
      ['#06b6d4', '#0e7490'],
      ['#ec4899', '#be185d']
    ];
    let h = 0;
    for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
    const pair = hues[Math.abs(h) % hues.length];
    return `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
  };

  // Group debts by person name (case-insensitive) & sort by dateCreated DESC
  const groupByPerson = (debtList) => {
    const map = {};
    for (const d of debtList) {
      const key = d.personName.trim().toLowerCase();
      if (!map[key]) map[key] = { personName: d.personName, debts: [] };
      map[key].debts.push(d);
    }
    const groups = Object.values(map);
    groups.forEach(g => {
      g.debts.sort((a, b) => new Date(b.dateCreated || 0) - new Date(a.dateCreated || 0));
    });
    return groups;
  };

  const lentGroups = groupByPerson(lentDebts);
  const borrowedGroups = groupByPerson(borrowedDebts);

  const [expandedPerson, setExpandedPerson] = useState(null);
  const [settlingGroupPerson, setSettlingGroupPerson] = useState(null);
  const [showAllSettled, setShowAllSettled] = useState(false);

  const handleSettleGroup = (groupDebts, direction) => {
    const partial = parseFloat(settleInput);
    const accountId = settleAccountId || '';
    let remaining = partial || groupDebts.reduce((s, d) => s + (d.amount - (d.settledAmount || 0)), 0);

    for (const debt of groupDebts) {
      if (remaining <= 0) break;
      const debtRemaining = debt.amount - (debt.settledAmount || 0);
      if (debtRemaining <= 0) continue;
      const toSettle = Math.min(remaining, debtRemaining);
      const newSettled = (debt.settledAmount || 0) + toSettle;
      const status = newSettled >= debt.amount ? 'settled' : 'partial';
      settleDebt(debt.id, newSettled, status, accountId);
      remaining -= toSettle;
    }
    setSettlingGroupPerson(null);
    setSettlingId(null);
    setSettleInput('');
    setSettleAccountId('');
  };

  const PersonGroup = ({ group, direction }) => {
    const totalInitial = group.debts.reduce((s, d) => s + (d.amount || 0), 0);
    const totalSettled = group.debts.reduce((s, d) => s + (d.settledAmount || 0), 0);
    const totalRemaining = Math.max(0, totalInitial - totalSettled);
    const isLent = direction === 'lent';
    const isExpanded = expandedPerson === group.personName.toLowerCase();
    const isSettling = settlingGroupPerson === group.personName.toLowerCase();
    const hasPartial = group.debts.some(d => d.status === 'partial');

    // Most recent activity
    const latestDebt = group.debts[0];
    const latestReason = latestDebt?.reason?.trim() || (isLent ? 'Lent' : 'Borrowed');
    const formattedLatestDate = latestDebt?.dateCreated
      ? new Date(latestDebt.dateCreated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : '';

    // Distinct reasons for preview chips (up to 3)
    const distinctReasons = Array.from(new Set(group.debts.map(d => d.reason?.trim()).filter(Boolean)));
    const previewChips = distinctReasons.slice(0, 3);
    const remainingReasonsCount = distinctReasons.length - previewChips.length;

    return (
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: `1px solid ${isLent ? 'rgba(16,185,129,0.22)' : 'rgba(244,63,94,0.22)'}`,
        borderRadius: '16px',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        boxShadow: isExpanded ? '0 8px 24px rgba(0,0,0,0.25)' : 'none'
      }}>
        {/* Person header row */}
        <div
          onClick={() => {
            if (group.debts.length > 1) {
              setExpandedPerson(isExpanded ? null : group.personName.toLowerCase());
            }
          }}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 16px',
            gap: '12px',
            cursor: group.debts.length > 1 ? 'pointer' : 'default',
            userSelect: 'none'
          }}
        >
          {/* Avatar */}
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: getAvatarBg(group.personName),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontWeight: '800',
              fontSize: '1rem',
              flexShrink: 0,
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)'
            }}
          >
            {group.personName.trim().charAt(0).toUpperCase()}
          </div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '0.96rem', color: 'var(--text-primary)' }}>
                {group.personName}
              </span>
              {group.debts.length > 1 && (
                <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px', fontSize: '0.68rem', fontWeight: '700' }}>
                  {group.debts.length} entries
                </span>
              )}
              {hasPartial && (
                <span style={{ background: 'rgba(245,158,11,0.18)', color: '#f59e0b', padding: '2px 8px', borderRadius: '12px', fontSize: '0.65rem', fontWeight: '700', border: '1px solid rgba(245,158,11,0.3)' }}>
                  PARTIAL
                </span>
              )}
            </div>

            {/* Smart subtitle */}
            {group.debts.length === 1 ? (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{latestReason}</span>
                {formattedLatestDate && <span>• {formattedLatestDate}</span>}
                {latestDebt?.dueDate && (
                  <span style={{ color: getDaysInfo(latestDebt.dueDate) < 0 ? '#f43f5e' : 'var(--text-dim)', fontSize: '0.7rem' }}>
                    • Due {latestDebt.dueDate}
                  </span>
                )}
              </div>
            ) : (
              <div style={{ marginTop: '3px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    Latest: <strong style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{latestReason}</strong> ({currency}{latestDebt.amount.toLocaleString('en-IN', { minimumFractionDigits: 0 })})
                  </span>
                  {formattedLatestDate && <span style={{ color: 'var(--text-dim)' }}>• {formattedLatestDate}</span>}
                </div>
                {previewChips.length > 0 && (
                  <div style={{ display: 'flex', gap: '5px', alignItems: 'center', marginTop: '5px', flexWrap: 'wrap' }}>
                    {previewChips.map((chip, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.66rem',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          padding: '1px 7px',
                          borderRadius: '8px',
                          color: 'var(--text-dim)',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {chip}
                      </span>
                    ))}
                    {remainingReasonsCount > 0 && (
                      <span
                        style={{
                          fontSize: '0.66rem',
                          background: 'rgba(99,102,241,0.14)',
                          color: '#818cf8',
                          padding: '1px 7px',
                          borderRadius: '8px',
                          fontWeight: '700'
                        }}
                      >
                        +{remainingReasonsCount} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Partial Progress Bar */}
            {totalSettled > 0 && (
              <div style={{ marginTop: '7px', maxWidth: '320px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                  <span style={{ color: '#10b981', fontWeight: '600' }}>{currency}{totalSettled.toLocaleString('en-IN')} paid</span>
                  <span>{currency}{totalRemaining.toLocaleString('en-IN')} left ({Math.round((totalSettled / totalInitial) * 100)}%)</span>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, Math.round((totalSettled / totalInitial) * 100))}%`, background: '#10b981', borderRadius: '2px' }} />
                </div>
              </div>
            )}
          </div>

          {/* Amount and Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: isLent ? '#10b981' : '#f43f5e' }}>
                {currency}{totalRemaining.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </div>
              {group.debts.length > 1 && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Balance
                </div>
              )}
            </div>

            <button
              onClick={() => { setSettlingGroupPerson(isSettling ? null : group.personName.toLowerCase()); setSettlingId(null); setSettleInput(''); setSettleAccountId(''); }}
              className="btn-secondary"
              style={{ padding: '6px 9px', fontSize: '0.72rem', borderRadius: '8px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}
              title={group.debts.length > 1 ? "Settle all or partial" : "Settle"}
            >
              <Check size={13} />
            </button>

            {group.debts.length === 1 && (
              <button
                onClick={() => handleOpenEdit(group.debts[0])}
                className="btn-secondary"
                style={{ padding: '6px 8px', fontSize: '0.72rem', borderRadius: '8px', color: 'var(--text-muted)' }}
                title="Edit"
              >
                <Edit2 size={13} />
              </button>
            )}

            {group.debts.length > 1 && (
              <button
                onClick={() => setExpandedPerson(isExpanded ? null : group.personName.toLowerCase())}
                className="btn-secondary"
                style={{ padding: '6px 8px', borderRadius: '8px', color: 'var(--text-dim)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                title={isExpanded ? "Collapse" : "View individual entries"}
              >
                <ChevronDown size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Expandable individual entries */}
        {isExpanded && (
          <div style={{ borderTop: `1px solid ${isLent ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`, padding: '10px 16px 14px', background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Itemized Ledger ({group.debts.length} records)
              </span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                Click [✓] on any item to settle individually
              </span>
            </div>

            {group.debts.map(d => {
              const rem = Math.max(0, d.amount - (d.settledAmount || 0));
              const formattedDate = d.dateCreated ? (typeof d.dateCreated === 'string' ? d.dateCreated.split('T')[0] : new Date(d.dateCreated).toISOString().split('T')[0]) : '';
              const isThisSettling = settlingId === d.id;

              return (
                <React.Fragment key={d.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', gap: '10px', padding: '8px 12px', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                          {d.reason || (isLent ? 'Lent' : 'Borrowed')}
                        </span>
                        {formattedDate && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: '6px' }}>
                            {formattedDate}
                          </span>
                        )}
                        {d.dueDate && (
                          <span style={{ fontSize: '0.68rem', color: getDaysInfo(d.dueDate) < 0 ? '#f43f5e' : 'var(--text-dim)' }}>
                            Due {d.dueDate}
                          </span>
                        )}
                      </div>
                      {d.notes && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                          📝 {d.notes}
                        </div>
                      )}
                      {d.settledAmount > 0 && (
                        <div style={{ fontSize: '0.68rem', color: '#10b981', marginTop: '2px', fontWeight: '600' }}>
                          ✓ Paid {currency}{d.settledAmount.toLocaleString('en-IN')} ({currency}{rem.toLocaleString('en-IN')} remaining)
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '700', fontSize: '0.88rem', color: isLent ? '#10b981' : '#f43f5e' }}>
                        {currency}{rem.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                      </span>
                      <button onClick={() => { setSettlingId(isThisSettling ? null : d.id); setSettlingGroupPerson(null); setSettleInput(''); setSettleAccountId(''); }} className="btn-secondary" style={{ padding: '4px 7px', borderRadius: '6px', color: '#10b981' }} title="Settle">
                        <Check size={12} />
                      </button>
                      <button onClick={() => handleOpenEdit(d)} className="btn-secondary" style={{ padding: '4px 7px', borderRadius: '6px', color: 'var(--text-muted)' }} title="Edit">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => deleteDebt(d.id)} className="btn-secondary" style={{ padding: '4px 7px', borderRadius: '6px', color: 'var(--text-dim)' }} title="Delete">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Micro Settle Panel for individual debt */}
                  {isThisSettling && (
                    <div style={{ padding: '10px', marginTop: '-4px', marginBottom: '4px', background: 'rgba(0,0,0,0.3)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          className="glass-input"
                          style={{ flex: 1, fontSize: '0.8rem', padding: '5px 8px' }}
                          placeholder={`Full: ${currency}${rem.toFixed(0)} or partial`}
                          value={settleInput}
                          onChange={e => setSettleInput(e.target.value)}
                        />
                        <button
                          onClick={() => handleSettleGroup([d], direction)}
                          className="btn-gradient"
                          style={{ padding: '5px 10px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        >
                          {settleInput ? 'Partial' : 'Full'} ✓
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {isLent ? 'Received in:' : 'Paid from:'}
                        </span>
                        <select
                          className="glass-input"
                          style={{ flex: 1, fontSize: '0.75rem', padding: '4px 6px' }}
                          value={settleAccountId}
                          onChange={e => setSettleAccountId(e.target.value)}
                        >
                          <option value="">Select account (optional)</option>
                          {accounts.filter(a => a.type !== 'card').map(a => (
                            <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Settle panel */}
        {isSettling && (
          <div style={{ borderTop: `1px solid ${isLent ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                className="glass-input"
                style={{ flex: 1, fontSize: '0.85rem', padding: '6px 10px' }}
                placeholder={`Full: ${currency}${totalRemaining.toFixed(0)} or partial`}
                value={settleInput}
                onChange={e => setSettleInput(e.target.value)}
              />
              <button
                onClick={() => handleSettleGroup(group.debts, direction)}
                className="btn-gradient"
                style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                {settleInput ? 'Partial' : 'Full'} Paid ✓
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {isLent ? 'Received in:' : 'Paid from:'}
              </span>
              <select
                className="glass-input"
                style={{ flex: 1, fontSize: '0.8rem', padding: '5px 8px' }}
                value={settleAccountId}
                onChange={e => setSettleAccountId(e.target.value)}
              >
                <option value="">Select account (optional)</option>
                {accounts.filter(a => a.type !== 'card').map(a => (
                  <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{
        background: 'rgba(15,22,41,0.6)', backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-light)', borderRadius: '16px', padding: '16px 20px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <HandCoins size={20} color="#f59e0b" />
            <div>
              <span style={{ fontWeight: '700', fontSize: '1rem' }}>Debt & IOU Tracker</span>
              <div style={{ display: 'flex', gap: '12px', marginTop: '2px' }}>
                {totalLent > 0 && <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '600' }}>↑ Owed to you: {currency}{totalLent.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>}
                {totalBorrowed > 0 && <span style={{ fontSize: '0.72rem', color: '#f43f5e', fontWeight: '600' }}>↓ You owe: {currency}{totalBorrowed.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</span>}
                {totalLent === 0 && totalBorrowed === 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>No active debts</span>}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', borderRadius: '10px' }}
            >
              <Plus size={14} /> Add
            </button>
            <button
              onClick={() => setCollapsed(c => !c)}
              className="btn-secondary"
              style={{ padding: '6px', borderRadius: '10px' }}
            >
              {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <>
            {/* People owe you */}
            {lentGroups.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💰 People owe you ({lentGroups.length} {lentGroups.length === 1 ? 'person' : 'people'})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lentGroups.map(g => <PersonGroup key={g.personName} group={g} direction="lent" />)}
                </div>
              </div>
            )}

            {/* You owe people */}
            {borrowedGroups.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f43f5e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💳 You owe ({borrowedGroups.length} {borrowedGroups.length === 1 ? 'person' : 'people'})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {borrowedGroups.map(g => <PersonGroup key={g.personName} group={g} direction="borrowed" />)}
                </div>
              </div>
            )}

            {/* Settled */}
            {settledDebts.length > 0 && (
              <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ✅ Settled History ({settledDebts.length})
                  </span>
                  {settledDebts.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setShowAllSettled(s => !s)}
                      style={{ background: 'transparent', border: 'none', color: '#818cf8', fontSize: '0.72rem', cursor: 'pointer', fontWeight: '600' }}
                    >
                      {showAllSettled ? 'Show Less' : `View All (${settledDebts.length})`}
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(showAllSettled ? settledDebts : settledDebts.slice(0, 3)).map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', padding: '7px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{d.personName}</span>
                        <span style={{ color: 'var(--text-dim)' }}>• {d.reason || (d.direction === 'lent' ? 'Lent' : 'Borrowed')}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ color: '#10b981', fontWeight: '700', fontSize: '0.82rem' }}>{currency}{d.amount.toFixed(0)} ✓</span>
                        <button onClick={() => handleOpenEdit(d)} className="btn-secondary" style={{ padding: '3px 6px', borderRadius: '6px', color: 'var(--text-muted)' }} title="Edit">
                          <Edit2 size={11} />
                        </button>
                        <button onClick={() => deleteDebt(d.id)} className="btn-secondary" style={{ padding: '3px 6px', borderRadius: '6px', color: 'var(--text-dim)' }} title="Delete">
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lentDebts.length === 0 && borrowedDebts.length === 0 && settledDebts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <HandCoins size={32} style={{ opacity: 0.3, marginBottom: '8px', display: 'block', margin: '0 auto 8px' }} />
                No debts tracked yet. Use "+ Add" to log money lent or borrowed.
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Debt Modal */}
      {showAddModal && createPortal(
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">Log Debt / IOU</h3>
              <button className="btn-secondary" onClick={() => setShowAddModal(false)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Direction toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {['lent', 'borrowed'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, direction: d }))}
                    style={{
                      padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      fontWeight: '700', fontSize: '0.85rem',
                      background: form.direction === d
                        ? (d === 'lent' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#f43f5e,#e11d48)')
                        : 'rgba(255,255,255,0.06)',
                      color: form.direction === d ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    {d === 'lent' ? '💰 I Lent' : '💳 I Borrowed'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    {form.direction === 'lent' ? 'Lent to' : 'Borrowed from'}
                  </label>
                  <input type="text" className="glass-input" value={form.personName}
                    onChange={e => setForm(f => ({ ...f, personName: e.target.value }))}
                    placeholder="Person's name" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Amount ({currency})</label>
                  <input type="number" step="0.01" className="glass-input" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" required />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Reason / Purpose</label>
                <input type="text" className="glass-input" value={form.reason}
                  onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Birthday gift, loan, split bill" />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Expected Return Date (optional)</label>
                <input type="date" className="glass-input" value={form.dueDate}
                  onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Notes (optional)</label>
                <input type="text" className="glass-input" value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any extra context" />
              </div>

              <div style={{ marginBottom: form.accountId ? '14px' : '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                  {form.direction === 'lent' ? 'Paid from Account (creates expense transaction)' : 'Received in Account (creates income transaction)'}
                </label>
                <select
                  className="glass-input"
                  value={form.accountId}
                  onChange={e => setForm(f => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">Do not log a transaction</option>
                  {accounts.filter(a => a.type !== 'card').map(a => (
                    <option key={a.id} value={a.id} style={{ background: '#0f172a' }}>{a.name}</option>
                  ))}
                </select>
              </div>

              {form.accountId && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    Category (default: Loans & Debts)
                  </label>
                  <select
                    className="glass-input"
                    value={form.categoryId || (categories.find(c => /loan|debt/i.test(c.name))?.id || categories.find(c => c.type === (form.direction === 'lent' ? 'expense' : 'income'))?.id || '')}
                    onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id} style={{ background: '#0f172a' }}>
                        {c.name} ({c.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button type="submit" className="btn-gradient" style={{
                width: '100%', padding: '13px',
                background: form.direction === 'lent' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#f43f5e,#e11d48)'
              }}>
                {form.direction === 'lent' ? '💰 Log as Lent' : '💳 Log as Borrowed'}
              </button>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Edit Debt Modal */}
      {editingDebt && createPortal(
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="font-heading">Edit Debt / IOU</h3>
              <button className="btn-secondary" onClick={() => setEditingDebt(null)} style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit}>
              {/* Direction toggle */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                {['lent', 'borrowed'].map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setEditForm(f => ({ ...f, direction: d }))}
                    style={{
                      padding: '10px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                      fontWeight: '700', fontSize: '0.85rem',
                      background: editForm.direction === d
                        ? (d === 'lent' ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#f43f5e,#e11d48)')
                        : 'rgba(255,255,255,0.06)',
                      color: editForm.direction === d ? '#fff' : 'var(--text-muted)'
                    }}
                  >
                    {d === 'lent' ? '💰 I Lent' : '💳 I Borrowed'}
                  </button>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    {editForm.direction === 'lent' ? 'Lent to' : 'Borrowed from'}
                  </label>
                  <input type="text" className="glass-input" value={editForm.personName}
                    onChange={e => setEditForm(f => ({ ...f, personName: e.target.value }))}
                    placeholder="Person's name" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Total Amount ({currency})</label>
                  <input type="number" step="0.01" className="glass-input" value={editForm.amount}
                    onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                    placeholder="0.00" required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Already Paid ({currency})</label>
                  <input type="number" step="0.01" className="glass-input" value={editForm.settledAmount}
                    onChange={e => setEditForm(f => ({ ...f, settledAmount: e.target.value }))}
                    placeholder="0.00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Expected Return Date</label>
                  <input type="date" className="glass-input" value={editForm.dueDate}
                    onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Reason / Purpose</label>
                <input type="text" className="glass-input" value={editForm.reason}
                  onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Birthday gift, loan, split bill" />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '4px', color: 'var(--text-muted)' }}>Notes (optional)</label>
                <input type="text" className="glass-input" value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any extra context" />
              </div>

              <button type="submit" className="btn-gradient" style={{
                width: '100%', padding: '13px',
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)'
              }}>
                💾 Save Changes
              </button>
            </form>
          </div>
        </div>
      , document.body)}
    </div>
  );
}
