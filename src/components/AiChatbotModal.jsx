import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { askAiAssistant } from '../services/aiService';
import { Bot, Send, X, Loader2, Sparkles, User } from 'lucide-react';

export function AiChatbotModal({ isOpen, onClose }) {
  const { apiKey, groqApiKey, currency, netWorth, totalIncome, totalExpenses, accounts, transactions, categories } = useExpense();
  
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: `Hello! I am your AI Financial Advisor. Ask me anything about your spending history, category budgets, or savings goals!`
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputQuestion.trim() || isAsking) return;

    const userText = inputQuestion.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userText }]);
    setInputQuestion('');
    setIsAsking(true);

    const contextData = {
      netWorth: `${currency}${netWorth.toFixed(2)}`,
      totalIncome: `${currency}${totalIncome.toFixed(2)}`,
      totalExpenses: `${currency}${totalExpenses.toFixed(2)}`,
      accounts: accounts.map(a => `${a.name}: ${currency}${a.balance}`),
      recentTransactions: transactions.slice(0, 10).map(t => `${t.date}: ${t.description} (${currency}${t.amount})`),
      budgets: categories.filter(c => c.type === 'expense').map(c => `${c.name}: Cap ${currency}${c.budgetCap}`)
    };

    const botResponse = await askAiAssistant(userText, contextData, apiKey, groqApiKey);

    setMessages(prev => [...prev, { sender: 'bot', text: botResponse }]);
    setIsAsking(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '540px', height: '620px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Chat Header */}
        <div style={{
          padding: '16px 20px',
          background: 'rgba(15, 22, 41, 0.95)',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={20} color="#fff" />
            </div>
            <div>
              <h3 className="font-heading" style={{ fontSize: '1.1rem' }}>AI Financial Assistant</h3>
              <p style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> Powered by Gemini & Groq
              </p>
            </div>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '6px' }}>
            <X size={18} />
          </button>
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
                <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={14} color="#8b5cf6" />
                </div>
              )}
              <div style={{
                background: msg.sender === 'user' ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' : 'rgba(255, 255, 255, 0.05)',
                color: '#fff',
                padding: '12px 16px',
                borderRadius: msg.sender === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                fontSize: '0.88rem',
                lineHeight: '1.45',
                border: msg.sender === 'bot' ? '1px solid var(--border-light)' : 'none'
              }}>
                {msg.text}
              </div>
            </div>
          ))}

          {isAsking && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              <Loader2 size={16} className="animate-spin" /> Thinking...
            </div>
          )}
        </div>

        {/* Preset Prompt Suggestion Buttons */}
        <div style={{ padding: '8px 18px', display: 'flex', gap: '6px', overflowX: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {[
            "How much did I spend this month?",
            "Give me budgeting advice",
            "Show my top spending category"
          ].map((prompt, i) => (
            <button
              key={i}
              className="btn-secondary"
              onClick={() => setInputQuestion(prompt)}
              style={{ fontSize: '0.72rem', padding: '5px 10px', borderRadius: '12px', whiteSpace: 'nowrap' }}
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
              placeholder="Ask AI about your spending..."
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
