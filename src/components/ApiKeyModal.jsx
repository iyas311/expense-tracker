import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Sparkles, Key, ExternalLink, Check, X, ShieldAlert } from 'lucide-react';

export function ApiKeyModal({ isOpen, onClose }) {
  const { apiKey, setApiKey, currency, setCurrency, passcode, updatePasscode } = useExpense();
  const [keyInput, setKeyInput] = useState(apiKey);
  const [currInput, setCurrInput] = useState(currency);
  const [newPin, setNewPin] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e) => {
    e.preventDefault();
    setApiKey(keyInput.trim());
    setCurrency(currInput);
    if (newPin.trim().length >= 4) {
      updatePasscode(newPin.trim());
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(6, 182, 212, 0.15)',
              padding: '10px',
              borderRadius: '12px',
              border: '1px solid rgba(6, 182, 212, 0.3)'
            }}>
              <Sparkles size={22} color="#06b6d4" />
            </div>
            <div>
              <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>AI & System Settings</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Configure Free Gemini API & Preferences</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '8px', borderRadius: '10px' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          {/* Gemini API Key */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', marginBottom: '6px' }}>
              Google Gemini API Key (100% Free)
            </label>
            <input
              type="password"
              className="glass-input"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="AIzaSy..."
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                Powers receipt OCR & AI assistant.
              </span>
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                Get Free API Key <ExternalLink size={12} />
              </a>
            </div>
          </div>

          {/* Currency Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', marginBottom: '6px' }}>
              Preferred Currency Symbol
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
              {['$', '₹', '€', '£', '¥'].map((symbol) => (
                <button
                  key={symbol}
                  type="button"
                  className={currInput === symbol ? 'btn-cyan' : 'btn-secondary'}
                  onClick={() => setCurrInput(symbol)}
                  style={{ padding: '10px', fontSize: '1.1rem', fontWeight: '700' }}
                >
                  {symbol}
                </button>
              ))}
            </div>
          </div>

          {/* Change Security PIN */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: '600', marginBottom: '6px' }}>
              Change Security Passcode (Current: {passcode})
            </label>
            <input
              type="text"
              className="glass-input"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="Enter new 4+ digit PIN"
              maxLength={8}
            />
          </div>

          {savedSuccess && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              padding: '10px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              textAlign: 'center',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}>
              <Check size={16} /> Settings saved successfully!
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-gradient">
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
