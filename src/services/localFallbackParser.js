/**
 * Intelligent local regex fallback parser — handles single & multiple transactions offline
 */
export function fallbackLocalParser(input, categories = [], accounts = []) {
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const defaultAccountId = accounts[0]?.id || 'acc-1';
  const defaultCategoryId = categories[0]?.id || 'cat-1';

  const getCategoryId = (text) => {
    for (const cat of categories) {
      if (text.includes((cat.name || '').toLowerCase())) return cat.id;
    }
    if (/\b(?:food|dinner|lunch|breakfast|coffee|pizza|restaurant|pepsi|burger|coke|drink|snack|eat|ate|protta|dosa|idli|biriyani|chai|tea)\b/i.test(text)) {
      return categories.find(c => /food|dining|restaurant/i.test(c.name))?.id || defaultCategoryId;
    }
    if (/\b(?:grocer|supermarket|vegetable|fruit|milk)\b/i.test(text)) {
      return categories.find(c => /grocer|market/i.test(c.name))?.id || defaultCategoryId;
    }
    if (/\b(?:uber|gas|fuel|cab|ride|auto|taxi|train|bus|petrol)\b/i.test(text)) {
      return categories.find(c => /transport|travel/i.test(c.name))?.id || defaultCategoryId;
    }
    if (/\b(?:bill|electricity|water|wifi|recharge|internet|power)\b/i.test(text)) {
      return categories.find(c => /bill|util/i.test(c.name))?.id || defaultCategoryId;
    }
    if (/\b(?:movie|netflix|game|cinema|show)\b/i.test(text)) {
      return categories.find(c => /entertain/i.test(c.name))?.id || defaultCategoryId;
    }
    return defaultCategoryId;
  };

  const getAccountId = (text) => {
    for (const acc of accounts) {
      if (text.includes((acc.name || '').toLowerCase())) return acc.id;
    }
    if (/\b(?:card|credit|debit|upi|gpay|phonepay|paytm)\b/i.test(text)) {
      return accounts.find(a => /card|credit|debit/i.test(a.name))?.id || defaultAccountId;
    }
    return defaultAccountId;
  };

  const isIncomeSentence = (text) => /\b(?:salary|income|received|earned|got paid)\b/i.test(text);

  // Check if input is lending or borrowing (e.g. "lent 500 to rahul", "borrowed 1000 from amit")
  const debtMatch = input.match(/\b(?:lent|lend|gave|loaned)\b\s*(?:(?:rs\.?|inr|[\$₹€£])\s*)?(\d+(?:\.\d{1,2})?)\s*(?:to\b)?\s*([a-z0-9\s]+?)(?:\s+(?:from|via|using)\s+([a-z0-9\s]+))?$/i);
  if (debtMatch) {
    const amt = parseFloat(debtMatch[1]) || 0;
    const person = debtMatch[2].trim();
    const accStr = (debtMatch[3] || '').trim().toLowerCase();
    const acc = accounts.find(a => (a.name || '').toLowerCase().includes(accStr)) || accounts[0] || { id: defaultAccountId };
    return [{
      operation: 'debt_add',
      amount: amt,
      direction: 'lent',
      personName: person.charAt(0).toUpperCase() + person.slice(1),
      reason: `Lent to ${person}`,
      accountId: acc.id,
      date: today,
      notes: ''
    }];
  }

  const borrowMatch = input.match(/\b(?:borrowed|borrow|took loan of)\b\s*(?:(?:rs\.?|inr|[\$₹€£])\s*)?(\d+(?:\.\d{1,2})?)\s*(?:from\b)?\s*([a-z0-9\s]+?)(?:\s+(?:to|into)\s+([a-z0-9\s]+))?$/i);
  if (borrowMatch) {
    const amt = parseFloat(borrowMatch[1]) || 0;
    const person = borrowMatch[2].trim();
    const accStr = (borrowMatch[3] || '').trim().toLowerCase();
    const acc = accounts.find(a => (a.name || '').toLowerCase().includes(accStr)) || accounts[0] || { id: defaultAccountId };
    return [{
      operation: 'debt_add',
      amount: amt,
      direction: 'borrowed',
      personName: person.charAt(0).toUpperCase() + person.slice(1),
      reason: `Borrowed from ${person}`,
      accountId: acc.id,
      date: today,
      notes: ''
    }];
  }

  // Check if input is a transfer operation (e.g. transfer 100 from kotak to slice cc)
  const tfrMatch = input.match(/\b(?:transfer|transferred|sent|send|move|moved)\b.*?(\d+(?:\.\d{1,2})?).*?\bfrom\b\s+([a-z0-9\s]+?)\s+\bto\b\s+([a-z0-9\s]+)/i);
  if (tfrMatch) {
    const amt = parseFloat(tfrMatch[1]) || 0;
    const fromStr = tfrMatch[2].trim().toLowerCase();
    const toStr = tfrMatch[3].trim().toLowerCase();
    const fromAcc = accounts.find(a => (a.name || '').toLowerCase().includes(fromStr)) || accounts[0] || { id: defaultAccountId };
    const toAcc = accounts.find(a => (a.name || '').toLowerCase().includes(toStr));
    
    if (toAcc) {
      return [{
        operation: 'transfer',
        amount: amt,
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        date: today,
        notes: ''
      }];
    } else {
      // Transfer to an external person -> treat as debt/external transfer
      return [{
        operation: 'debt_add',
        amount: amt,
        direction: 'lent',
        personName: tfrMatch[3].trim().charAt(0).toUpperCase() + tfrMatch[3].trim().slice(1),
        reason: `Transfer to ${tfrMatch[3].trim()}`,
        accountId: fromAcc.id,
        date: today,
        notes: ''
      }];
    }
  }

  // Split input into chunks at conjunctions that likely separate two expenses
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
