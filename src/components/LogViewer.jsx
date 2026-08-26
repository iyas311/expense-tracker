import React, { useState, useEffect } from 'react';
import { X, RefreshCw, Trash2, Activity, Cpu, AlertTriangle, CheckCircle, MessageSquare, Clock } from 'lucide-react';

export function LogViewer({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('prompts'); // 'prompts' | 'logs'
  const [logs, setLogs] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getLogs', payload: {} })
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'getPromptHistory', payload: {} })
      });
      if (res.ok) {
        const data = await res.json();
        setPrompts(data.history || []);
      }
    } catch (e) {
      setPrompts([]);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearLogs', payload: {} })
      });
      setLogs([]);
    } catch (e) {}
  };

  const clearPrompts = async () => {
    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clearPromptHistory', payload: {} })
      });
      setPrompts([]);
    } catch (e) {}
  };

  const handleRefresh = () => {
    if (activeTab === 'logs') fetchLogs();
    else fetchPrompts();
  };

  const handleClear = () => {
    if (activeTab === 'logs') clearLogs();
    else clearPrompts();
  };

  useEffect(() => {
    if (isOpen) {
      fetchPrompts();
      fetchLogs();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) handleRefresh();
  }, [activeTab]);

  if (!isOpen) return null;

  const getLevelConfig = (level) => {
    switch (level) {
      case 'info': return { color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: <CheckCircle size={13} /> };
      case 'warn': return { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: <AlertTriangle size={13} /> };
      case 'error': return { color: '#f43f5e', bg: 'rgba(244,63,94,0.1)', icon: <AlertTriangle size={13} /> };
      default: return { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', icon: <Activity size={13} /> };
    }
  };

  const getAiBadge = (meta) => {
    if (!meta?.aiUsed) return null;
    const colors = { gemini: '#4285f4', groq: '#ff6b35', local_fallback: '#94a3b8', none: '#64748b' };
    const color = colors[meta.aiUsed] || '#64748b';
    return (
      <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: '700', background: `${color}20`, color, border: `1px solid ${color}40`, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        <Cpu size={10} /> {meta.aiUsed.toUpperCase()}
      </span>
    );
  };

  const tabStyle = (isActive) => ({
    padding: '7px 16px',
    borderRadius: '10px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
    background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
    color: isActive ? '#818cf8' : '#94a3b8',
    borderBottom: isActive ? '2px solid #818cf8' : '2px solid transparent',
  });

  return (
    <div className="modal-overlay">
      <div className="modal-content animate-fade-in" style={{ maxWidth: '760px', width: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <h3 className="font-heading" style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={20} color="#6366f1" /> AI Activity
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Prompt history & system logs
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleRefresh} className="btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={handleClear} className="btn-secondary" style={{ padding: '7px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', color: '#f43f5e' }}>
              <Trash2 size={13} /> Clear
            </button>
            <button onClick={onClose} className="btn-secondary" style={{ padding: '7px' }}>
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: '0' }}>
          <button style={tabStyle(activeTab === 'prompts')} onClick={() => setActiveTab('prompts')}>
            <MessageSquare size={14} /> Prompt History
            {prompts.length > 0 && (
              <span style={{ background: '#6366f1', color: '#fff', borderRadius: '20px', fontSize: '0.65rem', padding: '1px 6px', fontWeight: '700' }}>
                {prompts.length}
              </span>
            )}
          </button>
          <button style={tabStyle(activeTab === 'logs')} onClick={() => setActiveTab('logs')}>
            <Activity size={14} /> System Logs
            {logs.length > 0 && (
              <span style={{ background: logs.filter(l => l.level === 'error').length > 0 ? '#f43f5e' : '#6366f1', color: '#fff', borderRadius: '20px', fontSize: '0.65rem', padding: '1px 6px', fontWeight: '700' }}>
                {logs.length}
              </span>
            )}
          </button>
        </div>

        {/* Prompt History Tab */}
        {activeTab === 'prompts' && (
          <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {loading && (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Loading...</div>
            )}
            {!loading && prompts.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                <MessageSquare size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
                <p>No prompts yet. Start logging expenses with natural language!</p>
                <p style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.6 }}>e.g. "burger 60 and groceries 100"</p>
              </div>
            )}
            {!loading && prompts.map(p => {
              const time = new Date(p.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
              return (
                <div key={p.id} style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <MessageSquare size={14} color="#818cf8" style={{ marginTop: '3px', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>"{p.text}"</p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={10} /> {time}
                      </span>
                      <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '1px 8px', borderRadius: '20px', fontWeight: '700' }}>
                        {p.txCount} tx logged
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* System Logs Tab */}
        {activeTab === 'logs' && (
          <>
            {logs.length > 0 && (
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                {['gemini', 'groq', 'local_fallback'].map(ai => {
                  const count = logs.filter(l => l.meta?.aiUsed === ai).length;
                  if (count === 0) return null;
                  const colors = { gemini: '#4285f4', groq: '#ff6b35', local_fallback: '#94a3b8' };
                  return (
                    <div key={ai} style={{ padding: '6px 14px', borderRadius: '20px', background: `${colors[ai]}15`, border: `1px solid ${colors[ai]}30`, fontSize: '0.75rem', color: colors[ai], fontWeight: '700' }}>
                      {ai.replace('_', ' ').toUpperCase()}: {count} calls
                    </div>
                  );
                })}
                <div style={{ padding: '6px 14px', borderRadius: '20px', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', fontSize: '0.75rem', color: '#f43f5e', fontWeight: '700' }}>
                  ERRORS: {logs.filter(l => l.level === 'error').length}
                </div>
              </div>
            )}
            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>Loading logs...</div>
              )}
              {!loading && logs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  <Activity size={36} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>No logs yet. Logs appear when AI features are used.</p>
                  <p style={{ fontSize: '0.78rem', marginTop: '6px', opacity: 0.6 }}>Make sure GEMINI_API_KEY or GROQ_API_KEY is set in Vercel env vars.</p>
                </div>
              )}
              {!loading && logs.map(log => {
                const lvl = getLevelConfig(log.level);
                const time = new Date(log.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <div key={log.id} style={{ background: lvl.bg, border: `1px solid ${lvl.color}25`, borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ color: lvl.color, marginTop: '2px', flexShrink: 0 }}>{lvl.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontFamily: 'monospace' }}>{time}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '700', color: lvl.color, textTransform: 'uppercase' }}>{log.level}</span>
                        {getAiBadge(log.meta)}
                        {log.meta?.latencyMs && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-dim)' }}>{log.meta.latencyMs}ms</span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>{log.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
