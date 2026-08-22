/**
 * AI Service for Antigravity AI Expense Tracker
 * Supports Google Gemini API (gemini-1.5-flash / gemini-2.0-flash), Groq API (llama-3.3-70b-versatile), and smart regex fallback
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Parses natural language input into a structured expense transaction object
 */
export async function parseNaturalLanguageTransaction(textInput, categories = [], accounts = [], apiKey = '', groqApiKey = '') {
  if (!textInput || !textInput.trim()) return null;

  const categoryNames = categories.map(c => c.name).join(', ');
  const accountNames = accounts.map(a => a.name).join(', ');

  const prompt = `You are a financial transaction extractor. Analyze the user's text and extract transaction details.
Return ONLY a raw JSON object with NO markdown formatting, NO code blocks.
Fields required:
- amount: number (e.g. 45.50)
- type: string ("expense" or "income")
- description: string (clean title, e.g. "Walmart Groceries")
- category: string (match best from: [${categoryNames}] or invent a logical one)
- account: string (match best from: [${accountNames}] or default "Bank Account")
- date: YYYY-MM-DD (default to current date: ${new Date().toISOString().split('T')[0]} if unspecified)

User text: "${textInput}"`;

  // 1. Try Gemini API if key provided
  if (apiKey && apiKey.trim()) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
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
    } catch (err) {
      console.warn('Gemini API call failed, attempting Groq fallback...', err);
    }
  }

  // 2. Try Groq API Fallback if Groq key provided
  if (groqApiKey && groqApiKey.trim()) {
    try {
      const groqResult = await callGroqApi(prompt, groqApiKey);
      if (groqResult) {
        const parsed = JSON.parse(groqResult);
        return formatParsedTransaction(parsed, categories, accounts);
      }
    } catch (err) {
      console.warn('Groq API call failed:', err);
    }
  }

  // 3. Smart local regex fallback
  return fallbackLocalParser(textInput, categories, accounts);
}

/**
 * Receipt OCR Image Parser using Gemini Vision API
 */
export async function parseReceiptImage(base64Image, categories = [], accounts = [], apiKey = '') {
  if (!apiKey) {
    throw new Error('Please enter your free Gemini API key in settings to scan receipt images.');
  }

  try {
    const mimeType = base64Image.split(';')[0].split(':')[1] || 'image/jpeg';
    const base64Data = base64Image.split(',')[1];
    const categoryNames = categories.map(c => c.name).join(', ');

    const prompt = `Analyze this receipt image and extract transaction information.
Return ONLY a raw JSON object with NO markdown block.
JSON format:
{
  "amount": number (total amount paid),
  "merchant": string (store/merchant name),
  "date": string (YYYY-MM-DD or today's date if missing),
  "category": string (best match from: [${categoryNames}] or "Shopping/Dining"),
  "description": string (short summary)
}`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
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
  } catch (err) {
    console.error('Receipt parsing error:', err);
    throw err;
  }
}

/**
 * Conversational AI Assistant (Gemini with Groq Fallback)
 */
export async function askAiAssistant(question, contextData, apiKey = '', groqApiKey = '') {
  const prompt = `You are a friendly personal finance assistant in an expense tracker app.
Context summary of user's financial state:
- Total Net Worth: ${contextData.netWorth}
- Total Monthly Income: ${contextData.totalIncome}
- Total Monthly Expenses: ${contextData.totalExpenses}
- Account Balances: ${JSON.stringify(contextData.accounts)}
- Recent 10 Transactions: ${JSON.stringify(contextData.recentTransactions)}
- Category Budgets: ${JSON.stringify(contextData.budgets)}

User question: "${question}"
Provide a helpful, encouraging, and concise response in 2-4 sentences. Use bullet points or numbers if listing items.`;

  // 1. Try Gemini
  if (apiKey && apiKey.trim()) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });

      if (response.ok) {
        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response.";
      }
    } catch (err) {
      console.warn('Gemini Assistant error, trying Groq fallback...', err);
    }
  }

  // 2. Try Groq
  if (groqApiKey && groqApiKey.trim()) {
    try {
      const groqResult = await callGroqApi(prompt, groqApiKey);
      if (groqResult) return groqResult;
    } catch (err) {
      console.warn('Groq Assistant error:', err);
    }
  }

  return "Please set your free Gemini API Key or Groq API Key in settings to chat with your AI assistant!";
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
      model: 'llama-3.3-70b-versatile',
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

  return {
    amount: parseFloat(parsed.amount) || 0,
    type: parsed.type?.toLowerCase() === 'income' ? 'income' : 'expense',
    description: parsed.description || 'Quick Transaction',
    categoryId: matchedCategory ? matchedCategory.id : 'cat-1',
    accountId: matchedAccount ? matchedAccount.id : 'acc-1',
    date: parsed.date || new Date().toISOString().split('T')[0]
  };
}

/**
 * Intelligent local regex fallback parser when API key is offline
 */
function fallbackLocalParser(input, categories, accounts) {
  const text = input.toLowerCase();
  
  const amountMatch = text.match(/(?:[\$₹€£]\s*)?(\d+(?:\.\d{1,2})?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

  const isIncome = text.includes('salary') || text.includes('income') || text.includes('received') || text.includes('earned') || text.includes('got paid');
  const type = isIncome ? 'income' : 'expense';

  let categoryId = categories[0]?.id || 'cat-1';
  for (const cat of categories) {
    if (text.includes(cat.name.toLowerCase())) {
      categoryId = cat.id;
      break;
    }
  }
  if (categoryId === categories[0]?.id) {
    if (text.includes('food') || text.includes('dinner') || text.includes('lunch') || text.includes('coffee') || text.includes('pizza') || text.includes('restaurant')) categoryId = 'cat-1';
    else if (text.includes('grocer') || text.includes('walmart') || text.includes('supermarket')) categoryId = 'cat-2';
    else if (text.includes('uber') || text.includes('gas') || text.includes('fuel') || text.includes('flight') || text.includes('cab')) categoryId = 'cat-3';
    else if (text.includes('bill') || text.includes('electricity') || text.includes('water') || text.includes('wifi')) categoryId = 'cat-4';
    else if (text.includes('movie') || text.includes('netflix') || text.includes('game')) categoryId = 'cat-5';
  }

  let accountId = accounts[0]?.id || 'acc-1';
  for (const acc of accounts) {
    if (text.includes(acc.name.toLowerCase())) {
      accountId = acc.id;
      break;
    }
  }

  let description = input
    .replace(/(?:spent|paid|received|earned|for|via|with|on|at|using)\s*/gi, ' ')
    .replace(/(?:[\$₹€£]\s*)?\d+(?:\.\d{1,2})?/g, '')
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
