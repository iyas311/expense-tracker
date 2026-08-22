import React from 'react';
import { useExpense } from '../context/ExpenseContext';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { TrendingUp, PieChart as PieIcon } from 'lucide-react';

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
        name: cat.name,
        value,
        color: cat.color || '#6366f1'
      };
    })
    .filter(item => item.value > 0);

  // Income vs Expense Comparison Bar Data
  const barData = [
    { name: timeRange.replace('_', ' ').toUpperCase(), Income: totalIncome, Expenses: totalExpenses }
  ];

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Donut Chart: Category Spending */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <PieIcon size={20} color="#06b6d4" />
            <h3 className="font-heading" style={{ fontSize: '1.15rem' }}>Expense Breakdown by Category</h3>
          </div>

          {categoryData.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>
              No expense records found for this period.
            </p>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val) => [`${currency}${val.toFixed(2)}`, 'Spent']}
                    contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Bar Chart: Cashflow Comparison */}
        <div className="glass-card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <TrendingUp size={20} color="#10b981" />
            <h3 className="font-heading" style={{ fontSize: '1.15rem' }}>Income vs Expenses Flow</h3>
          </div>

          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={barData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  formatter={(val) => [`${currency}${val.toFixed(2)}`, 'Amount']}
                  contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                />
                <Legend verticalAlign="bottom" height={36} />
                <Bar dataKey="Income" fill="#10b981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
