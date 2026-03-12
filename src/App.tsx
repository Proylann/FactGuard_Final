import { useState, useEffect, useCallback } from 'react';
import Auth from './frontend/Auth';
import AdminPanel from './frontend/AdminPanel';
import LandingPage from './frontend/LandingPage';
import Main from './frontend/Main';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function App() {
  const [sessionRole, setSessionRole] = useState<'user' | 'admin'>(() => {
    try {
      const raw = localStorage.getItem('fg_session');
      if (!raw) return 'user';
      const parsed = JSON.parse(raw);
      return parsed?.role === 'admin' ? 'admin' : 'user';
    } catch {
      return 'user';
    }
  });

  // Initialize state from localStorage: if session exists, open dashboard
  const [authState, setAuthState] = useState<'auth' | 'landing' | 'dashboard'>(() => {
    try {
      const s = localStorage.getItem('fg_session');
      if (s) return 'dashboard';
      const saved = localStorage.getItem('authState') as 'auth' | 'landing' | 'dashboard' | null;
      return saved || 'auth';
    } catch (e) {
      return 'auth';
    }
  });

  // Save authState to localStorage whenever it changes (non-sensitive)
  useEffect(() => {
    try { localStorage.setItem('authState', authState); } catch (e) { /* ignore */ }
  }, [authState]);

  const handleAuthSuccess = (session?: any) => {
    try {
      if (session) localStorage.setItem('fg_session', JSON.stringify(session));
      else localStorage.setItem('fg_session', JSON.stringify({ authenticated: true }));
    } catch (e) { /* ignore */ }
    setSessionRole(session?.role === 'admin' ? 'admin' : 'user');
    setAuthState('dashboard');
  };

  const handleLogout = useCallback(() => {
    void (async () => {
      try {
        const raw = localStorage.getItem('fg_session');
        const parsed = raw ? JSON.parse(raw) : null;
        const token = parsed?.access_token || parsed?.token;
        if (token) {
          await fetch(`${API_BASE}/api/logout`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      } catch (e) {
        // Ignore network/storage errors and continue with local logout.
      }
    })();
    try { localStorage.removeItem('fg_session'); } catch (e) { /* ignore */ }
    setSessionRole('user');
    setAuthState('landing');
  }, []);

  return (
    <>
      {authState === 'landing' ? (
        <LandingPage onEnter={() => setAuthState('auth')} />
      ) : authState === 'auth' ? (
        <Auth onAuthSuccess={handleAuthSuccess} onBack={() => setAuthState('landing')} />
      ) : (
        sessionRole === 'admin' ? <AdminPanel onLogout={handleLogout} /> : <Main onLogout={handleLogout} />
      )}
    </>
  );
}

export default App;
