import React, { useState, useEffect, useRef } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Sparkles, ExternalLink, Check, X, Activity, Lock, Loader2, Server, Key, ChevronDown, ChevronUp, CheckCircle2, Download, FileText, Database, Upload, Calendar, Mail, Copy } from 'lucide-react';

export function ApiKeyModal({ isOpen, onClose, onOpenLogs, onOpenAdmin }) {
  const {
    apiKey, setApiKey,
    groqApiKey, setGroqApiKey,
    currency, setCurrency,
    currentVault, changePassword,
    exportData, exportPdfStatement,
    exportVaultBackup, restoreVaultBackup
  } = useExpense();

  const [keyInput, setKeyInput] = useState(apiKey);
  const [groqInput, setGroqInput] = useState(groqApiKey);
  const [currInput, setCurrInput] = useState(currency);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false);

  // Server AI status check
  const [serverAiStatus, setServerAiStatus] = useState(null);
  const [isCheckingServer, setIsCheckingServer] = useState(false);

  // Vault Backup & Restore State
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState({ text: '', type: '' });
  const fileInputRef = useRef(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passMsg, setPassMsg] = useState({ text: '', type: '' });

  // Calendar Feed & Email Alerts state
  const [copiedCalendar, setCopiedCalendar] = useState(false);
  const [alertEmail, setAlertEmail] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState({ text: '', type: '' });

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        if (!json.transactions && !json.accounts) {
          throw new Error('Not a valid Expensia vault backup file.');
        }

        const txCount = json.transactions?.length || 0;
        const accCount = json.accounts?.length || 0;
        const debtCount = json.debts?.length || 0;

        if (!window.confirm(`Found backup containing:\n• ${accCount} Accounts\n• ${txCount} Transactions\n• ${debtCount} Debts\n\nDo you want to restore this into your active vault?`)) {
          return;
        }

        setIsRestoring(true);
        setRestoreStatus({ text: 'Restoring backup data...', type: 'info' });
        const res = await restoreVaultBackup(json);
        if (res.success) {
          setRestoreStatus({ text: `✓ Successfully restored ${txCount} transactions and ${debtCount} debts!`, type: 'success' });
        } else {
          setRestoreStatus({ text: res.error || 'Failed to restore backup', type: 'error' });
        }
      } catch (err) {
        setRestoreStatus({ text: err.message || 'Invalid JSON file', type: 'error' });
      } finally {
        setIsRestoring(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

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

  const calendarUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar?vault=${currentVault?.id || 'vault_admin'}&key=1122`
    : '';
  const webcalUrl = calendarUrl.replace(/^https?:/, 'webcal:');
  const googleCalUrl = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`;

  const handleCopyCalendar = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(calendarUrl);
      setCopiedCalendar(true);
      setTimeout(() => setCopiedCalendar(false), 2000);
    }
  };

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setEmailStatus({ text: 'Sending test email via Resend...', type: 'info' });
    try {
      const res = await fetch('/api/email-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          payload: {
            vaultId: currentVault?.id || 'vault_admin',
            recipientEmail: alertEmail.trim() || undefined
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setEmailStatus({ text: `✓ Test email sent successfully to ${data.sentTo}! Check your inbox.`, type: 'success' });
      } else {
        setEmailStatus({ text: `Error: ${data.error || 'Failed to send'}`, type: 'error' });
      }
    } catch (e) {
      setEmailStatus({ text: 'Network error: ' + e.message, type: 'error' });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

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

            {/* Export & Reports */}
            <div style={{ marginBottom: '18px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '600', marginBottom: '8px', color: 'var(--text-muted)' }}>
                Export & Reports
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => exportData && exportData()}
                  style={{ padding: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Download size={14} /> Export CSV
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => exportPdfStatement && exportPdfStatement()}
                  style={{ padding: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#38bdf8', borderColor: 'rgba(6,182,212,0.3)' }}
                >
                  <FileText size={14} /> PDF Statement
                </button>
              </div>
            </div>

            {/* Complete Vault Backup & Restore */}
            <div style={{ marginBottom: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                  <Database size={14} color="#06b6d4" /> Complete Vault Backup & Restore
                </label>
                <span style={{ fontSize: '0.65rem', color: '#10b981', background: 'rgba(16,185,129,0.12)', padding: '1px 6px', borderRadius: '8px', fontWeight: '700' }}>
                  JSON
                </span>
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginBottom: '10px', lineHeight: '1.4' }}>
                Download a complete disaster-recovery backup of all accounts, transactions, debts, and budgets.
              </p>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button
                  type="button"
                  className="btn-cyan"
                  onClick={exportVaultBackup}
                  style={{ padding: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px' }}
                >
                  <Download size={14} /> Download Backup
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isRestoring}
                  onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '8px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px' }}
                >
                  <Upload size={14} /> {isRestoring ? 'Restoring...' : 'Restore Backup'}
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
              </div>

              {restoreStatus.text && (
                <div style={{
                  marginTop: '8px', padding: '6px 10px', borderRadius: '8px', fontSize: '0.73rem',
                  background: restoreStatus.type === 'success' ? 'rgba(16,185,129,0.15)' : restoreStatus.type === 'error' ? 'rgba(244,63,94,0.15)' : 'rgba(99,102,241,0.15)',
                  color: restoreStatus.type === 'success' ? '#10b981' : restoreStatus.type === 'error' ? '#f43f5e' : '#818cf8',
                  border: `1px solid ${restoreStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : restoreStatus.type === 'error' ? 'rgba(244,63,94,0.3)' : 'rgba(99,102,241,0.3)'}`
                }}>
                  {restoreStatus.text}
                </div>
              )}
            </div>

            {/* ─── Google Calendar / iCal Feed Sync ─── */}
            <div style={{ marginBottom: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Calendar size={16} color="#06b6d4" />
                <label style={{ fontSize: '0.86rem', fontWeight: '700', color: '#fff' }}>Calendar Feed (Due Dates & Subscriptions)</label>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '10px', lineHeight: 1.4 }}>
                Subscribe to your live bill due dates and recurring subscriptions in Google Calendar, Apple iCal, or Outlook.
              </p>
              
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="text"
                  readOnly
                  value={calendarUrl}
                  className="glass-input"
                  style={{ fontSize: '0.74rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)' }}
                />
                <button
                  type="button"
                  onClick={handleCopyCalendar}
                  className="btn-secondary"
                  style={{ padding: '0 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                >
                  {copiedCalendar ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copiedCalendar ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <a
                  href={googleCalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary"
                  style={{ padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textDecoration: 'none', color: '#38bdf8' }}
                >
                  <ExternalLink size={13} /> Add to Google Cal
                </a>
                <a
                  href={calendarUrl}
                  download="expensia_calendar.ics"
                  className="btn-secondary"
                  style={{ padding: '8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', borderRadius: '10px', textDecoration: 'none' }}
                >
                  <Download size={13} /> Download .ics
                </a>
              </div>
            </div>

            {/* ─── Resend Email Alerts ─── */}
            <div style={{ marginBottom: '20px', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <Mail size={16} color="#f59e0b" />
                <label style={{ fontSize: '0.86rem', fontWeight: '700', color: '#fff' }}>Email Alerts (Resend)</label>
              </div>
              <p style={{ fontSize: '0.74rem', color: 'var(--text-dim)', marginBottom: '10px', lineHeight: 1.4 }}>
                Receive automatic morning reminders 2-3 days before credit card bills are due. Leave blank to use your default Vercel / Resend email.
              </p>

              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="email"
                  placeholder="e.g. Leave blank to use default email"
                  value={alertEmail}
                  onChange={(e) => setAlertEmail(e.target.value)}
                  className="glass-input"
                  style={{ fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={handleSendTestEmail}
                  disabled={isSendingTestEmail}
                  className="btn-secondary"
                  style={{ padding: '0 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap', borderColor: 'rgba(245,158,11,0.3)', color: '#f59e0b' }}
                >
                  {isSendingTestEmail ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
                  {isSendingTestEmail ? 'Sending...' : 'Test Send'}
                </button>
              </div>

              {emailStatus.text && (
                <div style={{
                  padding: '6px 10px', borderRadius: '8px', fontSize: '0.73rem',
                  background: emailStatus.type === 'success' ? 'rgba(16,185,129,0.15)' : emailStatus.type === 'error' ? 'rgba(244,63,94,0.15)' : 'rgba(99,102,241,0.15)',
                  color: emailStatus.type === 'success' ? '#10b981' : emailStatus.type === 'error' ? '#f43f5e' : '#818cf8',
                  border: `1px solid ${emailStatus.type === 'success' ? 'rgba(16,185,129,0.3)' : emailStatus.type === 'error' ? 'rgba(244,63,94,0.3)' : 'rgba(99,102,241,0.3)'}`
                }}>
                  {emailStatus.text}
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

