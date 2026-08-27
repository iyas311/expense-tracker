import React, { useState, useEffect } from 'react';
import { useExpense } from '../context/ExpenseContext';
import { Users, UserPlus, ShieldCheck, Loader2 } from 'lucide-react';

export function AdminDashboard() {
  const { currentVault, getUsers, createUser } = useExpense();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadUsers = async () => {
    setIsLoading(true);
    const data = await getUsers();
    setUsers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (currentVault?.isAdmin) {
      loadUsers();
    }
  }, [currentVault]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    
    setIsCreating(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    const res = await createUser(newUsername, newPassword, 'user');
    if (res.success) {
      setSuccessMsg(`User ${newUsername} created successfully. A new empty vault was automatically created for them.`);
      setNewUsername('');
      setNewPassword('');
      loadUsers();
    } else {
      setErrorMsg(res.error || 'Failed to create user');
    }
    setIsCreating(false);
  };

  if (!currentVault?.isAdmin) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Access Denied</div>;
  }

  return (
    <div style={{ padding: '24px 0', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(6, 182, 212, 0.3)'
        }}>
          <Users size={24} color="#06b6d4" />
        </div>
        <div>
          <h2 className="font-heading" style={{ fontSize: '1.8rem', color: '#fff' }}>User Management</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Create and manage app users</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Create User Form */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 className="font-heading" style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserPlus size={18} color="#10b981" /> Create New User
          </h3>
          
          {errorMsg && <div style={{ background: 'rgba(244,63,94,0.1)', color: '#f43f5e', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>{errorMsg}</div>}
          {successMsg && <div style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '16px' }}>{successMsg}</div>}
          
          <form onSubmit={handleCreateUser}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '8px' }}>Username</label>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="glass-input" style={{ width: '100%', padding: '12px' }} required />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '8px' }}>Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="glass-input" style={{ width: '100%', padding: '12px' }} required />
            </div>
            
            <button type="submit" disabled={isCreating} className="btn-gradient" style={{ width: '100%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {isCreating ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
              Create User & Generate Vault
            </button>
          </form>
        </div>

        {/* User List */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 className="font-heading" style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#06b6d4" /> Registered Users
          </h3>
          
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><Loader2 className="animate-spin" color="#06b6d4" /></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {users.map(user => (
                <div key={user.id} style={{ 
                  background: 'rgba(255,255,255,0.03)', 
                  border: '1px solid var(--border-light)', 
                  borderRadius: '12px', 
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '1rem', color: '#fff', marginBottom: '4px' }}>
                      {user.username}
                      {user.role === 'admin' && <span className="badge" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', marginLeft: '8px' }}>Admin</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              {users.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '20px' }}>No users found.</div>}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
