const getToken = () => localStorage.getItem('token');

async function request(path, options = {}) {
  const headers = { ...options.headers };
  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: () => request('/auth/me'),
  updateProfile: (body) => request('/auth/profile', { method: 'PATCH', body }),

  workspaces: () => request('/workspaces'),
  workspace: (id) => request(`/workspaces/${id}`),
  createWorkspace: (name) => request('/workspaces', { method: 'POST', body: { name } }),
  updateWorkspace: (id, name) => request(`/workspaces/${id}`, { method: 'PATCH', body: { name } }),
  deleteWorkspace: (id) => request(`/workspaces/${id}`, { method: 'DELETE' }),
  inviteMember: (id, email, role) =>
    request(`/workspaces/${id}/members`, { method: 'POST', body: { email, role } }),
  removeMember: (id, userId) => request(`/workspaces/${id}/members/${userId}`, { method: 'DELETE' }),
  updateMemberRole: (id, userId, role) =>
    request(`/workspaces/${id}/members/${userId}`, { method: 'PATCH', body: { role } }),
  searchWorkspace: (id, q) => request(`/workspaces/${id}/search?q=${encodeURIComponent(q)}`),

  boardsByWorkspace: (workspaceId) => request(`/boards/workspace/${workspaceId}`),
  createBoard: (workspaceId, title, background) =>
    request('/boards', { method: 'POST', body: { workspaceId, title, background } }),
  boardFull: (id) => request(`/boards/${id}/full`),
  updateBoard: (id, body) => request(`/boards/${id}`, { method: 'PATCH', body }),
  deleteBoard: (id) => request(`/boards/${id}`, { method: 'DELETE' }),
  starBoard: (id, starred) => request(`/boards/${id}/star`, { method: 'PATCH', body: { starred } }),

  createList: (boardId, title) => request('/lists', { method: 'POST', body: { boardId, title } }),
  updateList: (id, title) => request(`/lists/${id}`, { method: 'PATCH', body: { title } }),
  deleteList: (id) => request(`/lists/${id}`, { method: 'DELETE' }),
  reorderLists: (boardId, orderedListIds) =>
    request('/lists/reorder', { method: 'PATCH', body: { boardId, orderedListIds } }),

  createCard: (body) => request('/cards', { method: 'POST', body }),
  updateCard: (id, body) => request(`/cards/${id}`, { method: 'PATCH', body }),
  deleteCard: (id) => request(`/cards/${id}`, { method: 'DELETE' }),
  moveCard: (id, listId, position) =>
    request(`/cards/${id}/move`, { method: 'PATCH', body: { listId, position } }),

  commentsForCard: (cardId) => request(`/comments/card/${cardId}`),
  addComment: (cardId, text) => request('/comments', { method: 'POST', body: { cardId, text } }),
  deleteComment: (id) => request(`/comments/${id}`, { method: 'DELETE' }),

  notifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  activitiesForBoard: (boardId) => request(`/activities/board/${boardId}`),
};
