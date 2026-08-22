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

  // 1. First try Serverless Proxy /api/ai (100% Secret Server Keys)
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parseText', textInput, categories, accounts })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.rawJson) {
        const parsed = JSON.parse(data.rawJson);
        return formatParsedTransaction(parsed, categories, accounts);
      }
    }
  } catch (e) {}

  // 2. Direct browser Gemini API key call
  if (apiKey && apiKey.trim()) {
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const accountNames = accounts.map(a => a.name).join(', ');
      const prompt = `You are a financial transaction extractor. Analyze the user's text and extract transaction details.
Return ONLY a raw JSON object with NO markdown formatting, NO code blocks.
Fields required:
- amount: number
- type: string ("expense" or "income")
- description: string (clean merchant or item name ONLY, e.g. "Pepsi" or "Burger". Do NOT include words like "rs", "spent", "for", "costed")
- category: string (match best from: [${categoryNames}] or invent a logical one)
- account: string (match best from: [${accountNames}] or default "Bank Account")
- date: YYYY-MM-DD (default to current date: ${new Date().toISOString().split('T')[0]} if unspecified)

User text: "${textInput}"`;

      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanedText);
          return formatParsedTransaction(parsed, categories, accounts);
        }
      }
    } catch (err) {}
  }

  // 3. Direct browser Groq API key call
  if (groqApiKey && groqApiKey.trim()) {
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const accountNames = accounts.map(a => a.name).join(', ');
      const prompt = `You are a financial transaction extractor. Analyze the user's text and extract transaction details.
Return ONLY a raw JSON object with NO markdown formatting, NO code blocks.
Fields required:
- amount: number
- type: string ("expense" or "income")
- description: string (clean item or merchant name ONLY, e.g. "Pepsi" or "Burger")
- category: string
- account: string
- date: string (YYYY-MM-DD)

User text: "${textInput}"`;

      const groqResult = await callGroqApi(prompt, groqApiKey);
      if (groqResult) {
        const parsed = JSON.parse(groqResult);
        return formatParsedTransaction(parsed, categories, accounts);
      }
    } catch (err) {}
  }

  // 4. Smart local regex fallback
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
          date: parsed.date || new Date().toISOString().split('T')[0]
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
    date: parsed.date || new Date().toISOString().split('T')[0]
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
    date: parsed.date || new Date().toISOString().split('T')[0]
  };
}

/**
 * Intelligent local regex fallback parser
 */
function fallbackLocalParser(input, categories, accounts) {
  const text = input.toLowerCase();

  const amountMatch = text.match(/(?:[\$₹€£]\s*)?(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  const isIncome = /\b(?:salary|income|received|earned|got paid)\b/i.test(text);
  const type = isIncome ? 'income' : 'expense';

  let categoryId = categories[0]?.id || 'cat-1';
  for (const cat of categories) {
    if (text.includes(cat.name.toLowerCase())) {
      categoryId = cat.id;
      break;
    }
  }
  if (categoryId === categories[0]?.id) {
    if (/\b(?:food|dinner|lunch|coffee|pizza|restaurant|pepsi|burger|coke|drink|snack|eat|ate)\b/i.test(text)) categoryId = 'cat-1';
    else if (/\b(?:grocer|walmart|supermarket|vegetable|fruit)\b/i.test(text)) categoryId = 'cat-2';
    else if (/\b(?:uber|gas|fuel|flight|cab|ride|auto|taxi|train|bus)\b/i.test(text)) categoryId = 'cat-3';
    else if (/\b(?:bill|electricity|water|wifi|recharge|internet|power)\b/i.test(text)) categoryId = 'cat-4';
    else if (/\b(?:movie|netflix|game|cinema|show)\b/i.test(text)) categoryId = 'cat-5';
  }

  let accountId = accounts[0]?.id || 'acc-1';
  for (const acc of accounts) {
    if (text.includes(acc.name.toLowerCase())) {
      accountId = acc.id;
      break;
    }
  }

  let description = input
    .replace(/(?:[\$₹€£]\s*)?\d+(?:\.\d{1,2})?/g, ' ')
    .replace(/\b(?:spent|paid|received|earned|costed|cost|for|via|with|on|at|using|me|rs|inr|usd|bucks|dollars|rupees|a|an|the)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!description) description = isIncome ? 'Income Source' : 'Expense Item';

  return {
    amount,
    type,
    description: description.charAt(0).toUpperCase() + description.slice(1),
    categoryId,
    accountId,
    date: new Date().toISOString().split('T')[0]
  };
}
