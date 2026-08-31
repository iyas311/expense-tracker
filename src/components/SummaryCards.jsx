import React from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowUpRight, ArrowDownRight, Calendar, Clock } from 'lucide-react';

export function SummaryCards() {
  const { currency, netWorth, totalIncome, totalExpenses, timeRange, setTimeRange, selectedMonth, setSelectedMonth, selectedDate, setSelectedDate } = useExpense();

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;

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
      {/* Time View Filter Switcher Toolbar */}
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
