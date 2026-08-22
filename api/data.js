import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const { rows: categories } = await sql`SELECT id, name, type, budget_cap as "budgetCap", is_auto_budget as "isAutoBudget", color, icon FROM categories ORDER BY name ASC;`;
      const { rows: accounts } = await sql`SELECT id, name, type, balance, color, icon FROM accounts ORDER BY name ASC;`;
      const { rows: transactions } = await sql`SELECT id, date, description, amount, type, category_id as "categoryId", account_id as "accountId", notes FROM transactions ORDER BY date DESC, created_at DESC;`;
      const { rows: subscriptions } = await sql`SELECT id, name, amount, category_id as "categoryId", account_id as "accountId", billing_cycle as "billingCycle", next_due_date as "nextDueDate" FROM subscriptions;`;

      return res.status(200).json({ categories, accounts, transactions, subscriptions });
    } catch (error) {
      console.warn('Vercel Postgres read error (using local storage fallback):', error);
      return res.status(200).json({ offline: true, error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { action, payload } = req.body;

      if (action === 'addTransaction') {
        const { id, date, description, amount, type, categoryId, accountId, notes } = payload;
        await sql`
          INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes)
          VALUES (${id}, ${date}, ${description}, ${amount}, ${type}, ${categoryId}, ${accountId}, ${notes});
        `;

        // Update account balance
        const delta = type === 'income' ? amount : -amount;
        await sql`
          UPDATE accounts SET balance = balance + ${delta} WHERE id = ${accountId};
        `;

        return res.status(200).json({ success: true });
      }

      if (action === 'deleteTransaction') {
        const { id } = payload;
        const { rows } = await sql`SELECT amount, type, account_id FROM transactions WHERE id = ${id};`;
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
          VALUES (${id}, ${name}, ${type}, ${budgetCap}, ${isAutoBudget}, ${color}, ${icon});
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'updateBudget') {
        const { id, budgetCap, isAutoBudget } = payload;
        await sql`
          UPDATE categories SET budget_cap = ${budgetCap}, is_auto_budget = ${isAutoBudget} WHERE id = ${id};
        `;
        return res.status(200).json({ success: true });
      }

      if (action === 'addAccount') {
        const { id, name, type, balance, color, icon } = payload;
        await sql`
          INSERT INTO accounts (id, name, type, balance, color, icon)
          VALUES (${id}, ${name}, ${type}, ${balance}, ${color}, ${icon});
        `;
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    } catch (error) {
      console.error('Vercel Postgres write error:', error);
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
