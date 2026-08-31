import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExpense } from '../context/ExpenseContext';
import { HandCoins, Plus, Check, Trash2, X, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react';

export function DebtTracker() {
  const { debts, addDebt, settleDebt, deleteDebt, currency, accounts } = useExpense();
  const [showAddModal, setShowAddModal] = useState(false);
  const [settlingId, setSettlingId] = useState(null);
  const [settleInput, setSettleInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [settleAccountId, setSettleAccountId] = useState('');

  // Form state
  const [form, setForm] = useState({
    personName: '', amount: '', direction: 'lent',
    reason: '', dueDate: '', notes: ''
  });

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
      dateCreated: new Date().toISOString().split('T')[0],
      dueDate: form.dueDate || null,
      notes: form.notes.trim()
    });
    setForm({ personName: '', amount: '', direction: 'lent', reason: '', dueDate: '', notes: '' });
    setShowAddModal(false);
  };

  const handleSettle = (debt) => {
    const partial = parseFloat(settleInput);
    const accountId = settleAccountId || accounts[0]?.id;
    if (settleInput && partial > 0) {
      const newSettled = (debt.settledAmount || 0) + partial;
      const status = newSettled >= debt.amount ? 'settled' : 'partial';
      settleDebt(debt.id, Math.min(newSettled, debt.amount), status, debt.direction === 'lent' ? accountId : null);
    } else {
      settleDebt(debt.id, debt.amount, 'settled', debt.direction === 'lent' ? accountId : null);
    }
    setSettlingId(null);
    setSettleInput('');
    setSettleAccountId('');
  };

  const DebtCard = ({ debt }) => {
    const remaining = debt.amount - (debt.settledAmount || 0);
    const days = getDaysInfo(debt.dueDate);
    const isOverdue = days !== null && days < 0;
    const isDueSoon = days !== null && days >= 0 && days <= 3;
    const isSettling = settlingId === debt.id;
    const isLent = debt.direction === 'lent';

    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isLent ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
        borderRadius: '14px', padding: '14px 16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{debt.personName}</span>
              {debt.status === 'partial' && (
                <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700' }}>PARTIAL</span>
              )}
              {isOverdue && (
                <span style={{ background: 'rgba(244,63,94,0.2)', color: '#f43f5e', padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <AlertCircle size={10} /> {Math.abs(days)}d overdue
                </span>
              )}
              {isDueSoon && (
                <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '3px' }}>
                  <Clock size={10} /> Due in {days}d
                </span>
              )}
            </div>
            {debt.reason && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{debt.reason}</div>}
            {debt.dueDate && !isOverdue && !isDueSoon && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
                Due: {debt.dueDate} {days !== null ? `(${days}d)` : ''}
              </div>
            )}
            {debt.settledAmount > 0 && (
              <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '2px' }}>
                Paid {currency}{debt.settledAmount.toFixed(0)} · Remaining: {currency}{remaining.toFixed(0)}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <div style={{ fontWeight: '800', fontSize: '1rem', color: isLent ? '#10b981' : '#f43f5e' }}>
              {currency}{remaining.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
            </div>
            <button
              onClick={() => { setSettlingId(isSettling ? null : debt.id); setSettleInput(''); }}
              className="btn-secondary"
              style={{ padding: '5px 8px', fontSize: '0.72rem', borderRadius: '8px', color: '#10b981' }}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => deleteDebt(debt.id)}
              className="btn-secondary"
              style={{ padding: '5px', borderRadius: '8px', color: 'var(--text-dim)' }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Settle panel */}
        {isSettling && (
          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                className="glass-input"
                style={{ flex: 1, fontSize: '0.85rem', padding: '6px 10px' }}
                placeholder={`Full: ${currency}${remaining} or partial amount`}
                value={settleInput}
                onChange={e => setSettleInput(e.target.value)}
              />
              <button
                onClick={() => handleSettle(debt)}
                className="btn-gradient"
                style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
              >
                {settleInput ? 'Partial' : 'Full'} Paid ✓
              </button>
            </div>
            {debt.direction === 'lent' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Received in:</span>
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
            )}
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
            {lentDebts.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#10b981', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💰 People owe you ({lentDebts.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {lentDebts.map(d => <DebtCard key={d.id} debt={d} />)}
                </div>
              </div>
            )}

            {/* You owe people */}
            {borrowedDebts.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '700', color: '#f43f5e', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💳 You owe ({borrowedDebts.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {borrowedDebts.map(d => <DebtCard key={d.id} debt={d} />)}
                </div>
              </div>
            )}

            {/* Settled */}
            {settledDebts.length > 0 && (
              <div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '6px' }}>✅ Settled ({settledDebts.length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {settledDebts.slice(0, 3).map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-dim)', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px' }}>
                      <span>{d.personName} · {d.reason || (d.direction === 'lent' ? 'lent' : 'borrowed')}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <span style={{ color: '#10b981' }}>{currency}{d.amount.toFixed(0)} ✓</span>
                        <button onClick={() => deleteDebt(d.id)} className="btn-secondary" style={{ padding: '3px', borderRadius: '6px', color: 'var(--text-dim)' }}>
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
    </div>
  );
}
