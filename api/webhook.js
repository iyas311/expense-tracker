import { sql } from '@vercel/postgres';
import { parseNaturalLanguageTransaction } from '../src/services/aiService.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    // 1. Find user by webhook token (using the normal session token for now, or they can generate a specific one)
    const sessions = await sql\SELECT user_id, vault_id FROM app_sessions WHERE token = \ AND expires_at > CURRENT_TIMESTAMP;\;
    if (sessions.length === 0) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const vaultId = sessions[0].vault_id;

    // 2. Fetch required context for AI (categories, accounts)
    const [categories, accounts, settings] = await Promise.all([
      sql\SELECT id, name FROM categories WHERE vault_id = \;\,
      sql\SELECT id, name FROM accounts WHERE vault_id = \;\,
      sql\SELECT key, value FROM app_settings WHERE vault_id = \;\
    ]);

    let geminiKey = process.env.GEMINI_API_KEY || '';
    let groqKey = process.env.GROQ_API_KEY || '';

    settings.forEach(s => {
      if (s.key === 'gemini_api_key' && s.value) geminiKey = s.value;
      if (s.key === 'groq_api_key' && s.value) groqKey = s.value;
    });

    if (!geminiKey && !groqKey) {
      return res.status(500).json({ error: 'No AI API keys configured' });
    }

    // 3. Parse the text using our existing AI service logic natively on the backend
    // But wait, parseNaturalLanguageTransaction is in src/services/aiService.js which uses fetch('/api/ai')! 
    // We should directly call the Gemini/Groq APIs here to avoid circular fetch.
    
    const categoryNames = categories.map(c => c.name).join(', ');
    const accountNames = accounts.map(a => a.name).join(', ');
    const prompt = \You are a smart financial AI. Analyze the user's text and extract a list of financial operations.
Return ONLY a raw JSON array of objects with NO markdown formatting, NO code blocks. Do not wrap the array in an object.

Types of operations you can extract:
1. "transaction": Standard expense or income.
2. "transfer": Moving money between accounts.
3. "debt_add": When the user lends money TO someone, or borrows money FROM someone.
4. "debt_settle": When a person pays the user back, or the user pays a person back.

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
    "notes": "Put location/extra context here"
  }
]

Object Fields required for transaction:
- amount: number
- type: string ("expense" or "income")
- description: string (clean short item name ONLY)
- category: string (match best from: [\] or invent a logical one)
- account: string (match best from: [\] or default "Bank Account")
- date: YYYY-MM-DD (default to current date: \)
- notes: string (any location, reasoning, or extra context)

Analyze this input: "\"\;

    let parsedArray = null;

    if (geminiKey) {
      const response = await fetch(\https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=\\, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      parsedArray = JSON.parse(rawJson.replace(/\\\json/g, '').replace(/\\\/g, '').trim());
    }

    if (!parsedArray || parsedArray.length === 0) {
       return res.status(400).json({ error: 'Could not parse any transactions' });
    }

    // 4. Save to DB
    let insertedCount = 0;
    for (const p of parsedArray) {
      if (!p.operation || p.operation === 'transaction') {
        const desc = p.description || 'Expense';
        const searchDesc = desc.toLowerCase();
        
        let matchedCategory = categories.find(c => searchDesc.includes(c.name.toLowerCase()));
        if (!matchedCategory && p.category) {
          const aiCat = p.category.toLowerCase();
          matchedCategory = categories.find(c => aiCat.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(aiCat));
        }

        let matchedAccount = null;
        if (p.account) {
          const aiAcc = p.account.toLowerCase();
          matchedAccount = accounts.find(a => aiAcc.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(aiAcc));
        }

        const catId = matchedCategory ? matchedCategory.id : (categories[0]?.id || 'cat-1');
        const accId = matchedAccount ? matchedAccount.id : (accounts[0]?.id || 'acc-1');
        const txId = 'tx-' + Date.now() + Math.floor(Math.random()*1000);

        await sql\
          INSERT INTO transactions (id, date, description, amount, type, category_id, account_id, notes, vault_id)
          VALUES (\, \, \, \, \, \, \, \, \);
        \;
        insertedCount++;
      }
    }

    return res.status(200).json({ success: true, message: \Logged \ transaction(s)\ });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
