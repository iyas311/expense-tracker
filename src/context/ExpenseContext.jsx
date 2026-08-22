import React, { createContext, useContext, useState, useEffect } from 'react';

const ExpenseContext = createContext();

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Food & Dining', type: 'expense', budgetCap: 400, isAutoBudget: false, color: '#f43f5e', icon: 'Utensils' },
  { id: 'cat-2', name: 'Groceries', type: 'expense', budgetCap: 500, isAutoBudget: false, color: '#10b981', icon: 'ShoppingCart' },
  { id: 'cat-3', name: 'Transport & Fuel', type: 'expense', budgetCap: 200, isAutoBudget: false, color: '#06b6d4', icon: 'Car' },
  { id: 'cat-4', name: 'Bills & Utilities', type: 'expense', budgetCap: 350, isAutoBudget: false, color: '#f59e0b', icon: 'Zap' },
  { id: 'cat-5', name: 'Entertainment', type: 'expense', budgetCap: 150, isAutoBudget: false, color: '#8b5cf6', icon: 'Film' },
  { id: 'cat-6', name: 'Shopping', type: 'expense', budgetCap: 250, isAutoBudget: false, color: '#ec4899', icon: 'ShoppingBag' },
  { id: 'cat-7', name: 'Salary & Income', type: 'income', budgetCap: 0, isAutoBudget: false, color: '#10b981', icon: 'DollarSign' }
];

const DEFAULT_ACCOUNTS = [
  { id: 'acc-1', name: 'Main Bank Account', type: 'bank', balance: 3450.00, color: '#6366f1', icon: 'Landmark' },
  { id: 'acc-2', name: 'Rewards Credit Card', type: 'card', balance: -420.50, color: '#f43f5e', icon: 'CreditCard' },
  { id: 'acc-3', name: 'Cash Wallet', type: 'cash', balance: 180.00, color: '#10b981', icon: 'Wallet' },
  { id: 'acc-4', name: 'Emergency Savings', type: 'savings', balance: 5000.00, color: '#06b6d4', icon: 'PiggyBank' }
];

const DEFAULT_SAMPLE_TRANSACTIONS = [
  { id: 'tx-1', date: '2026-08-22', description: 'Monthly Salary Credit', amount: 4500.00, type: 'income', categoryId: 'cat-7', accountId: 'acc-1', notes: 'Direct deposit' },
  { id: 'tx-2', date: '2026-08-21', description: 'Whole Foods Market', amount: 124.50, type: 'expense', categoryId: 'cat-2', accountId: 'acc-2', notes: 'Weekly organic groceries' },
  { id: 'tx-3', date: '2026-08-20', description: 'Electric & Power Bill', amount: 85.20, type: 'expense', categoryId: 'cat-4', accountId: 'acc-1', notes: 'Utility payment' },
  { id: 'tx-4', date: '2026-08-19', description: 'Starbucks Coffee & Snacks', amount: 18.40, type: 'expense', categoryId: 'cat-1', accountId: 'acc-3', notes: 'Coffee with friends' },
  { id: 'tx-5', date: '2026-08-18', description: 'Uber Ride to Downtown', amount: 24.00, type: 'expense', categoryId: 'cat-3', accountId: 'acc-2', notes: 'Cab fare' },
  { id: 'tx-6', date: '2026-08-17', description: 'Netflix Subscription', amount: 15.99, type: 'expense', categoryId: 'cat-5', accountId: 'acc-2', notes: 'Monthly HD plan' }
];

const DEFAULT_SUBSCRIPTIONS = [
  { id: 'sub-1', name: 'Netflix Premium', amount: 15.99, categoryId: 'cat-5', accountId: 'acc-2', billingCycle: 'monthly', nextDueDate: '2026-09-17' },
  { id: 'sub-2', name: 'Gigabit Internet', amount: 79.99, categoryId: 'cat-4', accountId: 'acc-1', billingCycle: 'monthly', nextDueDate: '2026-09-01' },
  { id: 'sub-3', name: 'Gym Membership', amount: 45.00, categoryId: 'cat-6', accountId: 'acc-2', billingCycle: 'monthly', nextDueDate: '2026-09-05' }
];

export function ExpenseProvider({ children }) {
  // Passcode Auth State
  const [passcode, setPasscode] = useState(() => localStorage.getItem('et_passcode') || '1234');
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const saved = localStorage.getItem('et_is_logged_in');
    return saved === 'true';
  });

  // API Key State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('et_gemini_api_key') || import.meta.env.VITE_GEMINI_API_KEY || '');
  const [currency, setCurrency] = useState(() => localStorage.getItem('et_currency') || '$');

  // App Data State
  const [transactions, setTransactions] = useState(() => {
    const saved = localStorage.getItem('et_transactions');
    return saved ? JSON.parse(saved) : DEFAULT_SAMPLE_TRANSACTIONS;
  });

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('et_categories');
    return saved ? JSON.parse(saved) : DEFAULT_CATEGORIES;
  });

  const [accounts, setAccounts] = useState(() => {
    const saved = localStorage.getItem('et_accounts');
    return saved ? JSON.parse(saved) : DEFAULT_ACCOUNTS;
  });

  const [subscriptions, setSubscriptions] = useState(() => {
    const saved = localStorage.getItem('et_subscriptions');
    return saved ? JSON.parse(saved) : DEFAULT_SUBSCRIPTIONS;
  });

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('et_passcode', passcode);
  }, [passcode]);

  useEffect(() => {
    localStorage.setItem('et_is_logged_in', isLoggedIn);
  }, [isLoggedIn]);

  useEffect(() => {
    localStorage.setItem('et_gemini_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem('et_currency', currency);
  }, [currency]);

  useEffect(() => {
    localStorage.setItem('et_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem('et_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('et_accounts', JSON.stringify(accounts));
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem('et_subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  // Auth Functions
  const login = (inputPass, rememberMe = true) => {
    if (inputPass === passcode) {
      setIsLoggedIn(true);
      if (rememberMe) {
        localStorage.setItem('et_is_logged_in', 'true');
      }
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('et_is_logged_in');
  };

  const updatePasscode = (newPass) => {
    setPasscode(newPass);
  };

  // Transaction Actions
  const addTransaction = (newTx) => {
    const formatted = {
      id: `tx-${Date.now()}`,
      date: newTx.date || new Date().toISOString().split('T')[0],
      description: newTx.description || 'Transaction',
      amount: parseFloat(newTx.amount) || 0,
      type: newTx.type || 'expense',
      categoryId: newTx.categoryId || categories[0].id,
      accountId: newTx.accountId || accounts[0].id,
      notes: newTx.notes || ''
    };

    setTransactions(prev => [formatted, ...prev]);

    // Update account balance
    setAccounts(prevAccounts => {
      return prevAccounts.map(acc => {
        if (acc.id === formatted.accountId) {
          const delta = formatted.type === 'income' ? formatted.amount : -formatted.amount;
          return { ...acc, balance: Math.round((acc.balance + delta) * 100) / 100 };
        }
        return acc;
      });
    });
  };

  const deleteTransaction = (id) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return;

    setTransactions(prev => prev.filter(t => t.id !== id));

    // Revert account balance
    setAccounts(prev => prev.map(acc => {
      if (acc.id === target.accountId) {
        const delta = target.type === 'income' ? -target.amount : target.amount;
        return { ...acc, balance: Math.round((acc.balance + delta) * 100) / 100 };
      }
      return acc;
    }));
  };

  // Category Actions
  const addCategory = (categoryData) => {
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
  };

  const updateCategoryBudget = (catId, budgetCap, isAutoBudget = false) => {
    setCategories(prev => prev.map(c => {
      if (c.id === catId) {
        return { ...c, budgetCap: parseFloat(budgetCap) || 0, isAutoBudget };
      }
      return c;
    }));
  };

  // Account Actions
  const addAccount = (accData) => {
    const newAcc = {
      id: `acc-${Date.now()}`,
      name: accData.name,
      type: accData.type || 'bank',
      balance: parseFloat(accData.balance) || 0,
      color: accData.color || '#06b6d4',
      icon: accData.icon || 'Landmark'
    };
    setAccounts(prev => [...prev, newAcc]);
  };

  // Subscription Actions
  const addSubscription = (subData) => {
    const newSub = {
      id: `sub-${Date.now()}`,
      name: subData.name,
      amount: parseFloat(subData.amount) || 0,
      categoryId: subData.categoryId || categories[0].id,
      accountId: subData.accountId || accounts[0].id,
      billingCycle: subData.billingCycle || 'monthly',
      nextDueDate: subData.nextDueDate || new Date().toISOString().split('T')[0]
    };
    setSubscriptions(prev => [...prev, newSub]);
  };

  // Export / Import
  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      transactions, categories, accounts, subscriptions
    }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `expense_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Derived Calculations
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netWorth = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <ExpenseContext.Provider value={{
      passcode,
      isLoggedIn,
      apiKey,
      currency,
      transactions,
      categories,
      accounts,
      subscriptions,
      totalIncome,
      totalExpenses,
      netWorth,
      login,
      logout,
      updatePasscode,
      setApiKey,
      setCurrency,
      addTransaction,
      deleteTransaction,
      addCategory,
      updateCategoryBudget,
      addAccount,
      addSubscription,
      exportData
    }}>
      {children}
    </ExpenseContext.Provider>
  );
}

export function useExpense() {
  return useContext(ExpenseContext);
}
