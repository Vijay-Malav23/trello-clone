import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import LogoMark from './LogoMark';

function userInitials(name) {
  if (!name || typeof name !== 'string') return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const a = parts[0].charAt(0);
  const b = parts.length > 1 ? parts[parts.length - 1].charAt(0) : '';
  return (a + b).toUpperCase();
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const notifWrapRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    api
      .notifications()
      .then((d) => setNotifications(d.notifications || []))
      .catch(() => {});
  }, [user, notifOpen]);

  useEffect(() => {
    if (!notifOpen) return;
    const onPointerDown = (e) => {
      if (notifWrapRef.current && !notifWrapRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [notifOpen]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <Link to="/" className="logo">
          <LogoMark size={28} />
          BoardFlow
        </Link>
        <nav className="top-nav">
          {user && (
            <>
              <div className="notif-wrap" ref={notifWrapRef}>
                <button
                  type="button"
                  className="btn ghost icon-btn notif-btn"
                  onClick={() => setNotifOpen(!notifOpen)}
                  aria-label="Notifications"
                  aria-expanded={notifOpen}
                >
                  <svg className="icon-svg" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d="M12 3a5 5 0 00-5 5v2.382c0 .898-.372 1.755-1.03 2.368l-.32.298A1 1 0 006.05 15h11.9a1 1 0 00.68-1.952l-.32-.298A3.2 3.2 0 0117 10.382V8a5 5 0 00-5-5z"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M10 18a2 2 0 004 0"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                    />
                  </svg>
                  {unread > 0 && <span className="badge">{unread > 9 ? '9+' : unread}</span>}
                </button>
                {notifOpen && (
                  <div className="notif-dropdown">
                    <div className="notif-head">
                      <span>Notifications</span>
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() =>
                          api.markAllNotificationsRead().then(() => setNotifications((n) => n.map((x) => ({ ...x, read: true }))))
                        }
                      >
                        Mark all read
                      </button>
                    </div>
                    <ul className="notif-list">
                      {notifications.length === 0 && <li className="muted notif-empty">No notifications</li>}
                      {notifications.map((n) => (
                        <li key={n._id}>
                          <button
                            type="button"
                            className={`notif-item ${n.read ? '' : 'unread'}`}
                            onClick={() => {
                              if (!n.read) api.markNotificationRead(n._id);
                              setNotifications((prev) =>
                                prev.map((x) => (x._id === n._id ? { ...x, read: true } : x))
                              );
                              if (n.boardId) nav(`/board/${String(n.boardId)}`);
                              setNotifOpen(false);
                            }}
                          >
                            {n.message}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div
                className="user-profile"
                title={user.email ? `${user.name} · ${user.email}` : user.name}
              >
                <span className="user-avatar" aria-hidden>
                  {userInitials(user.name)}
                </span>
                <div className="user-profile-meta">
                  <span className="user-profile-name">{user.name}</span>
                  {user.email ? (
                    <span className="user-profile-email">{user.email}</span>
                  ) : null}
                </div>
              </div>
              <button type="button" className="btn header-logout" onClick={logout}>
                Log out
              </button>
            </>
          )}
        </nav>
      </header>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
