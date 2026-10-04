import { neon } from '@neondatabase/serverless';
import { hashPassword } from './auth.js';

export function getSql() {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL;
  if (!dbUrl) throw new Error('No Database URL found in environment variables.');
  return neon(dbUrl);
}

export async function runMigrations(sql) {
  // Vaults table (legacy, kept for foreign key references if any)
  await sql`
    CREATE TABLE IF NOT EXISTS app_vaults (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      passcode VARCHAR(64) UNIQUE NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 1. Users and Sessions tables
  await sql`
    CREATE TABLE IF NOT EXISTS app_users (
      id VARCHAR(64) PRIMARY KEY,
      username VARCHAR(128) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) DEFAULT 'user',
      vault_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS app_sessions (
      token VARCHAR(128) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      vault_id VARCHAR(64) NOT NULL,
      role VARCHAR(32) NOT NULL,
      expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Insert default admin if no users exist
  try {
    const usersCount = await sql`SELECT COUNT(*) as count FROM app_users;`;
    if (parseInt(usersCount[0].count) === 0) {
      await sql`
        INSERT INTO app_users (id, username, password_hash, role, vault_id)
        VALUES ('user_admin', 'admin', ${hashPassword('password123')}, 'admin', 'vault_admin');
      `;
    }
  } catch (e) {}

  // 2. Add vault_id column to core tables
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS vault_id VARCHAR(64) DEFAULT 'vault_admin';`; } catch (e) {}
  try { await sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS vault_id VARCHAR(64) DEFAULT 'vault_admin';`; } catch (e) {}
  try { await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS vault_id VARCHAR(64) DEFAULT 'vault_admin';`; } catch (e) {}
  try { await sql`ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS vault_id VARCHAR(64) DEFAULT 'vault_admin';`; } catch (e) {}
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) DEFAULT 0;`; } catch (e) {}
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS initial_balance NUMERIC(12,2) DEFAULT 0;`; } catch (e) {}
  try { await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transfer_id VARCHAR(64);`; } catch (e) {}

  // Billing cycle fields on accounts
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS statement_day INT DEFAULT NULL;`; } catch (e) {}
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_day INT DEFAULT NULL;`; } catch (e) {}
  try { await sql`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS due_month_offset INT DEFAULT 1;`; } catch (e) {}

  // Debts table
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_debts (
      id VARCHAR(64) PRIMARY KEY,
      vault_id VARCHAR(64) NOT NULL,
      person_name VARCHAR(255) NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      direction VARCHAR(16) NOT NULL DEFAULT 'lent',
      reason TEXT DEFAULT '',
      date_created DATE NOT NULL,
      due_date DATE,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      settled_amount NUMERIC(12,2) DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
  } catch (e) {}

  // Split expense and salary budget_month support
  try { await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS bank_amount NUMERIC(12,2) DEFAULT NULL;`; } catch (e) {}
  try { await sql`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS budget_month VARCHAR(7) DEFAULT NULL;`; } catch (e) {}

  // 3. Settings and Logs tables
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
  try {
    await sql`CREATE TABLE IF NOT EXISTS app_prompt_history (
      id SERIAL PRIMARY KEY,
      text TEXT NOT NULL,
      tx_count INTEGER DEFAULT 1,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );`;
  } catch (e) {}

  // 4. Migrate any null vault_ids to 'vault_admin'
  try { await sql`UPDATE accounts SET vault_id = 'vault_admin' WHERE vault_id IS NULL;`; } catch (e) {}
  try { await sql`UPDATE categories SET vault_id = 'vault_admin' WHERE vault_id IS NULL;`; } catch (e) {}
  try { await sql`UPDATE transactions SET vault_id = 'vault_admin' WHERE vault_id IS NULL;`; } catch (e) {}
  try { await sql`UPDATE subscriptions SET vault_id = 'vault_admin' WHERE vault_id IS NULL;`; } catch (e) {}

  // 5. Database Indexes for high-speed indexing & querying
  try { await sql`CREATE INDEX IF NOT EXISTS idx_tx_vault_date ON transactions(vault_id, date DESC);`; } catch (e) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);`; } catch (e) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_sessions_token ON app_sessions(token);`; } catch (e) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_debts_vault ON app_debts(vault_id);`; } catch (e) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_accounts_vault ON accounts(vault_id);`; } catch (e) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_categories_vault ON categories(vault_id);`; } catch (e) {}
  try { await sql`CREATE INDEX IF NOT EXISTS idx_subscriptions_vault ON subscriptions(vault_id);`; } catch (e) {}

  // 6. Ensure Admin Vault exists in app_vaults
  const adminVaults = await sql`SELECT id, passcode FROM app_vaults WHERE id = 'vault_admin' OR is_admin = TRUE;`;
  if (adminVaults.length === 0) {
    let adminPass = '3311';
    try {
      const savedPass = await sql`SELECT value FROM app_settings WHERE key = 'passcode';`;
      if (savedPass.length > 0 && savedPass[0].value) adminPass = savedPass[0].value;
    } catch (e) {}
    await sql`INSERT INTO app_vaults (id, name, passcode, is_admin) VALUES ('vault_admin', 'Admin Vault', ${adminPass}, TRUE) ON CONFLICT (id) DO NOTHING;`;
  }

  // 6. Ensure Loans & Debts category exists for vaults
  try {
    const vaults = await sql`SELECT DISTINCT vault_id FROM categories;`;
    for (const v of vaults) {
      if (!v.vault_id) continue;
      const debtCat = await sql`SELECT id FROM categories WHERE vault_id = ${v.vault_id} AND (name ILIKE '%debt%' OR name ILIKE '%loan%');`;
      if (debtCat.length === 0) {
        await sql`INSERT INTO categories (id, name, type, budget_cap, is_auto_budget, color, icon, vault_id)
          VALUES (${'cat-debt-' + v.vault_id}, 'Loans & Debts', 'expense', 0, FALSE, '#f59e0b', 'HandCoins', ${v.vault_id})
          ON CONFLICT DO NOTHING;`;
      }
    }
  } catch (e) {}
}

export async function ensureTablesExist(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(32) NOT NULL,
      budget_cap NUMERIC(12, 2) DEFAULT 0,
      is_auto_budget BOOLEAN DEFAULT FALSE,
      color VARCHAR(32) DEFAULT '#8b5cf6',
      icon VARCHAR(64) DEFAULT 'Tag',
      vault_id VARCHAR(64) DEFAULT 'vault_admin'
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
      icon VARCHAR(64) DEFAULT 'Landmark',
      vault_id VARCHAR(64) DEFAULT 'vault_admin',
      statement_day INT DEFAULT NULL,
      due_day INT DEFAULT NULL,
      due_month_offset INT DEFAULT 1
    );
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS transactions (
      id VARCHAR(64) PRIMARY KEY,
      date DATE NOT NULL,
      description VARCHAR(255) NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      type VARCHAR(32) NOT NULL,
      category_id VARCHAR(64),
      account_id VARCHAR(64),
      notes TEXT,
      transfer_id VARCHAR(64),
      vault_id VARCHAR(64) DEFAULT 'vault_admin',
      budget_month VARCHAR(7) DEFAULT NULL,
      bank_amount NUMERIC(12,2) DEFAULT NULL,
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
      next_due_date VARCHAR(32),
      vault_id VARCHAR(64) DEFAULT 'vault_admin'
    );
  `;

  // Seed default categories for vault_admin if empty
  const catCount = await sql`SELECT COUNT(*) as count FROM categories WHERE vault_id = 'vault_admin';`;
  if (parseInt(catCount[0].count) === 0) {
    await seedStarterCategories(sql, 'vault_admin');
  }

  const accCount = await sql`SELECT COUNT(*) as count FROM accounts WHERE vault_id = 'vault_admin';`;
  if (parseInt(accCount[0].count) === 0) {
    await seedStarterAccounts(sql, 'vault_admin');
  }

  await sql`INSERT INTO app_settings (key, value) VALUES ('currency', '₹') ON CONFLICT DO NOTHING;`;
}

export async function seedStarterCategories(sql, vaultId) {
  const defaults = [
    [`cat-1-${vaultId}`, 'Food & Dining', 'expense', 0, false, '#f43f5e', 'Utensils'],
    [`cat-2-${vaultId}`, 'Groceries', 'expense', 0, false, '#10b981', 'ShoppingCart'],
    [`cat-3-${vaultId}`, 'Transportation', 'expense', 0, false, '#0284c7', 'Car'],
    [`cat-fuel-${vaultId}`, 'Fuel', 'expense', 0, false, '#f97316', 'Fuel'],
    [`cat-4-${vaultId}`, 'Bills & Utilities', 'expense', 0, false, '#f59e0b', 'Zap'],
    [`cat-5-${vaultId}`, 'Entertainment', 'expense', 0, false, '#8b5cf6', 'Film'],
    [`cat-6-${vaultId}`, 'Shopping', 'expense', 0, false, '#ec4899', 'ShoppingBag'],
    [`cat-7-${vaultId}`, 'Loans & Debts', 'expense', 0, false, '#be123c', 'HandCoins'],
    [`cat-8-${vaultId}`, 'Salary & Income', 'income', 0, false, '#22c55e', 'DollarSign']
  ];
  for (const [id, name, type, budgetCap, isAuto, color, icon] of defaults) {
    await sql`INSERT INTO categories (id, name, type, budget_cap, is_auto_budget, color, icon, vault_id) VALUES (${id}, ${name}, ${type}, ${budgetCap}, ${isAuto}, ${color}, ${icon}, ${vaultId}) ON CONFLICT DO NOTHING;`;
  }
}

export async function seedStarterAccounts(sql, vaultId) {
  const defaultAccs = [
    [`acc-1-${vaultId}`, 'Main Bank Account', 'bank', 0, 0, 0, '#6366f1', 'Landmark'],
    [`acc-2-${vaultId}`, 'Rewards Credit Card', 'card', 0, 0, 50000, '#f43f5e', 'CreditCard'],
    [`acc-3-${vaultId}`, 'Cash Wallet', 'cash', 0, 0, 0, '#10b981', 'Wallet'],
    [`acc-4-${vaultId}`, 'Emergency Savings', 'savings', 0, 0, 0, '#06b6d4', 'PiggyBank']
  ];
  for (const [id, name, type, balance, initialBalance, creditLimit, color, icon] of defaultAccs) {
    await sql`INSERT INTO accounts (id, name, type, balance, initial_balance, credit_limit, color, icon, vault_id) VALUES (${id}, ${name}, ${type}, ${balance}, ${initialBalance}, ${creditLimit}, ${color}, ${icon}, ${vaultId}) ON CONFLICT DO NOTHING;`;
  }
}

// Compute balances per vault from transactions (source of truth)
export async function getComputedAccounts(sql, vaultId) {
  const accounts = await sql`
    SELECT id, name, type, initial_balance as "initialBalance", credit_limit as "creditLimit", color, icon, vault_id as "vaultId", statement_day as "statementDay", due_day as "dueDay", due_month_offset as "dueMonthOffset"
    FROM accounts
    WHERE vault_id = ${vaultId}
    ORDER BY name ASC;
  `;
  const txSums = await sql`
    SELECT account_id,
      SUM(CASE WHEN type IN ('income', 'transfer_in') THEN amount ELSE 0 END) as income_sum,
      SUM(CASE WHEN type IN ('expense', 'transfer_out', 'transfer') THEN COALESCE(bank_amount, amount) ELSE 0 END) as expense_sum
    FROM transactions
    WHERE vault_id = ${vaultId}
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
      icon: a.icon,
      vaultId: a.vaultId,
      statementDay: a.statementDay ? parseInt(a.statementDay) : null,
      dueDay: a.dueDay ? parseInt(a.dueDay) : null,
      dueMonthOffset: a.dueMonthOffset !== null ? parseInt(a.dueMonthOffset) : 1,
    };
  });
}

// Helper to fetch all data for a specific vault
export async function getVaultData(sql, vaultId) {
  const rawCategories = await sql`
    SELECT id, name, type, budget_cap as "budgetCap", is_auto_budget as "isAutoBudget", color, icon
    FROM categories
    WHERE vault_id = ${vaultId}
    ORDER BY name ASC;
  `;
  const accounts = await getComputedAccounts(sql, vaultId);
  const rawTransactions = await sql`
    SELECT id, date, description, amount, type, category_id as "categoryId", account_id as "accountId", notes, transfer_id as "transferId", budget_month as "budgetMonth", bank_amount as "bankAmount"
    FROM transactions
    WHERE vault_id = ${vaultId}
    ORDER BY date DESC, created_at DESC;
  `;
  const rawSubscriptions = await sql`
    SELECT id, name, amount, category_id as "categoryId", account_id as "accountId", billing_cycle as "billingCycle", next_due_date as "nextDueDate"
    FROM subscriptions
    WHERE vault_id = ${vaultId};
  `;
  const rawSettings = await sql`SELECT key, value FROM app_settings;`;

  let debts = [];
  try {
    debts = await sql`SELECT id, person_name as "personName", amount, direction, reason, date_created as "dateCreated", due_date as "dueDate", status, settled_amount as "settledAmount", notes FROM app_debts WHERE vault_id = ${vaultId} ORDER BY created_at DESC;`;
    debts = debts.map(d => ({ ...d, amount: parseFloat(d.amount) || 0, settledAmount: parseFloat(d.settledAmount) || 0 }));
  } catch (e) {}

  const settings = {};
  for (const row of rawSettings) settings[row.key] = row.value;

  const categories = rawCategories.map(c => ({ ...c, budgetCap: parseFloat(c.budgetCap) || 0, isAutoBudget: Boolean(c.isAutoBudget) }));
  const transactions = rawTransactions.map(t => ({ ...t, amount: parseFloat(t.amount) || 0, bankAmount: t.bankAmount ? parseFloat(t.bankAmount) : null }));
  const subscriptions = rawSubscriptions.map(s => ({ ...s, amount: parseFloat(s.amount) || 0 }));

  return { categories, accounts, transactions, subscriptions, settings, debts };
}
