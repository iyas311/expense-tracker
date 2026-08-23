import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { parseNaturalLanguageTransaction, parseReceiptImage } from '../services/aiService';
import { Sparkles, Camera, Plus, Loader2, CornerDownLeft, CheckCircle2, AlertCircle } from 'lucide-react';

export function QuickAiBar({ onOpenManualAdd }) {
  const { categories, accounts, apiKey, groqApiKey, addTransaction, currency } = useExpense();
  const [naturalInput, setNaturalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success' | 'error', message: string }

  const handleAiSubmit = async (e) => {
    e?.preventDefault();
    if (!naturalInput.trim() || isLoading) return;

    setIsLoading(true);
    setStatus({ type: 'loading', message: 'Analyzing transaction details...' });

    try {
      const parsed = await parseNaturalLanguageTransaction(naturalInput, categories, accounts, apiKey, groqApiKey);
      if (parsed) {
        addTransaction(parsed);
        setNaturalInput('');
        setStatus({
          type: 'success',
          message: `Logged ${parsed.type === 'expense' ? '−' : '+'}${currency}${parsed.amount} for "${parsed.description}"`
        });
        setTimeout(() => setStatus(null), 4000);
      } else {
        setStatus({ type: 'error', message: 'Could not detect amount or details. Try manual entry.' });
        setTimeout(() => setStatus(null), 4000);
      }
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', message: 'Failed to process transaction.' });
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

  return (
    <div style={{ marginBottom: '24px' }}>
      {/* Main Command Bar Container */}
      <div style={{
        background: 'rgba(17, 24, 39, 0.75)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '8px 12px 8px 16px',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        position: 'relative',
        transition: 'border-color 0.2s, box-shadow 0.2s'
      }}>
        
        {/* AI Brand Indicator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(6, 182, 212, 0.2))',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          flexShrink: 0
        }}>
          {isLoading ? (
            <Loader2 size={16} className="animate-spin" color="#06b6d4" />
          ) : (
            <Sparkles size={16} color="#06b6d4" />
          )}
        </div>

        {/* Input Form */}
        <form onSubmit={handleAiSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={naturalInput}
            onChange={(e) => setNaturalInput(e.target.value)}
            placeholder={`Log expense: e.g. "Paid ${currency}450 for lunch on credit card"...`}
            disabled={isLoading}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#f8fafc',
              fontSize: '0.92rem',
              fontWeight: '500',
              fontFamily: 'inherit'
            }}
          />
        </form>

        {/* Action Controls Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Receipt Scanner Button */}
          <label
            title="Scan Receipt Photo"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#94a3b8',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
          >
            <Camera size={17} />
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleReceiptUpload}
              disabled={isLoading}
            />
          </label>

          {/* Manual Form Button */}
          <button
            type="button"
            onClick={onOpenManualAdd}
            title="Manual Transaction Entry"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '10px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#cbd5e1',
              fontSize: '0.82rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.09)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.color = '#cbd5e1';
            }}
          >
            <Plus size={15} />
            <span className="hide-mobile">Add</span>
          </button>

          {/* Quick Submit Button (when user has typed) */}
          {naturalInput.trim().length > 0 && (
            <button
              onClick={handleAiSubmit}
              disabled={isLoading}
              className="btn-gradient"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '7px 14px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                fontWeight: '700',
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 100%)',
                boxShadow: '0 0 15px rgba(6, 182, 212, 0.35)'
              }}
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <>
                  <span>Log</span>
                  <CornerDownLeft size={13} style={{ opacity: 0.8 }} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Subtle Status Pill */}
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
