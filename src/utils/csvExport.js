/**
 * Generates and downloads a CSV export of filtered transactions and budget summary.
 */
export function exportCsv({
  filteredTransactions = [],
  categories = [],
  accounts = [],
  timeRange = 'this_month',
  selectedDate = '',
  selectedMonth = '',
  totalIncome = 0,
  totalExpenses = 0,
  currency = '₹',
  currentVault = null
}) {
  // 1. Export filtered transactions
  const headers = ['Date', 'Budget Month', 'Type', 'Description', 'Amount', 'Category', 'Account', 'Notes', 'Transaction ID'];
  const rows = filteredTransactions.map(t => {
    const cat = categories.find(c => c.id === t.categoryId)?.name || 'General';
    const acc = accounts.find(a => a.id === t.accountId)?.name || 'Account';
    const bMonth = t.budgetMonth || t.date.slice(0, 7);
    return [
      t.date,
      bMonth,
      t.type,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.amount,
      `"${cat}"`,
      `"${acc}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`,
      t.id
    ].join(',');
  });

  // 2. Budget status calculations
  const expenseCategories = categories.filter(c => c.type === 'expense');
  const totalBudgetCap = expenseCategories.reduce((s, c) => s + (parseFloat(c.budgetCap) || 0), 0);
  const budgetRemaining = totalBudgetCap - totalExpenses;
  const isOverBudget = budgetRemaining < 0;

  let displayTime = timeRange.replace('_', ' ').toUpperCase();
  if (timeRange === 'custom_date') displayTime = `DATE: ${selectedDate}`;
  if (timeRange === 'custom_month') displayTime = `MONTH: ${selectedMonth}`;

  const reportLines = [
    '',
    '',
    '"--- FINANCIAL REPORT FOR SELECTED PERIOD ---"',
    `"Time Period:","${displayTime}"`,
    `"Total Income:","${currency}${totalIncome.toFixed(2)}"`,
    `"Total Expenses:","${currency}${totalExpenses.toFixed(2)}"`,
    `"Net Savings:","${currency}${(totalIncome - totalExpenses).toFixed(2)}"`,
    '',
    '"--- BUDGET STATUS ---"',
    `"Total Monthly Budget Cap:","${currency}${totalBudgetCap.toFixed(2)}"`,
    `"Total Spent in Period:","${currency}${totalExpenses.toFixed(2)}"`,
    `"Remaining Budget:","${currency}${budgetRemaining.toFixed(2)}"`,
    `"Status:","${isOverBudget ? 'OVER BUDGET' : 'ON TRACK'}"`
  ];

  const csvContent = [headers.join(','), ...rows, ...reportLines].join('\n');
  // Prepend UTF-8 BOM (\uFEFF) so Excel correctly parses currency symbols like ₹
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expensia_${currentVault?.name || 'vault'}_${timeRange}_${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
