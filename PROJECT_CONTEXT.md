# Expensia AI — Project Context & Architecture Guide

> **Single Source of Truth** for developers and AI assistants (Antigravity, Cursor, Claude, Copilot).
> Last updated: September 2026

---

## 1. Project Overview & Tech Stack

Expensia AI is an AI-powered personal financial tracker and budget manager built as a high-performance Progressive Web App (PWA) with a serverless backend.

- **Frontend**: React 18, Vite 6, Tailwind CSS, Lucide React (Icons), Canvas Confetti.
- **Backend**: Vercel Serverless Functions (Node.js ES Modules).
- **Database**: Neon Serverless Postgres (`@neondatabase/serverless`).
- **AI Engines**:
  - **Gemini**: `gemini-3.5-flash-lite`, `gemini-3.8-flash`, `gemini-2.0-flash`, `gemini-flash-latest` (Text parsing, Vision OCR receipt scanning, conversational advisor).
  - **Groq**: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `llama-3.2-11b-vision-preview` (Fast Llama & Vision fallback).
  - **Local Regex Fallback**: Offline parser when network or AI keys are unavailable.

---

## 2. Directory Structure

```
├── api/
│   ├── data.js                     # Main CRUD serverless action router (/api/data)
│   ├── ai.js                       # Serverless proxy for secret server AI keys (/api/ai)
│   ├── setup-db.js                 # Database setup and sanity checker
│   ├── webhook.js                  # Webhook receiver for automated entries
│   └── lib/
│       ├── db.js                   # Neon SQL connection, schema migrations, table seeds, computed balances
│       └── auth.js                 # SHA-256 password hashing & IP rate limiter
├── src/
│   ├── context/
│   │   └── ExpenseContext.jsx      # Global React state, sync manager, auth & financial calculations
│   ├── services/
│   │   ├── aiService.js            # Core AI orchestrator (text parse, OCR receipt scan, chat assistant)
│   │   ├── aiMatchUtils.js         # Fuzzy account & category matching, response normalization
│   │   └── localFallbackParser.js  # Smart offline regex parser
│   ├── utils/
│   │   ├── csvExport.js            # CSV statement download with BOM for currency support (₹)
│   │   └── pdfExport.js            # Printable A4 PDF financial statement generator
│   ├── components/                 # Modals, Overview, Accounts, Debts, Subscriptions, QuickAI, Chatbot
│   ├── App.jsx                     # Top-level view router & navigation shell
│   └── main.jsx                    # Vite entry point
├── public/                         # PWA icons, manifest, service worker
└── PROJECT_CONTEXT.md              # Project documentation for AI and developers
```

---

## 3. Database Schema (Neon Postgres)

### Tables
1. **`app_users`**:
   - `id VARCHAR(64) PRIMARY KEY`
   - `username VARCHAR(128) UNIQUE NOT NULL`
   - `password_hash VARCHAR(255) NOT NULL` (SHA-256 + salt)
   - `role VARCHAR(32) DEFAULT 'user'` (`admin` vs `user`)
   - `vault_id VARCHAR(64) NOT NULL`

2. **`app_sessions`**:
   - `token VARCHAR(128) PRIMARY KEY` (UUID)
   - `user_id VARCHAR(64)`, `vault_id VARCHAR(64)`, `role VARCHAR(32)`
   - `expires_at TIMESTAMP WITH TIME ZONE` (90-day expiration)

3. **`accounts`**:
   - `id VARCHAR(64) PRIMARY KEY`, `name`, `type` (`bank`, `card`, `cash`, `savings`)
   - `balance NUMERIC(12,2)`, `initial_balance NUMERIC(12,2)`, `credit_limit NUMERIC(12,2)`
   - `statement_day INT`, `due_day INT`, `due_month_offset INT`
   - `color`, `icon`, `vault_id`

4. **`categories`**:
   - `id VARCHAR(64) PRIMARY KEY`, `name`, `type` (`expense`, `income`)
   - `budget_cap NUMERIC(12,2)`, `is_auto_budget BOOLEAN`
   - `color`, `icon`, `vault_id`

5. **`transactions`**:
   - `id VARCHAR(64) PRIMARY KEY`, `date DATE`, `description`, `amount NUMERIC(12,2)`
   - `type VARCHAR(32)` (`expense`, `income`, `transfer_in`, `transfer_out`)
   - `category_id`, `account_id`, `notes`, `transfer_id`, `vault_id`
   - `budget_month VARCHAR(7)` (e.g. `2026-09` for salary or retroactive budgeting)
   - `bank_amount NUMERIC(12,2)` (Full amount deducted from bank when an expense is split among friends)

6. **`app_debts`**:
   - `id VARCHAR(64) PRIMARY KEY`, `vault_id`, `person_name`, `amount NUMERIC(12,2)`
   - `direction VARCHAR(16)` (`lent` [they owe you] vs `borrowed` [you owe them])
   - `reason`, `date_created`, `due_date`, `status` (`pending`, `settled`)
   - `settled_amount NUMERIC(12,2)`, `notes`

7. **`subscriptions`**:
   - `id VARCHAR(64) PRIMARY KEY`, `name`, `amount`, `category_id`, `account_id`
   - `billing_cycle VARCHAR(32)` (`monthly`, `weekly`, `yearly`), `next_due_date`, `vault_id`

8. **`app_settings`** & **`app_logs`**: Key-value settings and audit/debug log table.

---

## 4. API Endpoints & Actions

### `/api/data`
- **`GET /api/data?token=<TOKEN>`**: Fetches all vault-scoped categories, accounts, transactions, debts, subscriptions, and settings.
- **`POST /api/data`**:
  - `login` / `logout`
  - `createUser` / `getUsers` / `changePassword`
  - `addTransaction` / `updateTransaction` / `deleteTransaction` / `addTransfer`
  - `addCategory` / `updateCategory` / `updateBudget` / `deleteCategory`
  - `addAccount` / `updateAccount` / `deleteAccount`
  - `addDebt` / `updateDebt` / `settleDebt` / `deleteDebt`
  - `addSubscription` / `updateSubscription` / `deleteSubscription` / `processRecurring`

### `/api/ai`
- **`POST /api/ai`**:
  - `parseText`: Parses natural language text into financial operations.
  - `parseReceipt`: Scans base64 receipt images via Gemini Vision or Groq Llama 3.2 Vision.
  - `chat`: Conversational financial assistant with last 6 conversation turns and user net worth context.

---

## 5. Architectural Principles & Business Rules

1. **Source of Truth for Account Balances**:
   - Account balances are always dynamically computed by `getComputedAccounts()` in `api/lib/db.js` using:
     $$\text{Balance} = \text{Initial Balance} + \sum \text{Incomes} - \sum \text{Expenses}$$
   - When a transaction has `bank_amount` (e.g. split expense where you paid \$3000 but your personal share was \$1000), the bank deduction uses `bank_amount` (\$3000), while the budget expense reflects your share (\$1000).

2. **Split Expense Flow**:
   - Prompt: *"spent 3k split between me, rahul, and rohit from slice"*
   - AI outputs:
     1. Main expense: Amount = 1000, Bank Amount = 3000, Account = Slice.
     2. Debt entries: Lent 1000 to Rahul, Lent 1000 to Rohit.
   - Bank balance accurately drops by 3000, while your personal monthly spending only increases by 1000.

3. **Offline & Optimistic UI**:
   - Every action updates React state and `localStorage` instantly for zero UI lag.
   - Cloud sync happens asynchronously in the background via `authFetch`.
   - If offline or database unreachable, the app functions normally in local cache mode.

4. **Currency Encoding**:
   - CSV statements prepend the UTF-8 Byte Order Mark (`\uFEFF`) so Microsoft Excel and Apple Numbers render the Indian Rupee (`₹`) symbol cleanly.

5. **AI Model Engine Switcher**:
   - Available options: `Auto`, `Gemini`, `Groq`.
   - Implemented in both the quick transaction input bar and the chatbot modal.
   - Mobile responsive: Compact select dropdown that takes no extra input height or width.
