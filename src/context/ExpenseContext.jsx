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
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7));
  const [selectedDate, setSelectedDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]);

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
          
          if (Array.isArray(data.categories)) setCategories(data.categories);
          if (Array.isArray(data.accounts)) setAccounts(data.accounts);
          if (Array.isArray(data.transactions)) setTransactions(data.transactions);
          if (Array.isArray(data.subscriptions)) setSubscriptions(data.subscriptions);
          if (Array.isArray(data.debts)) setDebts(data.debts);
          
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
    setCurrentVault(null);
    setTransactions([]);
    setCategories([]);
    setAccounts([]);
    setSubscriptions([]);
    setDebts([]);
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

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const res = await authFetch('changePassword', { currentPassword, newPassword });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change password');
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
      date: newTx.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
      description: newTx.description || 'Transaction',
      amount: parseFloat(newTx.amount) || 0,
      type: newTx.type || 'expense',
      categoryId: newTx.categoryId || categories[0]?.id || 'cat-1',
      accountId: newTx.accountId || accounts[0]?.id || 'acc-1',
      notes: newTx.notes || '',
      vaultId: currentVault?.id || 'vault_admin',
      budgetMonth: newTx.budgetMonth || null,
      bankAmount: newTx.bankAmount ? parseFloat(newTx.bankAmount) : null
    };
    const bankDelta = formatted.bankAmount || formatted.amount;
    setTransactions(prev => [formatted, ...prev]);
    setAccounts(prev => prev.map(acc => {
      if (acc.id === formatted.accountId) {
        const delta = formatted.type === 'income' ? formatted.amount : -bankDelta;
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
      date: newTx.date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
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
    const transferDate = date || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
    const transferId = `tfr-${Date.now()}`;
    const vId = currentVault?.id || 'vault_admin';
    setTransactions(prev => [
      { id: `tx-out-${Date.now()}`, date: transferDate, description: 'Transfer Out', amount: parsedAmount, type: 'transfer_out', categoryId: null, accountId: fromAccountId, notes: notes || '', transferId, vaultId: vId },
      { id: `tx-in-${Date.now() + 1}`, date: transferDate, description: 'Transfer In', amount: parsedAmount, type: 'transfer_in', categoryId: null, accountId: toAccountId, notes: notes || '', transferId, vaultId: vId },
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

  const updateCategory = async (categoryData) => {
    setCategories(prev => prev.map(c => c.id === categoryData.id ? { ...c, ...categoryData, budgetCap: parseFloat(categoryData.budgetCap) || 0 } : c));
    try {
      await authFetch('updateCategory', categoryData);
      refreshCloudData();
    } catch (e) {}
  };

  const deleteCategory = async (id) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    try {
      await authFetch('deleteCategory', { id });
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
      dateCreated: debtData.dateCreated || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
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

  const settleDebt = async (id, settledAmount, status = 'settled', receivedAccountId = null) => {
    const debt = debts.find(d => d.id === id);
    setDebts(prev => prev.map(d => d.id === id ? { ...d, settledAmount: parseFloat(settledAmount) || d.amount, status } : d));
    
    const debtCat = categories.find(c => /loan|debt/i.test(c.name));
    const defaultExpenseCatId = debtCat?.id || categories.find(c => c.type === 'expense')?.id || categories[0]?.id;
    const defaultIncomeCatId = debtCat?.id || categories.find(c => c.type === 'income')?.id || categories[0]?.id;

    // If friend paid us back (lent direction) and we have an account to credit, create an income transaction
    if (receivedAccountId && debt && debt.direction === 'lent') {
      const amt = parseFloat(settledAmount) || debt.amount;
      await addTransaction({
        description: `${debt.personName} repaid loan`,
        amount: amt,
        type: 'income',
        categoryId: defaultIncomeCatId,
        accountId: receivedAccountId,
        date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
        notes: debt.reason ? `Debt repaid: ${debt.reason}` : 'Loan repayment'
      });
    } else if (receivedAccountId && debt && debt.direction === 'borrowed') {
      const amt = parseFloat(settledAmount) || debt.amount;
      await addTransaction({
        description: `Repaid ${debt.personName}`,
        amount: amt,
        type: 'expense',
        categoryId: defaultExpenseCatId,
        accountId: receivedAccountId,
        date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
        notes: debt.reason ? `Settlement: ${debt.reason}` : 'Debt settlement'
      });
    }
    try {
      await authFetch('settleDebt', { id, settledAmount, status });
    } catch (e) {}
  };

  const updateDebt = async (debtData) => {
    setDebts(prev => prev.map(d => d.id === debtData.id ? { ...d, ...debtData, amount: parseFloat(debtData.amount) || d.amount } : d));
    try {
      await authFetch('updateDebt', debtData);
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
      nextDueDate: subData.nextDueDate || new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
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



  // ─── Filtered Transactions ───────────────────────────────────────────────────
  const getFilteredTransactions = () => {
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const now = new Date();
    const currentMonthStr = now.toISOString().slice(0, 7);
    
    return transactions.filter(t => {
      const txMonth = t.budgetMonth || t.date.slice(0, 7);
      
      if (timeRange === 'today') return t.date === todayStr;
      if (timeRange === 'yesterday') return t.date === yesterdayStr;
      if (timeRange === 'this_week') {
        const diffDays = Math.floor((now - new Date(t.date)) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      }
      if (timeRange === 'this_month') return txMonth === currentMonthStr;
      if (timeRange === 'custom_month') return txMonth === selectedMonth;
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

  // ─── Export CSV (Timeline & Budget Report) ───────────────────────────────────
  const exportData = () => {
    // 1. Export filtered transactions
    const headers = ['Date', 'Budget Month', 'Type', 'Description', 'Amount', 'Category', 'Account', 'Notes', 'Transaction ID'];
    const rows = filteredTransactions.map(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'General';
      const acc = accounts.find(a => a.id === t.accountId)?.name || 'Account';
      const bMonth = t.budgetMonth || t.date.slice(0, 7);
      return [t.date, bMonth, t.type, `"${(t.description||'').replace(/"/g,'""')}"`, t.amount, `"${cat}"`, `"${acc}"`, `"${(t.notes||'').replace(/"/g,'""')}"`, t.id].join(',');
    });
    
    // 2. Budget status calculations
    const expenseCategories = categories.filter(c => c.type === 'expense');
    const totalBudgetCap = expenseCategories.reduce((s, c) => s + (parseFloat(c.budgetCap) || 0), 0);
    const budgetRemaining = totalBudgetCap - totalExpenses;
    const isOverBudget = budgetRemaining < 0;

    let displayTime = timeRange.replace('_', ' ').toUpperCase();
    if (timeRange === 'custom_date') displayTime = `DATE: ${selectedDate}`;
    if (timeRange === 'custom_month') displayTime = `MONTH: ${selectedMonth}`;

    const reportLines = [
      '',
      '',
      '"--- FINANCIAL REPORT FOR SELECTED PERIOD ---"',
      `"Time Period:","${displayTime}"`,
      `"Total Income:","${currency}${totalIncome.toFixed(2)}"`,
      `"Total Expenses:","${currency}${totalExpenses.toFixed(2)}"`,
      `"Net Savings:","${currency}${(totalIncome - totalExpenses).toFixed(2)}"`,
      '',
      '"--- BUDGET STATUS ---"',
      `"Total Monthly Budget Cap:","${currency}${totalBudgetCap.toFixed(2)}"`,
      `"Total Spent in Period:","${currency}${totalExpenses.toFixed(2)}"`,
      `"Remaining Budget:","${currency}${budgetRemaining.toFixed(2)}"`,
      `"Status:","${isOverBudget ? 'OVER BUDGET' : 'ON TRACK'}"`
    ];

    const csvContent = [headers.join(','), ...rows, ...reportLines].join('\n');
    // Prepend UTF-8 BOM (\uFEFF) so Excel correctly parses currency symbols like ₹
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expensia_${currentVault?.name || 'vault'}_${timeRange}_${new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // ─── Export Printable PDF Statement ─────────────────────────────────────────
  const exportPdfStatement = () => {
    let displayTime = timeRange.replace('_', ' ').toUpperCase();
    if (timeRange === 'custom_date') displayTime = `Date: ${selectedDate}`;
    if (timeRange === 'custom_month') {
      const [yr, mo] = selectedMonth.split('-');
      displayTime = new Date(yr, mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }
    if (timeRange === 'this_month') {
      displayTime = new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    }

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((netSavings / totalIncome) * 100)) : 0;
    const expenseCategories = categories.filter(c => c.type === 'expense');

    // Category breakdown
    const categoryRows = expenseCategories.map(cat => {
      const spent = filteredTransactions
        .filter(t => t.type === 'expense' && t.categoryId === cat.id)
        .reduce((sum, t) => sum + t.amount, 0);
      const cap = parseFloat(cat.budgetCap) || 0;
      const pctOfExpenses = totalExpenses > 0 ? ((spent / totalExpenses) * 100).toFixed(1) : '0.0';
      const isOver = cap > 0 && spent > cap;
      return {
        name: cat.name,
        spent: spent,
        cap: cap,
        pct: pctOfExpenses,
        isOver
      };
    }).filter(c => c.spent > 0 || c.cap > 0);

    const printHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Financial Statement - ${displayTime}</title>
        <meta charset="utf-8" />
        <style>
          @page { size: A4; margin: 15mm; }
          * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 20px;
            font-size: 12px;
            line-height: 1.4;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .brand {
            font-size: 22px;
            font-weight: 800;
            color: #0284c7;
            letter-spacing: -0.5px;
          }
          .badge {
            display: inline-block;
            background: #e0f2fe;
            color: #0369a1;
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            margin-top: 4px;
          }
          .meta {
            text-align: right;
            font-size: 11px;
            color: #64748b;
          }
          .grid-summary {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            margin-bottom: 20px;
          }
          .card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 10px 12px;
          }
          .card-label {
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .card-value {
            font-size: 17px;
            font-weight: 800;
            margin-top: 4px;
          }
          .val-income { color: #059669; }
          .val-expense { color: #e11d48; }
          .val-savings { color: #0284c7; }
          .val-worth { color: #4f46e5; }
          
          h3 {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
            margin: 18px 0 10px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-bottom: 16px;
          }
          th {
            background: #f1f5f9;
            color: #475569;
            font-weight: 700;
            text-align: left;
            padding: 7px 10px;
            border-bottom: 1px solid #cbd5e1;
          }
          td {
            padding: 6px 10px;
            border-bottom: 1px solid #f1f5f9;
          }
          tr:nth-child(even) { background: #fafafa; }
          .text-right { text-align: right; }
          .tag-expense { color: #e11d48; font-weight: 600; }
          .tag-income { color: #059669; font-weight: 600; }
          .tag-transfer { color: #4f46e5; font-weight: 600; }
          .footer {
            margin-top: 24px;
            padding-top: 10px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="brand">EXPENSIA AI</div>
            <div class="badge">Financial Statement · ${displayTime}</div>
          </div>
          <div class="meta">
            <div><strong>Vault:</strong> ${currentVault?.name || 'Main Vault'}</div>
            <div><strong>Generated:</strong> ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Total Transactions:</strong> ${filteredTransactions.length}</div>
          </div>
        </div>

        <div class="grid-summary">
          <div class="card">
            <div class="card-label">Total Income</div>
            <div class="card-value val-income">+${currency}${totalIncome.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card">
            <div class="card-label">Total Expenses</div>
            <div class="card-value val-expense">-${currency}${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card">
            <div class="card-label">Net Savings (${savingsRate}%)</div>
            <div class="card-value val-savings">${netSavings >= 0 ? '+' : ''}${currency}${netSavings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="card">
            <div class="card-label">Total Net Worth</div>
            <div class="card-value val-worth">${currency}${netWorth.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
          </div>
        </div>

        <h3>Spending by Category</h3>
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th class="text-right">Spent Amount</th>
              <th class="text-right">Budget Limit</th>
              <th class="text-right">% of Spending</th>
              <th class="text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            ${categoryRows.length > 0 ? categoryRows.map(c => `
              <tr>
                <td><strong>${c.name}</strong></td>
                <td class="text-right">${currency}${c.spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                <td class="text-right">${c.cap > 0 ? `${currency}${c.cap.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'No Cap'}</td>
                <td class="text-right">${c.pct}%</td>
                <td class="text-right" style="color: ${c.isOver ? '#e11d48' : '#059669'}; font-weight: 700;">
                  ${c.isOver ? '⚠️ Over Budget' : (c.cap > 0 ? '✓ Within Cap' : '—')}
                </td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No category expenses recorded in this period.</td></tr>'}
          </tbody>
        </table>

        <h3>Account Balances</h3>
        <table>
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Type</th>
              <th class="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${accounts.map(a => `
              <tr>
                <td><strong>${a.name}</strong></td>
                <td style="text-transform: capitalize;">${a.type}</td>
                <td class="text-right" style="font-weight: 700; color: ${a.balance >= 0 ? '#059669' : '#e11d48'};">
                  ${currency}${a.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <h3>Transaction History (${displayTime})</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Account</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTransactions.length > 0 ? filteredTransactions.map(t => {
              const cat = categories.find(c => c.id === t.categoryId)?.name || 'General';
              const acc = accounts.find(a => a.id === t.accountId)?.name || 'Account';
              const isIncome = t.type === 'income';
              const isTransfer = t.type === 'transfer';
              return `
                <tr>
                  <td>${t.date}</td>
                  <td>
                    <strong>${t.description}</strong>
                    ${t.notes ? `<br/><span style="font-size:10px; color:#64748b;">${t.notes}</span>` : ''}
                  </td>
                  <td>${cat}</td>
                  <td>${acc}</td>
                  <td class="text-right ${isIncome ? 'tag-income' : (isTransfer ? 'tag-transfer' : 'tag-expense')}">
                    ${isIncome ? '+' : (isTransfer ? '🔄 ' : '-')}${currency}${t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              `;
            }).join('') : '<tr><td colspan="5" style="text-align:center; color:#94a3b8;">No transactions found in this period.</td></tr>'}
          </tbody>
        </table>

        <div class="footer">
          Generated automatically by Expensia AI · Confidential Personal Financial Statement
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 350);
    }
  };

  return (
    <ExpenseContext.Provider value={{
      currentVault, isLoggedIn, apiKey, groqApiKey, currency,
      timeRange, setTimeRange, selectedMonth, setSelectedMonth, selectedDate, setSelectedDate,
      isSyncing, isOffline, refreshCloudData,
      transactions, filteredTransactions,
      categories, accounts, subscriptions, debts,
      totalIncome, totalExpenses, netWorth,
      login, logout, getUsers, createUser, changePassword,
      setApiKey, setGroqApiKey, setCurrency,
      addTransaction, addTransactions, editTransaction, deleteTransaction,
      addTransfer,
      addCategory, updateCategory, deleteCategory, updateCategoryBudget,
      addAccount, editAccount, deleteAccount,
      addDebt, updateDebt, settleDebt, deleteDebt,
      addSubscription,
      updateSubscription,
      deleteSubscription,
      clearAllData,
      exportData,
      exportPdfStatement,
      authFetch
    }}>
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpense() {
  return useContext(ExpenseContext);
}
