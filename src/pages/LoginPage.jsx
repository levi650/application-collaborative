import { useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';

/**
 * LoginPage – login form with email/password, error display, loading state.
 */
export default function LoginPage() {
  const { login, loading, error: authError, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/grades', { replace: true });
    } catch { /* error is handled by AuthProvider */ }
  }, [email, password, login, navigate]);

  // If session is restoring from sessionStorage, show loading
  if (loading) {
    return (
      <div className="loading-state">
        <span className="spinner lg" />
        <span>Chargement…</span>
      </div>
    );
  }

  // Redirect if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/grades" replace />;
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="logo">
          <h1>📊 GradeSync</h1>
          <p>Application collaborative de gestion des notes</p>
        </div>

        {authError && <div className="login-error">{authError}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Adresse e-mail</label>
            <input
              id="login-email"
              className="input"
              type="email"
              placeholder="exemple@test.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Mot de passe</label>
            <input
              id="login-password"
              className="input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" /> Connexion…</> : 'Se connecter'}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <p style={{ fontWeight: 600, marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>Comptes de test :</p>
          <p>admin@test.com / admin123 (Admin)</p>
          <p>teacher1@test.com / teacher123 (Enseignant)</p>
          <p>teacher2@test.com / teacher123 (Enseignant)</p>
          <p>student1@test.com / student123 (Étudiant)</p>
        </div>
      </div>
    </div>
  );
}
