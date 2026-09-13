import React, { useState, useMemo } from 'react';
import { useExpense } from '../context/ExpenseContext';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, ArrowUpRight, ArrowDownRight, Sparkles, Percent, Calendar } from 'lucide-react';

export function AnalyticsDashboard() {
  const { categories, filteredTransactions, transactions, currency, totalIncome, totalExpenses, timeRange } = useExpense();
  const [cashflowView, setCashflowView] = useState('trend'); // 'trend' | 'current'
  const [activeIndex, setActiveIndex] = useState(null);

  // Category Pie Chart Data based on time view filter
  const categoryData = useMemo(() => {
    return categories
      .filter(c => c.type === 'expense')
      .map(cat => {
        const value = filteredTransactions
          .filter(t => t.categoryId === cat.id && t.type === 'expense')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        return {
          id: cat.id,
          name: cat.name,
          value,
          color: cat.color || '#6366f1'
        };
      })
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [categories, filteredTransactions]);

  const totalSpentInChart = useMemo(() => {
    return categoryData.reduce((sum, item) => sum + item.value, 0);
  }, [categoryData]);

  // 6-Month Trend Data
  const trendData = useMemo(() => {
    const now = new Date();
    const list = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = d.toISOString().slice(0, 7);
      const monthLabel = d.toLocaleString('default', { month: 'short' });

      const mIncome = transactions
        .filter(t => (t.budgetMonth || (t.date && t.date.slice(0, 7))) === monthKey && t.type === 'income')
        .reduce((s, t) => s + (t.amount || 0), 0);

      const mExpense = transactions
        .filter(t => t.date && t.date.slice(0, 7) === monthKey && t.type === 'expense')
        .reduce((s, t) => s + (t.amount || 0), 0);

      list.push({
        month: monthLabel,
        monthKey,
        Income: Math.round(mIncome),
        Expenses: Math.round(mExpense),
        net: Math.round(mIncome - mExpense)
      });
    }
    return list;
  }, [transactions]);

  // Current period comparison data
  const currentPeriodData = useMemo(() => {
    const label = timeRange.replace(/_/g, ' ').toUpperCase();
    return [
      {
        month: label.length > 10 ? label.slice(0, 8) + '..' : label,
        Income: Math.round(totalIncome),
        Expenses: Math.round(totalExpenses)
      }
    ];
  }, [timeRange, totalIncome, totalExpenses]);

  // Savings rate calculation
  const savingsRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : 0;
  const netCashflow = totalIncome - totalExpenses;



  const CustomBarTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const inc = payload.find(p => p.dataKey === 'Income')?.value || 0;
      const exp = payload.find(p => p.dataKey === 'Expenses')?.value || 0;
      const net = inc - exp;
      return (
        <div style={{
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '10px 14px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          color: '#fff',
          fontSize: '0.8rem',
          minWidth: '150px'
        }}>
          <div style={{ fontWeight: '800', color: '#94a3b8', marginBottom: '6px', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            {label}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '3px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              Income:
            </span>
            <span style={{ fontWeight: '700', color: '#f8fafc' }}>{currency}{inc.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '6px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f43f5e' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f43f5e' }} />
              Expenses:
            </span>
            <span style={{ fontWeight: '700', color: '#f8fafc' }}>{currency}{exp.toLocaleString('en-IN')}</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Net:</span>
            <span style={{ fontWeight: '800', color: net >= 0 ? '#10b981' : '#f43f5e' }}>
              {net >= 0 ? '+' : ''}{currency}{net.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        
        {/* ─── CARD 1: Category Spending Donut & Ranked List ──────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(6,182,212,0.2) 0%, rgba(59,130,246,0.2) 100%)',
                border: '1px solid rgba(6,182,212,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <PieIcon size={18} color="#06b6d4" />
              </div>
              <div>
                <h3 className="font-heading" style={{ fontSize: '1.02rem', fontWeight: '700', color: '#fff', margin: 0 }}>
                  Expense Breakdown
                </h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {categoryData.length} categories active
                </div>
              </div>
            </div>
            {totalSpentInChart > 0 && (
              <div style={{
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.25)',
                padding: '4px 10px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: '800',
                color: '#f43f5e'
              }}>
                {currency}{totalSpentInChart.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </div>
            )}
          </div>

          {categoryData.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={36} style={{ opacity: 0.2 }} />
              No expense records found for this period.
            </div>
          ) : (
            <>
              {/* Donut Chart with Center Display */}
              <div style={{ width: '100%', height: 200, position: 'relative', margin: '4px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={88}
                      paddingAngle={4}
                      cornerRadius={5}
                      dataKey="value"
                      stroke="rgba(15, 23, 42, 0.9)"
                      strokeWidth={2}
                      onClick={(_, index) => setActiveIndex(prev => prev === index ? null : index)}
                      onMouseEnter={(_, index) => setActiveIndex(index)}
                      onMouseLeave={() => setActiveIndex(null)}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          opacity={activeIndex === null || activeIndex === index ? 1 : 0.35}
                          style={{
                            transition: 'opacity 0.2s ease, transform 0.2s ease',
                            outline: 'none',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center text in Donut (Clean & No Clutter) */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  maxWidth: '105px'
                }}>
                  <span style={{
                    fontSize: '0.62rem',
                    color: activeIndex !== null && categoryData[activeIndex] ? categoryData[activeIndex].color : 'var(--text-dim)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontWeight: '700',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '95px'
                  }}>
                    {activeIndex !== null && categoryData[activeIndex] ? categoryData[activeIndex].name : 'TOTAL EXPENSES'}
                  </span>
                  <span style={{
                    fontSize: '1.05rem',
                    fontWeight: '800',
                    color: '#f8fafc',
                    marginTop: '2px',
                    letterSpacing: '-0.02em',
                    lineHeight: '1.2'
                  }}>
                    {currency}{
                      activeIndex !== null && categoryData[activeIndex]
                        ? categoryData[activeIndex].value.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                        : totalSpentInChart > 99999
                          ? `${(totalSpentInChart / 1000).toFixed(1)}k`
                          : totalSpentInChart.toLocaleString('en-IN', { maximumFractionDigits: 0 })
                    }
                  </span>
                  {activeIndex !== null && categoryData[activeIndex] && (
                    <span style={{
                      fontSize: '0.65rem',
                      fontWeight: '700',
                      color: categoryData[activeIndex].color,
                      background: `${categoryData[activeIndex].color}22`,
                      padding: '1px 6px',
                      borderRadius: '4px',
                      marginTop: '3px'
                    }}>
                      {totalSpentInChart > 0 ? Math.round((categoryData[activeIndex].value / totalSpentInChart) * 100) : 0}%
                    </span>
                  )}
                </div>
              </div>

              {/* Ranked Category Progress List */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: '10px',
                maxHeight: '190px',
                overflowY: 'auto',
                paddingRight: '4px'
              }} className="hide-scrollbar">
                {categoryData.map((item, idx) => {
                  const percent = totalSpentInChart > 0 ? Math.round((item.value / totalSpentInChart) * 100) : 0;
                  const isSelected = activeIndex === idx;
                  return (
                    <div
                      key={item.id || item.name}
                      onClick={() => setActiveIndex(prev => prev === idx ? null : idx)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseLeave={() => setActiveIndex(null)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        padding: '7px 10px',
                        background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.025)',
                        border: `1px solid ${isSelected ? item.color : 'rgba(255, 255, 255, 0.05)'}`,
                        borderRadius: '10px',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                          <span style={{
                            width: '9px',
                            height: '9px',
                            borderRadius: '50%',
                            background: item.color,
                            boxShadow: `0 0 8px ${item.color}88`,
                            flexShrink: 0
                          }} />
                          <span style={{
                            color: isHovered ? '#fff' : 'var(--text-main)',
                            fontWeight: isHovered ? '700' : '500',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {item.name}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <span style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem' }}>
                            {currency}{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                          </span>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: '700',
                            color: item.color,
                            background: `${item.color}18`,
                            padding: '2px 6px',
                            borderRadius: '6px'
                          }}>
                            {percent}%
                          </span>
                        </div>
                      </div>

                      {/* Mini Progress Bar */}
                      <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.max(percent, 2)}%`,
                          height: '100%',
                          background: item.color,
                          borderRadius: '999px',
                          transition: 'width 0.4s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* ─── CARD 2: Cashflow Trends & Flow ────────────────────────────── */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
          
          {/* Card Header & View Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(6,182,212,0.2) 100%)',
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <TrendingUp size={18} color="#10b981" />
              </div>
              <div>
                <h3 className="font-heading" style={{ fontSize: '1.02rem', fontWeight: '700', color: '#fff', margin: 0 }}>
                  Cashflow Flow
                </h3>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Income vs Expenses
                </div>
              </div>
            </div>

            {/* View Pill Switcher */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <button
                type="button"
                onClick={() => setCashflowView('trend')}
                style={{
                  background: cashflowView === 'trend' ? 'rgba(16, 185, 129, 0.25)' : 'transparent',
                  color: cashflowView === 'trend' ? '#10b981' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                6-Mo Trend
              </button>
              <button
                type="button"
                onClick={() => setCashflowView('current')}
                style={{
                  background: cashflowView === 'current' ? 'rgba(6, 182, 212, 0.25)' : 'transparent',
                  color: cashflowView === 'current' ? '#06b6d4' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Period
              </button>
            </div>
          </div>

          {/* Quick Header Indicators */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', fontSize: '0.76rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', background: 'rgba(16, 185, 129, 0.08)', padding: '3px 8px', borderRadius: '6px' }}>
              <ArrowUpRight size={14} />
              <span>+{currency}{totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#f43f5e', background: 'rgba(244, 63, 94, 0.08)', padding: '3px 8px', borderRadius: '6px' }}>
              <ArrowDownRight size={14} />
              <span>-{currency}{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          {/* Recharts Bar Chart with Gradients */}
          <div style={{ width: '100%', height: 190, margin: '2px 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={cashflowView === 'trend' ? trendData : currentPeriodData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                barGap={4}
              >
                <defs>
                  <linearGradient id="incomeBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="expenseBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#be123c" stopOpacity={0.65} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                />
                <YAxis
                  stroke="#64748b"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={val => val > 999 ? `${(val/1000).toFixed(0)}k` : val}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar
                  dataKey="Income"
                  fill="url(#incomeBarGrad)"
                  radius={[5, 5, 2, 2]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="Expenses"
                  fill="url(#expenseBarGrad)"
                  radius={[5, 5, 2, 2]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* KPI Summary Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px',
            marginTop: '10px'
          }}>
            {/* Net Cashflow Pill */}
            <div style={{
              padding: '9px 12px',
              background: netCashflow >= 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(244, 63, 94, 0.06)',
              border: `1px solid ${netCashflow >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Net Flow
              </span>
              <span style={{
                fontSize: '0.88rem',
                fontWeight: '800',
                color: netCashflow >= 0 ? '#10b981' : '#f43f5e'
              }}>
                {netCashflow >= 0 ? '+' : ''}{currency}{netCashflow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>

            {/* Savings Rate Pill */}
            <div style={{
              padding: '9px 12px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Savings Rate
              </span>
              <span style={{
                fontSize: '0.88rem',
                fontWeight: '800',
                color: savingsRate >= 20 ? '#10b981' : savingsRate >= 0 ? '#f59e0b' : '#f43f5e'
              }}>
                {savingsRate}%
              </span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

