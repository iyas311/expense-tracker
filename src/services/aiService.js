/**
 * AI Service for Antigravity AI Expense Tracker
 * Calls serverless proxy /api/ai for 100% secret server-side API keys, with browser fallback.
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Smart Account Matcher with Keyword & Substring Scoring
 */
function matchAccount(hint, userText, accounts = [], defaultType = 'transaction') {
  if (!accounts || accounts.length === 0) return { id: 'acc-1', name: 'Default' };
  
  const cleanHint = (hint || '').toLowerCase().trim();
  const cleanText = (userText || '').toLowerCase().trim();

  // 1. Check if userText explicitly mentioned any specific account keyword
  for (const acc of accounts) {
    const accKeywords = acc.name.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['bank', 'account', 'savings'].includes(w));
    for (const kw of accKeywords) {
      if (cleanText.includes(kw)) {
        return acc;
      }
    }
  }

  // 2. Direct hint match from AI response
  if (cleanHint) {
    const found = accounts.find(a => {
      const accName = a.name.toLowerCase();
      return accName === cleanHint || accName.includes(cleanHint) || cleanHint.includes(accName);
    });
    if (found) return found;

    // Word token match (e.g. "slice" matches "Slice Savings")
    const hintWords = cleanHint.split(/\s+/).filter(w => w.length > 2);
    for (const hw of hintWords) {
      const wordMatch = accounts.find(a => a.name.toLowerCase().includes(hw));
      if (wordMatch) return wordMatch;
    }
  }

  // 3. Fallback defaults
  if (defaultType === 'debt') {
    const sliceAcc = accounts.find(a => a.name.toLowerCase().includes('slice'));
    if (sliceAcc) return sliceAcc;
  }
  const kotakAcc = accounts.find(a => a.name.toLowerCase().includes('kotak'));
  if (kotakAcc) return kotakAcc;

  return accounts[0];
}

/**
 * Smart Category Matcher
 */
function matchCategory(hint, descText, categories = [], type = 'expense') {
  if (!categories || categories.length === 0) return { id: 'cat-1', name: 'General' };
  const cleanHint = (hint || '').toLowerCase().trim();
  const cleanDesc = (descText || '').toLowerCase().trim();

  if (cleanHint) {
    const found = categories.find(c => {
      const cName = c.name.toLowerCase();
      return cName === cleanHint || cName.includes(cleanHint) || cleanHint.includes(cName);
    });
    if (found) return found;
  }

  const foundDesc = categories.find(c => cleanDesc.includes(c.name.toLowerCase()));
  if (foundDesc) return foundDesc;

  return categories.find(c => c.type === type) || categories[0];
}

/**
 * Parses natural language input into a structured expense transaction object
 */
export async function parseNaturalLanguageTransaction(textInput, categories = [], accounts = [], apiKey = '', groqApiKey = '', preferredEngine = 'auto') {
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
      // 1. Regular transaction
      if (!p.operation || p.operation === 'transaction') {
        const desc = p.description || 'Expense';
        const matchedCategory = matchCategory(p.category, desc, categories, p.type === 'income' ? 'income' : 'expense');
        const matchedAccount = matchAccount(p.account, textInput, accounts, 'transaction');

        return {
          operation: 'transaction',
          amount: parseFloat(p.amount) || 0,
          type: p.type === 'income' ? 'income' : 'expense',
          description: desc.charAt(0).toUpperCase() + desc.slice(1),
          categoryId: matchedCategory.id,
          accountId: matchedAccount.id,
          date: p.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          notes: (p.notes || '').toString().trim()
        };
      }

      // 2. Transfer operation
      if (p.operation === 'transfer') {
        const fromAcc = matchAccount(p.fromAccount, textInput, accounts, 'transaction');
        let toAcc = matchAccount(p.toAccount, textInput, accounts, 'transaction');
        if (toAcc.id === fromAcc.id) {
          toAcc = accounts.find(a => a.id !== fromAcc.id) || accounts[1] || accounts[0];
        }
        return {
          operation: 'transfer',
          amount: parseFloat(p.amount) || 0,
          fromAccountId: fromAcc.id,
          toAccountId: toAcc.id,
          date: p.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          notes: (p.notes || '').toString().trim()
        };
      }

      // 3. Debt operation (add or settle)
      if (p.operation === 'debt_add' || p.operation === 'debt_settle') {
        const matchedAccount = matchAccount(p.account, textInput, accounts, 'debt');
        
        return {
          operation: p.operation,
          amount: parseFloat(p.amount) || 0,
          direction: p.direction === 'borrowed' ? 'borrowed' : 'lent',
          personName: p.personName || 'Friend',
          reason: p.reason || p.description || '',
          accountId: matchedAccount.id,
          date: p.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
          notes: (p.notes || '').toString().trim()
        };
      }

      // 4. Split expense
      if (p.operation === 'split_expense') {
        const desc = p.description || 'Shared Expense';
        const matchedCategory = matchCategory(p.category, desc, categories, 'expense');
        const matchedAccount = matchAccount(p.account, textInput, accounts, 'transaction');
        
        return {
          operation: 'split_expense',
          totalAmount: parseFloat(p.totalAmount) || 0,
          yourShare: parseFloat(p.yourShare) || 0,
          description: desc.charAt(0).toUpperCase() + desc.slice(1),
          categoryId: matchedCategory.id,
          accountId: matchedAccount.id,
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
    console.log('[AI] Trying serverless /api/ai with preferredEngine:', preferredEngine);
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parseText', textInput, categories, accounts, preferredEngine })
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
  if (apiKey && apiKey.trim() && preferredEngine !== 'groq') {
    console.log('[AI] Trying browser Gemini key...');
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const accountNames = accounts.map(a => a.name).join(', ');
      const prompt = `You are an expert financial transaction parser AI.
Analyze the user's text and extract a list of financial operations.
Return ONLY a raw JSON array of objects with NO markdown formatting, NO backticks.

Available Accounts: [${accountNames}]
Available Categories: [${categoryNames}]

CRITICAL ACCOUNT MATCHING:
- Always scan text for bank names (e.g. "slice", "axis", "kotak", "cash").
- Match "slice" to "Slice Savings", "axis" to "Axis Bank", "kotak" to "Kotak Bank".

SPLIT EXPENSE:
- "spent 3k split between me, rahul, and rohit from slice" ->
  operation: "split_expense", totalAmount: 3000, yourShare: 1000, account: "Slice Savings", splits: [{"personName": "Rahul", "amount": 1000}, {"personName": "Rohit", "amount": 1000}]

User text: "${textInput}"`;

      const geminiModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
      for (const gModel of geminiModels) {
        try {
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { response_mime_type: 'application/json', temperature: 0.1 }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(cleanedText);
              return processParsed(parsed);
            }
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[AI] Browser Gemini failed:', err.message);
    }
  }

  // 3. Direct browser Groq API key call
  if (groqApiKey && groqApiKey.trim() && preferredEngine !== 'gemini') {
    console.log('[AI] Trying browser Groq key...');
    try {
      const categoryNames = categories.map(c => c.name).join(', ');
      const accountNames = accounts.map(a => a.name).join(', ');
      const prompt = `You are an expert financial transaction parser AI.
Analyze the user's text and extract a list of financial operations.
Return ONLY a raw JSON array of objects with NO markdown formatting, NO backticks.

Available Accounts: [${accountNames}]
Available Categories: [${categoryNames}]

CRITICAL ACCOUNT MATCHING:
- Always scan text for bank names (e.g. "slice", "axis", "kotak", "cash").
- Match "slice" to "Slice Savings", "axis" to "Axis Bank", "kotak" to "Kotak Bank".

SPLIT EXPENSE:
- "spent 3k split between me, rahul, and rohit from slice" ->
  operation: "split_expense", totalAmount: 3000, yourShare: 1000, account: "Slice Savings", splits: [{"personName": "Rahul", "amount": 1000}, {"personName": "Rohit", "amount": 1000}]

User text: "${textInput}"`;

      const groqResult = await callGroqApi(prompt, groqApiKey);
      if (groqResult) {
        const parsed = JSON.parse(groqResult);
        return processParsed(parsed);
      }
    } catch (err) {
      console.warn('[AI] Browser Groq failed:', err.message);
    }
  }

  // 4. Smart local regex fallback
  console.warn('[AI] Falling back to local regex parser');
  return fallbackLocalParser(textInput, categories, accounts);
}

/**
 * Receipt OCR Image Parser
 */
export async function parseReceiptImage(base64Image, categories = [], accounts = [], apiKey = '', groqApiKey = '') {
  // 1. Try serverless endpoint first
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parseReceipt', base64Image, categories, accounts, apiKey, groqApiKey })
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

  // 2. Direct browser Gemini Vision
  if (apiKey && apiKey.trim()) {
    const geminiModels = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-flash-latest'];
    for (const gModel of geminiModels) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${apiKey}`, {
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

        if (response.ok) {
          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
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
        }
      } catch (e) {}
    }
  }

  // 3. Direct browser Groq Vision
  if (groqApiKey && groqApiKey.trim()) {
    try {
      const groqVisionModels = ['llama-3.2-11b-vision-preview', 'llama-3.2-90b-vision-preview'];
      for (const gModel of groqVisionModels) {
        try {
          const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: gModel,
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: prompt },
                  { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Data}` } }
                ]
              }],
              response_format: { type: 'json_object' },
              temperature: 0.1
            })
          });

          if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
              const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
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
      }
    } catch (e) {}
  }

  throw new Error('Could not extract text from receipt. Please check your Gemini or Groq API key.');
}

/**
 * Conversational AI Assistant
 */
export async function askAiAssistant(question, contextData, apiKey = '', groqApiKey = '', preferredEngine = 'auto', chatHistory = []) {
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'chat', question, contextData, apiKey, groqApiKey, preferredEngine, chatHistory })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.response) {
        return {
          response: data.response,
          aiUsed: data.aiUsed || 'auto',
          model: data.model || null
        };
      }
    }
  } catch (e) {}

  // Direct Browser Fallbacks
  const historyText = (chatHistory || [])
    .slice(-6)
    .map(m => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.text}`)
    .join('\n');

  const chatPrompt = `You are an expert personal financial advisor and assistant in an expense tracker app.
Context summary of user's financial state:
- Total Net Worth: ${contextData.netWorth}
- Total Monthly Income: ${contextData.totalIncome}
- Total Monthly Expenses: ${contextData.totalExpenses}
- Daily Spending Allowance: ${contextData.dailySafeSpend || 'N/A'} (Spent today: ${contextData.spentToday || 'N/A'})
- Spending By Category: ${JSON.stringify(contextData.monthlySpendingByCategory || {})}
- Category Budgets: ${JSON.stringify(contextData.categoryBudgets || {})}
- Account Balances & Limits: ${JSON.stringify(contextData.accounts)}
- Debts / IOUs: ${JSON.stringify(contextData.debts || [])}
- Subscriptions: ${JSON.stringify(contextData.subscriptions || [])}
- Recent Transactions: ${JSON.stringify(contextData.recentTransactions)}

Recent Conversation:
${historyText || 'No previous messages.'}

User question: "${question}"
Provide a helpful, encouraging, accurate, and concise response in 2-4 sentences or clear bullet points quoting real figures from their data.`;

  if (apiKey && apiKey.trim() && preferredEngine !== 'groq') {
    const geminiModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest'];
    for (const gModel of geminiModels) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: chatPrompt }] }] })
        });

        if (response.ok) {
          const data = await response.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            return { response: text, aiUsed: 'gemini', model: gModel };
          }
        }
      } catch (err) {}
    }
  }

  if (groqApiKey && groqApiKey.trim() && preferredEngine !== 'gemini') {
    try {
      const groqModels = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3.8-27b'];
      for (const model of groqModels) {
        try {
          const response = await fetch(GROQ_API_URL, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: chatPrompt }],
              temperature: 0.2
            })
          });

          if (response.ok) {
            const data = await response.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
              return { response: text, aiUsed: 'groq', model };
            }
          }
        } catch (e) {}
      }
    } catch (err) {}
  }

  return {
    response: "Please set GEMINI_API_KEY / GROQ_API_KEY in Vercel environment variables or in app settings UI!",
    aiUsed: 'none',
    model: null
  };
}

/**
 * Groq API Integration Helper
 */
async function callGroqApi(prompt, groqApiKey) {
  const models = ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b'];

  for (const model of models) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) return text.replace(/```json/g, '').replace(/```/g, '').trim();
      }
    } catch (e) {}
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
      operation: 'transaction',
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
    operation: 'transaction',
    amount: 0,
    type: 'expense',
    description: 'Expense Item',
    categoryId: defaultCategoryId,
    accountId: defaultAccountId,
    date: today,
    notes: ''
  }];
}

