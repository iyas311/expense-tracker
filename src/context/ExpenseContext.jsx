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
  // Vault & Auth State
  const [currentVault, setCurrentVault] = useState(() => {
    try {
      const saved = localStorage.getItem('et_vault_info');
      return saved ? JSON.parse(saved) : { id: 'vault_admin', name: 'Admin Vault', isAdmin: true };
    } catch {
      return { id: 'vault_admin', name: 'Admin Vault', isAdmin: true };
    }
  });

  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('et_token'));

  // API Keys
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('et_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
  const [groqApiKey, setGroqApiKey] = useState(() => localStorage.getItem('et_groq_api_key') || import.meta.env.VITE_GROQ_API_KEY || '');

  // Currency
  const [currency, setCurrencyState] = useState(() => localStorage.getItem('et_currency') || '₹');

  // Time filter
  const [timeRange, setTimeRange] = useState('this_month');
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // App Data (Scoped to current vault)
  const [transactions, setTransactions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`et_tx_${currentVault?.id}`) || '[]'); } catch { return []; }
  });
  const [categories, setCategories] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`et_cat_${currentVault?.id}`) || 'null') || DEFAULT_CATEGORIES; } catch { return DEFAULT_CATEGORIES; }
  });
  const [accounts, setAccounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`et_acc_${currentVault?.id}`) || 'null') || DEFAULT_ACCOUNTS; } catch { return DEFAULT_ACCOUNTS; }
  });
  const [subscriptions, setSubscriptions] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`et_sub_${currentVault?.id}`) || '[]'); } catch { return []; }
  });
  const [debts, setDebts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`et_debts_${currentVault?.id}`) || '[]'); } catch { return []; }
  });

  // ─── Cloud Sync ─────────────────────────────────────────────────────────────
  const refreshCloudData = useCallback(async () => {
    const token = localStorage.getItem('et_token');
    if (!token) return;

    setIsSyncing(true);
    try {
      const res = await fetch(`/api/data?token=${token}&t=${Date.now()}`, {
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
          if (Array.isArray(cloudData.debts)) setDebts(cloudData.debts);
          if (cloudData.settings?.currency) {
            setCurrencyState(cloudData.settings.currency);
            localStorage.setItem('et_currency', cloudData.settings.currency);
          }
          // Process recurring
          if (cloudData.subscriptions?.length > 0) {
            fetch('/api/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'processRecurring', payload: { token } })
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

  useEffect(() => {
    if (isLoggedIn) {
      refreshCloudData();
    }
  }, [isLoggedIn, refreshCloudData]);

  // ─── Local Storage Sync ─────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem('et_is_logged_in', isLoggedIn); }, [isLoggedIn]);
  useEffect(() => { localStorage.setItem('et_vault_info', JSON.stringify(currentVault)); }, [currentVault]);
  useEffect(() => { localStorage.setItem('et_gemini_api_key', apiKey); }, [apiKey]);
  useEffect(() => { localStorage.setItem('et_groq_api_key', groqApiKey); }, [groqApiKey]);
  useEffect(() => { localStorage.setItem('et_currency', currency); }, [currency]);

  useEffect(() => {
    if (currentVault?.id) {
      localStorage.setItem(`et_tx_${currentVault.id}`, JSON.stringify(transactions));
      localStorage.setItem(`et_cat_${currentVault.id}`, JSON.stringify(categories));
      localStorage.setItem(`et_acc_${currentVault.id}`, JSON.stringify(accounts));
      localStorage.setItem(`et_sub_${currentVault.id}`, JSON.stringify(subscriptions));
      localStorage.setItem(`et_debts_${currentVault.id}`, JSON.stringify(debts));
    }
  }, [transactions, categories, accounts, subscriptions, debts, currentVault?.id]);

  // ─── Auth / Vault Login ──────────────────────────────────────────────────────
  const login = async (username, password) => {
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', payload: { username, password } })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.token) {
          localStorage.setItem('et_token', data.token);
          setCurrentVault({ id: data.user.vaultId, name: data.user.username + ' Vault', isAdmin: data.user.role === 'admin' });
          setIsLoggedIn(true);
          
          if (data.categories?.length > 0) setCategories(data.categories);
          if (data.accounts?.length > 0) setAccounts(data.accounts);
          if (Array.isArray(data.transactions)) setTransactions(data.transactions);
          if (Array.isArray(data.subscriptions)) setSubscriptions(data.subscriptions);
          
          localStorage.setItem('et_vault_info', JSON.stringify({ id: data.user.vaultId, name: data.user.username + ' Vault', isAdmin: data.user.role === 'admin' }));
          
          return { success: true };
        }
      }
      return { success: false, error: 'Incorrect Username or Password' };
    } catch (e) {
      return { success: false, error: 'Network error. Offline login not available for users.' };
    }
  };

  const authFetch = async (action, payload = {}) => {
    const token = localStorage.getItem('et_token');
    return fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload: { ...payload, token } })
    });
  };

  const logout = async () => {
    try { await authFetch('logout'); } catch (e) {}
    setIsLoggedIn(false);
    localStorage.removeItem('et_token');
    localStorage.removeItem('et_vault_info');
  };

  // ─── Admin User Management ──────────────────────────────────────────────────
  const getUsers = async () => {
    try {
      const res = await authFetch('getUsers');
      if (res.ok) {
        const data = await res.json();
        return data.users || [];
      }
      return [];
    } catch (e) {
      return [];
    }
  };

  const createUser = async (newUsername, newPassword, role = 'user') => {
    try {
      const res = await authFetch('createUser', { newUsername, newPassword, role });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create user');
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  };

  // ─── Currency ────────────────────────────────────────────────────────────────
  const setCurrency = async (sym) => {
    setCurrencyState(sym);
    localStorage.setItem('et_currency', sym);
    try {
      await authFetch('updateSetting', { key: 'currency', value: sym });
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
      notes: newTx.notes || '',
      vaultId: currentVault?.id || 'vault_admin'
    };
    setTransactions(prev => [formatted, ...prev]);
    setAccounts(prev => prev.map(acc => {
      if (acc.id === formatted.accountId) {
        const delta = formatted.type === 'income' ? formatted.amount : -formatted.amount;
        return { ...acc, balance: Math.round((acc.balance + delta) * 100) / 100 };
      }
      return acc;
    }));
    try {
      await authFetch('addTransaction', formatted);
      refreshCloudData();
    } catch (e) {}
  };

  // Adds multiple transactions atomically in a single state update (avoids React batching bug)
  const addTransactions = async (txList) => {
    if (!txList || txList.length === 0) return;
    const now = Date.now();
    const formatted = txList.map((newTx, i) => ({
      id: `tx-${now + i}`,
      date: newTx.date || new Date().toISOString().split('T')[0],
      description: newTx.description || 'Transaction',
      amount: parseFloat(newTx.amount) || 0,
      type: newTx.type || 'expense',
      categoryId: newTx.categoryId || categories[0]?.id || 'cat-1',
      accountId: newTx.accountId || accounts[0]?.id || 'acc-1',
      notes: newTx.notes || '',
    }));

    // Single state update for all transactions
    setTransactions(prev => [...formatted, ...prev]);

    // Single state update for all account balance changes
    setAccounts(prev => {
      const updated = [...prev];
      for (const tx of formatted) {
        const idx = updated.findIndex(a => a.id === tx.accountId);
        if (idx !== -1) {
          const delta = tx.type === 'income' ? tx.amount : -tx.amount;
          updated[idx] = { ...updated[idx], balance: Math.round((updated[idx].balance + delta) * 100) / 100 };
        }
      }
      return updated;
    });

    // Save each to DB
    try {
      await Promise.all(formatted.map(tx => authFetch('addTransaction', tx)));
      refreshCloudData();
    } catch (e) {}
  };

  const editTransaction = async (id, updatedData) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatedData } : t));
    try {
      await authFetch('updateTransaction', { id, ...updatedData });
      refreshCloudData();
    } catch (e) {}
  };

  const deleteTransaction = async (id) => {
    setTransactions(prev => prev.filter(t => t.id !== id && t.transferId !== id));
    try {
      await authFetch('deleteTransaction', { id });
      refreshCloudData();
    } catch (e) {}
  };

  // ─── Transfer ────────────────────────────────────────────────────────────────
  const addTransfer = async ({ fromAccountId, toAccountId, amount, date, notes }) => {
    const parsedAmount = parseFloat(amount) || 0;
    const transferDate = date || new Date().toISOString().split('T')[0];
    const transferId = `tfr-${Date.now()}`;
    const vId = currentVault?.id || 'vault_admin';
    setTransactions(prev => [
      { id: `tx-out-${Date.now()}`, date: transferDate, description: 'Transfer Out', amount: parsedAmount, type: 'transfer', categoryId: null, accountId: fromAccountId, notes: notes || '', transferId, vaultId: vId },
      { id: `tx-in-${Date.now() + 1}`, date: transferDate, description: 'Transfer In', amount: parsedAmount, type: 'income', categoryId: null, accountId: toAccountId, notes: notes || '', transferId, vaultId: vId },
      ...prev
    ]);
    setAccounts(prev => prev.map(acc => {
      if (acc.id === fromAccountId) return { ...acc, balance: Math.round((acc.balance - parsedAmount) * 100) / 100 };
      if (acc.id === toAccountId) return { ...acc, balance: Math.round((acc.balance + parsedAmount) * 100) / 100 };
      return acc;
    }));
    try {
      await authFetch('addTransfer', { fromAccountId, toAccountId, amount: parsedAmount, date: transferDate, notes });
      refreshCloudData();
    } catch (e) {}
  };

  // ─── Categories ──────────────────────────────────────────────────────────────
  const addCategory = async (categoryData) => {
    const vId = currentVault?.id || 'vault_admin';
    const newCat = {
      id: `cat-${Date.now()}`,
      name: categoryData.name,
      type: categoryData.type || 'expense',
      budgetCap: parseFloat(categoryData.budgetCap) || 0,
      isAutoBudget: categoryData.isAutoBudget || false,
      color: categoryData.color || '#8b5cf6',
      icon: categoryData.icon || 'Tag',
      vaultId: vId
    };
    setCategories(prev => [...prev, newCat]);
    try {
      await authFetch('addCategory', newCat);
      refreshCloudData();
    } catch (e) {}
  };

  const updateCategoryBudget = async (catId, budgetCap, isAutoBudget = false) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, budgetCap: parseFloat(budgetCap) || 0, isAutoBudget } : c));
    try {
      await authFetch('updateBudget', { id: catId, budgetCap, isAutoBudget });
      refreshCloudData();
    } catch (e) {}
  };

  // ─── Accounts ────────────────────────────────────────────────────────────────
  const addAccount = async (accData) => {
    const vId = currentVault?.id || 'vault_admin';
    const newAcc = {
      id: `acc-${Date.now()}`,
      name: accData.name,
      type: accData.type || 'bank',
      balance: parseFloat(accData.balance) || 0,
      initialBalance: parseFloat(accData.balance) || 0,
      creditLimit: parseFloat(accData.creditLimit) || 0,
      color: accData.color || '#06b6d4',
      icon: accData.icon || 'Landmark',
      vaultId: vId
    };
    setAccounts(prev => [...prev, newAcc]);
    try {
      await authFetch('addAccount', newAcc);
      refreshCloudData();
    } catch (e) {}
  };

  const editAccount = async (id, updatedData) => {
    setAccounts(prev => prev.map(a => a.id === id ? { ...a, ...updatedData } : a));
    try {
      await authFetch('updateAccount', { id, ...updatedData });
      refreshCloudData();
    } catch (e) {}
  };

  const deleteAccount = async (id) => {
    setAccounts(prev => prev.filter(a => a.id !== id));
    try {
      await authFetch('deleteAccount', { id });
    } catch (e) {}
  };

  // ─── Debts / IOU ─────────────────────────────────────────────────────────────
  const addDebt = async (debtData) => {
    const vId = currentVault?.id || 'vault_admin';
    const newDebt = {
      id: `debt-${Date.now()}`,
      personName: debtData.personName,
      amount: parseFloat(debtData.amount) || 0,
      direction: debtData.direction || 'lent',
      reason: debtData.reason || '',
      dateCreated: debtData.dateCreated || new Date().toISOString().split('T')[0],
      dueDate: debtData.dueDate || null,
      status: 'pending',
      settledAmount: 0,
      notes: debtData.notes || '',
      vaultId: vId
    };
    setDebts(prev => [newDebt, ...prev]);
    try {
      await authFetch('addDebt', newDebt);
    } catch (e) {}
  };

  const settleDebt = async (id, settledAmount, status = 'settled') => {
    setDebts(prev => prev.map(d => d.id === id ? { ...d, settledAmount: parseFloat(settledAmount) || d.amount, status } : d));
    try {
      await authFetch('settleDebt', { id, settledAmount, status });
    } catch (e) {}
  };

  const deleteDebt = async (id) => {
    setDebts(prev => prev.filter(d => d.id !== id));
    try {
      await authFetch('deleteDebt', { id });
    } catch (e) {}
  };

  // ─── Subscriptions ───────────────────────────────────────────────────────────
  const addSubscription = async (subData) => {
    const vId = currentVault?.id || 'vault_admin';
    const newSub = {
      id: `sub-${Date.now()}`,
      name: subData.name,
      amount: parseFloat(subData.amount) || 0,
      categoryId: subData.categoryId || categories[0]?.id,
      accountId: subData.accountId || accounts[0]?.id,
      billingCycle: subData.billingCycle || 'monthly',
      nextDueDate: subData.nextDueDate || new Date().toISOString().split('T')[0],
      vaultId: vId
    };
    setSubscriptions(prev => [...prev, newSub]);
    try {
      await authFetch('addSubscription', newSub);
    } catch (e) {}
  };

  const updateSubscription = async (id, nextDueDate) => {
    setSubscriptions(prev => prev.map(s => s.id === id ? { ...s, nextDueDate } : s));
    try {
      await authFetch('updateSubscription', { id, nextDueDate });
    } catch (e) {}
  };

  const deleteSubscription = async (id) => {
    setSubscriptions(prev => prev.filter(s => s.id !== id));
    try {
      await authFetch('deleteSubscription', { id });
    } catch (e) {}
  };

  // ─── Clear All ───────────────────────────────────────────────────────────────
  const clearAllData = async () => {
    setTransactions([]);
    setAccounts(prev => prev.map(a => ({ ...a, balance: 0, initialBalance: 0 })));
    try {
      await authFetch('clearAllData');
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
    a.download = `expensia_${currentVault?.name || 'vault'}_${new Date().toISOString().split('T')[0]}.csv`;
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
      if (timeRange === 'custom_date') return t.date === selectedDate;
      return true;
    });
  };

  const filteredTransactions = getFilteredTransactions();

  // ─── Derived Metrics ─────────────────────────────────────────────────────────
  const totalIncome = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpenses = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const accountsNetWorth = accounts.reduce((s, a) => s + a.balance, 0);
  // Lent debts (people owe you) add to net worth; borrowed debts subtract
  const debtNetWorth = debts
    .filter(d => d.status !== 'settled')
    .reduce((s, d) => {
      const remaining = d.amount - (d.settledAmount || 0);
      return d.direction === 'lent' ? s + remaining : s - remaining;
    }, 0);
  const netWorth = accountsNetWorth + debtNetWorth;

  return (
    <ExpenseContext.Provider value={{
      currentVault, passcode, isLoggedIn, apiKey, groqApiKey, currency,
      timeRange, setTimeRange, selectedMonth, setSelectedMonth, selectedDate, setSelectedDate,
      isSyncing, isOffline, refreshCloudData,
      transactions, filteredTransactions,
      categories, accounts, subscriptions, debts,
      totalIncome, totalExpenses, netWorth,
      login, logout, updatePasscode,
      listVaults, createVault, deleteVault,
      setApiKey, setGroqApiKey, setCurrency,
      addTransaction, addTransactions, editTransaction, deleteTransaction,
      addTransfer,
      addCategory, updateCategoryBudget,
      addAccount, editAccount, deleteAccount,
      addDebt, settleDebt, deleteDebt,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      clearAllData,
      exportData
    }}>
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpense() {
  return useContext(ExpenseContext);
}
