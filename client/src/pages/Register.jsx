import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import LogoMark from '../components/LogoMark';

export default function Register() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await register(name, email, password);
      nav('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand" aria-hidden>
          <LogoMark size={40} className="auth-brand-logo" />
          <span className="auth-brand-name">BoardFlow</span>
        </div>
        <h1>Create account</h1>
        <p className="muted auth-tagline">Join workspaces and boards</p>
        <form onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
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
            Password (min 6)
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="btn primary">
            Register
          </button>
        </form>
        <p className="auth-footer">
          Have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
