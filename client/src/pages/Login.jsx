import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import LogoMark from '../components/LogoMark';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      nav('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand" aria-hidden>
          <LogoMark size={40} className="auth-brand-logo" />
          <span className="auth-brand-name">BoardFlow</span>
        </div>
        <h1>Sign in</h1>
        <p className="muted auth-tagline">Sign in to your boards</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="btn primary">
            Sign in
          </button>
        </form>
        <p className="auth-footer">
          No account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
