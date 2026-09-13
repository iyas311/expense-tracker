import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { parseNaturalLanguageTransaction, parseReceiptImage } from '../services/aiService';
import { Sparkles, Camera, Plus, Loader2, CornerDownLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export function QuickAiBar({ onOpenManualAdd }) {
  const { categories, accounts, apiKey, groqApiKey, addTransactions, addTransfer, addDebt, settleDebt, debts, currency, authFetch } = useExpense();
  const [naturalInput, setNaturalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  const handleAiSubmit = async (e) => {
    e?.preventDefault();
    if (!naturalInput.trim() || isLoading) return;

    const promptText = naturalInput.trim();
    setIsLoading(true);
    setStatus({ type: 'loading', message: 'Analyzing AI prompt...' });

    try {
      const parsedArray = await parseNaturalLanguageTransaction(promptText, categories, accounts, apiKey, groqApiKey);
      const validOps = (parsedArray || []).filter(p => (p.amount > 0) || (p.totalAmount > 0));

      if (validOps.length > 0) {
        const transactionsToLog = [];
        
        for (const op of validOps) {
          if (op.operation === 'transaction') {
            transactionsToLog.push(op);
          } 
          else if (op.operation === 'transfer') {
            await addTransfer({
              fromAccountId: op.fromAccountId,
              toAccountId: op.toAccountId,
              amount: op.amount,
              date: op.date,
              notes: op.notes
            });
          }
          else if (op.operation === 'debt_add') {
            const debtPayload = {
              personName: op.personName,
              amount: op.amount,
              direction: op.direction,
              reason: op.reason,
              dateCreated: op.date,
              dueDate: null,
              notes: op.notes
            };
            addDebt(debtPayload);

            // Create corresponding transaction
            transactionsToLog.push({
              amount: op.amount,
              type: op.direction === 'lent' ? 'expense' : 'income',
              description: `${op.direction === 'lent' ? 'Lent to' : 'Borrowed from'} ${op.personName}`,
              categoryId: categories[0]?.id || 'cat-1', // Default category
              accountId: op.accountId,
              date: op.date,
              notes: op.notes
            });
          }
          else if (op.operation === 'debt_settle') {
            // Find existing debt for this person
            const targetDebt = debts.find(d => 
              d.personName.toLowerCase().includes(op.personName.toLowerCase()) && 
              d.status !== 'settled'
            );
            
            if (targetDebt) {
              const newSettled = (targetDebt.settledAmount || 0) + op.amount;
              const status = newSettled >= targetDebt.amount ? 'settled' : 'partial';
              settleDebt(targetDebt.id, Math.min(newSettled, targetDebt.amount), status);

              // Create corresponding transaction
              transactionsToLog.push({
                amount: op.amount,
                type: targetDebt.direction === 'lent' ? 'income' : 'expense',
                description: `${targetDebt.direction === 'lent' ? 'Received back from' : 'Paid back to'} ${targetDebt.personName}`,
                categoryId: categories[0]?.id || 'cat-1',
                accountId: op.accountId,
                date: op.date,
                notes: op.notes
              });
            } else {
              console.warn("Could not find matching debt for settlement:", op.personName);
            }
          }
          else if (op.operation === 'split_expense') {
            // Log full bank deduction with only your share for budget
            transactionsToLog.push({
              amount: op.yourShare,
              bankAmount: op.totalAmount,
              type: 'expense',
              description: op.description,
              categoryId: op.categoryId,
              accountId: op.accountId,
              date: op.date,
              notes: op.notes
            });
            // Create debt for each friend
            for (const s of op.splits) {
              if (s.personName && s.amount > 0) {
                addDebt({
                  personName: s.personName,
                  amount: s.amount,
                  direction: 'lent',
                  reason: op.description,
                  dateCreated: op.date,
                  dueDate: null,
                  notes: op.notes
                });
              }
            }
          }
        }

        if (transactionsToLog.length > 0) {
          await addTransactions(transactionsToLog);
        }
        
        setNaturalInput('');

        authFetch('addPromptHistory', { text: promptText, txCount: validOps.length })
          .catch(() => {});

        setStatus({
          type: 'success',
          message: `Processed ${validOps.length} action(s) successfully!`
        });
        setTimeout(() => setStatus(null), 4000);
      } else {
        setStatus({ type: 'error', message: 'Could not detect a valid operation.' });
        setTimeout(() => setStatus(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to process AI operation.' });
      setTimeout(() => setStatus(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };


  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatus({ type: 'loading', message: 'Extracting details from receipt image...' });

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Image = reader.result;
        const parsed = await parseReceiptImage(base64Image, categories, accounts, apiKey);
        if (parsed) {
          addTransaction(parsed);
          setStatus({
            type: 'success',
            message: `Receipt logged: ${currency}${parsed.amount} at ${parsed.description}`
          });
          setTimeout(() => setStatus(null), 4000);
        }
      } catch (err) {
        setStatus({ type: 'error', message: err.message || 'Failed to scan receipt.' });
        setTimeout(() => setStatus(null), 4000);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset file input
  };

  const [isFocused, setIsFocused] = useState(false);

  const suggestions = [
    { label: '☕ Coffee ₹150', text: `Spent ${currency}150 on coffee` },
    { label: '🍕 Split ₹600 with Rahul', text: `Me and Rahul had lunch for ${currency}600, split equally` },
    { label: '⛽ Fuel ₹500 from SBI', text: `Spent ${currency}500 for petrol from SBI Bank` },
    { label: '⚡ Electric Bill ₹1200', text: `Paid ${currency}1200 electricity bill from Credit Card` },
    { label: '💰 Salary ₹45000', text: `Received ${currency}45000 salary for this month` },
    { label: '🔄 Transfer ₹2000', text: `Transferred ${currency}2000 from Savings to Credit Card` }
  ];

  return (
    <div style={{ marginBottom: '20px' }}>
      {/* Main Command Bar Container */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1.5px solid ${isFocused ? 'rgba(6, 182, 212, 0.7)' : 'rgba(255, 255, 255, 0.12)'}`,
        borderRadius: '22px',
        padding: '6px 8px 6px 12px',
        boxShadow: isFocused 
          ? '0 0 25px -2px rgba(6, 182, 212, 0.4), 0 10px 30px -10px rgba(0, 0, 0, 0.6)' 
          : '0 8px 24px -6px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        position: 'relative',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        
        {/* AI Brand Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '36px',
          height: '36px',
          borderRadius: '12px',
          background: isFocused 
            ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.3), rgba(99, 102, 241, 0.3))'
            : 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(6, 182, 212, 0.15))',
          border: `1px solid ${isFocused ? 'rgba(6, 182, 212, 0.5)' : 'rgba(6, 182, 212, 0.25)'}`,
          flexShrink: 0,
          transition: 'all 0.25s ease'
        }}>
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" color="#06b6d4" />
          ) : (
            <Sparkles size={18} color="#06b6d4" />
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAiSubmit} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center' }}>
          <textarea
            value={naturalInput}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onChange={(e) => {
              setNaturalInput(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAiSubmit(e);
                e.target.style.height = 'auto';
              }
            }}
            placeholder={`Type anything: "Spent ${currency}450 on food"...`}
            disabled={isLoading}
            rows={1}
            style={{
              flex: 1,
              minWidth: 0,
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '500',
              fontFamily: 'inherit',
              resize: 'none',
              overflowY: 'auto',
              minHeight: '26px',
              maxHeight: '100px',
              padding: '6px 2px',
              lineHeight: '1.4',
              caretColor: '#06b6d4'
            }}
          />
        </form>

        {/* Clear Button (when user has typed) */}
        {naturalInput.length > 0 && !isLoading && (
          <button
            type="button"
            onClick={() => setNaturalInput('')}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              flexShrink: 0,
              padding: 0
            }}
          >
            ✕
          </button>
        )}

        {/* Action Controls Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Receipt Scanner Button */}
          <label
            title="Scan Receipt Photo"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#94a3b8',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <Camera size={18} />
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleReceiptUpload}
              disabled={isLoading}
            />
          </label>

          {/* Quick Submit Button (when user typed) OR Manual Add Button */}
          {naturalInput.trim().length > 0 ? (
            <button
              type="button"
              onClick={handleAiSubmit}
              disabled={isLoading}
              className="btn-gradient"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 14px',
                borderRadius: '12px',
                fontSize: '0.85rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.4)',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <span>Log</span>
                  <CornerDownLeft size={13} style={{ opacity: 0.9 }} />
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenManualAdd}
              title="Manual Transaction Entry"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#cbd5e1',
                fontSize: '0.82rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = '#cbd5e1';
              }}
            >
              <Plus size={16} />
              <span className="hide-mobile">Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Quick Suggestions Chips Carousel (Mobile-friendly) */}
      {!naturalInput && !isLoading && (
        <div style={{
          display: 'flex',
          gap: '6px',
          marginTop: '8px',
          overflowX: 'auto',
          paddingBottom: '2px',
          WebkitOverflowScrolling: 'touch'
        }} className="hide-scrollbar">
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setNaturalInput(s.text)}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '20px',
                padding: '4px 10px',
                color: 'var(--text-muted)',
                fontSize: '0.72rem',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                e.currentTarget.style.color = '#06b6d4';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
                e.currentTarget.style.color = 'var(--text-muted)';
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Status Pill */}
      {status && (
        <div className="animate-fade-in" style={{
          marginTop: '8px',
          padding: '6px 14px',
          borderRadius: '12px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.78rem',
          fontWeight: '600',
          background: status.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : status.type === 'error' ? 'rgba(244, 63, 94, 0.12)' : 'rgba(6, 182, 212, 0.12)',
          border: `1px solid ${status.type === 'success' ? 'rgba(16, 185, 129, 0.25)' : status.type === 'error' ? 'rgba(244, 63, 94, 0.25)' : 'rgba(6, 182, 212, 0.25)'}`,
          color: status.type === 'success' ? '#10b981' : status.type === 'error' ? '#f43f5e' : '#06b6d4'
        }}>
          {status.type === 'success' && <CheckCircle2 size={14} />}
          {status.type === 'error' && <AlertCircle size={14} />}
          {status.type === 'loading' && <Loader2 size={14} className="animate-spin" />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
