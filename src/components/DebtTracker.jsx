import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useExpense } from '../context/ExpenseContext';
import { HandCoins, Plus, Check, Trash2, X, ChevronDown, ChevronUp, AlertCircle, Clock } from 'lucide-react';

export function DebtTracker() {
  const { debts, addDebt, settleDebt, deleteDebt, currency, accounts, addTransaction, categories } = useExpense();
  const [showAddModal, setShowAddModal] = useState(false);
  const [settlingId, setSettlingId] = useState(null);
  const [settleInput, setSettleInput] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [settleAccountId, setSettleAccountId] = useState('');

  // Form state
  const [form, setForm] = useState({
    personName: '', amount: '', direction: 'lent',
    reason: '', dueDate: '', notes: '', accountId: ''
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

    if (form.accountId) {
      addTransaction({
        description: form.direction === 'lent' ? `Lent to ${form.personName.trim()}` : `Borrowed from ${form.personName.trim()}`,
        amount: parseFloat(form.amount),
        type: form.direction === 'lent' ? 'expense' : 'income',
        categoryId: categories.find(c => c.type === (form.direction === 'lent' ? 'expense' : 'income'))?.id || categories[0]?.id,
        accountId: form.accountId,
        date: new Date().toISOString().split('T')[0],
        notes: form.reason ? `Debt creation: ${form.reason.trim()}` : 'Debt creation'
      });
    }

    setForm({ personName: '', amount: '', direction: 'lent', reason: '', dueDate: '', notes: '', accountId: '' });
    setShowAddModal(false);
  };

  // Group debts by person name (case-insensitive)
  const groupByPerson = (debtList) => {
    const map = {};
    for (const d of debtList) {
      const key = d.personName.trim().toLowerCase();
      if (!map[key]) map[key] = { personName: d.personName, debts: [] };
      map[key].debts.push(d);
    }
    return Object.values(map);
  };

  const lentGroups = groupByPerson(lentDebts);
  const borrowedGroups = groupByPerson(borrowedDebts);

  const [expandedPerson, setExpandedPerson] = useState(null);
  const [settlingGroupPerson, setSettlingGroupPerson] = useState(null);

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
    const totalRemaining = group.debts.reduce((s, d) => s + Math.max(0, d.amount - (d.settledAmount || 0)), 0);
    const isLent = direction === 'lent';
    const isExpanded = expandedPerson === group.personName.toLowerCase();
    const isSettling = settlingGroupPerson === group.personName.toLowerCase();
    const hasPartial = group.debts.some(d => d.status === 'partial');

    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${isLent ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
        borderRadius: '14px', overflow: 'hidden'
      }}>
        {/* Person header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', gap: '10px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{group.personName}</span>
              {group.debts.length > 1 && (
                <span style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '2px 7px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '700' }}>
                  {group.debts.length} entries
                </span>
              )}
              {hasPartial && (
                <span style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', padding: '2px 7px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: '700' }}>PARTIAL</span>
              )}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {group.debts.map(d => d.reason || (isLent ? 'Lent' : 'Borrowed')).join(' · ')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <span style={{ fontWeight: '800', fontSize: '1rem', color: isLent ? '#10b981' : '#f43f5e' }}>
              {currency}{totalRemaining.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
            </span>
            <button
              onClick={() => { setSettlingGroupPerson(isSettling ? null : group.personName.toLowerCase()); setSettlingId(null); setSettleInput(''); setSettleAccountId(''); }}
              className="btn-secondary"
              style={{ padding: '5px 8px', fontSize: '0.72rem', borderRadius: '8px', color: '#10b981' }}
            >
              <Check size={13} />
            </button>
            {group.debts.length > 1 && (
              <button
                onClick={() => setExpandedPerson(isExpanded ? null : group.personName.toLowerCase())}
                className="btn-secondary"
                style={{ padding: '5px', borderRadius: '8px', color: 'var(--text-dim)' }}
              >
                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>
        </div>

        {/* Expandable individual entries */}
        {isExpanded && (
          <div style={{ borderTop: `1px solid ${isLent ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`, padding: '8px 16px 10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {group.debts.map(d => {
              const rem = d.amount - (d.settledAmount || 0);
              const formattedDate = d.dateCreated ? (typeof d.dateCreated === 'string' ? d.dateCreated.split('T')[0] : new Date(d.dateCreated).toISOString().split('T')[0]) : '';
              const isThisSettling = settlingId === d.id;

              return (
                <React.Fragment key={d.id}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', gap: '8px', padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ color: 'var(--text-main)' }}>{d.reason || (isLent ? 'Lent' : 'Borrowed')}</span>
                      {formattedDate && <span style={{ color: 'var(--text-dim)', marginLeft: '6px' }}>· {formattedDate}</span>}
                      {d.settledAmount > 0 && <span style={{ color: '#10b981', marginLeft: '6px' }}>· paid {currency}{d.settledAmount.toFixed(0)}</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontWeight: '700', color: isLent ? '#10b981' : '#f43f5e' }}>{currency}{rem.toFixed(0)}</span>
                      <button onClick={() => { setSettlingId(isThisSettling ? null : d.id); setSettlingGroupPerson(null); setSettleInput(''); setSettleAccountId(''); }} className="btn-secondary" style={{ padding: '3px 6px', borderRadius: '6px', color: '#10b981' }}>
                        <Check size={11} />
                      </button>
                      <button onClick={() => deleteDebt(d.id)} className="btn-secondary" style={{ padding: '3px 6px', borderRadius: '6px', color: 'var(--text-dim)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                  
                  {/* Micro Settle Panel for individual debt */}
                  {isThisSettling && (
                    <div style={{ padding: '8px', marginTop: '-4px', marginBottom: '4px', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                          <option value="">Select account</option>
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

              <div style={{ marginBottom: '20px' }}>
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
