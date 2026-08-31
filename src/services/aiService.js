/**
 * AI Service for Antigravity AI Expense Tracker
 * Calls serverless proxy /api/ai for 100% secret server-side API keys, with browser fallback.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Parses natural language input into a structured expense transaction object
 */
export async function parseNaturalLanguageTransaction(textInput, categories = [], accounts = [], apiKey = '', groqApiKey = '') {
  if (!textInput || !textInput.trim()) return null;

  const processParsed = (parsed) => {
    let arr = Array.isArray(parsed) ? parsed : null;
    if (!arr && typeof parsed === 'object' && parsed !== null) {
      for (const key of Object.keys(parsed)) {
        if (Array.isArray(parsed[key])) {
          arr = parsed[key];
          break;
        }
      }
      if (!arr) arr = [parsed];
    } else if (!arr) {
      arr = [];
    }

    return arr.map(p => {
      // It's a regular transaction
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
        if (!matchedAccount) {
          matchedAccount = accounts.find(a => searchDesc.includes(a.name.toLowerCase()));
        }

        return {
          operation: 'transaction',
          amount: parseFloat(p.amount) || 0,
          type: p.type === 'income' ? 'income' : 'expense',
          description: desc.charAt(0).toUpperCase() + desc.slice(1),
          categoryId: matchedCategory ? matchedCategory.id : categories[0]?.id || 'cat-1',
          accountId: matchedAccount ? matchedAccount.id : accounts[0]?.id || 'acc-1',
          date: p.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          notes: (p.notes || '').toString().trim()
        };
      }

      // It's a transfer operation
      if (p.operation === 'transfer') {
        let fromAcc = null;
        let toAcc = null;
        if (p.fromAccount) {
          const aiFrom = p.fromAccount.toLowerCase();
          fromAcc = accounts.find(a => aiFrom.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(aiFrom));
        }
        if (p.toAccount) {
          const aiTo = p.toAccount.toLowerCase();
          toAcc = accounts.find(a => aiTo.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(aiTo));
        }
        return {
          operation: 'transfer',
          amount: parseFloat(p.amount) || 0,
          fromAccountId: fromAcc ? fromAcc.id : accounts[0]?.id || 'acc-1',
          toAccountId: toAcc ? toAcc.id : accounts[1]?.id || 'acc-2',
          date: p.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          notes: (p.notes || '').toString().trim()
        };
      }

      // It's a debt operation
      if (p.operation === 'debt_add' || p.operation === 'debt_settle') {
        let matchedAccount = null;
        const aiAcc = (p.account || 'Slice Savings').toLowerCase();
        matchedAccount = accounts.find(a => aiAcc.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(aiAcc));
        
        return {
          operation: p.operation,
          amount: parseFloat(p.amount) || 0,
          direction: p.direction === 'borrowed' ? 'borrowed' : 'lent',
          personName: p.personName || 'Unknown',
          reason: p.reason || '',
          accountId: matchedAccount ? matchedAccount.id : accounts[0]?.id || 'acc-1',
          date: p.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          notes: (p.notes || '').toString().trim()
        };
      }

      // It's a split expense
      if (p.operation === 'split_expense') {
        let matchedAccount = null;
        if (p.account) {
          const aiAcc = p.account.toLowerCase();
          matchedAccount = accounts.find(a => aiAcc.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(aiAcc));
        }
        let matchedCategory = null;
        if (p.category) {
          const aiCat = p.category.toLowerCase();
          matchedCategory = categories.find(c => aiCat.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(aiCat));
        }
        const desc = p.description || 'Shared expense';
        return {
          operation: 'split_expense',
          totalAmount: parseFloat(p.totalAmount) || 0,
          yourShare: parseFloat(p.yourShare) || 0,
          description: desc.charAt(0).toUpperCase() + desc.slice(1),
          categoryId: matchedCategory ? matchedCategory.id : categories[0]?.id || 'cat-1',
          accountId: matchedAccount ? matchedAccount.id : accounts[0]?.id || 'acc-1',
          date: p.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          notes: (p.notes || '').toString().trim(),
          splits: Array.isArray(p.splits) ? p.splits.map(s => ({ personName: s.personName || 'Friend', amount: parseFloat(s.amount) || 0 })) : []
        };
      }

      return null;
    }).filter(Boolean);
  };


  // 1. First try Serverless Proxy /api/ai (100% Secret Server Keys)
  try {
    console.log('[AI] Trying serverless /api/ai...');
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parseText', textInput, categories, accounts })
    });
    console.log('[AI] /api/ai status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('[AI] /api/ai response:', data);
      if (data.rawJson) {
        const parsed = JSON.parse(data.rawJson);
        console.log('[AI] Parsed from server:', parsed);
        return processParsed(parsed);
      }
      if (data.error) {
        console.warn('[AI] Server returned error:', data.error);
      }
    }
  } catch (e) {
    console.warn('[AI] /api/ai call failed:', e.message);
  }

  // 2. Direct browser Gemini API key call
  if (apiKey && apiKey.trim()) {
    console.log('[AI] Trying browser Gemini key...');
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const accountNames = accounts.map(a => a.name).join(', ');
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
    "direction": "lent",  // "lent" (user gave money) or "borrowed" (user received money)
    "personName": "Rahul",
    "reason": "Lunch",
    "account": "Match best account",
    "date": "YYYY-MM-DD",
    "notes": ""
  },
  {
    "operation": "debt_settle",
    "amount": 500,
    "direction": "lent", // "lent" (someone returning money to user) or "borrowed" (user returning money to someone)
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
- date: default to current date: ${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]} if unspecified.

User text: "${textInput}"`;

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      console.log('[AI] Browser Gemini status:', response.status);
      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log('[AI] Browser Gemini raw text:', rawText);
        if (rawText) {
          const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedText);
          console.log('[AI] Browser Gemini parsed:', parsed);
          return processParsed(parsed);
        }
      }
    } catch (err) {
      console.warn('[AI] Browser Gemini failed:', err.message);
    }
  } else {
    console.log('[AI] No browser Gemini key available');
  }

  // 3. Direct browser Groq API key call
  if (groqApiKey && groqApiKey.trim()) {
    console.log('[AI] Trying browser Groq key...');
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const accountNames = accounts.map(a => a.name).join(', ');
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
    "direction": "lent",  // "lent" (user gave money) or "borrowed" (user received money)
    "personName": "Rahul",
    "reason": "Lunch",
    "account": "Match best account",
    "date": "YYYY-MM-DD",
    "notes": ""
  },
  {
    "operation": "debt_settle",
    "amount": 500,
    "direction": "lent", // "lent" (someone returning money to user) or "borrowed" (user returning money to someone)
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
- date: default to current date: ${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]} if unspecified.

User text: "${textInput}"`;

      const groqResult = await callGroqApi(prompt, groqApiKey);
      console.log('[AI] Browser Groq raw result:', groqResult);
      if (groqResult) {
        const parsed = JSON.parse(groqResult);
        console.log('[AI] Browser Groq parsed:', parsed);
        return processParsed(parsed);
      }
    } catch (err) {
      console.warn('[AI] Browser Groq failed:', err.message);
    }
  } else {
    console.log('[AI] No browser Groq key available');
  }

  // 4. Smart local regex fallback (handles multiple transactions)
  console.warn('[AI] Falling back to local regex parser');
  return fallbackLocalParser(textInput, categories, accounts);
}

/**
 * Receipt OCR Image Parser
 */
export async function parseReceiptImage(base64Image, categories = [], accounts = [], apiKey = '') {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parseReceipt', base64Image, categories, accounts })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.rawJson) {
        const parsed = JSON.parse(data.rawJson);
        return formatParsedTransaction({
          amount: parsed.amount,
          type: 'expense',
          description: parsed.merchant || parsed.description || 'Receipt Purchase',
          category: parsed.category,
          date: parsed.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
        }, categories, accounts);
      }
    }
  } catch (e) {}

  if (!apiKey) {
    throw new Error('Please enter your free Gemini API key in settings or set GEMINI_API_KEY in Vercel environment variables.');
  }

  const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
  const base64Data = base64Image.split(',')[1];
  const categoryNames = categories.map(c => c.name).join(', ');

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

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64Data } }
        ]
      }]
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to scan receipt image.');
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Could not extract text from receipt.');

  const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
  const parsed = JSON.parse(cleanedText);
  
  return formatParsedTransaction({
    amount: parsed.amount,
    type: 'expense',
    description: parsed.merchant || parsed.description || 'Receipt Purchase',
    category: parsed.category,
    date: parsed.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]
  }, categories, accounts);
}

/**
 * Conversational AI Assistant
 */
export async function askAiAssistant(question, contextData, apiKey = '', groqApiKey = '') {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'chat', question, contextData })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.response) return data.response;
    }
  } catch (e) {}

  if (apiKey && apiKey.trim()) {
    try {
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

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (response.ok) {
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
      }
    } catch (err) {}
  }

  if (groqApiKey && groqApiKey.trim()) {
    try {
      const prompt = `You are a friendly personal finance assistant in an expense tracker app.
User question: "${question}"`;
      const groqResult = await callGroqApi(prompt, groqApiKey);
      if (groqResult) return groqResult;
    } catch (err) {}
  }

  return "Please set GEMINI_API_KEY / GROQ_API_KEY in Vercel environment variables or in app settings UI!";
}

/**
 * Groq API Integration Helper
 */
async function callGroqApi(prompt, groqApiKey) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${groqApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'groq/compound-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2
    })
  });

  if (response.ok) {
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    return text ? text.replace(/```json/g, '').replace(/```/g, '').trim() : null;
  }
  return null;
}

/**
 * Formats parsed output to match category and account IDs
 */
function formatParsedTransaction(parsed, categories, accounts) {
  let matchedCategory = categories.find(c => c.name.toLowerCase() === (parsed.category || '').toLowerCase());
  if (!matchedCategory) matchedCategory = categories[0];

  let matchedAccount = accounts.find(a => a.name.toLowerCase().includes((parsed.account || '').toLowerCase()));
  if (!matchedAccount) matchedAccount = accounts[0];

  // Clean description string to ensure no residual currency labels like "rs", "usd", etc.
  let cleanDescription = (parsed.description || 'Quick Transaction')
    .replace(/\b(?:rs|inr|usd|bucks|dollars|rupees|spent|paid|for|costed|cost)\b/gi, '')
    .trim();

  if (!cleanDescription) cleanDescription = 'Purchase Item';

  return {
    amount: parseFloat(parsed.amount) || 0,
    type: parsed.type?.toLowerCase() === 'income' ? 'income' : 'expense',
    description: cleanDescription.charAt(0).toUpperCase() + cleanDescription.slice(1),
    categoryId: matchedCategory ? matchedCategory.id : 'cat-1',
    accountId: matchedAccount ? matchedAccount.id : 'acc-1',
    date: parsed.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
    notes: (parsed.notes || '').toString().trim()
  };
}

/**
 * Intelligent local regex fallback parser — handles multiple transactions
 */
function fallbackLocalParser(input, categories, accounts) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const defaultAccountId = accounts[0]?.id || 'acc-1';
  const defaultCategoryId = categories[0]?.id || 'cat-1';

  const getCategoryId = (text) => {
    for (const cat of categories) {
      if (text.includes(cat.name.toLowerCase())) return cat.id;
    }
    if (/\b(?:food|dinner|lunch|breakfast|coffee|pizza|restaurant|pepsi|burger|coke|drink|snack|eat|ate|protta|dosa|idli|biriyani|chai|tea)\b/i.test(text)) return categories.find(c => /food|dining|restaurant/i.test(c.name))?.id || defaultCategoryId;
    if (/\b(?:grocer|supermarket|vegetable|fruit|milk)\b/i.test(text)) return categories.find(c => /grocer|market/i.test(c.name))?.id || defaultCategoryId;
    if (/\b(?:uber|gas|fuel|cab|ride|auto|taxi|train|bus|petrol)\b/i.test(text)) return categories.find(c => /transport|travel/i.test(c.name))?.id || defaultCategoryId;
    if (/\b(?:bill|electricity|water|wifi|recharge|internet|power)\b/i.test(text)) return categories.find(c => /bill|util/i.test(c.name))?.id || defaultCategoryId;
    if (/\b(?:movie|netflix|game|cinema|show)\b/i.test(text)) return categories.find(c => /entertain/i.test(c.name))?.id || defaultCategoryId;
    return defaultCategoryId;
  };

  const getAccountId = (text) => {
    for (const acc of accounts) {
      if (text.includes(acc.name.toLowerCase())) return acc.id;
    }
    if (/\b(?:card|credit|debit|upi|gpay|phonepay|paytm)\b/i.test(text)) {
      return accounts.find(a => /card|credit|debit/i.test(a.name))?.id || defaultAccountId;
    }
    return defaultAccountId;
  };

  const isIncomeSentence = (text) => /\b(?:salary|income|received|earned|got paid)\b/i.test(text);

  // Split input into chunks at conjunctions that likely separate two expenses
  // Pattern: "... 240 rs and had choco tnami costed 229 rs"
  // We split whenever we see "and" preceded by an amount
  const chunks = input
    .split(/\b(?:and also|and then|also|then)\b/i)
    .map(s => s.trim())
    .filter(Boolean);

  const results = [];

  for (const chunk of chunks) {
    const text = chunk.toLowerCase();

    // Find amount in this chunk
    const amountMatch = text.match(/(?:[\$₹€£]\s*)?(\d+(?:\.\d{1,2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

    // Build description: remove amount, currency words, filler words
    let description = chunk
      .replace(/(?:[\$₹€£]\s*)?\d+(?:\.\d{1,2})?/g, ' ')
      .replace(/\b(?:spent|paid|received|earned|costed|cost|for|via|with|on|at|using|me|i|had|have|rs|inr|usd|bucks|dollars|rupees|a|an|the|it|was|is)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description || description.length < 2) {
      description = isIncomeSentence(text) ? 'Income' : 'Expense Item';
    }

    results.push({
      amount,
      type: isIncomeSentence(text) ? 'income' : 'expense',
      description: description.charAt(0).toUpperCase() + description.slice(1),
      categoryId: getCategoryId(text),
      accountId: getAccountId(text),
      date: today,
      notes: ''
    });
  }

  console.log('[AI] Local fallback produced:', results);
  return results.length > 0 ? results : [{
    amount: 0,
    type: 'expense',
    description: 'Expense Item',
    categoryId: defaultCategoryId,
    accountId: defaultAccountId,
    date: today,
    notes: ''
  }];
}

