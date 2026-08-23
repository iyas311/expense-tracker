import React, { useState, useEffect } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Sparkles, ExternalLink, Check, X, Activity, Users, Plus, Trash2, Key, Shield } from 'lucide-react';

export function ApiKeyModal({ isOpen, onClose, onOpenLogs }) {
  const {
    apiKey, setApiKey,
    groqApiKey, setGroqApiKey,
    currency, setCurrency,
    passcode, updatePasscode,
    currentVault, listVaults, createVault, deleteVault
  } = useExpense();

  const [activeSettingsTab, setActiveSettingsTab] = useState('general');
  const [keyInput, setKeyInput] = useState(apiKey);
  const [groqInput, setGroqInput] = useState(groqApiKey);
  const [currInput, setCurrInput] = useState(currency);
  const [newPin, setNewPin] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pinError, setPinError] = useState('');

  // Vault Management State
  const [vaultsList, setVaultsList] = useState([]);
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPin, setNewVaultPin] = useState('');
  const [vaultMsg, setVaultMsg] = useState({ type: '', text: '' });
  const [isCreatingVault, setIsCreatingVault] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!currentVault?.isAdmin) {
        setActiveSettingsTab('general');
        setVaultsList([]); // Clear any leaked state
      } else {
        loadVaults();
      }
    }
  }, [isOpen, currentVault?.isAdmin]);

  const loadVaults = async () => {
    const list = await listVaults();
    setVaultsList(list);
  };

  const handleCreateFriendVault = async (e) => {
    e.preventDefault();
    if (!newVaultName.trim() || newVaultPin.trim().length < 4) {
      setVaultMsg({ type: 'error', text: 'Name & 4+ digit PIN required' });
      return;
    }

    setIsCreatingVault(true);
    setVaultMsg({ type: '', text: '' });

    const res = await createVault(newVaultName.trim(), newVaultPin.trim());
    if (res.success) {
      setVaultMsg({ type: 'success', text: `Vault created for "${newVaultName}" with PIN ${newVaultPin}!` });
      setNewVaultName('');
      setNewVaultPin('');
      loadVaults();
    } else {
      setVaultMsg({ type: 'error', text: res.error || 'Failed to create vault.' });
    }
    setIsCreatingVault(false);
  };

  const handleDeleteVault = async (vId, vName) => {
    if (window.confirm(`Are you sure you want to delete "${vName}" and all its records?`)) {
      const res = await deleteVault(vId);
      if (res.success) {
        loadVaults();
      } else {
        alert(res.error || 'Failed to delete vault.');
      }
    }
  };

  if (!isOpen) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setApiKey(keyInput.trim());
    setGroqApiKey(groqInput.trim());
    setCurrency(currInput);
    setPinError('');

    if (newPin.trim().length >= 4) {
      const res = await updatePasscode(newPin.trim());
      if (!res.success) {
        setPinError(res.error || 'Failed to update PIN');
        return;
      }
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '520px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
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
              <h3 className="font-heading" style={{ fontSize: '1.25rem' }}>Settings & Vaults</h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Active: <span style={{ color: currentVault?.isAdmin ? '#06b6d4' : '#10b981', fontWeight: '700' }}>{currentVault?.name || 'Vault'}</span> {currentVault?.isAdmin && '(Admin 👑)'}
              </p>
            </div>
          </div>
          <button className="btn-secondary" onClick={onClose} style={{ padding: '8px', borderRadius: '10px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector (General vs Multi-User Vaults) */}
        {currentVault?.isAdmin && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
            <button
              type="button"
              className={activeSettingsTab === 'general' ? 'btn-cyan' : 'btn-secondary'}
              onClick={() => setActiveSettingsTab('general')}
              style={{ fontSize: '0.82rem', padding: '8px', borderRadius: '10px' }}
            >
              General & AI
            </button>
            <button
              type="button"
              className={activeSettingsTab === 'vaults' ? 'btn-cyan' : 'btn-secondary'}
              onClick={() => setActiveSettingsTab('vaults')}
              style={{ fontSize: '0.82rem', padding: '8px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              <Users size={14} /> Multi-User Vaults
            </button>
          </div>
        )}

        {(!currentVault?.isAdmin || activeSettingsTab === 'general') ? (
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

            {/* Change Security PIN */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '6px' }}>
                Change Vault PIN (Current: ••••)
              </label>
              <input
                type="text"
                className="glass-input"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="Enter new 4+ digit PIN"
                maxLength={8}
              />
              {pinError && (
                <p style={{ color: 'var(--accent-rose)', fontSize: '0.75rem', marginTop: '4px' }}>{pinError}</p>
              )}
            </div>

            {/* System Diagnostics */}
            <div style={{ marginBottom: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenLogs && onOpenLogs()}
                style={{ width: '100%', color: '#6366f1', borderColor: 'rgba(99,102,241,0.3)', padding: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '0.82rem' }}
              >
                <Activity size={15} /> View System Logs & AI Usage
              </button>
            </div>

            {savedSuccess && (
              <div style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#10b981',
                padding: '8px',
                borderRadius: '10px',
                fontSize: '0.82rem',
                textAlign: 'center',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}>
                <Check size={15} /> Settings saved successfully!
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
        ) : (
          /* Multi-User Vaults Management Tab */
          <div>
            <div style={{ marginBottom: '16px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '14px', padding: '14px' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px', color: '#818cf8' }}>
                <Shield size={16} /> Create Private Vault for Friend / Family
              </h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                Assign a name and custom 4-digit PIN. They will have their own completely isolated expenses and accounts.
              </p>

              <form onSubmit={handleCreateFriendVault} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input
                    type="text"
                    className="glass-input"
                    value={newVaultName}
                    onChange={(e) => setNewVaultName(e.target.value)}
                    placeholder="Friend's Name (e.g. Sarah)"
                    style={{ fontSize: '0.85rem' }}
                    required
                  />
                  <input
                    type="text"
                    className="glass-input"
                    value={newVaultPin}
                    onChange={(e) => setNewVaultPin(e.target.value)}
                    placeholder="4+ Digit PIN (e.g. 7788)"
                    maxLength={8}
                    style={{ fontSize: '0.85rem' }}
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isCreatingVault}
                  className="btn-gradient"
                  style={{ padding: '8px 14px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Create Vault
                </button>
              </form>

              {vaultMsg.text && (
                <p style={{
                  fontSize: '0.75rem',
                  marginTop: '8px',
                  color: vaultMsg.type === 'success' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                  fontWeight: '600'
                }}>
                  {vaultMsg.text}
                </p>
              )}
            </div>

            {/* Active Vaults List */}
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px' }}>
                Active Cloud Vaults ({vaultsList.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                {vaultsList.map(v => (
                  <div
                    key={v.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: '700' }}>{v.name}</span>
                        {v.isAdmin && (
                          <span className="badge" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', fontSize: '0.65rem' }}>
                            Admin 👑
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Key size={12} /> Unlock PIN: <span style={{ fontFamily: 'monospace', color: '#f8fafc', fontWeight: '700' }}>{v.passcode}</span>
                      </div>
                    </div>

                    {!v.isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVault(v.id, v.name)}
                        className="btn-secondary"
                        title="Delete this vault"
                        style={{ padding: '6px', color: 'var(--accent-rose)', border: 'none' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
