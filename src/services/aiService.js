/**
 * AI Service for Antigravity AI Expense Tracker
 * Calls serverless proxy /api/ai for 100% secret server-side API keys, with browser fallback.
 */

import { matchAccount, matchCategory, formatParsedTransaction } from './aiMatchUtils.js';
import { fallbackLocalParser } from './localFallbackParser.js';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Parses natural language input into structured financial operations
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
        const fromHint = p.fromAccount || p.from || p.sourceAccount || p.from_account || p.source;
        const toHint = p.toAccount || p.to || p.targetAccount || p.destinationAccount || p.to_account || p.destination;

        // Pass specific hint as both hint and userText so matchAccount doesn't cross-match other bank names from full sentence
        const fromAcc = matchAccount(fromHint, fromHint || textInput, accounts, 'transaction');
        let toAcc = matchAccount(toHint, toHint || textInput, accounts, 'transaction');

        // Only pick an alternative if destination was completely missing/unresolvable
        if (toAcc.id === fromAcc.id && !toHint) {
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
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'parseText', textInput, categories, accounts, preferredEngine })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.rawJson) {
        const parsed = JSON.parse(data.rawJson);
        return processParsed(parsed);
      }
    }
  } catch (e) {}

  // 2. Direct browser Gemini API key call
  if (apiKey && apiKey.trim() && preferredEngine !== 'groq') {
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
- Correct mobile typing errors: "korak" -> "Kotak Bank", "axix" -> "Axis Bank", "slise" -> "Slice".

TRANSFER:
- "transfer 100 from kotak to slice cc" ->
  operation: "transfer", amount: 100, fromAccount: "Kotak Bank", toAccount: "Slice CC"

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
    } catch (err) {}
  }

  // 3. Direct browser Groq API key call
  if (groqApiKey && groqApiKey.trim() && preferredEngine !== 'gemini') {
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
- Correct mobile typing errors: "korak" -> "Kotak Bank", "axix" -> "Axis Bank", "slise" -> "Slice".

TRANSFER:
- "transfer 100 from kotak to slice cc" ->
  operation: "transfer", amount: 100, fromAccount: "Kotak Bank", toAccount: "Slice CC"

SPLIT EXPENSE:
- "spent 3k split between me, rahul, and rohit from slice" ->
  operation: "split_expense", totalAmount: 3000, yourShare: 1000, account: "Slice Savings", splits: [{"personName": "Rahul", "amount": 1000}, {"personName": "Rohit", "amount": 1000}]

User text: "${textInput}"`;

      const groqResult = await callGroqApi(prompt, groqApiKey);
      if (groqResult) {
        const parsed = JSON.parse(groqResult);
        return processParsed(parsed);
      }
    } catch (err) {}
  }

  // 4. Smart local regex fallback
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
    const geminiModels = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-flash-latest'];
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
      const groqVisionModels = ['llama-3.2-11b-vision-preview'];
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
