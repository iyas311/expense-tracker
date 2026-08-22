import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Lock, ShieldCheck } from 'lucide-react';

export function PasscodeModal() {
  const { isLoggedIn, login } = useExpense();
  const [pinInput, setPinInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  if (isLoggedIn) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const success = login(pinInput, rememberMe);
    if (!success) {
      setErrorMsg('Incorrect Security Passcode');
      setPinInput('');
    }
  };

  const handleKeyClick = (num) => {
    if (pinInput.length < 8) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    setPinInput(prev => prev.slice(0, -1));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ textAlign: 'center', maxWidth: '420px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '20px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
        }}>
          <Lock size={30} color="#38bdf8" />
        </div>

        <h2 className="font-heading" style={{ fontSize: '1.6rem', marginBottom: '6px' }}>Private Vault Lock</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px' }}>
          Enter your security PIN to access your personal expense tracker.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <input
              type="password"
              className="glass-input"
              style={{
                fontSize: '1.8rem',
                letterSpacing: '8px',
                textAlign: 'center',
                padding: '12px 16px',
                borderRadius: '16px'
              }}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="••••"
              maxLength={8}
              autoFocus
            />
          </div>

          {errorMsg && (
            <p style={{ color: 'var(--accent-rose)', fontSize: '0.82rem', marginBottom: '14px', fontWeight: '500' }}>
              {errorMsg}
            </p>
          )}

          {/* Keypad */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '20px'
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                className="btn-secondary"
                onClick={() => handleKeyClick(n.toString())}
                style={{ fontSize: '1.2rem', padding: '14px', borderRadius: '14px' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPinInput('')}
              style={{ fontSize: '0.85rem', padding: '14px', borderRadius: '14px', color: 'var(--text-muted)' }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => handleKeyClick('0')}
              style={{ fontSize: '1.2rem', padding: '14px', borderRadius: '14px' }}
            >
              0
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleBackspace}
              style={{ fontSize: '1.1rem', padding: '14px', borderRadius: '14px', color: 'var(--accent-rose)' }}
            >
              ⌫
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '20px',
            fontSize: '0.85rem',
            color: 'var(--text-muted)'
          }}>
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer', width: '16px', height: '16px' }}
            />
            <label htmlFor="remember" style={{ cursor: 'pointer' }}>
              Keep me logged in on this browser long-term
            </label>
          </div>

          <button type="submit" className="btn-gradient" style={{ width: '100%', padding: '14px', fontSize: '1rem' }}>
            <ShieldCheck size={20} /> Unlock Expense Tracker
          </button>
        </form>
      </div>
    </div>
  );
}
