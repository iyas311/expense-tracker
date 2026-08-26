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
    const { action, textInput, base64Image, question, contextData, categories, accounts } = req.body;

    const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;

    const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

    // ─── 1. parseText ───────────────────────────────────────────────────────────
    if (action === 'parseText') {
      const categoryNames = (categories || []).map(c => c.name).join(', ');
      const accountNames = (accounts || []).map(a => a.name).join(', ');
      const prompt = `You are a financial transaction extractor. Analyze the user's text and extract transaction details.
Return ONLY a raw JSON array of objects with NO markdown formatting, NO code blocks. Do not wrap the array in an object.
If there are multiple transactions in the text, extract them all into the array.

Example Output format:
[
  {
    "amount": 240,
    "type": "expense",
    "description": "Clean item name",
    "category": "Match best category",
    "account": "Match best account",
    "date": "YYYY-MM-DD"
  }
]

Object Fields required:
- amount: number
- type: string ("expense" or "income")
- description: string (clean item or merchant name ONLY, e.g. "Pepsi" or "Burger". Do NOT include words like "rs", "inr", "spent", "for", "costed")
- category: string (match best from: [${categoryNames}] or invent a logical one)
- account: string (match best from: [${accountNames}] or default "Bank Account")
- date: YYYY-MM-DD (default to current date: ${new Date().toISOString().split('T')[0]} if unspecified)

User text: "${textInput}"`;

      // Try Gemini
      if (geminiKey) {
        const t0 = Date.now();
        try {
          const response = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          if (response.ok) {
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              await logAiUsage(action, 'gemini', Date.now() - t0, true); // ← awaited
              return res.status(200).json({ rawJson: text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: 'gemini' });
            }
          }
        } catch (e) {
          await logAiUsage(action, 'gemini', Date.now() - t0, false, e.message); // ← awaited
        }
      }

      // Try Groq Fallback
      if (groqKey) {
        const t0 = Date.now();
        try {
          const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'compound-beta-mini', messages: [{ role: 'user', content: prompt }] })
          });
          if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
              await logAiUsage(action, 'groq', Date.now() - t0, true); // ← awaited
              return res.status(200).json({ rawJson: text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: 'groq' });
            }
          }
        } catch (e) {
          await logAiUsage(action, 'groq', Date.now() - t0, false, e.message); // ← awaited
        }
      }

      await logAiUsage(action, 'none', 0, false, 'No API key configured'); // ← awaited
      return res.status(400).json({ error: 'No API key configured on server' });
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
        const response = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }] })
        });
        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            await logAiUsage(action, 'gemini', Date.now() - t0, true); // ← awaited
            return res.status(200).json({ rawJson: text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: 'gemini' });
          }
        }
      } catch (e) {
        await logAiUsage(action, 'gemini', Date.now() - t0, false, e.message); // ← awaited
      }
      return res.status(500).json({ error: 'Failed to scan receipt image' });
    }

    // ─── 3. chat ────────────────────────────────────────────────────────────────
    if (action === 'chat') {
      const prompt = `You are a friendly personal finance assistant in an expense tracker app.
Context summary of user's financial state:
- Total Net Worth: ${contextData.netWorth}
- Total Monthly Income: ${contextData.totalIncome}
- Total Monthly Expenses: ${contextData.totalExpenses}
- Account Balances: ${JSON.stringify(contextData.accounts)}
- Recent 10 Transactions: ${JSON.stringify(contextData.recentTransactions)}
- Category Budgets: ${JSON.stringify(contextData.budgets)}

User question: "${question}"
Provide a helpful, encouraging, and concise response in 2-4 sentences.`;

      if (geminiKey) {
        const t0 = Date.now();
        try {
          const response = await fetch(`${GEMINI_URL}?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          });
          if (response.ok) {
            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              await logAiUsage(action, 'gemini', Date.now() - t0, true); // ← awaited
              return res.status(200).json({ response: text, aiUsed: 'gemini' });
            }
          }
        } catch (e) {
          await logAiUsage(action, 'gemini', Date.now() - t0, false, e.message); // ← awaited
        }
      }

      if (groqKey) {
        const t0 = Date.now();
        try {
          const response = await fetch(GROQ_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'compound-beta-mini', messages: [{ role: 'user', content: prompt }] })
          });
          if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
              await logAiUsage(action, 'groq', Date.now() - t0, true); // ← awaited
              return res.status(200).json({ response: text, aiUsed: 'groq' });
            }
          }
        } catch (e) {
          await logAiUsage(action, 'groq', Date.now() - t0, false, e.message); // ← awaited
        }
      }

      return res.status(400).json({ error: 'No server API key set' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('Server AI Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
