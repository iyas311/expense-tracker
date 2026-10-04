import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    const msg = error?.message || '';
    if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
      const reloaded = sessionStorage.getItem('et_chunk_auto_reloaded');
      if (!reloaded) {
        sessionStorage.setItem('et_chunk_auto_reloaded', 'true');
        window.location.reload();
      }
    }
  }

  handleReset = () => {
    const msg = this.state.error?.message || '';
    if (msg.includes('Failed to fetch dynamically imported module') || msg.includes('Importing a module script failed')) {
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = Boolean(
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Importing a module script failed')
      );

      return (
        <div style={{
          padding: '28px 20px',
          margin: '16px 0',
          borderRadius: '16px',
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.25)',
          color: '#fff',
          textAlign: 'center'
        }}>
          <div style={{ display: 'inline-flex', padding: '10px', background: 'rgba(244, 63, 94, 0.15)', borderRadius: '50%', marginBottom: '12px' }}>
            <AlertTriangle size={24} color="#f43f5e" />
          </div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '6px' }}>
            {isChunkError ? 'New App Version Available' : (this.props.fallbackTitle || 'Something went wrong in this section')}
          </h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '420px', margin: '0 auto 16px', lineHeight: 1.5 }}>
            {isChunkError
              ? 'A fresh update was just deployed to Expensia. Click below to load the latest version.'
              : (this.state.error?.message || 'An unexpected rendering error occurred. The rest of your app is still running safely.')}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="btn-cyan"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 18px',
              fontSize: '0.82rem',
              borderRadius: '10px'
            }}
          >
            <RefreshCw size={14} /> {isChunkError ? 'Refresh & Update App' : 'Try Reloading Component'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
