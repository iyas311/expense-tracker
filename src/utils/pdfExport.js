/**
 * Generates an A4 printable / savable PDF statement in a popup print window.
 */
export function exportPdfStatement({
  filteredTransactions = [],
  categories = [],
  accounts = [],
  timeRange = 'this_month',
  selectedDate = '',
  selectedMonth = '',
  totalIncome = 0,
  totalExpenses = 0,
  netWorth = 0,
  currency = '₹',
  currentVault = null
}) {
  let displayTime = timeRange.replace('_', ' ').toUpperCase();
  if (timeRange === 'custom_date') displayTime = `Date: ${selectedDate}`;
  if (timeRange === 'custom_month') {
    const [yr, mo] = (selectedMonth || '').split('-');
    if (yr && mo) {
      displayTime = new Date(yr, mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }
  }
  if (timeRange === 'this_month') {
    displayTime = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }

  const netSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;
  const expenseCategories = categories.filter(c => c.type === 'expense');

  // Category breakdown
  const categoryRows = expenseCategories.map(cat => {
    const spent = filteredTransactions
      .filter(t => t.type === 'expense' && t.categoryId === cat.id)
      .reduce((sum, t) => sum + t.amount, 0);
    const cap = parseFloat(cat.budgetCap) || 0;
    const pctOfExpenses = totalExpenses > 0 ? ((spent / totalExpenses) * 100).toFixed(1) : '0.0';
    const isOver = cap > 0 && spent > cap;
    return {
      name: cat.name,
      spent: spent,
      cap: cap,
      pct: pctOfExpenses,
      isOver
    };
  }).filter(c => c.spent > 0 || c.cap > 0);

  const printHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Financial Statement - ${displayTime}</title>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #1e293b;
          background: #ffffff;
          margin: 0;
          padding: 20px;
          font-size: 12px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 14px;
          margin-bottom: 20px;
        }
        .brand {
          font-size: 22px;
          font-weight: 800;
          color: #0284c7;
          letter-spacing: -0.5px;
        }
        .badge {
          display: inline-block;
          background: #e0f2fe;
          color: #0369a1;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          margin-top: 4px;
        }
        .meta {
          text-align: right;
          font-size: 11px;
          color: #64748b;
        }
        .grid-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 10px 12px;
        }
        .card-label {
          font-size: 10px;
          color: #64748b;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .card-value {
          font-size: 17px;
          font-weight: 800;
          margin-top: 4px;
        }
        .val-income { color: #059669; }
        .val-expense { color: #e11d48; }
        .val-savings { color: #0284c7; }
        .val-worth { color: #4f46e5; }
        
        h3 {
          font-size: 13px;
          font-weight: 700;
          color: #0f172a;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 6px;
          margin: 18px 0 10px 0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-bottom: 16px;
        }
        th {
          background: #f1f5f9;
          color: #475569;
          font-weight: 700;
          text-align: left;
          padding: 7px 10px;
          border-bottom: 1px solid #cbd5e1;
        }
        td {
          padding: 6px 10px;
          border-bottom: 1px solid #f1f5f9;
        }
        tr:nth-child(even) { background: #fafafa; }
        .text-right { text-align: right; }
        .tag-expense { color: #e11d48; font-weight: 600; }
        .tag-income { color: #059669; font-weight: 600; }
        .tag-transfer { color: #4f46e5; font-weight: 600; }
        .footer {
          margin-top: 24px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          font-size: 10px;
          color: #94a3b8;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">EXPENSIA AI</div>
          <div class="badge">Financial Statement · ${displayTime}</div>
        </div>
        <div class="meta">
          <div><strong>Vault:</strong> ${currentVault?.name || 'Main Vault'}</div>
          <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
          <div><strong>Total Transactions:</strong> ${filteredTransactions.length}</div>
        </div>
      </div>

      <div class="grid-summary">
        <div class="card">
          <div class="card-label">Total Income</div>
          <div class="card-value val-income">+${currency}${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Expenses</div>
          <div class="card-value val-expense">-${currency}${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Net Savings (${savingsRate}%)</div>
          <div class="card-value val-savings">${netSavings >= 0 ? '+' : ''}${currency}${netSavings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="card">
          <div class="card-label">Total Net Worth</div>
          <div class="card-value val-worth">${currency}${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <h3>Spending by Category</h3>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th class="text-right">Spent Amount</th>
            <th class="text-right">Budget Limit</th>
            <th class="text-right">% of Spending</th>
            <th class="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          ${categoryRows.length > 0 ? categoryRows.map(c => `
            <tr>
              <td><strong>${c.name}</strong></td>
              <td class="text-right">${currency}${c.spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              <td class="text-right">${c.cap > 0 ? `${currency}${c.cap.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'No Cap'}</td>
              <td class="text-right">${c.pct}%</td>
              <td class="text-right" style="color: ${c.isOver ? '#e11d48' : '#059669'}; font-weight: 700;">
                ${c.isOver ? '⚠️ Over Budget' : (c.cap > 0 ? '✓ Within Cap' : '—')}
              </td>
            </tr>
          `).join('') : '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No category expenses recorded in this period.</td></tr>'}
        </tbody>
      </table>

      <h3>Account Balances</h3>
      <table>
        <thead>
          <tr>
            <th>Account Name</th>
            <th>Type</th>
            <th class="text-right">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${accounts.map(a => `
            <tr>
              <td><strong>${a.name}</strong></td>
              <td style="text-transform: capitalize;">${a.type}</td>
              <td class="text-right" style="font-weight: 700; color: ${a.balance >= 0 ? '#059669' : '#e11d48'};">
                ${currency}${a.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <h3>Transaction History (${displayTime})</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description</th>
            <th>Category</th>
            <th>Account</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${filteredTransactions.length > 0 ? filteredTransactions.map(t => {
            const cat = categories.find(c => c.id === t.categoryId)?.name || 'General';
            const acc = accounts.find(a => a.id === t.accountId)?.name || 'Account';
            const isIncome = t.type === 'income';
            const isTransfer = t.type === 'transfer';
            return `
              <tr>
                <td>${t.date}</td>
                <td>
                  <strong>${t.description}</strong>
                  ${t.notes ? `<br/><span style="font-size:10px; color:#64748b;">${t.notes}</span>` : ''}
                </td>
                <td>${cat}</td>
                <td>${acc}</td>
                <td class="text-right ${isIncome ? 'tag-income' : (isTransfer ? 'tag-transfer' : 'tag-expense')}">
                  ${isIncome ? '+' : (isTransfer ? '🔄 ' : '-')}${currency}${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            `;
          }).join('') : '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No transactions found in this period.</td></tr>'}
        </tbody>
      </table>

      <div class="footer">
        Generated automatically by Expensia AI · Confidential Personal Financial Statement
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 350);
  }
}
