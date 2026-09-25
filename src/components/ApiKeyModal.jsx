import React, { useState, useEffect } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Sparkles, ExternalLink, Check, X, Activity, Lock, Loader2, Server, Key, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

export function ApiKeyModal({ isOpen, onClose, onOpenLogs, onOpenAdmin }) {
  const {
    apiKey, setApiKey,
    groqApiKey, setGroqApiKey,
    currency, setCurrency,
    currentVault, changePassword
  } = useExpense();

  const [keyInput, setKeyInput] = useState(apiKey);
  const [groqInput, setGroqInput] = useState(groqApiKey);
  const [currInput, setCurrInput] = useState(currency);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);

  // Server AI status check
  const [serverAiStatus, setServerAiStatus] = useState(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });

  useEffect(() => {
    if (isOpen) {
      setIsCheckingServer(true);
      fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkStatus' })
      })
        .then(r => r.json())
        .then(data => {
          setServerAiStatus(data);
          setIsCheckingServer(false);
        })
        .catch(() => {
          setServerAiStatus(null);
          setIsCheckingServer(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveSettings = (e) => {
    e?.preventDefault();
    setApiKey(keyInput.trim());
    setGroqApiKey(groqInput.trim());
    setCurrency(currInput);
    
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (newPassword.length < 4) {
      setPassMsg({ text: 'New password must be at least 4 characters', type: 'error' });
      return;
    }

    setIsChangingPass(true);
    setPassMsg({ text: '', type: '' });

    const res = await changePassword(currentPassword, newPassword);
    
    if (res.success) {
      setPassMsg({ text: 'Password changed successfully!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
    } else {
      setPassMsg({ text: res.error || 'Failed to change password', type: 'error' });
    }
    
    setIsChangingPass(false);
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

        <div style={{ padding: '24px', maxHeight: '70vh', overflowY: 'auto' }}>
          
          {/* Server AI Status Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.25)',
            borderRadius: '14px',
            padding: '14px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={16} color="#06b6d4" />
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#fff' }}>Vercel Server AI</span>
              </div>
              {isCheckingServer ? (
                <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Loader2 size={12} className="animate-spin" /> Checking...
                </span>
              ) : serverAiStatus?.hasGeminiServerKey || serverAiStatus?.hasGroqServerKey ? (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: '#10b981',
                  background: 'rgba(16, 185, 129, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <CheckCircle2 size={12} /> Active in Vercel
                </span>
              ) : (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: '700',
                  color: '#f59e0b',
                  background: 'rgba(245, 158, 11, 0.15)',
                  padding: '2px 8px',
                  borderRadius: '6px'
                }}>
                  Uses GEMINI_API_KEY
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
              AI runs via secret server environment variables (<strong>GEMINI_API_KEY</strong> / <strong>GROQ_API_KEY</strong>) configured in your Vercel project dashboard.
            </p>
          </div>

          {/* Change Password Section */}
          <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
              <Lock size={16} /> Account Security
            </h4>
            
            <form onSubmit={handleChangePassword}>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>Current Password</label>
                <input
                  type="password"
                  className="glass-input"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '4px' }}>New Password</label>
                <input
                  type="password"
                  className="glass-input"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                />
              </div>
              
              {passMsg.text && (
                <div style={{
                  marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', fontSize: '0.8rem',
                  background: passMsg.type === 'error' ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                  color: passMsg.type === 'error' ? '#f43f5e' : '#10b981'
                }}>
                  {passMsg.text}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isChangingPass || !currentPassword || !newPassword}
                className="btn-secondary"
                style={{ width: '100%', padding: '9px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                {isChangingPass ? <><Loader2 size={15} className="animate-spin" /> Updating...</> : 'Update Password'}
              </button>
            </form>
          </div>

          <form onSubmit={handleSaveSettings}>
            
            {/* Preferred Currency */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '8px' }}>
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

            {/* Theme Selection */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                App Theme
              </label>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const isLight = document.documentElement.classList.toggle('light-theme');
                  localStorage.setItem('et_theme', isLight ? 'light' : 'dark');
                  setSavedSuccess(true);
                  setTimeout(() => setSavedSuccess(false), 2000);
                }}
                style={{ width: '100%', padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                Toggle Dark/Light Mode
              </button>
            </div>

            {/* Optional Collapsible: Custom Browser API Keys */}
            <div style={{ marginBottom: '20px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setShowAdvancedKeys(prev => !prev)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: 'none',
                  color: 'var(--text-dim)',
                  fontSize: '0.8rem',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Key size={14} /> Optional: Custom Browser Keys (Overrides Server)
                </span>
                {showAdvancedKeys ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {showAdvancedKeys && (
                <div style={{ padding: '14px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {/* Gemini Key Input */}
                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '4px' }}>
                      Gemini Key (Browser)
                    </label>
                    <input
                      type="password"
                      className="glass-input"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder="Leave blank to use Vercel env var"
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>

                  {/* Groq Key Input */}
                  <div style={{ marginBottom: '6px' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: '600', marginBottom: '4px', color: '#8b5cf6' }}>
                      Groq Key (Browser)
                    </label>
                    <input
                      type="password"
                      className="glass-input"
                      value={groqInput}
                      onChange={(e) => setGroqInput(e.target.value)}
                      placeholder="Leave blank to use Vercel env var"
                      style={{ fontSize: '0.8rem' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* System Diagnostics & Admin */}
            <div style={{ marginBottom: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {currentVault?.isAdmin && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => onOpenAdmin && onOpenAdmin()}
                  style={{ width: '100%', color: '#10b981', borderColor: 'rgba(16,185,129,0.3)', padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }}
                >
                  <Lock size={15} /> Manage Users & Vaults
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenLogs && onOpenLogs()}
                style={{ width: '100%', color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)', padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }}
              >
                <Activity size={15} /> View System & AI Logs
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

