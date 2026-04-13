import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';

export default function WorkspacePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const [workspace, setWorkspace] = useState(null);
  const [boards, setBoards] = useState([]);
  const [boardTitle, setBoardTitle] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = workspace?.myRole === 'admin';

  async function load() {
    setError('');
    try {
      const [ws, bs] = await Promise.all([api.workspace(id), api.boardsByWorkspace(id)]);
      setWorkspace(ws.workspace);
      setBoards(bs.boards || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function createBoard(e) {
    e.preventDefault();
    if (!boardTitle.trim() || !isAdmin) return;
    try {
      await api.createBoard(id, boardTitle.trim());
      setBoardTitle('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function invite(e) {
    e.preventDefault();
    if (!inviteEmail.trim() || !isAdmin) return;
    try {
      await api.inviteMember(id, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeMember(userId) {
    if (!isAdmin) return;
    try {
      await api.removeMember(id, userId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function runSearch(e) {
    e.preventDefault();
    if (!searchQ.trim()) {
      setSearchResults(null);
      return;
    }
    try {
      const { results } = await api.searchWorkspace(id, searchQ.trim());
      setSearchResults(results);
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleStar(board, starred) {
    try {
      await api.starBoard(board._id, starred);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteWs() {
    if (!confirm('Delete this workspace and all boards?')) return;
    try {
      await api.deleteWorkspace(id);
      nav('/');
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
  if (!workspace) return <div className="page">{error || 'Not found'}</div>;

  return (
    <div className="page workspace-page">
      <div className="page-head workspace-head">
        <Link to="/" className="back-link">
          ← Workspaces
        </Link>
        <div className="workspace-title-block">
          <h1>{workspace.name}</h1>
        </div>
        {isAdmin && (
          <button type="button" className="btn danger outline" onClick={deleteWs}>
            Delete workspace
          </button>
        )}
      </div>
      {error && <div className="error-banner">{error}</div>}

      <section className="section panel">
        <h2 className="panel-title">Members</h2>
        <ul className="member-list">
          <li>
            <strong>{workspace.owner?.name}</strong> <span className="muted">owner</span>
          </li>
          {workspace.members?.map((m) => (
            <li key={m.user._id}>
              {m.user.name} ({m.user.email}) — <span className="role-pill">{m.role}</span>
              {isAdmin && m.user._id !== workspace.owner._id && (
                <button type="button" className="link-btn danger" onClick={() => removeMember(m.user._id)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {isAdmin && (
          <form onSubmit={invite} className="inline-form">
            <input
              type="email"
              placeholder="Invite by email (user must be registered)"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="guest">Guest (view only)</option>
              <option value="admin">Admin</option>
            </select>
            <button type="submit" className="btn secondary">
              Invite
            </button>
          </form>
        )}
      </section>

      <section className="section panel">
        <h2 className="panel-title">Search cards</h2>
        <form onSubmit={runSearch} className="inline-form">
          <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search title or description" />
          <button type="submit" className="btn secondary">
            Search
          </button>
        </form>
        {searchResults && (
          <ul className="search-results">
            {searchResults.length === 0 && <li className="muted">No matches</li>}
            {searchResults.map((r) => (
              <li key={r.card._id}>
                <button type="button" className="link-block" onClick={() => nav(`/board/${r.board._id}`)}>
                  <strong>{r.card.title}</strong>
                  <span className="muted">
                    {' '}
                    — {r.board.title} / {r.list.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="section panel">
        <h2 className="panel-title">Boards</h2>
        {isAdmin && (
          <form onSubmit={createBoard} className="inline-form">
            <input
              placeholder="New board title"
              value={boardTitle}
              onChange={(e) => setBoardTitle(e.target.value)}
            />
            <button type="submit" className="btn primary">
              Add board
            </button>
          </form>
        )}
        <ul className="board-grid">
          {boards.map((b) => (
            <li key={b._id} className="board-tile-wrap">
              <Link
                to={`/board/${b._id}`}
                className="board-tile"
                style={{ background: b.background || undefined }}
              >
                {b.title}
              </Link>
              <button
                type="button"
                className="star-btn"
                title={b.starred ? 'Unstar' : 'Star'}
                onClick={(e) => {
                  e.preventDefault();
                  toggleStar(b, !b.starred);
                }}
              >
                {b.starred ? '★' : '☆'}
              </button>
            </li>
          ))}
        </ul>
        {boards.length === 0 && <p className="muted">No boards yet.</p>}
      </section>
    </div>
  );
}
