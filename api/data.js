import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';

// In-memory rate limiter (max 60 requests/minute per IP)
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

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password + 'ET_SALT_99').digest('hex');
};

async function runMigrations(sql) {
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

  // 5. Ensure Admin Vault exists in app_vaults
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

async function ensureTablesExist(sql) {
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

async function seedStarterCategories(sql, vaultId) {
  const defaults = [
    [`cat-1-${vaultId}`, 'Food & Dining', 'expense', 0, false, '#f43f5e', 'Utensils'],
    [`cat-2-${vaultId}`, 'Groceries', 'expense', 0, false, '#10b981', 'ShoppingCart'],
    [`cat-3-${vaultId}`, 'Transport & Fuel', 'expense', 0, false, '#06b6d4', 'Car'],
    [`cat-4-${vaultId}`, 'Bills & Utilities', 'expense', 0, false, '#f59e0b', 'Zap'],
    [`cat-5-${vaultId}`, 'Entertainment', 'expense', 0, false, '#8b5cf6', 'Film'],
    [`cat-6-${vaultId}`, 'Shopping', 'expense', 0, false, '#ec4899', 'ShoppingBag'],
    [`cat-7-${vaultId}`, 'Loans & Debts', 'expense', 0, false, '#f59e0b', 'HandCoins'],
    [`cat-8-${vaultId}`, 'Salary & Income', 'income', 0, false, '#10b981', 'DollarSign']
  ];
  for (const [id, name, type, budgetCap, isAuto, color, icon] of defaults) {
    await sql`INSERT INTO categories (id, name, type, budget_cap, is_auto_budget, color, icon, vault_id) VALUES (${id}, ${name}, ${type}, ${budgetCap}, ${isAuto}, ${color}, ${icon}, ${vaultId}) ON CONFLICT DO NOTHING;`;
  }
}

async function seedStarterAccounts(sql, vaultId) {
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
async function getComputedAccounts(sql, vaultId) {
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
async function getVaultData(sql, vaultId) {
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

      const token = req.query.token;
      if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

      // Clean up expired sessions randomly (approx 1/10 chance)
      if (Math.random() < 0.1) {
        await sql`DELETE FROM app_sessions WHERE expires_at < CURRENT_TIMESTAMP;`;
      }

      const sessions = await sql`SELECT user_id, vault_id FROM app_sessions WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP;`;
      if (sessions.length === 0) return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });

      const vaultId = sessions[0].vault_id;
      const data = await getVaultData(sql, vaultId);
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      await runMigrations(sql);
      await ensureTablesExist(sql);
      const { action, payload } = req.body || {};

      // ─── LOGIN USER ──────────────────────────────────────────────────────────
      if (action === 'login') {
        const { username, password } = payload || {};
        if (!username || !password) return res.status(400).json({ success: false, error: 'Username and password required' });

        const users = await sql`SELECT id, username, password_hash, role, vault_id FROM app_users WHERE username = ${username.toLowerCase().trim()};`;
        if (users.length === 0) return res.status(401).json({ success: false, error: 'Invalid credentials' });

        const user = users[0];
        const hash = hashPassword(password);
        if (hash !== user.password_hash) {
          return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Generate token and session (expires in 30 days)
        const token = crypto.randomUUID();
        await sql`
          INSERT INTO app_sessions (token, user_id, vault_id, role, expires_at)
          VALUES (${token}, ${user.id}, ${user.vault_id}, ${user.role}, CURRENT_TIMESTAMP + INTERVAL '30 days');
        `;

        const vaultData = await getVaultData(sql, user.vault_id);
        
        return res.status(200).json({
          success: true,
          token,
          user: { id: user.id, username: user.username, role: user.role, vaultId: user.vault_id },
          ...vaultData
        });
      }

      // ─── LOGOUT USER ─────────────────────────────────────────────────────────
      if (action === 'logout') {
        const { token } = payload || {};
        if (token) {
          await sql`DELETE FROM app_sessions WHERE token = ${token};`;
        }
        return res.status(200).json({ success: true });
      }

      // ─── AUTHENTICATION WALL ───────────────────────────────────────────────
      const token = payload?.token;
      if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided' });

      const sessions = await sql`SELECT user_id, vault_id, role FROM app_sessions WHERE token = ${token} AND expires_at > CURRENT_TIMESTAMP;`;
      if (sessions.length === 0) return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });

      const session = sessions[0];
      const vaultId = session.vault_id;

      // ─── GET USERS (Admin only) ────────────────────────────────────────────
      if (action === 'getUsers') {
        if (session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const users = await sql`SELECT id, username, role, vault_id, created_at FROM app_users ORDER BY created_at DESC;`;
        return res.status(200).json({ success: true, users });
      }

      // ─── CREATE NEW USER (Admin only) ──────────────────────────────────────
      if (action === 'createUser') {
        if (session.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        const { newUsername, newPassword, role } = payload || {};
        if (!newUsername || !newPassword) return res.status(400).json({ error: 'Username and password required' });

        try {
          const newUserId = crypto.randomUUID();
          const newVaultId = 'vault_' + crypto.randomUUID().slice(0, 8);
          
          await sql`
            INSERT INTO app_users (id, username, password_hash, role, vault_id)
            VALUES (${newUserId}, ${newUsername.toLowerCase().trim()}, ${hashPassword(newPassword)}, ${role || 'user'}, ${newVaultId});
          `;
          return res.status(200).json({ success: true, message: 'User created successfully' });
        } catch (e) {
          if (e.message.includes('unique constraint')) {
            return res.status(400).json({ error: 'Username already exists' });
          }
          return res.status(500).json({ error: 'Error creating user' });
        }
      }

      // ─── CHANGE PASSWORD ───────────────────────────────────────────────────
      if (action === 'changePassword') {
        const { currentPassword, newPassword } = payload || {};
        if (!currentPassword || !newPassword || newPassword.length < 4) {
          return res.status(400).json({ error: 'Invalid password provided' });
        }

        const users = await sql`SELECT password_hash FROM app_users WHERE id = ${session.user_id};`;
        if (users.length === 0) return res.status(404).json({ error: 'User not found' });

        if (users[0].password_hash !== hashPassword(currentPassword)) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        await sql`UPDATE app_users SET password_hash = ${hashPassword(newPassword)} WHERE id = ${session.user_id};`;
        return res.status(200).json({ success: true });
      }

      // ─── ADD TRANSACTION ─────────────────────────────────────────────────────
      if (action === 'addTransaction') {
        const { id, date, description, amount, type, categoryId, accountId, notes, transferId, budgetMonth, bankAmount } = payload;
        await sql`
          INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, transfer_id, vault_id, budget_month, bank_amount)
          VALUES (${id}, ${date}, ${description}, ${amount}, ${type}, ${categoryId || null}, ${accountId}, ${notes || ''}, ${transferId || null}, ${vaultId}, ${budgetMonth || null}, ${bankAmount || null});
        `;
        return res.status(200).json({ success: true });
      }

      // ─── EDIT TRANSACTION ────────────────────────────────────────────────────
      if (action === 'updateTransaction') {
        const { id, date, description, amount, type, categoryId, accountId, notes } = payload;
        await sql`
          UPDATE transactions
          SET date=${date}, description=${description}, amount=${amount}, type=${type}, category_id=${categoryId || null}, account_id=${accountId}, notes=${notes || ''}
          WHERE id=${id} AND vault_id=${vaultId};
        `;
        return res.status(200).json({ success: true });
      }

      // ─── DELETE TRANSACTION ──────────────────────────────────────────────────
      if (action === 'deleteTransaction') {
        const { id } = payload;
        await sql`DELETE FROM transactions WHERE (id=${id} OR transfer_id=${id}) AND vault_id=${vaultId};`;
        return res.status(200).json({ success: true });
      }

      // ─── TRANSFER BETWEEN ACCOUNTS ───────────────────────────────────────────
      if (action === 'addTransfer') {
        const { fromAccountId, toAccountId, amount, date, notes } = payload;
        const transferId = `tfr-${Date.now()}`;
        const txOutId = `tx-out-${Date.now()}`;
        const txInId = `tx-in-${Date.now() + 1}`;
        await sql`
          INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, transfer_id, vault_id)
          VALUES (${txOutId}, ${date}, ${'Transfer Out'}, ${amount}, ${'transfer_out'}, ${null}, ${fromAccountId}, ${notes || ''}, ${transferId}, ${vaultId});
        `;
        await sql`
          INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, transfer_id, vault_id)
          VALUES (${txInId}, ${date}, ${'Transfer In'}, ${amount}, ${'transfer_in'}, ${null}, ${toAccountId}, ${notes || ''}, ${transferId}, ${vaultId});
        `;
        return res.status(200).json({ success: true, transferId });
      }

      // ─── ADD CATEGORY ────────────────────────────────────────────────────────
      if (action === 'addCategory') {
        const { id, name, type, budgetCap, isAutoBudget, color, icon } = payload;
        await sql`
          INSERT INTO categories (id, name, type, budget_cap, is_auto_budget, color, icon, vault_id)
          VALUES (${id}, ${name}, ${type}, ${budgetCap || 0}, ${isAutoBudget || false}, ${color || '#8b5cf6'}, ${icon || 'Tag'}, ${vaultId});
        `;
        return res.status(200).json({ success: true });
      }

      // ─── UPDATE BUDGET ───────────────────────────────────────────────────────
      if (action === 'updateBudget') {
        const { id, budgetCap, isAutoBudget } = payload;
        await sql`
          UPDATE categories
          SET budget_cap=${budgetCap || 0}, is_auto_budget=${isAutoBudget || false}
          WHERE id=${id} AND vault_id=${vaultId};
        `;
        return res.status(200).json({ success: true });
      }

      // ─── UPDATE CATEGORY ─────────────────────────────────────────────────────
      if (action === 'updateCategory') {
        const { id, name, type, budgetCap, isAutoBudget, color, icon } = payload;
        await sql`
          UPDATE categories
          SET name=${name},
              type=${type || 'expense'},
              budget_cap=${parseFloat(budgetCap) || 0},
              is_auto_budget=${isAutoBudget || false},
              color=${color || '#8b5cf6'},
              icon=${icon || 'Tag'}
          WHERE id=${id} AND vault_id=${vaultId};
        `;
        return res.status(200).json({ success: true });
      }

      // ─── DELETE CATEGORY ─────────────────────────────────────────────────────
      if (action === 'deleteCategory') {
        const { id } = payload;
        await sql`DELETE FROM categories WHERE id=${id} AND vault_id=${vaultId};`;
        return res.status(200).json({ success: true });
      }

      // ─── ADD ACCOUNT ─────────────────────────────────────────────────────────
      if (action === 'addAccount') {
        const { id, name, type, balance, creditLimit, color, icon, statementDay, dueDay, dueMonthOffset } = payload;
        const bal = parseFloat(balance) || 0;
        await sql`INSERT INTO accounts (id, name, type, balance, initial_balance, credit_limit, color, icon, vault_id, statement_day, due_day, due_month_offset)
VALUES (${id}, ${name}, ${type}, ${bal}, ${bal}, ${creditLimit || 0}, ${color || '#06b6d4'}, ${icon || 'Landmark'}, ${vaultId}, ${statementDay || null}, ${dueDay || null}, ${dueMonthOffset !== undefined ? dueMonthOffset : 1})`;
        return res.status(200).json({ success: true });
      }

      // ─── UPDATE ACCOUNT ─────────────────────────────────────────────────────────
      if (action === 'updateAccount') {
        const { id, name, type, creditLimit, color, statementDay, dueDay, dueMonthOffset, initialBalance } = payload;
        await sql`
          UPDATE accounts
          SET name=${name}, type=${type}, credit_limit=${creditLimit || 0}, color=${color || '#06b6d4'},
              statement_day=${statementDay || null}, due_day=${dueDay || null}, due_month_offset=${dueMonthOffset !== undefined ? dueMonthOffset : 1},
              initial_balance=${parseFloat(initialBalance) || 0}
          WHERE id=${id} AND vault_id=${vaultId};
        `;
        return res.status(200).json({ success: true });
      }

      // ─── DELETE ACCOUNT ─────────────────────────────────────────────────────────
      if (action === 'deleteAccount') {
        const { id } = payload;
        await sql`DELETE FROM accounts WHERE id=${id} AND vault_id=${vaultId};`;
        return res.status(200).json({ success: true });
      }

      // ─── DEBT CRUD ───────────────────────────────────────────────────────────────
      if (action === 'addDebt') {
        const { id, personName, amount, direction, reason, dateCreated, dueDate, notes } = payload;
        await sql`
          INSERT INTO app_debts (id, vault_id, person_name, amount, direction, reason, date_created, due_date, status, settled_amount, notes)
          VALUES (${id}, ${vaultId}, ${personName}, ${parseFloat(amount) || 0}, ${direction || 'lent'}, ${reason || ''}, ${dateCreated}, ${dueDate || null}, ${'pending'}, ${0}, ${notes || ''});
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'settleDebt') {
        const { id, settledAmount, status } = payload;
        await sql`
          UPDATE app_debts
          SET settled_amount=${parseFloat(settledAmount) || 0}, status=${status || 'settled'}
          WHERE id=${id} AND vault_id=${vaultId};
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'updateDebt') {
        const { id, personName, amount, direction, reason, dueDate, notes, status, settledAmount } = payload;
        await sql`
          UPDATE app_debts
          SET person_name=${personName},
              amount=${parseFloat(amount) || 0},
              direction=${direction || 'lent'},
              reason=${reason || ''},
              due_date=${dueDate || null},
              notes=${notes || ''},
              status=${status || 'pending'},
              settled_amount=${settledAmount !== undefined ? parseFloat(settledAmount) : 0}
          WHERE id=${id} AND vault_id=${vaultId};
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'deleteDebt') {
        const { id } = payload;
        await sql`DELETE FROM app_debts WHERE id=${id} AND vault_id=${vaultId};`;
        return res.status(200).json({ success: true });
      }

      // ─── ADD SUBSCRIPTION ────────────────────────────────────────────────────
      if (action === 'addSubscription') {
        const { id, name, amount, categoryId, accountId, billingCycle, nextDueDate } = payload;
        await sql`
          INSERT INTO subscriptions (id, name, amount, category_id, account_id, billing_cycle, next_due_date, vault_id)
          VALUES (${id}, ${name}, ${amount}, ${categoryId}, ${accountId}, ${billingCycle || 'monthly'}, ${nextDueDate}, ${vaultId})
          ON CONFLICT DO NOTHING;
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'updateSubscription') {
        const { id, nextDueDate } = payload;
        await sql`
          UPDATE subscriptions
          SET next_due_date=${nextDueDate}
          WHERE id=${id} AND vault_id=${vaultId};
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'deleteSubscription') {
        const { id } = payload;
        await sql`DELETE FROM subscriptions WHERE id=${id} AND vault_id=${vaultId};`;
        return res.status(200).json({ success: true });
      }

      // ─── PROCESS RECURRING ───────────────────────────────────────────────────
      if (action === 'processRecurring') {
        const today = new Date().toISOString().split('T')[0];
        const dueSubs = await sql`SELECT * FROM subscriptions WHERE next_due_date <= ${today} AND vault_id = ${vaultId};`;
        const created = [];
        for (const sub of dueSubs) {
          const txId = `tx-${Date.now()}-${sub.id}`;
          await sql`
            INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, vault_id)
            VALUES (${txId}, ${sub.next_due_date}, ${sub.name}, ${sub.amount}, ${'expense'}, ${sub.category_id}, ${sub.account_id}, ${'Auto-recurring'}, ${vaultId})
            ON CONFLICT DO NOTHING;
          `;
          const nextDate = new Date(sub.next_due_date);
          if (sub.billing_cycle === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          else if (sub.billing_cycle === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (sub.billing_cycle === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
          const nextDueDateStr = nextDate.toISOString().split('T')[0];
          await sql`UPDATE subscriptions SET next_due_date=${nextDueDateStr} WHERE id=${sub.id} AND vault_id=${vaultId};`;
          created.push({ id: txId, name: sub.name, amount: sub.amount });
        }
        return res.status(200).json({ success: true, created });
      }

      // ─── SETTINGS & LOGS ─────────────────────────────────────────────────────
      if (action === 'updateSetting') {
        const { key, value } = payload;
        await sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value=${value};`;
        return res.status(200).json({ success: true });
      }

      if (action === 'addLog') {
        const { level, message, meta } = payload;
        await sql`INSERT INTO app_logs (level, message, meta) VALUES (${level || 'info'}, ${message}, ${JSON.stringify(meta || {})});`;
        return res.status(200).json({ success: true });
      }

      if (action === 'getLogs') {
        const logs = await sql`SELECT id, level, message, meta, created_at as "createdAt" FROM app_logs ORDER BY created_at DESC LIMIT 100;`;
        return res.status(200).json({ logs });
      }

      if (action === 'clearLogs') {
        await sql`DELETE FROM app_logs;`;
        return res.status(200).json({ success: true });
      }

      if (action === 'addPromptHistory') {
        const { text, txCount } = payload;
        await sql`INSERT INTO app_prompt_history (text, tx_count) VALUES (${text || ''}, ${txCount || 1});`;
        return res.status(200).json({ success: true });
      }

      if (action === 'getPromptHistory') {
        const history = await sql`SELECT id, text, tx_count as "txCount", created_at as "createdAt" FROM app_prompt_history ORDER BY created_at DESC LIMIT 100;`;
        return res.status(200).json({ history });
      }

      if (action === 'clearPromptHistory') {
        await sql`DELETE FROM app_prompt_history;`;
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
