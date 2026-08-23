import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Lock, ShieldCheck, Loader2 } from 'lucide-react';

export function PasscodeModal() {
  const { isLoggedIn, login } = useExpense();
  const [pinInput, setPinInput] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  if (isLoggedIn) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!pinInput.trim() || isVerifying) return;

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const result = await login(pinInput, rememberMe);
      if (!result.success) {
        setErrorMsg(result.error || 'Incorrect Security PIN');
        setPinInput('');
      }
    } catch (err) {
      setErrorMsg('Verification failed. Check network connection.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyClick = (num) => {
    if (pinInput.length < 8 && !isVerifying) {
      const newPin = pinInput + num;
      setPinInput(newPin);
      setErrorMsg('');
    }
  };

  const handleBackspace = () => {
    if (!isVerifying) setPinInput(prev => prev.slice(0, -1));
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          borderRadius: '18px',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
        }}>
          <Lock size={28} color="#38bdf8" />
        </div>

        <h2 className="font-heading" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Expensia Vault</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '20px' }}>
          Enter your 4+ digit PIN to unlock your private cloud vault.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ position: 'relative', marginBottom: '14px' }}>
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
              onChange={(e) => {
                setPinInput(e.target.value);
                setErrorMsg('');
              }}
              placeholder="••••"
              maxLength={8}
              disabled={isVerifying}
              autoFocus
            />
          </div>

          {errorMsg && (
            <p style={{ color: 'var(--accent-rose)', fontSize: '0.82rem', marginBottom: '14px', fontWeight: '600' }}>
              {errorMsg}
            </p>
          )}

          {/* Keypad */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginBottom: '18px'
          }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                className="btn-secondary"
                disabled={isVerifying}
                onClick={() => handleKeyClick(n.toString())}
                style={{ fontSize: '1.2rem', padding: '12px', borderRadius: '12px' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="btn-secondary"
              disabled={isVerifying}
              onClick={() => setPinInput('')}
              style={{ fontSize: '0.82rem', padding: '12px', borderRadius: '12px', color: 'var(--text-muted)' }}
            >
              Clear
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={isVerifying}
              onClick={() => handleKeyClick('0')}
              style={{ fontSize: '1.2rem', padding: '12px', borderRadius: '12px' }}
            >
              0
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={isVerifying}
              onClick={handleBackspace}
              style={{ fontSize: '1.1rem', padding: '12px', borderRadius: '12px', color: 'var(--accent-rose)' }}
            >
              ⌫
            </button>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '18px',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <input
              type="checkbox"
              id="remember"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              style={{ accentColor: 'var(--accent-cyan)', cursor: 'pointer', width: '15px', height: '15px' }}
            />
            <label htmlFor="remember" style={{ cursor: 'pointer' }}>
              Keep me unlocked on this browser
            </label>
          </div>

          <button
            type="submit"
            disabled={isVerifying || pinInput.length < 4}
            className="btn-gradient"
            style={{ width: '100%', padding: '13px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {isVerifying ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Unlocking Vault...
              </>
            ) : (
              <>
                <ShieldCheck size={18} /> Unlock Vault
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
