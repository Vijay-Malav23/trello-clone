import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Home() {
  const [workspaces, setWorkspaces] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const { workspaces: w } = await api.workspaces();
      setWorkspaces(w || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createWorkspace(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    try {
      await api.createWorkspace(name.trim());
      setName('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading)
    return (
      <div className="page-center">
        <div className="loading-block" aria-busy="true" aria-label="Loading">
          <span className="loading-spinner" />
          <span className="muted">Loading…</span>
        </div>
      </div>
    );

  return (
    <div className="page home-page">
      <header className="page-hero">
        <h1>Your workspaces</h1>
        <p className="page-lead muted">Create a workspace, then add boards and lists.</p>
      </header>
      {error && <div className="error-banner">{error}</div>}
      <form onSubmit={createWorkspace} className="create-bar inline-form">
        <input
          placeholder="New workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Workspace name"
        />
        <button type="submit" className="btn primary">
          Create workspace
        </button>
      </form>
      {workspaces.length === 0 ? (
        <div className="empty-state" role="status">
          <div className="empty-state-art" aria-hidden />
          <p className="empty-state-title">No workspaces yet</p>
          <p className="muted empty-state-hint">Name your first workspace above to get started.</p>
        </div>
      ) : (
        <ul className="workspace-grid">
          {workspaces.map((w) => (
            <li key={w._id}>
              <Link to={`/workspace/${w._id}`} className="workspace-tile">
                <span className="workspace-tile-accent" aria-hidden />
                <div className="workspace-tile-body">
                  <h2>{w.name}</h2>
                  <span className="role-pill">{w.myRole}</span>
                </div>
                <span className="workspace-tile-chevron" aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
