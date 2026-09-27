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

    // Helper: Call Gemini with exact models requested and robust vision fallbacks
    const callGemini = async (prompt, inlineData = null, isJson = true) => {
      if (!geminiKey) return null;
      const models = inlineData 
        ? ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-flash-latest'] // Multi-tier multimodal vision models
        : ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
      let lastError = null;

      for (const model of models) {
        try {
          const parts = [{ text: prompt }];
          if (inlineData) parts.push({ inline_data: inlineData });

          const payload = {
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.1,
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
            // If high demand spike or rate limited, small delay before trying fallback model
            if (resp.status === 429 || resp.status === 503 || (lastError && lastError.includes('demand'))) {
              await new Promise(r => setTimeout(r, 300));
            }
          }
        } catch (e) {
          lastError = e.message;
        }
      }
      throw new Error(`Gemini failed: ${lastError}`);
    };

    // Helper: Call Groq with top production models and fallback chain
    const callGroq = async (prompt, isJson = true, imageData = null) => {
      if (!groqKey) return null;
      const models = imageData 
        ? ['llama-3.2-11b-vision-preview']
        : ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'mixtral-8x7b-32768'];
      let lastError = null;

      for (const model of models) {
        try {
          const messages = [];
          if (imageData) {
            messages.push({
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${imageData.mime_type};base64,${imageData.data}` } }
              ]
            });
          } else {
            messages.push({ role: 'user', content: prompt });
          }

          const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages,
              ...(isJson ? { response_format: { type: 'json_object' } } : {}),
              temperature: 0.1
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
      const prompt = `You are an expert financial transaction parser AI.
Analyze the user's text and extract a list of financial operations.
Return ONLY a raw JSON array of objects with NO markdown formatting, NO backticks, NO code blocks.

Available Accounts in User's Vault: [${accountNames}]
Available Categories: [${categoryNames}]

CRITICAL ACCOUNT MATCHING RULES:
1. ALWAYS scan the user's text for any mention of a bank or account name (e.g. "slice", "axis", "kotak", "sbi", "hdfc", "icici", "cash", "card").
2. Match it EXACTLY to one of the accounts from [${accountNames}].
   - If user mentions "slice" or "slice savings", account MUST be "Slice Savings" (or the account in the list containing "Slice").
   - If user mentions "axis", account MUST be "Axis Bank" (or the account in the list containing "Axis").
   - If user mentions "kotak", account MUST be "Kotak Bank".
   - NEVER choose "Axis Bank" if the user said "slice". Never choose "Kotak" if user said "axis".
3. If NO account is mentioned at all:
   - For debt_add or debt_settle: default to "Slice Savings" (if available in list) or the first available account.
   - For standard transaction: default to "Kotak Bank" (if available in list) or the first available account.

CRITICAL TRANSFER RULES:
- When user transfers money between accounts (e.g. "transfer 100 from kotak to slice cc", "transfer 500 from axis to kotak"):
  - operation: "transfer"
  - amount: The numerical transfer amount
  - fromAccount: The exact source account name from [${accountNames}]
  - toAccount: The exact destination account name from [${accountNames}]
  - date: "YYYY-MM-DD"
  - notes: ""

- NEVER output "Axis" if user explicitly mentioned "slice". NEVER swap fromAccount and toAccount.

CRITICAL SPLIT EXPENSE RULES:
- When user paid a bill and split with friends (e.g. "spent 3k split between me, rahul, and rohit from slice" or "dinner 600 split 3 ways with amit"):
  - operation: "split_expense"
  - totalAmount: The entire total bill paid (e.g. 3000)
  - yourShare: The user's personal share of the bill (e.g. 3000 / 3 = 1000)
  - account: The exact bank account mentioned (e.g. "Slice Savings")
  - splits: An array of each OTHER person's share who owes the user (e.g. [{ "personName": "Rahul", "amount": 1000 }, { "personName": "Rohit", "amount": 1000 }])
  - DO NOT include the user in the splits array.

Types of operations:
1. "transaction": Normal expense or income.
2. "transfer": Transferring funds from one account to another.
3. "debt_add": User lent money TO someone ("lent 500 to rahul") or borrowed FROM someone.
4. "debt_settle": Someone paid user back ("rahul returned 500") or user paid someone back.
5. "split_expense": User paid a group expense and friends owe their share.

Output JSON Structure:
[
  {
    "operation": "transfer",
    "amount": 100,
    "fromAccount": "Kotak Bank",
    "toAccount": "Slice CC",
    "date": "YYYY-MM-DD",
    "notes": "Account transfer"
  },
  {
    "operation": "split_expense",
    "totalAmount": 3000,
    "yourShare": 1000,
    "description": "Dinner with friends",
    "category": "Food & Dining",
    "account": "Slice Savings",
    "date": "YYYY-MM-DD",
    "notes": "",
    "splits": [
      { "personName": "Rahul", "amount": 1000 },
      { "personName": "Rohit", "amount": 1000 }
    ]
  },
  {
    "operation": "transaction",
    "amount": 250,
    "type": "expense",
    "description": "Coffee and Snacks",
    "category": "Food & Dining",
    "account": "Kotak Bank",
    "date": "YYYY-MM-DD",
    "notes": ""
  },
  {
    "operation": "debt_add",
    "amount": 500,
    "direction": "lent",
    "personName": "Rahul",
    "reason": "Cab fare",
    "account": "Slice Savings",
    "date": "YYYY-MM-DD",
    "notes": ""
  }
]

Current Date: ${new Date().toISOString().split('T')[0]}
User Text: "${textInput}"`;

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
      let lastError = null;

      // 1. Try Gemini Vision
      if (geminiKey) {
        try {
          const resGem = await callGemini(prompt, { mime_type: mimeType, data: base64Data }, true);
          if (resGem?.text) {
            await logAiUsage(action, 'gemini', Date.now() - t0, true);
            return res.status(200).json({ rawJson: resGem.text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: `gemini (${resGem.model})` });
          }
        } catch (e) {
          lastError = e.message;
          await logAiUsage(action, 'gemini', Date.now() - t0, false, e.message);
        }
      }

      // 2. Try Groq Vision Fallback (llama-3.2-11b-vision-preview)
      if (groqKey) {
        try {
          const resGroq = await callGroq(prompt, true, { mime_type: mimeType, data: base64Data });
          if (resGroq?.text) {
            await logAiUsage(action, 'groq', Date.now() - t0, true);
            return res.status(200).json({ rawJson: resGroq.text.replace(/```json/g, '').replace(/```/g, '').trim(), aiUsed: `groq (${resGroq.model})` });
          }
        } catch (e) {
          lastError = e.message;
          await logAiUsage(action, 'groq', Date.now() - t0, false, e.message);
        }
      }

      return res.status(500).json({ error: lastError || 'Failed to scan receipt image. Please ensure GEMINI_API_KEY or GROQ_API_KEY is configured.' });
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
