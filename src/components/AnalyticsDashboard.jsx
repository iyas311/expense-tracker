import React from 'react';
import { useExpense } from '../context/ExpenseContext';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, ArrowRight } from 'lucide-react';

export function AnalyticsDashboard() {
  const { categories, filteredTransactions, currency, totalIncome, totalExpenses, timeRange } = useExpense();

  // Category Pie Chart Data based on time view filter
  const categoryData = categories
    .filter(c => c.type === 'expense')
    .map(cat => {
      const value = filteredTransactions
        .filter(t => t.categoryId === cat.id && t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        id: cat.id,
        name: cat.name,
        value,
        color: cat.color || '#6366f1'
      };
    })
    .filter(item => item.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalSpentInChart = categoryData.reduce((sum, item) => sum + item.value, 0);

  // Income vs Expense Comparison Bar Data
  const barData = [
    { name: timeRange.replace('_', ' ').toUpperCase(), Income: totalIncome, Expenses: totalExpenses }
  ];

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
        
        {/* Donut Chart: Category Spending */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={18} color="#06b6d4" />
              <h3 className="font-heading" style={{ fontSize: '1.05rem', fontWeight: '700' }}>Expense Breakdown</h3>
            </div>
            {totalSpentInChart > 0 && (
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#f43f5e' }}>
                {currency}{totalSpentInChart.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
              </span>
            )}
          </div>

          {categoryData.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '36px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={32} style={{ opacity: 0.2 }} />
              No expense records found for this period.
            </div>
          ) : (
            <>
              {/* Donut Chart with Centered Total */}
              <div style={{ width: '100%', height: 200, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="rgba(15, 23, 42, 0.8)"
                      strokeWidth={2}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val) => [`${currency}${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Spent']}
                      contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: '#fff', fontSize: '0.8rem' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Center text in Donut */}
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none'
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {currency}{totalSpentInChart > 99999 ? `${(totalSpentInChart/1000).toFixed(1)}k` : totalSpentInChart.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </div>
              </div>

              {/* Custom Mobile-Friendly Legend & Breakdown Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '8px',
                marginTop: '12px',
                maxHeight: '160px',
                overflowY: 'auto',
                paddingRight: '4px'
              }} className="hide-scrollbar">
                {categoryData.map(item => {
                  const percent = totalSpentInChart > 0 ? Math.round((item.value / totalSpentInChart) * 100) : 0;
                  return (
                    <div
                      key={item.id || item.name}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid rgba(255, 255, 255, 0.05)',
                        borderRadius: '10px',
                        fontSize: '0.75rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <span style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: item.color,
                          flexShrink: 0
                        }} />
                        <span style={{
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '75px'
                        }}>
                          {item.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>
                          {currency}{item.value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>
                          {percent}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Bar Chart: Cashflow Comparison */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={18} color="#10b981" />
              <h3 className="font-heading" style={{ fontSize: '1.05rem', fontWeight: '700' }}>Cashflow Flow</h3>
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', fontWeight: '600' }}>
              <span style={{ color: '#10b981' }}>+{currency}{totalIncome.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
              <span style={{ color: '#f43f5e' }}>-{currency}{totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
            </div>
          </div>

          <div style={{ width: '100%', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 15, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  formatter={(val) => [`${currency}${val.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Amount']}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', color: '#fff', fontSize: '0.8rem' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Bar dataKey="Income" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cashflow Summary pill */}
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: totalIncome >= totalExpenses ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
            border: `1px solid ${totalIncome >= totalExpenses ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.78rem'
          }}>
            <span style={{ color: 'var(--text-muted)' }}>Net Savings for Period:</span>
            <span style={{ fontWeight: '800', color: totalIncome >= totalExpenses ? '#10b981' : '#f43f5e' }}>
              {totalIncome >= totalExpenses ? '+' : ''}{currency}{(totalIncome - totalExpenses).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
