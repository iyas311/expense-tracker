const STOP_WORDS = new Set(['bank', 'account', 'savings', 'credit', 'card', 'cc', 'wallet', 'main', 'default', 'pay', 'money', 'the', 'from', 'to', 'for', 'with', 'and']);

/**
 * Smart Account Matcher with Distinctive Keyword & Token Scoring
 */
export function matchAccount(hint, userText, accounts = [], defaultType = 'transaction') {
  if (!accounts || accounts.length === 0) return { id: 'acc-1', name: 'Default' };
  
  const cleanHint = (hint || '').toLowerCase().trim();
  const cleanText = (userText || '').toLowerCase().trim();

  // Helper to extract distinctive tokens (excluding generic terms like 'card', 'credit', 'bank')
  const getDistinctiveTokens = (str) => {
    return str.split(/[^a-z0-9]+/).filter(w => w.length >= 2 && !STOP_WORDS.has(w));
  };

  // 1. Direct exact or full substring match on cleanHint (highest priority)
  if (cleanHint) {
    const exact = accounts.find(a => (a.name || '').toLowerCase() === cleanHint);
    if (exact) return exact;

    const sub = accounts.find(a => {
      const aName = (a.name || '').toLowerCase();
      return aName.includes(cleanHint) || cleanHint.includes(aName);
    });
    if (sub) return sub;

    // Distinctive token scoring from cleanHint (e.g. "slice" or "axis" or "kotak")
    const hintTokens = getDistinctiveTokens(cleanHint);
    if (hintTokens.length > 0) {
      let bestAcc = null;
      let maxMatches = 0;
      for (const acc of accounts) {
        const accTokens = getDistinctiveTokens((acc.name || '').toLowerCase());
        const matches = hintTokens.filter(t => accTokens.includes(t)).length;
        if (matches > maxMatches) {
          maxMatches = matches;
          bestAcc = acc;
        }
      }
      if (bestAcc) return bestAcc;
    }
  }

  // 2. Distinctive token match from userText (only distinctive brand tokens!)
  const textTokens = getDistinctiveTokens(cleanText);
  if (textTokens.length > 0) {
    let bestAcc = null;
    let maxMatches = 0;
    for (const acc of accounts) {
      const accTokens = getDistinctiveTokens((acc.name || '').toLowerCase());
      const matches = textTokens.filter(t => accTokens.includes(t)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestAcc = acc;
      }
    }
    if (bestAcc) return bestAcc;
  }

  // 3. Fallback defaults
  if (defaultType === 'debt') {
    const sliceAcc = accounts.find(a => (a.name || '').toLowerCase().includes('slice'));
    if (sliceAcc) return sliceAcc;
  }
  const kotakAcc = accounts.find(a => (a.name || '').toLowerCase().includes('kotak'));
  if (kotakAcc) return kotakAcc;

  return accounts[0];
}

/**
 * Smart Category Matcher
 */
export function matchCategory(hint, descText, categories = [], type = 'expense') {
  if (!categories || categories.length === 0) return { id: 'cat-1', name: 'General' };
  const cleanHint = (hint || '').toLowerCase().trim();
  const cleanDesc = (descText || '').toLowerCase().trim();

  if (cleanHint) {
    const found = categories.find(c => {
      const cName = (c.name || '').toLowerCase();
      return cName === cleanHint || cName.includes(cleanHint) || cleanHint.includes(cName);
    });
    if (found) return found;
  }

  const foundDesc = categories.find(c => cleanDesc.includes((c.name || '').toLowerCase()));
  if (foundDesc) return foundDesc;

  return categories.find(c => c.type === type) || categories[0];
}

/**
 * Formats parsed output to match category and account IDs
 */
export function formatParsedTransaction(parsed, categories, accounts) {
  let matchedCategory = categories.find(c => (c.name || '').toLowerCase() === (parsed.category || '').toLowerCase());
  if (!matchedCategory) matchedCategory = categories[0];

  let matchedAccount = accounts.find(a => (a.name || '').toLowerCase().includes((parsed.account || '').toLowerCase()));
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
