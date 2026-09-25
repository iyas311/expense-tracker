import { neon } from '@neondatabase/serverless';

// Direct DB log — must be AWAITED before returning response on Vercel serverless
async function logAiUsage(action, aiUsed, latencyMs, success, errorMsg = null) {
  try {
    const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_PRISMA_URL;
    if (!databaseUrl) return;
    const sql = neon(databaseUrl);
    const level = success ? (aiUsed === 'local_fallback' ? 'warn' : 'info') : 'error';
    const message = success
      ? `AI [${aiUsed.toUpperCase()}] handled '${action}' in ${latencyMs}ms`
      : `AI [${aiUsed.toUpperCase()}] failed '${action}': ${errorMsg}`;
    const meta = JSON.stringify({ action, aiUsed, latencyMs, success, error: errorMsg });
    await sql`INSERT INTO app_logs (level, message, meta) VALUES (${level}, ${message}, ${meta})`;
  } catch (e) {
    // Logging failure should never break the main flow
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, textInput, base64Image, question, contextData, categories, accounts, apiKey, groqApiKey, preferredEngine = 'auto', chatHistory = [] } = req.body || {};

    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || apiKey;
    const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || groqApiKey;

    // ─── 0. Status Check ────────────────────────────────────────────────────────
    if (action === 'checkStatus') {
      return res.status(200).json({
        hasGeminiServerKey: !!(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
        hasGroqServerKey: !!(process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY),
        activeGemini: !!geminiKey,
        activeGroq: !!groqKey
      });
    }

    // Helper: Call Gemini with exact models requested: 3.5 Flash Lite & 3.8 Flash
    const callGemini = async (prompt, inlineData = null, isJson = true) => {
      if (!geminiKey) return null;
      const models = [
        'gemini-3.5-flash-lite',
        'gemini-3.8-flash',
        'gemini-flash-latest'
      ];
      let lastError = null;

      for (const model of models) {
        try {
          const parts = [{ text: prompt }];
          if (inlineData) parts.push({ inline_data: inlineData });

          const payload = {
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.2,
              ...(isJson ? { response_mime_type: 'application/json' } : {})
            }
          };

          const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return { text, model };
          } else {
            const errJson = await resp.json().catch(() => ({}));
            lastError = errJson?.error?.message || `HTTP ${resp.status}`;
          }
        } catch (e) {
          lastError = e.message;
        }
      }
      throw new Error(`Gemini failed: ${lastError}`);
    };

    // Helper: Call Groq with top production models and fallback chain
    const callGroq = async (prompt, isJson = true) => {
      if (!groqKey) return null;
      // Primary: llama-3.1-8b-instant (ultra-low token overhead, fastest speed, highest free rate limits)
      const models = [
        'llama-3.1-8b-instant',
        'llama-3.3-70b-versatile',
        'qwen/qwen3.8-27b',
        'openai/gpt-oss-120b',
        'openai/gpt-oss-20b',
        'mixtral-8x7b-32768'
      ];
      let lastError = null;

      for (const model of models) {
        try {
          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              ...(isJson ? { response_format: { type: 'json_object' } } : {}),
              temperature: 0.2
            })
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) return { text, model };
          } else {
            const errJson = await resp.json().catch(() => ({}));
            lastError = errJson?.error?.message || `HTTP ${resp.status}`;
          }
        } catch (e) {
          lastError = e.message;
        }
      }
      throw new Error(`Groq failed: ${lastError}`);
    };

    // ─── 1. parseText ───────────────────────────────────────────────────────────
    if (action === 'parseText') {
      const categoryNames = (categories || []).map(c => c.name).join(', ');
      const accountNames = (accounts || []).map(a => a.name).join(', ');
      const prompt = `You are a smart financial AI. Analyze the user's text and extract a list of financial operations.
Return ONLY a raw JSON array of objects with NO markdown formatting, NO code blocks. Do not wrap the array in an object.

Types of operations you can extract:
1. "transaction": Standard expense or income (buying things, receiving salary).
2. "transfer": Moving money between accounts or paying a credit card bill from a bank account.
3. "debt_add": When the user lends money TO someone, or borrows money FROM someone.
4. "debt_settle": When a person pays the user back, or the user pays a person back.
5. "split_expense": When the user paid a shared bill for friends and expects to be paid back (e.g. "paid 300 for dinner, split 3 ways with Rahul and Sai").

Example Output format:
[
  {
    "operation": "transaction",
    "amount": 240,
    "type": "expense",
    "description": "Short main heading only (e.g. 'Creatinine test')",
    "category": "Match best category",
    "account": "Match best account",
    "date": "YYYY-MM-DD",
    "notes": "Put location/extra context here (e.g. 'at Edakulam lab')"
  },
  {
    "operation": "transfer",
    "amount": 5000,
    "fromAccount": "Match best source account",
    "toAccount": "Match best destination account",
    "date": "YYYY-MM-DD",
    "notes": ""
  },
  {
    "operation": "debt_add",
    "amount": 500,
    "direction": "lent",
    "personName": "Rahul",
    "reason": "Lunch",
    "account": "Match best account",
    "date": "YYYY-MM-DD",
    "notes": ""
  },
  {
    "operation": "debt_settle",
    "amount": 500,
    "direction": "lent",
    "personName": "Rahul",
    "account": "Match best account",
    "date": "YYYY-MM-DD",
    "notes": ""
  },
  {
    "operation": "split_expense",
    "totalAmount": 300,
    "yourShare": 100,
    "description": "Dinner",
    "category": "Match best category",
    "account": "Match best account",
    "date": "YYYY-MM-DD",
    "notes": "",
    "splits": [
      { "personName": "Rahul", "amount": 100 },
      { "personName": "Sai", "amount": 100 }
    ]
  }
]

Rules:
- For 'account', 'fromAccount', 'toAccount', match best from: [${accountNames}].
- IMPORTANT: For ANY debt operation (debt_add or debt_settle), if the user does NOT explicitly mention an account, you MUST default the account to "Slice Savings".
- For standard 'transaction', if the account is unspecified, default to "Kotak Bank".
- For 'split_expense': yourShare = totalAmount / number_of_people. splits array contains each OTHER person's share (not yours).
- For 'category', match best from: [${categoryNames}] or invent a logical one.
- For 'direction' in debts: "lent" means the user gave money to someone (people owe user). "borrowed" means user took money (user owes people).
- date: default to current date: ${new Date().toISOString().split('T')[0]} if unspecified.

User text: "${textInput}"`;

      let lastError = null;

      // Try Gemini first (unless Groq explicitly chosen)
      if (geminiKey && preferredEngine !== 'groq') {
        const t0 = Date.now();
        try {
          const resGem = await callGemini(prompt, null, true);
          if (resGem?.text) {
            await logAiUsage(action, 'gemini', Date.now() - t0, true);
            return res.status(200).json({ rawJson: resGem.text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: `gemini (${resGem.model})` });
          }
        } catch (e) {
          lastError = e.message;
          await logAiUsage(action, 'gemini', Date.now() - t0, false, e.message);
        }
      }

      // Try Groq
      if (groqKey && preferredEngine !== 'gemini') {
        const t0 = Date.now();
        try {
          const resGroq = await callGroq(prompt, true);
          if (resGroq?.text) {
            await logAiUsage(action, 'groq', Date.now() - t0, true);
            return res.status(200).json({ rawJson: resGroq.text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: `groq (${resGroq.model})` });
          }
        } catch (e) {
          lastError = e.message;
          await logAiUsage(action, 'groq', Date.now() - t0, false, e.message);
        }
      }

      await logAiUsage(action, 'none', 0, false, lastError || 'No API key configured');
      return res.status(400).json({ error: lastError || 'No API key configured on server. Please set GEMINI_API_KEY in Vercel environment variables.' });
    }

    // ─── 2. parseReceipt ────────────────────────────────────────────────────────
    if (action === 'parseReceipt') {
      if (!geminiKey) return res.status(400).json({ error: 'GEMINI_API_KEY required for vision scan' });

      const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
      const base64Data = base64Image.split(',')[1];
      const categoryNames = (categories || []).map(c => c.name).join(', ');
      const prompt = `Analyze this receipt image and extract transaction information.
Return ONLY a raw JSON object with NO markdown block.
JSON format:
{
  "amount": number,
  "merchant": string,
  "date": string (YYYY-MM-DD),
  "category": string (best match from: [${categoryNames}]),
  "description": string
}`;

      const t0 = Date.now();
      try {
        const resGem = await callGemini(prompt, { mime_type: mimeType, data: base64Data }, true);
        if (resGem?.text) {
          await logAiUsage(action, 'gemini', Date.now() - t0, true);
          return res.status(200).json({ rawJson: resGem.text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: `gemini (${resGem.model})` });
        }
      } catch (e) {
        await logAiUsage(action, 'gemini', Date.now() - t0, false, e.message);
      }
      return res.status(500).json({ error: 'Failed to scan receipt image' });
    }

    // ─── 3. chat ────────────────────────────────────────────────────────────────
    if (action === 'chat') {
      const historyContext = (chatHistory || [])
        .slice(-6)
        .map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
        .join('\n');

      const prompt = `You are an expert personal financial advisor and assistant in an expense tracker app.
Use the user's real-time financial data and recent conversation history to provide accurate, tailored, and actionable advice:

User Financial State:
- Net Worth: ${contextData?.netWorth || 'N/A'}
- Monthly Income: ${contextData?.totalIncome || 'N/A'}
- Monthly Expenses: ${contextData?.totalExpenses || 'N/A'}
- Spending By Category: ${JSON.stringify(contextData?.monthlySpendingByCategory || {})}
- Category Budgets & Caps: ${JSON.stringify(contextData?.categoryBudgets || {})}
- Daily Spending Allowance: ${contextData?.dailySafeSpend || 'N/A'} (Spent today: ${contextData?.spentToday || 'N/A'})
- Accounts & Credit Limits: ${JSON.stringify(contextData?.accounts || [])}
- Active Debts & IOUs: ${JSON.stringify(contextData?.debts || [])}
- Recurring Subscriptions: ${JSON.stringify(contextData?.subscriptions || [])}
- Recent Transactions: ${JSON.stringify(contextData?.recentTransactions || [])}

Recent Conversation:
${historyContext || 'No previous messages.'}

Current User Question: "${question}"

Instructions:
- Be clear, direct, and concise (2-4 sentences or clean bullet points).
- Quote real numbers, category names, debts, or accounts from their data.
- Offer actionable financial guidance.`;

      let lastError = null;

      // Gemini
      if (geminiKey && preferredEngine !== 'groq') {
        const t0 = Date.now();
        try {
          const resGem = await callGemini(prompt, null, false);
          if (resGem?.text) {
            await logAiUsage(action, 'gemini', Date.now() - t0, true);
            return res.status(200).json({ response: resGem.text, aiUsed: 'gemini', model: resGem.model });
          }
        } catch (e) {
          lastError = e.message;
          await logAiUsage(action, 'gemini', Date.now() - t0, false, e.message);
        }
      }

      // Groq
      if (groqKey && preferredEngine !== 'gemini') {
        const t0 = Date.now();
        try {
          const resGroq = await callGroq(prompt, false);
          if (resGroq?.text) {
            await logAiUsage(action, 'groq', Date.now() - t0, true);
            return res.status(200).json({ response: resGroq.text, aiUsed: 'groq', model: resGroq.model });
          }
        } catch (e) {
          lastError = e.message;
          await logAiUsage(action, 'groq', Date.now() - t0, false, e.message);
        }
      }

      return res.status(400).json({ error: lastError || 'No server API key configured' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Server AI Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
