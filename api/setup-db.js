import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  try {
    // 1. Categories Table
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

    // 2. Accounts Table
    await sql`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(32) NOT NULL,
        balance NUMERIC(12, 2) DEFAULT 0,
        color VARCHAR(32) DEFAULT '#06b6d4',
        icon VARCHAR(64) DEFAULT 'Landmark'
      );
    `;

    // 3. Transactions Table
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(64) PRIMARY KEY,
        date VARCHAR(32) NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        type VARCHAR(32) NOT NULL,
        category_id VARCHAR(64) REFERENCES categories(id),
        account_id VARCHAR(64) REFERENCES accounts(id),
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 4. Subscriptions Table
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

    return res.status(200).json({ success: true, message: 'Vercel Postgres tables initialized successfully!' });
  } catch (error) {
    console.error('Vercel Postgres setup error:', error);
    return res.status(500).json({ error: error.message });
  }
}
