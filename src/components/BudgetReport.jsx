import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { TrendingDown, AlertCircle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';

export function BudgetReport() {
  const { categories, transactions, currency } = useExpense();
  const [reportMonth, setReportMonth] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7));

  const prevMonth = () => {
    const d = new Date(reportMonth + '-01');
    d.setMonth(d.getMonth() - 1);
    setReportMonth(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(reportMonth + '-01');
    d.setMonth(d.getMonth() + 1);
    const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7);
    if (new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 7) <= now) setReportMonth(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 7));
  };

  const monthTxns = transactions.filter(t => {
    const txMonth = t.budgetMonth || t.date.slice(0, 7);
    return txMonth === reportMonth && t.type === 'expense';
  });

  const getCategorySpent = (catId) =>
    monthTxns.filter(t => t.categoryId === catId).reduce((s, t) => s + t.amount, 0);

  const expenseCategories = categories.filter(c => c.type === 'expense');
  const totalBudgeted = expenseCategories.reduce((s, c) => s + (c.budgetCap || 0), 0);
  const totalSpent = expenseCategories.reduce((s, c) => s + getCategorySpent(c.id), 0);

  const monthLabel = new Date(reportMonth + '-02').toLocaleString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="glass-card" style={{ marginBottom: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 className="font-heading" style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingDown size={20} color="#f59e0b" /> Monthly Budget Report
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Budget vs actual spending per category</p>
        </div>
        {/* Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={prevMonth} className="btn-secondary" style={{ padding: '7px' }}><ChevronLeft size={16} /></button>
          <span style={{ fontSize: '0.9rem', fontWeight: '700', minWidth: '140px', textAlign: 'center' }}>{monthLabel}</span>
          <button onClick={nextMonth} className="btn-secondary" style={{ padding: '7px' }}><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        {[
          { label: 'Total Budgeted', value: totalBudgeted, color: '#6366f1' },
          { label: 'Total Spent', value: totalSpent, color: totalSpent > totalBudgeted && totalBudgeted > 0 ? '#f43f5e' : '#10b981' },
          { label: 'Remaining', value: Math.max(0, totalBudgeted - totalSpent), color: '#06b6d4' }
        ].map(item => (
          <div key={item.label} style={{ background: `${item.color}10`, border: `1px solid ${item.color}25`, borderRadius: '14px', padding: '14px 16px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>{item.label}</div>
            <div className="font-heading" style={{ fontSize: '1.25rem', fontWeight: '800', color: item.color }}>
              {currency}{item.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      {/* Category Rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {expenseCategories.map(cat => {
          const spent = getCategorySpent(cat.id);
          const cap = cat.budgetCap || 0;
          const percent = cap > 0 ? Math.min(100, Math.round((spent / cap) * 100)) : 0;
          const isOver = cap > 0 && spent > cap;
          const isWarning = cap > 0 && percent >= 75 && !isOver;
          const statusColor = isOver ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';

          return (
            <div key={cat.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-light)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color, boxShadow: `0 0 8px ${cat.color}` }} />
                  <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{cat.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span className="font-heading" style={{ fontSize: '1rem', fontWeight: '800', color: isOver ? '#f43f5e' : 'var(--text-primary)' }}>
                    {currency}{spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    / {cap > 0 ? `${currency}${cap.toLocaleString('en-IN')}` : 'Uncapped'}
                  </span>
                  {cap > 0 && (
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', color: statusColor, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      {isOver ? <AlertCircle size={12} /> : <CheckCircle2 size={12} />}
                      {isOver ? `+${currency}${(spent - cap).toFixed(0)} over` : `${percent}%`}
                    </span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {cap > 0 && (
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.07)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${percent}%`, height: '100%', background: statusColor, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                </div>
              )}

              {/* No spend for uncapped */}
              {cap === 0 && spent === 0 && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>No spending this month</div>
              )}
              {cap === 0 && spent > 0 && (
                <div style={{ fontSize: '0.72rem', color: '#f59e0b' }}>No budget cap — {currency}{spent.toFixed(2)} spent</div>
              )}
            </div>
          );
        })}
      </div>

      {expenseCategories.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No expense categories yet. Add categories from Budget Manager.
        </div>
      )}
    </div>
  );
}
