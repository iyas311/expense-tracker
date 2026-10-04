import crypto from 'crypto';
import { getSql, runMigrations, ensureTablesExist, getVaultData } from './lib/db.js';
import { hashPassword, isRateLimited, isLoginRateLimited, recordFailedLogin, clearFailedLogins } from './lib/auth.js';

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

        if (isLoginRateLimited(ip)) {
          return res.status(429).json({ 
            success: false, 
            error: 'Too many failed login attempts. Please wait 15 minutes before trying again.' 
          });
        }

        const users = await sql`SELECT id, username, password_hash, role, vault_id FROM app_users WHERE username = ${username.toLowerCase().trim()};`;
        if (users.length === 0) {
          recordFailedLogin(ip);
          return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const user = users[0];
        const hash = hashPassword(password);
        if (hash !== user.password_hash) {
          const failCount = recordFailedLogin(ip);
          const remaining = Math.max(0, 5 - failCount);
          const warning = remaining > 0 ? ` (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)` : ' (Account locked for 15 minutes)';
          return res.status(401).json({ success: false, error: `Invalid credentials${warning}` });
        }

        // Successful login: clear failed attempts
        clearFailedLogins(ip);

        // Generate token and session (expires in 90 days)
        const token = crypto.randomUUID();
        await sql`
          INSERT INTO app_sessions (token, user_id, vault_id, role, expires_at)
          VALUES (${token}, ${user.id}, ${user.vault_id}, ${user.role}, CURRENT_TIMESTAMP + INTERVAL '90 days');
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
          if (e.message?.includes('unique constraint')) {
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

      // ─── RESTORE VAULT BACKUP (JSON) ─────────────────────────────────────────
      if (action === 'restoreVaultData') {
        const { backup } = payload || {};
        if (!backup || typeof backup !== 'object') {
          return res.status(400).json({ error: 'Invalid backup file provided' });
        }

        const { accounts, categories, transactions, debts, subscriptions } = backup;

        // Restore accounts
        if (Array.isArray(accounts)) {
          for (const a of accounts) {
            await sql`
              INSERT INTO accounts (id, name, type, balance, initial_balance, credit_limit, color, icon, vault_id, statement_day, due_day, due_month_offset)
              VALUES (${a.id}, ${a.name}, ${a.type}, ${parseFloat(a.balance) || 0}, ${parseFloat(a.initialBalance || a.balance) || 0}, ${parseFloat(a.creditLimit) || 0}, ${a.color || '#06b6d4'}, ${a.icon || 'Landmark'}, ${vaultId}, ${a.statementDay || null}, ${a.dueDay || null}, ${a.dueMonthOffset !== undefined ? a.dueMonthOffset : 1})
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                type = EXCLUDED.type,
                balance = EXCLUDED.balance,
                initial_balance = EXCLUDED.initial_balance,
                credit_limit = EXCLUDED.credit_limit,
                color = EXCLUDED.color,
                statement_day = EXCLUDED.statement_day,
                due_day = EXCLUDED.due_day,
                due_month_offset = EXCLUDED.due_month_offset;
            `;
          }
        }

        // Restore categories
        if (Array.isArray(categories)) {
          for (const c of categories) {
            await sql`
              INSERT INTO categories (id, name, budget_cap, is_auto_budget, color, icon, vault_id, type)
              VALUES (${c.id}, ${c.name}, ${parseFloat(c.budgetCap) || 0}, ${Boolean(c.isAutoBudget)}, ${c.color || '#8b5cf6'}, ${c.icon || 'Tag'}, ${vaultId}, ${c.type || 'expense'})
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                budget_cap = EXCLUDED.budget_cap,
                is_auto_budget = EXCLUDED.is_auto_budget,
                color = EXCLUDED.color,
                type = EXCLUDED.type;
            `;
          }
        }

        // Restore transactions
        if (Array.isArray(transactions)) {
          for (const t of transactions) {
            await sql`
              INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, transfer_id, vault_id, budget_month, bank_amount)
              VALUES (${t.id}, ${t.date}, ${t.description}, ${parseFloat(t.amount) || 0}, ${t.type}, ${t.categoryId || null}, ${t.accountId}, ${t.notes || ''}, ${t.transferId || null}, ${vaultId}, ${t.budgetMonth || null}, ${t.bankAmount || null})
              ON CONFLICT (id) DO UPDATE SET
                date = EXCLUDED.date,
                description = EXCLUDED.description,
                amount = EXCLUDED.amount,
                type = EXCLUDED.type,
                category_id = EXCLUDED.category_id,
                account_id = EXCLUDED.account_id,
                notes = EXCLUDED.notes,
                transfer_id = EXCLUDED.transfer_id,
                budget_month = EXCLUDED.budget_month,
                bank_amount = EXCLUDED.bank_amount;
            `;
          }
        }

        // Restore debts
        if (Array.isArray(debts)) {
          for (const d of debts) {
            await sql`
              INSERT INTO app_debts (id, vault_id, person_name, amount, direction, reason, date_created, due_date, status, settled_amount, notes)
              VALUES (${d.id}, ${vaultId}, ${d.personName}, ${parseFloat(d.amount) || 0}, ${d.direction || 'lent'}, ${d.reason || ''}, ${d.dateCreated}, ${d.dueDate || null}, ${d.status || 'pending'}, ${parseFloat(d.settledAmount) || 0}, ${d.notes || ''})
              ON CONFLICT (id) DO UPDATE SET
                person_name = EXCLUDED.person_name,
                amount = EXCLUDED.amount,
                direction = EXCLUDED.direction,
                reason = EXCLUDED.reason,
                date_created = EXCLUDED.date_created,
                due_date = EXCLUDED.due_date,
                status = EXCLUDED.status,
                settled_amount = EXCLUDED.settled_amount,
                notes = EXCLUDED.notes;
            `;
          }
        }

        // Restore subscriptions
        if (Array.isArray(subscriptions)) {
          for (const s of subscriptions) {
            await sql`
              INSERT INTO subscriptions (id, name, amount, billing_cycle, next_billing_date, category_id, account_id, is_active, notes, vault_id)
              VALUES (${s.id}, ${s.name}, ${parseFloat(s.amount) || 0}, ${s.billingCycle || 'monthly'}, ${s.nextBillingDate}, ${s.categoryId || null}, ${s.accountId || null}, ${s.isActive !== false}, ${s.notes || ''}, ${vaultId})
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                amount = EXCLUDED.amount,
                billing_cycle = EXCLUDED.billing_cycle,
                next_billing_date = EXCLUDED.next_billing_date,
                is_active = EXCLUDED.is_active;
            `;
          }
        }

        const freshData = await getVaultData(sql, vaultId);
        return res.status(200).json({ success: true, message: 'Vault restored successfully', ...freshData });
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
