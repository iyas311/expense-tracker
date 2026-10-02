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
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
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
            {this.props.fallbackTitle || 'Something went wrong in this section'}
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '400px', margin: '0 auto 16px' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred. The rest of your app is still running safely.'}
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: '8px'
            }}
          >
            <RefreshCw size={14} /> Try Reloading Component
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
