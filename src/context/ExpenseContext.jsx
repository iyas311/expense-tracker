import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ExpenseContext = createContext();

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Food & Dining', type: 'expense', budgetCap: 0, isAutoBudget: false, color: '#f43f5e', icon: 'Utensils' },
  { id: 'cat-2', name: 'Groceries', type: 'expense', budgetCap: 0, isAutoBudget: false, color: '#10b981', icon: 'ShoppingCart' },
  { id: 'cat-3', name: 'Transport & Fuel', type: 'expense', budgetCap: 0, isAutoBudget: false, color: '#06b6d4', icon: 'Car' },
  { id: 'cat-4', name: 'Bills & Utilities', type: 'expense', budgetCap: 0, isAutoBudget: false, color: '#f59e0b', icon: 'Zap' },
  { id: 'cat-5', name: 'Entertainment', type: 'expense', budgetCap: 0, isAutoBudget: false, color: '#8b5cf6', icon: 'Film' },
  { id: 'cat-6', name: 'Shopping', type: 'expense', budgetCap: 0, isAutoBudget: false, color: '#ec4899', icon: 'ShoppingBag' },
  { id: 'cat-7', name: 'Salary & Income', type: 'income', budgetCap: 0, isAutoBudget: false, color: '#10b981', icon: 'DollarSign' }
];

const DEFAULT_ACCOUNTS = [
  { id: 'acc-1', name: 'Main Bank Account', type: 'bank', balance: 0, initialBalance: 0, creditLimit: 0, color: '#6366f1', icon: 'Landmark' },
  { id: 'acc-2', name: 'Rewards Credit Card', type: 'card', balance: 0, initialBalance: 0, creditLimit: 50000, color: '#f43f5e', icon: 'CreditCard' },
  { id: 'acc-3', name: 'Cash Wallet', type: 'cash', balance: 0, initialBalance: 0, creditLimit: 0, color: '#10b981', icon: 'Wallet' },
  { id: 'acc-4', name: 'Emergency Savings', type: 'savings', balance: 0, initialBalance: 0, creditLimit: 0, color: '#06b6d4', icon: 'PiggyBank' }
];

export function ExpenseProvider({ children }) {
  // Auth
  const [passcode, setPasscode] = useState(() => localStorage.getItem('et_passcode') || '3311');
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('et_is_logged_in') === 'true');

  // API Keys
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('et_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
  const [groqApiKey, setGroqApiKey] = useState(() => localStorage.getItem('et_groq_api_key') || import.meta.env.VITE_GROQ_API_KEY || '');

  // Currency
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('et_currency') || '₹');

  // Time filter
  const [timeRange, setTimeRange] = useState('this_month');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // App Data
  const [transactions, setTransactions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('et_transactions') || '[]'); } catch { return []; }
  });
  const [categories, setCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem('et_categories') || 'null') || DEFAULT_CATEGORIES; } catch { return DEFAULT_CATEGORIES; }
  });
  const [accounts, setAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('et_accounts') || 'null') || DEFAULT_ACCOUNTS; } catch { return DEFAULT_ACCOUNTS; }
  });
  const [subscriptions, setSubscriptions] = useState(() => {
    try { return JSON.parse(localStorage.getItem('et_subscriptions') || '[]'); } catch { return []; }
  });

  // ─── Cloud Sync ─────────────────────────────────────────────────────────────
  const refreshCloudData = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/data?t=${Date.now()}`, {
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      if (res.ok) {
        const cloudData = await res.json();
        if (!cloudData.offline) {
          setIsOffline(false);
          if (cloudData.categories?.length > 0) setCategories(cloudData.categories);
          if (cloudData.accounts?.length > 0) setAccounts(cloudData.accounts);
          if (Array.isArray(cloudData.transactions)) setTransactions(cloudData.transactions);
          if (Array.isArray(cloudData.subscriptions)) setSubscriptions(cloudData.subscriptions);
          if (cloudData.settings?.passcode) {
            setPasscode(cloudData.settings.passcode);
            localStorage.setItem('et_passcode', cloudData.settings.passcode);
          }
          if (cloudData.settings?.currency) {
            setCurrencyState(cloudData.settings.currency);
            localStorage.setItem('et_currency', cloudData.settings.currency);
          }
          // Process recurring subscriptions if any are due
          if (cloudData.subscriptions?.length > 0) {
            fetch('/api/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'processRecurring', payload: {} })
            }).catch(() => {});
          }
        } else {
          setIsOffline(true);
        }
      } else {
        setIsOffline(true);
      }
    } catch (err) {
      setIsOffline(true);
      console.log('Running in local mode.');
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => { refreshCloudData(); }, [refreshCloudData]);

  // ─── LocalStorage Sync ───────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('et_passcode', passcode); }, [passcode]);
  useEffect(() => { localStorage.setItem('et_is_logged_in', isLoggedIn); }, [isLoggedIn]);
  useEffect(() => { localStorage.setItem('et_gemini_api_key', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('et_groq_api_key', groqApiKey); }, [groqApiKey]);
  useEffect(() => { localStorage.setItem('et_currency', currency); }, [currency]);
  useEffect(() => { localStorage.setItem('et_transactions', JSON.stringify(transactions)); }, [transactions]);
  useEffect(() => { localStorage.setItem('et_categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('et_accounts', JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem('et_subscriptions', JSON.stringify(subscriptions)); }, [subscriptions]);

  // ─── Auth ────────────────────────────────────────────────────────────────────
  const login = (inputPass) => {
    if (inputPass === passcode) {
      setIsLoggedIn(true);
      localStorage.setItem('et_is_logged_in', 'true');
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('et_is_logged_in');
  };

  const updatePasscode = async (newPass) => {
    setPasscode(newPass);
    localStorage.setItem('et_passcode', newPass);
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updatePasscode', payload: { passcode: newPass } })
      });
    } catch (e) {}
  };

  // ─── Currency ────────────────────────────────────────────────────────────────
  const setCurrency = async (sym) => {
    setCurrencyState(sym);
    localStorage.setItem('et_currency', sym);
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateSetting', payload: { key: 'currency', value: sym } })
      });
    } catch (e) {}
  };

  // ─── Transactions ────────────────────────────────────────────────────────────
  const addTransaction = async (newTx) => {
    const formatted = {
      id: `tx-${Date.now()}`,
      date: newTx.date || new Date().toISOString().split('T')[0],
      description: newTx.description || 'Transaction',
      amount: parseFloat(newTx.amount) || 0,
      type: newTx.type || 'expense',
      categoryId: newTx.categoryId || categories[0]?.id || 'cat-1',
      accountId: newTx.accountId || accounts[0]?.id || 'acc-1',
      notes: newTx.notes || ''
    };
    setTransactions(prev => [formatted, ...prev]);
    // Optimistic balance update
    setAccounts(prev => prev.map(acc => {
      if (acc.id === formatted.accountId) {
        const delta = formatted.type === 'income' ? formatted.amount : -formatted.amount;
        return { ...acc, balance: Math.round((acc.balance + delta) * 100) / 100 };
      }
      return acc;
    }));
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addTransaction', payload: formatted })
      });
      refreshCloudData();
    } catch (e) {}
  };

  const editTransaction = async (id, updatedData) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateTransaction', payload: { id, ...updatedData } })
      });
      refreshCloudData();
    } catch (e) {}
  };

  const deleteTransaction = async (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id && t.transferId !== id));
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deleteTransaction', payload: { id } })
      });
      refreshCloudData();
    } catch (e) {}
  };

  // ─── Transfer ────────────────────────────────────────────────────────────────
  const addTransfer = async ({ fromAccountId, toAccountId, amount, date, notes }) => {
    const parsedAmount = parseFloat(amount) || 0;
    const transferDate = date || new Date().toISOString().split('T')[0];
    const transferId = `tfr-${Date.now()}`;
    // Optimistic UI updates
    setTransactions(prev => [
      { id: `tx-out-${Date.now()}`, date: transferDate, description: 'Transfer Out', amount: parsedAmount, type: 'transfer', categoryId: null, accountId: fromAccountId, notes: notes || '', transferId },
      { id: `tx-in-${Date.now() + 1}`, date: transferDate, description: 'Transfer In', amount: parsedAmount, type: 'income', categoryId: null, accountId: toAccountId, notes: notes || '', transferId },
      ...prev
    ]);
    setAccounts(prev => prev.map(acc => {
      if (acc.id === fromAccountId) return { ...acc, balance: Math.round((acc.balance - parsedAmount) * 100) / 100 };
      if (acc.id === toAccountId) return { ...acc, balance: Math.round((acc.balance + parsedAmount) * 100) / 100 };
      return acc;
    }));
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addTransfer', payload: { fromAccountId, toAccountId, amount: parsedAmount, date: transferDate, notes } })
      });
      refreshCloudData();
    } catch (e) {}
  };

  // ─── Categories ──────────────────────────────────────────────────────────────
  const addCategory = async (categoryData) => {
    const newCat = {
      id: `cat-${Date.now()}`,
      name: categoryData.name,
      type: categoryData.type || 'expense',
      budgetCap: parseFloat(categoryData.budgetCap) || 0,
      isAutoBudget: categoryData.isAutoBudget || false,
      color: categoryData.color || '#8b5cf6',
      icon: categoryData.icon || 'Tag'
    };
    setCategories(prev => [...prev, newCat]);
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addCategory', payload: newCat })
      });
      refreshCloudData();
    } catch (e) {}
  };

  const updateCategoryBudget = async (catId, budgetCap, isAutoBudget = false) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, budgetCap: parseFloat(budgetCap) || 0, isAutoBudget } : c));
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateBudget', payload: { id: catId, budgetCap, isAutoBudget } })
      });
    } catch (e) {}
  };

  // ─── Accounts ────────────────────────────────────────────────────────────────
  const addAccount = async (accData) => {
    const newAcc = {
      id: `acc-${Date.now()}`,
      name: accData.name,
      type: accData.type || 'bank',
      balance: parseFloat(accData.balance) || 0,
      initialBalance: parseFloat(accData.balance) || 0,
      creditLimit: parseFloat(accData.creditLimit) || 0,
      color: accData.color || '#06b6d4',
      icon: accData.icon || 'Landmark'
    };
    setAccounts(prev => [...prev, newAcc]);
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addAccount', payload: newAcc })
      });
      refreshCloudData();
    } catch (e) {}
  };

  // ─── Subscriptions ───────────────────────────────────────────────────────────
  const addSubscription = async (subData) => {
    const newSub = {
      id: `sub-${Date.now()}`,
      name: subData.name,
      amount: parseFloat(subData.amount) || 0,
      categoryId: subData.categoryId || categories[0]?.id,
      accountId: subData.accountId || accounts[0]?.id,
      billingCycle: subData.billingCycle || 'monthly',
      nextDueDate: subData.nextDueDate || new Date().toISOString().split('T')[0]
    };
    setSubscriptions(prev => [...prev, newSub]);
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addSubscription', payload: newSub })
      });
    } catch (e) {}
  };

  // ─── Clear All ───────────────────────────────────────────────────────────────
  const clearAllData = async () => {
    setTransactions([]);
    setAccounts(prev => prev.map(a => ({ ...a, balance: 0, initialBalance: 0 })));
    localStorage.removeItem('et_transactions');
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearAllData' })
      });
      refreshCloudData();
    } catch (e) {}
  };

  // ─── Export CSV ──────────────────────────────────────────────────────────────
  const exportData = () => {
    const headers = ['Date', 'Type', 'Description', 'Amount', 'Category', 'Account', 'Notes'];
    const rows = transactions.map(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'General';
      const acc = accounts.find(a => a.id === t.accountId)?.name || 'Account';
      return [t.date, t.type, `"${(t.description||'').replace(/"/g,'""')}"`, t.amount, `"${cat}"`, `"${acc}"`, `"${(t.notes||'').replace(/"/g,'""')}"`].join(',');
    });
    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expensia_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ─── Filtered Transactions ───────────────────────────────────────────────────
  const getFilteredTransactions = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    return transactions.filter(t => {
      if (timeRange === 'today') return t.date === todayStr;
      if (timeRange === 'this_week') {
        const diffDays = Math.floor((now - new Date(t.date)) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }
      if (timeRange === 'this_month') return t.date.startsWith(now.toISOString().slice(0, 7));
      if (timeRange === 'custom_month') return t.date.startsWith(selectedMonth);
      return true;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  // ─── Derived Metrics ─────────────────────────────────────────────────────────
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netWorth = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <ExpenseContext.Provider value={{
      passcode, isLoggedIn, apiKey, groqApiKey, currency,
      timeRange, setTimeRange, selectedMonth, setSelectedMonth,
      isSyncing, isOffline, refreshCloudData,
      transactions, filteredTransactions,
      categories, accounts, subscriptions,
      totalIncome, totalExpenses, netWorth,
      login, logout, updatePasscode,
      setApiKey, setGroqApiKey, setCurrency,
      addTransaction, editTransaction, deleteTransaction,
      addTransfer,
      addCategory, updateCategoryBudget,
      addAccount,
      addSubscription,
      exportData, clearAllData
    }}>
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpense() {
  return useContext(ExpenseContext);
}
