import React, { useState, useEffect } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight, ArrowDownRight, Calendar, Zap, CheckCircle2 } from 'lucide-react';

export function SummaryCards() {
  const { currency, netWorth, totalIncome, totalExpenses, timeRange, setTimeRange, selectedMonth, setSelectedMonth, selectedDate, setSelectedDate, accounts, transactions } = useExpense();

  // Selected Spending Accounts Pool (persisted in localStorage)
  const [spendingAccountIds, setSpendingAccountIds] = useState(() => {
    try {
      const saved = localStorage.getItem('et_spending_accounts');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    // Default: select non-card accounts (e.g. Kotak and SBI)
    return accounts.filter(a => a.type !== 'card').map(a => a.id);
  });

  // Ensure default is set once accounts load if empty
  useEffect(() => {
    if (spendingAccountIds.length === 0 && accounts.length > 0) {
      const defaultIds = accounts.filter(a => a.type !== 'card').map(a => a.id);
      setSpendingAccountIds(defaultIds);
      localStorage.setItem('et_spending_accounts', JSON.stringify(defaultIds));
    }
  }, [accounts]);

  const toggleSpendingAccount = (id) => {
    setSpendingAccountIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('et_spending_accounts', JSON.stringify(next));
      return next;
    });
  };

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

  // Daily Allowance Calculations for Current Month
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, (daysInMonth - currentDay) + 1); // including today
  const currentMonthName = now.toLocaleString('en-IN', { month: 'long' });

  // Combined Spending Balance
  const activeSpendingAccounts = accounts.filter(a => spendingAccountIds.includes(a.id));
  const combinedSpendingBalance = activeSpendingAccounts.reduce((sum, a) => sum + (a.balance || 0), 0);
  const dailyAllowance = remainingDays > 0 ? Math.max(0, combinedSpendingBalance / remainingDays) : 0;

  // Spending from these accounts today
  const todayStr = now.toISOString().split('T')[0];
  const spentToday = transactions
    .filter(t => spendingAccountIds.includes(t.accountId) && t.type === 'expense' && t.date === todayStr)
    .reduce((sum, t) => sum + t.amount, 0);

  const remainingDailyToday = Math.max(0, dailyAllowance - spentToday);
  const isOverDaily = dailyAllowance > 0 && spentToday > dailyAllowance;
  const todaySpentPercent = dailyAllowance > 0 ? Math.min(100, Math.round((spentToday / dailyAllowance) * 100)) : 0;

  const getPeriodLabel = () => {
    switch (timeRange) {
      case 'today': return 'Today\'s';
      case 'this_week': return 'This Week\'s';
      case 'this_month': return 'This Month\'s';
      case 'all_time': return 'All Time';
      case 'custom_month': {
        const [year, month] = selectedMonth.split('-');
        const label = new Date(year, month - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
        return label;
      }
      case 'custom_date': {
        const label = new Date(selectedDate + 'T00:00:00').toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        return label;
      }
      default: return 'Period';
    }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      
      {/* ─── 1. Combined Spending Pool & Daily Safe-to-Spend Allowance Card ─── */}
      <div className="glass-card" style={{
        marginBottom: '16px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid rgba(6, 182, 212, 0.25)',
        boxShadow: '0 8px 30px -10px rgba(6, 182, 212, 0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-30px',
          right: '-30px',
          width: '140px',
          height: '140px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #06b6d4, #3b82f6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Zap size={18} color="#fff" />
            </div>
            <div>
              <h3 className="font-heading" style={{ fontSize: '1.1rem', fontWeight: '800' }}>Daily Spending Allowance</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Safe burn rate based on your selected spending accounts</p>
            </div>
          </div>

          <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontSize: '0.72rem' }}>
            📅 {remainingDays} {remainingDays === 1 ? 'day' : 'days'} left in {currentMonthName}
          </span>
        </div>

        {/* Main Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          marginBottom: '14px'
        }}>
          {/* Daily Allowance */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Daily Safe-to-Spend
            </span>
            <div className="font-heading" style={{ fontSize: '1.6rem', fontWeight: '900', color: '#06b6d4', marginTop: '4px' }}>
              {currency}{dailyAllowance.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-dim)', marginLeft: '4px' }}>/ day</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              Total divided by {remainingDays} remaining days
            </div>
          </div>

          {/* Combined Spending Balance */}
          <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Combined Spending Balance
            </span>
            <div className="font-heading" style={{ fontSize: '1.6rem', fontWeight: '900', color: combinedSpendingBalance >= 0 ? '#10b981' : '#f43f5e', marginTop: '4px' }}>
              {currency}{combinedSpendingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '2px' }}>
              {activeSpendingAccounts.length} {activeSpendingAccounts.length === 1 ? 'account' : 'accounts'} selected in pool
            </div>
          </div>
        </div>

        {/* Today's Spending Progress Meter */}
        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px 14px', borderRadius: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>
              Today's Spending: <strong style={{ color: isOverDaily ? '#f43f5e' : '#fff' }}>{currency}{spentToday.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</strong>
            </span>
            <span style={{ fontWeight: '700', color: isOverDaily ? '#f43f5e' : '#10b981' }}>
              {isOverDaily 
                ? `Over by ${currency}${(spentToday - dailyAllowance).toFixed(0)}` 
                : `${currency}${remainingDailyToday.toFixed(0)} remaining today`}
            </span>
          </div>
          <div style={{ width: '100%', height: '7px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, todaySpentPercent)}%`,
              height: '100%',
              background: isOverDaily ? '#f43f5e' : todaySpentPercent > 80 ? '#f59e0b' : '#06b6d4',
              borderRadius: '4px',
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* Account Selector Chips */}
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', display: 'block', marginBottom: '6px' }}>
            Tap accounts to include in your spending pool:
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {accounts.map(acc => {
              const isSelected = spendingAccountIds.includes(acc.id);
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => toggleSpendingAccount(acc.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 10px',
                    borderRadius: '10px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(6, 182, 212, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${isSelected ? 'rgba(6, 182, 212, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: isSelected ? '#38bdf8' : 'var(--text-dim)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    background: acc.color || '#06b6d4'
                  }} />
                  <span>{acc.name}</span>
                  <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({currency}{acc.balance.toLocaleString('en-IN', { maximumFractionDigits: 0 })})</span>
                  {isSelected && <span>✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── 2. Time View Filter Switcher Toolbar ─── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        padding: '12px 18px',
        background: 'rgba(15, 22, 41, 0.6)',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--border-light)',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="#06b6d4" />
          <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-main)' }}>
            Financial Overview Period:
          </span>
        </div>

        <div className="hide-scrollbar" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', paddingBottom: '4px' }}>
          {[
            { id: 'today', label: 'Today' },
            { id: 'this_week', label: 'This Week' },
            { id: 'this_month', label: 'This Month' },
            { id: 'all_time', label: 'All Time' },
            { id: 'custom_month', label: 'Select Month' },
            { id: 'custom_date', label: 'Select Date' }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTimeRange(item.id)}
              className={timeRange === item.id ? 'btn-cyan' : 'btn-secondary'}
              style={{ fontSize: '0.78rem', padding: '6px 12px', borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {item.label}
            </button>
          ))}

          {/* Month Picker — shown inline right after Select Month button */}
          {timeRange === 'custom_month' && (
            <input
              type="month"
              className="glass-input"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem', flexShrink: 0 }}
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          )}

          {/* Date Picker — shown when Select Date is active */}
          {timeRange === 'custom_date' && (
            <input
              type="date"
              className="glass-input"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem', flexShrink: 0 }}
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          )}

        </div>
      </div>

      {/* Metric Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        {/* Net Worth */}
        <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute',
            top: '-20px',
            right: '-20px',
            width: '100px',
            height: '100px',
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%)'
          }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Total Net Worth</span>
            <div style={{ background: 'rgba(99, 102, 241, 0.15)', padding: '8px', borderRadius: '12px' }}>
              <Wallet size={20} color="#6366f1" />
            </div>
          </div>
          <h3 className="font-heading" style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '6px' }}>
            {currency}{netWorth.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
            Across all connected bank accounts & cash
          </p>
        </div>

        {/* Monthly / Period Income */}
        <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'capitalize' }}>
              {getPeriodLabel()} Income
            </span>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '8px', borderRadius: '12px' }}>
              <TrendingUp size={20} color="#10b981" />
            </div>
          </div>
          <h3 className="font-heading" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981', marginBottom: '6px' }}>
            +{currency}{totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981' }}>
            <ArrowUpRight size={14} /> Total money received
          </div>
        </div>

        {/* Monthly / Period Expenses */}
        <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'capitalize' }}>
              {getPeriodLabel()} Expenses
            </span>
            <div style={{ background: 'rgba(244, 63, 94, 0.15)', padding: '8px', borderRadius: '12px' }}>
              <TrendingDown size={20} color="#f43f5e" />
            </div>
          </div>
          <h3 className="font-heading" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f43f5e', marginBottom: '6px' }}>
            -{currency}{totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#f43f5e' }}>
            <ArrowDownRight size={14} /> Total spent across categories
          </div>
        </div>

        {/* Net Savings & Rate */}
        <div className="glass-card" style={{ position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>Net Savings</span>
            <div style={{ background: 'rgba(6, 182, 212, 0.15)', padding: '8px', borderRadius: '12px' }}>
              <PiggyBank size={20} color="#06b6d4" />
            </div>
          </div>
          <h3 className="font-heading" style={{ fontSize: '1.8rem', fontWeight: '800', color: netSavings >= 0 ? '#06b6d4' : '#f43f5e', marginBottom: '6px' }}>
            {netSavings >= 0 ? '+' : ''}{currency}{netSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            <span>Savings Rate: <strong style={{ color: '#06b6d4' }}>{savingsRate}%</strong></span>
            <div style={{
              width: '60px',
              height: '6px',
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${Math.min(100, savingsRate)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #06b6d4 0%, #10b981 100%)'
              }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
