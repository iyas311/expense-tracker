import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { parseNaturalLanguageTransaction, parseReceiptImage } from '../services/aiService';
import { Sparkles, Camera, Plus, Loader2, ArrowRight } from 'lucide-react';

export function QuickAiBar({ onOpenManualAdd }) {
  const { categories, accounts, apiKey, groqApiKey, addTransaction } = useExpense();
  const [naturalInput, setNaturalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!naturalInput.trim()) return;

    setIsLoading(true);
    setStatusMsg('AI Parsing transaction...');

    try {
      const parsed = await parseNaturalLanguageTransaction(naturalInput, categories, accounts, apiKey, groqApiKey);
      if (parsed) {
        addTransaction(parsed);
        setNaturalInput('');
        setStatusMsg('✨ Expense added successfully!');
        setTimeout(() => setStatusMsg(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg('Error parsing transaction.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setStatusMsg('Scanning receipt with Gemini AI Vision...');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Image = reader.result;
        const parsed = await parseReceiptImage(base64Image, categories, accounts, apiKey);
        if (parsed) {
          addTransaction(parsed);
          setStatusMsg('📸 Receipt scanned & expense added!');
          setTimeout(() => setStatusMsg(''), 3000);
        }
      } catch (err) {
        alert(err.message || 'Failed to scan receipt image.');
        setStatusMsg('');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="glass-card" style={{ padding: '18px 22px', marginBottom: '24px', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} color="#06b6d4" />
          <span style={{ fontSize: '0.9rem', fontWeight: '700' }} className="text-gradient-cyan">
            Smart Natural Language & Receipt Entry
          </span>
        </div>
        <button
          className="btn-secondary"
          onClick={onOpenManualAdd}
          style={{ fontSize: '0.8rem', padding: '6px 12px', borderRadius: '10px' }}
        >
          <Plus size={14} /> Form Add
        </button>
      </div>

      <form onSubmit={handleAiSubmit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <input
            type="text"
            className="glass-input"
            value={naturalInput}
            onChange={(e) => setNaturalInput(e.target.value)}
            placeholder='Try typing: "Spent $35 on dinner with credit card today"'
            disabled={isLoading}
            style={{ paddingRight: '45px' }}
          />
          {/* Hidden File Input for Receipt Scanner */}
          <label style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: 'translateY(-50%)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            color: 'var(--accent-cyan)'
          }} title="Scan Receipt Image">
            <Camera size={18} />
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleReceiptUpload}
              disabled={isLoading}
            />
          </label>
        </div>

        <button type="submit" className="btn-cyan" disabled={isLoading} style={{ whiteSpace: 'nowrap' }}>
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <><ArrowRight size={18} /> AI Add</>}
        </button>
      </form>

      {statusMsg && (
        <p style={{
          fontSize: '0.78rem',
          marginTop: '8px',
          color: statusMsg.includes('Error') ? 'var(--accent-rose)' : 'var(--accent-emerald)',
          fontWeight: '600'
        }}>
          {statusMsg}
        </p>
      )}
    </div>
  );
}
