import { neon } from '@neondatabase/serverless';

// Simple in-memory rate limiter (resets on cold start, good enough for burst protection)
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 60;
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= max) return true;
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

function getSql() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL;
  if (!dbUrl) throw new Error('No Database URL found in environment variables.');
  return neon(dbUrl);
}

async function runMigrations(sql) {
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0;`; } catch (e) {}
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(12,2) DEFAULT 0;`; } catch (e) {}
  try { await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_id VARCHAR(64);`; } catch (e) {}
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_settings (key VARCHAR(64) PRIMARY KEY, value TEXT NOT NULL);`;
  } catch (e) {}
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_logs (
      id SERIAL PRIMARY KEY,
      level VARCHAR(16) NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
  } catch (e) {}
}

async function ensureTablesExist(sql) {
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
      initial_balance NUMERIC(12, 2) DEFAULT 0,
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
      transfer_id VARCHAR(64),
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
  await sql`
    CREATE TABLE IF NOT EXISTS app_settings (
      key VARCHAR(64) PRIMARY KEY,
      value TEXT NOT NULL
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS app_logs (
      id SERIAL PRIMARY KEY,
      level VARCHAR(16) NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      meta JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Seed defaults
  const catCount = await sql`SELECT COUNT(*) as count FROM categories;`;
  if (parseInt(catCount[0].count) === 0) {
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

  const accCount = await sql`SELECT COUNT(*) as count FROM accounts;`;
  if (parseInt(accCount[0].count) === 0) {
    const defaultAccs = [
      ['acc-1', 'Main Bank Account', 'bank', 0, 0, '#6366f1', 'Landmark'],
      ['acc-2', 'Rewards Credit Card', 'card', 0, 50000, '#f43f5e', 'CreditCard'],
      ['acc-3', 'Cash Wallet', 'cash', 0, 0, '#10b981', 'Wallet'],
      ['acc-4', 'Emergency Savings', 'savings', 0, 0, '#06b6d4', 'PiggyBank']
    ];
    for (const [id, name, type, balance, creditLimit, color, icon] of defaultAccs) {
      await sql`INSERT INTO accounts (id, name, type, balance, initial_balance, credit_limit, color, icon) VALUES (${id}, ${name}, ${type}, ${balance}, ${balance}, ${creditLimit}, ${color}, ${icon}) ON CONFLICT DO NOTHING;`;
    }
  }

  await sql`INSERT INTO app_settings (key, value) VALUES ('passcode', '3311') ON CONFLICT DO NOTHING;`;
  await sql`INSERT INTO app_settings (key, value) VALUES ('currency', '₹') ON CONFLICT DO NOTHING;`;
}

// Compute balances from transactions (source of truth)
async function getComputedAccounts(sql) {
  const accounts = await sql`SELECT id, name, type, initial_balance as "initialBalance", credit_limit as "creditLimit", color, icon FROM accounts ORDER BY name ASC;`;
  const txSums = await sql`
    SELECT account_id,
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income_sum,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expense_sum
    FROM transactions
    GROUP BY account_id;
  `;
  const sumMap = {};
  for (const row of txSums) {
    sumMap[row.account_id] = { income: parseFloat(row.income_sum) || 0, expense: parseFloat(row.expense_sum) || 0 };
  }
  return accounts.map(a => {
    const sums = sumMap[a.id] || { income: 0, expense: 0 };
    const initialBalance = parseFloat(a.initialBalance) || 0;
    const balance = Math.round((initialBalance + sums.income - sums.expense) * 100) / 100;
    return {
      id: a.id,
      name: a.name,
      type: a.type,
      balance,
      initialBalance,
      creditLimit: parseFloat(a.creditLimit) || 0,
      color: a.color,
      icon: a.icon
    };
  });
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Rate limiting
  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  try {
    const sql = getSql();

    if (req.method === 'GET') {
      await runMigrations(sql);
      await ensureTablesExist(sql);

      const rawCategories = await sql`SELECT id, name, type, budget_cap as "budgetCap", is_auto_budget as "isAutoBudget", color, icon FROM categories ORDER BY name ASC;`;
      const accounts = await getComputedAccounts(sql);
      const rawTransactions = await sql`SELECT id, date, description, amount, type, category_id as "categoryId", account_id as "accountId", notes, transfer_id as "transferId" FROM transactions ORDER BY date DESC, created_at DESC;`;
      const rawSubscriptions = await sql`SELECT id, name, amount, category_id as "categoryId", account_id as "accountId", billing_cycle as "billingCycle", next_due_date as "nextDueDate" FROM subscriptions;`;
      const rawSettings = await sql`SELECT key, value FROM app_settings;`;

      const settings = {};
      for (const row of rawSettings) settings[row.key] = row.value;

      const categories = rawCategories.map(c => ({ ...c, budgetCap: parseFloat(c.budgetCap) || 0, isAutoBudget: Boolean(c.isAutoBudget) }));
      const transactions = rawTransactions.map(t => ({ ...t, amount: parseFloat(t.amount) || 0 }));
      const subscriptions = rawSubscriptions.map(s => ({ ...s, amount: parseFloat(s.amount) || 0 }));

      return res.status(200).json({ categories, accounts, transactions, subscriptions, settings });
    }

    if (req.method === 'POST') {
      await runMigrations(sql);
      await ensureTablesExist(sql);
      const { action, payload } = req.body;

      // --- ADD TRANSACTION ---
      if (action === 'addTransaction') {
        const { id, date, description, amount, type, categoryId, accountId, notes, transferId } = payload;
        await sql`INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, transfer_id)
          VALUES (${id}, ${date}, ${description}, ${amount}, ${type}, ${categoryId || null}, ${accountId}, ${notes || ''}, ${transferId || null});`;
        return res.status(200).json({ success: true });
      }

      // --- EDIT TRANSACTION ---
      if (action === 'updateTransaction') {
        const { id, date, description, amount, type, categoryId, accountId, notes } = payload;
        await sql`UPDATE transactions SET date=${date}, description=${description}, amount=${amount}, type=${type}, category_id=${categoryId || null}, account_id=${accountId}, notes=${notes || ''} WHERE id=${id};`;
        return res.status(200).json({ success: true });
      }

      // --- DELETE TRANSACTION ---
      if (action === 'deleteTransaction') {
        const { id } = payload;
        await sql`DELETE FROM transactions WHERE id=${id} OR transfer_id=${id};`;
        return res.status(200).json({ success: true });
      }

      // --- TRANSFER BETWEEN ACCOUNTS ---
      if (action === 'addTransfer') {
        const { fromAccountId, toAccountId, amount, date, notes } = payload;
        const transferId = `tfr-${Date.now()}`;
        const txOutId = `tx-out-${Date.now()}`;
        const txInId = `tx-in-${Date.now() + 1}`;
        await sql`INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, transfer_id)
          VALUES (${txOutId}, ${date}, ${'Transfer Out'}, ${amount}, ${'transfer'}, ${null}, ${fromAccountId}, ${notes || ''}, ${transferId});`;
        await sql`INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, transfer_id)
          VALUES (${txInId}, ${date}, ${'Transfer In'}, ${amount}, ${'income'}, ${null}, ${toAccountId}, ${notes || ''}, ${transferId});`;
        return res.status(200).json({ success: true, transferId });
      }

      // --- ADD CATEGORY ---
      if (action === 'addCategory') {
        const { id, name, type, budgetCap, isAutoBudget, color, icon } = payload;
        await sql`INSERT INTO categories (id, name, type, budget_cap, is_auto_budget, color, icon) VALUES (${id}, ${name}, ${type}, ${budgetCap || 0}, ${isAutoBudget || false}, ${color || '#8b5cf6'}, ${icon || 'Tag'});`;
        return res.status(200).json({ success: true });
      }

      // --- UPDATE BUDGET ---
      if (action === 'updateBudget') {
        const { id, budgetCap, isAutoBudget } = payload;
        await sql`UPDATE categories SET budget_cap=${budgetCap || 0}, is_auto_budget=${isAutoBudget || false} WHERE id=${id};`;
        return res.status(200).json({ success: true });
      }

      // --- ADD ACCOUNT ---
      if (action === 'addAccount') {
        const { id, name, type, balance, creditLimit, color, icon } = payload;
        const bal = parseFloat(balance) || 0;
        await sql`INSERT INTO accounts (id, name, type, balance, initial_balance, credit_limit, color, icon) VALUES (${id}, ${name}, ${type}, ${bal}, ${bal}, ${creditLimit || 0}, ${color || '#06b6d4'}, ${icon || 'Landmark'});`;
        return res.status(200).json({ success: true });
      }

      // --- ADD SUBSCRIPTION ---
      if (action === 'addSubscription') {
        const { id, name, amount, categoryId, accountId, billingCycle, nextDueDate } = payload;
        await sql`INSERT INTO subscriptions (id, name, amount, category_id, account_id, billing_cycle, next_due_date) VALUES (${id}, ${name}, ${amount}, ${categoryId}, ${accountId}, ${billingCycle || 'monthly'}, ${nextDueDate}) ON CONFLICT DO NOTHING;`;
        return res.status(200).json({ success: true });
      }

      // --- PROCESS RECURRING SUBSCRIPTIONS ---
      if (action === 'processRecurring') {
        const today = new Date().toISOString().split('T')[0];
        const dueSubs = await sql`SELECT * FROM subscriptions WHERE next_due_date <= ${today};`;
        const created = [];
        for (const sub of dueSubs) {
          const txId = `tx-${Date.now()}-${sub.id}`;
          await sql`INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes)
            VALUES (${txId}, ${sub.next_due_date}, ${sub.name}, ${sub.amount}, ${'expense'}, ${sub.category_id}, ${sub.account_id}, ${'Auto-recurring'})
            ON CONFLICT DO NOTHING;`;
          // Advance next due date
          const nextDate = new Date(sub.next_due_date);
          if (sub.billing_cycle === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else if (sub.billing_cycle === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (sub.billing_cycle === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
          const nextDueDateStr = nextDate.toISOString().split('T')[0];
          await sql`UPDATE subscriptions SET next_due_date=${nextDueDateStr} WHERE id=${sub.id};`;
          created.push({ id: txId, name: sub.name, amount: sub.amount });
        }
        return res.status(200).json({ success: true, created });
      }

      // --- UPDATE PASSCODE ---
      if (action === 'updatePasscode') {
        const { passcode } = payload;
        await sql`INSERT INTO app_settings (key, value) VALUES ('passcode', ${passcode}) ON CONFLICT (key) DO UPDATE SET value=${passcode};`;
        return res.status(200).json({ success: true });
      }

      // --- UPDATE SETTING (currency etc) ---
      if (action === 'updateSetting') {
        const { key, value } = payload;
        await sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value=${value};`;
        return res.status(200).json({ success: true });
      }

      // --- CLEAR ALL DATA ---
      if (action === 'clearAllData') {
        await sql`DELETE FROM transactions;`;
        await sql`UPDATE accounts SET balance=0, initial_balance=0;`;
        return res.status(200).json({ success: true });
      }

      // --- ADD LOG ---
      if (action === 'addLog') {
        const { level, message, meta } = payload;
        await sql`INSERT INTO app_logs (level, message, meta) VALUES (${level || 'info'}, ${message}, ${JSON.stringify(meta || {})});`;
        return res.status(200).json({ success: true });
      }

      // --- GET LOGS ---
      if (action === 'getLogs') {
        const logs = await sql`SELECT id, level, message, meta, created_at as "createdAt" FROM app_logs ORDER BY created_at DESC LIMIT 100;`;
        return res.status(200).json({ logs });
      }

      // --- CLEAR LOGS ---
      if (action === 'clearLogs') {
        await sql`DELETE FROM app_logs;`;
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('DB Error:', error.message);
    return res.status(500).json({ offline: true, error: error.message });
  }
}
