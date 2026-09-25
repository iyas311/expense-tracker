import React, { useState, useRef, useEffect } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { askAiAssistant } from '../services/aiService';
import { Bot, Send, X, Loader2, Sparkles, Zap, Cpu } from 'lucide-react';

export function AiChatbotModal({ isOpen, onClose }) {
  const { apiKey, groqApiKey, currency, netWorth, totalIncome, totalExpenses, accounts, transactions, categories, debts, subscriptions } = useExpense();
  
  const [selectedEngine, setSelectedEngine] = useState('auto'); // 'auto' | 'gemini' | 'groq'
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: `Hello! I am your AI Financial Advisor. Ask me anything about your spending history, category budgets, daily allowance, or debts!`,
      aiUsed: null,
      model: null
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isAsking, isOpen]);

  if (!isOpen) return null;

  // Calculate real-time financial stats
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  const currentMonth = now.toISOString().slice(0, 7);
  const todayStr = now.toISOString().split('T')[0];
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const remainingDays = Math.max(1, (daysInMonth - currentDay) + 1);

  // Spending pool calculation
  let spendingAccountIds = [];
  try {
    const saved = localStorage.getItem('et_spending_accounts');
    if (saved) spendingAccountIds = JSON.parse(saved);
  } catch (e) {}
  if (!spendingAccountIds.length) {
    spendingAccountIds = accounts.filter(a => a.type !== 'card').map(a => a.id);
  }
  const spendingPoolBalance = accounts.filter(a => spendingAccountIds.includes(a.id)).reduce((sum, a) => sum + (a.balance || 0), 0);
  const dailySafeSpend = remainingDays > 0 ? Math.max(0, spendingPoolBalance / remainingDays) : 0;
  const spentToday = transactions
    .filter(t => t.type === 'expense' && t.date === todayStr)
    .reduce((sum, t) => sum + t.amount, 0);

  // Category spending vs budget caps
  const categoryBudgets = categories
    .filter(c => c.type === 'expense')
    .map(c => {
      const spent = transactions
        .filter(t => t.type === 'expense' && t.categoryId === c.id && t.date.startsWith(currentMonth))
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        category: c.name,
        spent: `${currency}${spent.toFixed(2)}`,
        budgetCap: c.budgetCap > 0 ? `${currency}${c.budgetCap}` : 'No cap',
        remaining: c.budgetCap > 0 ? `${currency}${Math.max(0, c.budgetCap - spent).toFixed(2)}` : 'Unlimited'
      };
    });

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isAsking) return;

    const userText = inputQuestion.trim();
    const newMessages = [...messages, { sender: 'user', text: userText }];
    setMessages(newMessages);
    setInputQuestion('');
    setIsAsking(true);

    const monthlySpending = {};
    transactions.filter(t => t.type === 'expense' && t.date.startsWith(currentMonth)).forEach(t => {
      const cat = categories.find(c => c.id === t.categoryId)?.name || 'Other';
      monthlySpending[cat] = (monthlySpending[cat] || 0) + t.amount;
    });

    const contextData = {
      netWorth: `${currency}${netWorth.toFixed(2)}`,
      totalIncome: `${currency}${totalIncome.toFixed(2)}`,
      totalExpenses: `${currency}${totalExpenses.toFixed(2)}`,
      dailySafeSpend: `${currency}${dailySafeSpend.toFixed(0)}/day (${remainingDays} days remaining)`,
      spentToday: `${currency}${spentToday.toFixed(2)}`,
      monthlySpendingByCategory: monthlySpending,
      categoryBudgets: categoryBudgets,
      accounts: accounts.map(a => `${a.name} (${a.type}): ${currency}${a.balance}${a.creditLimit > 0 ? ` [Limit: ${currency}${a.creditLimit}, Stmt Day: ${a.statementDay||'N/A'}, Due Day: ${a.dueDay||'N/A'}]` : ''}`),
      debts: debts.map(d => `${d.direction === 'lent' ? 'I Lent' : 'I Borrowed'} ${currency}${d.amount} to/from ${d.personName}. Status: ${d.status} (Remaining: ${currency}${(d.amount - (d.settledAmount || 0)).toFixed(2)})`),
      subscriptions: subscriptions.map(s => `${s.name}: ${currency}${s.amount}/${s.billingCycle} (Next due: ${s.nextDueDate || 'N/A'})`),
      recentTransactions: transactions.slice(0, 15).map(t => `${t.date}: ${t.description} (${currency}${t.amount}, ${categories.find(c => c.id === t.categoryId)?.name || 'Other'})`)
    };

    const historyForAi = newMessages.slice(-6).map(m => ({ sender: m.sender, text: m.text }));
    const result = await askAiAssistant(userText, contextData, apiKey, groqApiKey, selectedEngine, historyForAi);

    const botText = typeof result === 'object' ? result.response : result;
    const aiUsed = typeof result === 'object' ? result.aiUsed : null;
    const model = typeof result === 'object' ? result.model : null;

    setMessages(prev => [...prev, { sender: 'bot', text: botText, aiUsed, model }]);
    setIsAsking(false);
  };

  const getModelBadge = (msg) => {
    if (!msg.aiUsed && !msg.model) return null;
    if (msg.aiUsed === 'gemini' || (msg.model && msg.model.includes('gemini'))) {
      const modelLabel = msg.model ? msg.model.replace('gemini-', '').replace(/-/g, ' ') : 'Gemini';
      return (
        <span style={{
          fontSize: '0.68rem',
          color: '#818cf8',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          padding: '2px 7px',
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: '4px'
        }}>
          ✨ {modelLabel}
        </span>
      );
    }
    if (msg.aiUsed === 'groq' || (msg.model && (msg.model.includes('llama') || msg.model.includes('qwen')))) {
      const modelLabel = msg.model ? msg.model.split('-').slice(0, 3).join('-') : 'Groq';
      return (
        <span style={{
          fontSize: '0.68rem',
          color: '#38bdf8',
          background: 'rgba(6, 182, 212, 0.12)',
          border: '1px solid rgba(6, 182, 212, 0.25)',
          padding: '2px 7px',
          borderRadius: '8px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          marginTop: '4px'
        }}>
          ⚡ {modelLabel}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '560px', height: '640px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Chat Header */}
        <div style={{
          padding: '14px 20px',
          background: 'rgba(15, 22, 41, 0.98)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <h3 className="font-heading" style={{ fontSize: '1.05rem', margin: 0 }}>AI Financial Assistant</h3>
              <p style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', margin: 0 }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Live Financial Context Active
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Model / Engine Switcher */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '2px',
              borderRadius: '10px',
              border: '1px solid var(--border-light)'
            }}>
              {[
                { id: 'auto', label: 'Auto' },
                { id: 'gemini', label: '✨ Gemini' },
                { id: 'groq', label: '⚡ Groq' }
              ].map(engine => (
                <button
                  key={engine.id}
                  onClick={() => setSelectedEngine(engine.id)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '0.72rem',
                    fontWeight: '600',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    background: selectedEngine === engine.id ? 'var(--btn-primary-bg, #06b6d4)' : 'transparent',
                    color: selectedEngine === engine.id ? '#fff' : 'var(--text-muted)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {engine.label}
                </button>
              ))}
            </div>

            <button className="btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {messages.map((msg, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                gap: '10px',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%'
              }}
            >
              {msg.sender === 'bot' && (
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  <Sparkles size={14} color="#8b5cf6" />
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  background: msg.sender === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(255, 255, 255, 0.05)',
                  color: '#fff',
                  padding: '12px 16px',
                  borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  fontSize: '0.88rem',
                  lineHeight: '1.5',
                  border: msg.sender === 'bot' ? '1px solid var(--border-light)' : 'none',
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text}
                </div>
                {msg.sender === 'bot' && getModelBadge(msg)}
              </div>
            </div>
          ))}

          {isAsking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem', paddingLeft: '38px' }}>
              <Loader2 size={16} className="animate-spin" color="#06b6d4" />
              <span>Analyzing finances ({selectedEngine === 'auto' ? 'Gemini/Groq' : selectedEngine})...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Preset Prompt Suggestion Buttons */}
        <div style={{ padding: '8px 18px', display: 'flex', gap: '6px', overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            "How much can I spend per day?",
            "Am I over budget in any category?",
            "What are my pending debts & subscriptions?",
            "Show my top spending this month"
          ].map((prompt, i) => (
            <button
              key={i}
              className="btn-secondary"
              onClick={() => setInputQuestion(prompt)}
              style={{ fontSize: '0.72rem', padding: '5px 10px', borderRadius: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Input Container */}
        <div style={{ padding: '14px 18px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom, 0px))', background: 'rgba(255, 255, 255, 0.02)', borderTop: '1px solid var(--border-light)' }}>
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="glass-input"
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              placeholder={`Ask AI (${selectedEngine.toUpperCase()}) about your spending, debts, budgets...`}
              disabled={isAsking}
            />
            <button type="submit" className="btn-cyan" disabled={isAsking || !inputQuestion.trim()} style={{ padding: '10px 16px' }}>
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

