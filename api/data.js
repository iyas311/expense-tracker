import { neon } from '@neondatabase/serverless';

function getSql() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL;
  if (!dbUrl) throw new Error('No Database URL found in environment variables.');
  return neon(dbUrl);
}

async function ensureTablesExist(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS categories (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(32) NOT NULL,
        budget_cap NUMERIC(12, 2) DEFAULT 0,
        is_auto_budget BOOLEAN DEFAULT FALSE,
        color VARCHAR(32) DEFAULT '#8b5cf6',
        icon VARCHAR(64) DEFAULT 'Tag'
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(32) NOT NULL,
        balance NUMERIC(12, 2) DEFAULT 0,
        credit_limit NUMERIC(12, 2) DEFAULT 0,
        color VARCHAR(32) DEFAULT '#06b6d4',
        icon VARCHAR(64) DEFAULT 'Landmark'
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        date VARCHAR(32) NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(32) NOT NULL,
        category_id VARCHAR(64),
        account_id VARCHAR(64),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        category_id VARCHAR(64),
        account_id VARCHAR(64),
        billing_cycle VARCHAR(32) DEFAULT 'monthly',
        next_due_date VARCHAR(32)
      );
    `;

    // Seed default categories if empty
    const categoriesCount = await sql`SELECT COUNT(*) FROM categories;`;
    if (parseInt(categoriesCount[0].count) === 0) {
      const defaults = [
        ['cat-1', 'Food & Dining', 'expense', 0, false, '#f43f5e', 'Utensils'],
        ['cat-2', 'Groceries', 'expense', 0, false, '#10b981', 'ShoppingCart'],
        ['cat-3', 'Transport & Fuel', 'expense', 0, false, '#06b6d4', 'Car'],
        ['cat-4', 'Bills & Utilities', 'expense', 0, false, '#f59e0b', 'Zap'],
        ['cat-5', 'Entertainment', 'expense', 0, false, '#8b5cf6', 'Film'],
        ['cat-6', 'Shopping', 'expense', 0, false, '#ec4899', 'ShoppingBag'],
        ['cat-7', 'Salary & Income', 'income', 0, false, '#10b981', 'DollarSign']
      ];
      for (const [id, name, type, budgetCap, isAuto, color, icon] of defaults) {
        await sql`INSERT INTO categories (id, name, type, budget_cap, is_auto_budget, color, icon) VALUES (${id}, ${name}, ${type}, ${budgetCap}, ${isAuto}, ${color}, ${icon}) ON CONFLICT DO NOTHING;`;
      }
    }

    // Seed default accounts if empty
    const accountsCount = await sql`SELECT COUNT(*) FROM accounts;`;
    if (parseInt(accountsCount[0].count) === 0) {
      const defaultAccs = [
        ['acc-1', 'Main Bank Account', 'bank', 0.00, 0, '#6366f1', 'Landmark'],
        ['acc-2', 'Rewards Credit Card', 'card', 0.00, 5000, '#f43f5e', 'CreditCard'],
        ['acc-3', 'Cash Wallet', 'cash', 0.00, 0, '#10b981', 'Wallet'],
        ['acc-4', 'Emergency Savings', 'savings', 0.00, 0, '#06b6d4', 'PiggyBank']
      ];
      for (const [id, name, type, balance, creditLimit, color, icon] of defaultAccs) {
        await sql`INSERT INTO accounts (id, name, type, balance, credit_limit, color, icon) VALUES (${id}, ${name}, ${type}, ${balance}, ${creditLimit}, ${color}, ${icon}) ON CONFLICT DO NOTHING;`;
      }
    }
  } catch (e) {
    console.error('ensureTablesExist error:', e);
  }
}

export default async function handler(req, res) {
  try {
    const sql = getSql();

    if (req.method === 'GET') {
      await ensureTablesExist(sql);

      const rawCategories = await sql`SELECT id, name, type, budget_cap as "budgetCap", is_auto_budget as "isAutoBudget", color, icon FROM categories ORDER BY name ASC;`;
      const rawAccounts = await sql`SELECT id, name, type, balance, credit_limit as "creditLimit", color, icon FROM accounts ORDER BY name ASC;`;
      const rawTransactions = await sql`SELECT id, date, description, amount, type, category_id as "categoryId", account_id as "accountId", notes FROM transactions ORDER BY date DESC, created_at DESC;`;
      const rawSubscriptions = await sql`SELECT id, name, amount, category_id as "categoryId", account_id as "accountId", billing_cycle as "billingCycle", next_due_date as "nextDueDate" FROM subscriptions;`;

      const categories = (rawCategories || []).map(c => ({
        ...c,
        budgetCap: parseFloat(c.budgetCap) || 0,
        isAutoBudget: Boolean(c.isAutoBudget)
      }));

      const accounts = (rawAccounts || []).map(a => ({
        ...a,
        balance: parseFloat(a.balance) || 0,
        creditLimit: parseFloat(a.creditLimit) || 0
      }));

      const transactions = (rawTransactions || []).map(t => ({
        ...t,
        amount: parseFloat(t.amount) || 0
      }));

      const subscriptions = (rawSubscriptions || []).map(s => ({
        ...s,
        amount: parseFloat(s.amount) || 0
      }));

      return res.status(200).json({ categories, accounts, transactions, subscriptions });
    }

    if (req.method === 'POST') {
      await ensureTablesExist(sql);
      const { action, payload } = req.body;

      if (action === 'addTransaction') {
        const { id, date, description, amount, type, categoryId, accountId, notes } = payload;
        await sql`
          INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes)
          VALUES (${id}, ${date}, ${description}, ${amount}, ${type}, ${categoryId}, ${accountId}, ${notes || ''});
        `;

        const delta = type === 'income' ? amount : -amount;
        await sql`
          UPDATE accounts SET balance = balance + ${delta} WHERE id = ${accountId};
        `;

        return res.status(200).json({ success: true });
      }

      if (action === 'deleteTransaction') {
        const { id } = payload;
        const rows = await sql`SELECT amount, type, account_id FROM transactions WHERE id = ${id};`;
        if (rows.length > 0) {
          const { amount, type, account_id } = rows[0];
          const delta = type === 'income' ? -amount : amount;
          await sql`UPDATE accounts SET balance = balance + ${delta} WHERE id = ${account_id};`;
          await sql`DELETE FROM transactions WHERE id = ${id};`;
        }
        return res.status(200).json({ success: true });
      }

      if (action === 'addCategory') {
        const { id, name, type, budgetCap, isAutoBudget, color, icon } = payload;
        await sql`
          INSERT INTO categories (id, name, type, budget_cap, is_auto_budget, color, icon)
          VALUES (${id}, ${name}, ${type}, ${budgetCap || 0}, ${isAutoBudget || false}, ${color || '#8b5cf6'}, ${icon || 'Tag'});
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'updateBudget') {
        const { id, budgetCap, isAutoBudget } = payload;
        await sql`
          UPDATE categories SET budget_cap = ${budgetCap || 0}, is_auto_budget = ${isAutoBudget || false} WHERE id = ${id};
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'addAccount') {
        const { id, name, type, balance, creditLimit, color, icon } = payload;
        await sql`
          INSERT INTO accounts (id, name, type, balance, credit_limit, color, icon)
          VALUES (${id}, ${name}, ${type}, ${balance || 0}, ${creditLimit || 0}, ${color || '#06b6d4'}, ${icon || 'Landmark'});
        `;
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Server Database Error:', error);
    return res.status(500).json({ error: error.message, offline: true });
  }
}
