/**
 * Smart Account Matcher with Keyword & Substring Scoring
 */
export function matchAccount(hint, userText, accounts = [], defaultType = 'transaction') {
  if (!accounts || accounts.length === 0) return { id: 'acc-1', name: 'Default' };
  
  const cleanHint = (hint || '').toLowerCase().trim();
  const cleanText = (userText || '').toLowerCase().trim();

  // 1. Check if userText explicitly mentioned any specific account keyword
  for (const acc of accounts) {
    const accKeywords = (acc.name || '').toLowerCase().split(/\s+/).filter(w => w.length > 2 && !['bank', 'account', 'savings'].includes(w));
    for (const kw of accKeywords) {
      if (cleanText.includes(kw)) {
        return acc;
      }
    }
  }

  // 2. Direct hint match from AI response
  if (cleanHint) {
    const found = accounts.find(a => {
      const accName = (a.name || '').toLowerCase();
      return accName === cleanHint || accName.includes(cleanHint) || cleanHint.includes(accName);
    });
    if (found) return found;

    // Word token match (e.g. "slice" matches "Slice Savings")
    const hintWords = cleanHint.split(/\s+/).filter(w => w.length > 2);
    for (const hw of hintWords) {
      const wordMatch = accounts.find(a => (a.name || '').toLowerCase().includes(hw));
      if (wordMatch) return wordMatch;
    }
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
