import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Sparkles, ExternalLink, Check, X, Activity } from 'lucide-react';

export function ApiKeyModal({ isOpen, onClose, onOpenLogs }) {
  const {
    apiKey, setApiKey,
    groqApiKey, setGroqApiKey,
    currency, setCurrency,
    currentVault
  } = useExpense();

  const [keyInput, setKeyInput] = useState(apiKey);
  const [groqInput, setGroqInput] = useState(groqApiKey);
  const [currInput, setCurrInput] = useState(currency);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e?.preventDefault();
    setApiKey(keyInput.trim());
    setGroqApiKey(groqInput.trim());
    setCurrency(currInput);
    
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1500);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ padding: '0', maxWidth: '440px', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px', height: '42px',
              background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px',
              borderRadius: '12px',
              border: '1px solid rgba(6, 182, 212, 0.3)'
            }}>
              <Sparkles size={22} color="#06b6d4" />
            </div>
            <div>
              <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>App Settings</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Active: <span style={{ color: currentVault?.isAdmin ? '#06b6d4' : '#10b981', fontWeight: '700' }}>{currentVault?.name || 'Vault'}</span>
              </p>
            </div>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '8px', borderRadius: '10px' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '24px' }}>
          <form onSubmit={handleSave}>
            {/* Gemini API Key */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                Google Gemini API Key (Primary Free AI)
              </label>
              <input
                type="password"
                className="glass-input"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="AIzaSy..."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  Receipt OCR & natural language parsing.
                </span>
                <a
                  href="https://aistudio.google.com/"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  Get Free Key <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Groq API Key Fallback */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px', color: '#8b5cf6' }}>
                Groq API Key (Fallback AI Engine)
              </label>
              <input
                type="password"
                className="glass-input"
                value={groqInput}
                onChange={(e) => setGroqInput(e.target.value)}
                placeholder="gsk_..."
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)' }}>
                  Ultra-fast backup AI model.
                </span>
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.72rem', color: '#8b5cf6', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                >
                  Get Free Key <ExternalLink size={11} />
                </a>
              </div>
            </div>

            {/* Currency Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                Preferred Currency
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                {['₹', '$', '€', '£', '¥'].map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    className={currInput === symbol ? 'btn-cyan' : 'btn-secondary'}
                    onClick={() => setCurrInput(symbol)}
                    style={{ padding: '8px', fontSize: '1rem', fontWeight: '700' }}
                  >
                    {symbol}
                  </button>
                ))}
              </div>
            </div>

            {/* System Diagnostics */}
            <div style={{ marginBottom: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenLogs && onOpenLogs()}
                style={{ width: '100%', color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)', padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }}
              >
                <Activity size={16} /> View System & AI Logs
              </button>
            </div>

            <button
              type="submit"
              className={savedSuccess ? "btn-gradient-success" : "btn-gradient"}
              style={{ width: '100%', padding: '12px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {savedSuccess ? <><Check size={18} /> Settings Saved</> : 'Save Settings'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
