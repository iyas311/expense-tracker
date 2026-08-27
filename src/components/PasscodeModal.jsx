import React, { useState } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Lock, ShieldCheck, Loader2, User } from 'lucide-react';

export function PasscodeModal() {
  const { isLoggedIn, login } = useExpense();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState(null);

  if (isLoggedIn) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username.trim() || !password.trim() || isVerifying) return;

    if (lockoutTime && Date.now() < lockoutTime) {
      const secondsLeft = Math.ceil((lockoutTime - Date.now()) / 1000);
      setErrorMsg(`Too many attempts. Locked for ${secondsLeft}s`);
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      const result = await login(username, password);
      if (!result.success) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        if (newAttempts >= 5) {
          setLockoutTime(Date.now() + 60000); // 1 minute lockout
          setErrorMsg('Account locked for 60 seconds due to too many failed attempts.');
        } else {
          setErrorMsg(result.error || 'Incorrect Username or Password');
        }
        setPassword(''); // only clear password
      } else {
        setFailedAttempts(0);
        setLockoutTime(null);
      }
    } catch (err) {
      setErrorMsg('Verification failed. Check network connection.');
    } finally {
      setIsVerifying(false);
    }
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
          <Lock size={28} color="#06b6d4" />
        </div>

        <h2 className="font-heading" style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Secure Login</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
          Enter your credentials to access your vault
        </p>

        {errorMsg && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.1)',
            border: '1px solid rgba(244, 63, 94, 0.2)',
            color: '#f43f5e',
            padding: '10px',
            borderRadius: '10px',
            fontSize: '0.85rem',
            marginBottom: '20px'
          }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-dim)' }}>Username</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: '38px', height: '42px', fontSize: '1rem' }}
                disabled={isVerifying}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', marginBottom: '6px', color: 'var(--text-dim)' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input"
                style={{ paddingLeft: '38px', height: '42px', fontSize: '1rem' }}
                disabled={isVerifying}
                required
              />
            </div>
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
            <ShieldCheck size={14} /> End-to-End Encrypted Session
          </div>

          <button
            type="submit"
            disabled={isVerifying || !username.trim() || !password.trim()}
            className="btn-gradient"
            style={{ width: '100%', padding: '13px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            {isVerifying ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Authenticating...
              </>
            ) : (
              <>
                <ShieldCheck size={18} /> Login
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
