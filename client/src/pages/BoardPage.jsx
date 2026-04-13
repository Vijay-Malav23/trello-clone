import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { api } from '../api';

function formatDate(d) {
  if (!d) return '';
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : x.toLocaleDateString();
}

export default function BoardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [board, setBoard] = useState(null);
  const [lists, setLists] = useState([]);
  const [role, setRole] = useState('member');
  const [workspace, setWorkspace] = useState(null);
  const [activities, setActivities] = useState([]);
  const [showAct, setShowAct] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [newCardTitles, setNewCardTitles] = useState({});
  const [cardModal, setCardModal] = useState(null);
  const [boardTitleEdit, setBoardTitleEdit] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const canEdit = role !== 'guest';

  const load = useCallback(async () => {
    setError('');
    try {
      const full = await api.boardFull(id);
      setBoard(full.board);
      setLists(full.lists || []);
      setRole(full.role || 'member');
      setBoardTitleEdit(full.board.title);
      const ws = await api.workspace(full.board.workspaceId);
      setWorkspace(ws.workspace);
      const act = await api.activitiesForBoard(id);
      setActivities(act.activities || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function onDragEnd(result) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    if (!canEdit) return;
    try {
      await api.moveCard(draggableId, destination.droppableId, destination.index);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addList(e) {
    e.preventDefault();
    if (!newListTitle.trim() || !canEdit) return;
    try {
      await api.createList(id, newListTitle.trim());
      setNewListTitle('');
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function addCard(listId, e) {
    e.preventDefault();
    const title = (newCardTitles[listId] || '').trim();
    if (!title || !canEdit) return;
    try {
      await api.createCard({ listId, title });
      setNewCardTitles((s) => ({ ...s, [listId]: '' }));
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveBoardTitle(e) {
    e.preventDefault();
    if (!canEdit || !boardTitleEdit.trim()) return;
    try {
      await api.updateBoard(id, { title: boardTitleEdit.trim() });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteBoard() {
    if (!canEdit || !confirm('Delete this board?')) return;
    try {
      await api.deleteBoard(id);
      navigate(`/workspace/${board.workspaceId}`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading)
    return (
      <div className="page-center board-loading">
        <div className="loading-block" aria-busy="true" aria-label="Loading">
          <span className="loading-spinner" />
          <span className="muted">Loading board…</span>
        </div>
      </div>
    );
  if (!board) return <div className="page">{error || 'Board not found'}</div>;

  const memberOptions =
    workspace?.members?.map((m) => m.user) || [];
  const ownerUser = workspace?.owner;
  const allUsers = ownerUser
    ? [ownerUser, ...memberOptions.filter((u) => u._id !== ownerUser._id)]
    : memberOptions;

  return (
    <div className="board-page-outer" style={{ background: board.background }}>
      {error && <div className="error-banner floating">{error}</div>}
      <div className="board-toolbar">
        <Link to={`/workspace/${board.workspaceId}`} className="back-link light">
          ← Workspace
        </Link>
        {canEdit ? (
          <form onSubmit={saveBoardTitle} className="board-title-form">
            <input
              className="board-title-input"
              value={boardTitleEdit}
              onChange={(e) => setBoardTitleEdit(e.target.value)}
            />
            <button type="submit" className="btn small secondary">
              Save title
            </button>
          </form>
        ) : (
          <h1 className="board-title-static">{board.title}</h1>
        )}
        <div className="toolbar-actions">
          <button type="button" className="btn ghost light" onClick={() => setShowAct(!showAct)}>
            Activity
          </button>
          {canEdit && (
            <button type="button" className="btn danger outline light" onClick={deleteBoard}>
              Delete board
            </button>
          )}
        </div>
      </div>

      <div className="board-columns-wrap">
        <DragDropContext onDragEnd={onDragEnd}>
          {lists.map((list) => (
            <div key={list._id} className="list-column">
              <div className="list-header">
                <h3>{list.title}</h3>
                {canEdit && (
                  <button
                    type="button"
                    className="link-btn light"
                    onClick={() => {
                      const t = prompt('Rename list', list.title);
                      if (t?.trim()) api.updateList(list._id, t.trim()).then(load);
                    }}
                  >
                    ⋮
                  </button>
                )}
              </div>
              <Droppable droppableId={String(list._id)} type="CARD">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`card-list ${snapshot.isDraggingOver ? 'drag-over' : ''}`}
                  >
                    {(list.cards || []).map((card, index) => (
                      <Draggable key={card._id} draggableId={String(card._id)} index={index} isDragDisabled={!canEdit}>
                        {(p, snap) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            className={`card-item ${snap.isDragging ? 'dragging' : ''}`}
                          >
                            <div className="card-item-top">
                              <span className="drag-handle" {...p.dragHandleProps} title="Drag">
                                ⋮⋮
                              </span>
                              <button
                                type="button"
                                className="card-open-btn"
                                onClick={() => setCardModal(card)}
                              >
                                <span className="card-title">{card.title}</span>
                              </button>
                            </div>
                            {card.dueDate && <span className="due-chip">{formatDate(card.dueDate)}</span>}
                            {card.assignedUsers?.length > 0 && (
                              <div className="assignees">
                                {card.assignedUsers.map((u) => (
                                  <span key={u._id} className="avatar" title={u.name}>
                                    {u.name?.charAt(0).toUpperCase()}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              {canEdit && (
                <form onSubmit={(e) => addCard(list._id, e)} className="add-card-form">
                  <input
                    placeholder="Add a card"
                    value={newCardTitles[list._id] || ''}
                    onChange={(e) => setNewCardTitles((s) => ({ ...s, [list._id]: e.target.value }))}
                  />
                  <button type="submit" className="btn small primary">
                    Add
                  </button>
                </form>
              )}
              {canEdit && (
                <button
                  type="button"
                  className="link-btn danger small"
                  onClick={() => {
                    if (confirm('Delete this list and its cards?')) api.deleteList(list._id).then(load);
                  }}
                >
                  Delete list
                </button>
              )}
            </div>
          ))}
        </DragDropContext>

        {canEdit && (
          <form onSubmit={addList} className="list-column add-list-column">
            <input placeholder="New list title" value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} />
            <button type="submit" className="btn secondary">
              Add list
            </button>
          </form>
        )}
      </div>

      {showAct && (
        <aside className="activity-drawer">
          <h3>Activity</h3>
          <ul>
            {activities.map((a) => (
              <li key={a._id}>
                <strong>{a.userId?.name || 'User'}</strong> {a.action}
                {a.details && <span className="muted"> — {a.details}</span>}
                <div className="muted small">{new Date(a.createdAt).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </aside>
      )}

      {cardModal && (
        <CardModal
          card={cardModal}
          canEdit={canEdit}
          users={allUsers}
          onClose={() => setCardModal(null)}
          onSaved={load}
          onDelete={() => {
            api.deleteCard(cardModal._id).then(() => {
              setCardModal(null);
              load();
            });
          }}
        />
      )}
    </div>
  );
}

function CardModal({ card, canEdit, users, onClose, onSaved, onDelete }) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description || '');
  const [dueDate, setDueDate] = useState(card.dueDate ? String(card.dueDate).slice(0, 10) : '');
  const [assigned, setAssigned] = useState(
    () => (card.assignedUsers || []).map((u) => String(u._id || u))
  );
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || '');
    setDueDate(card.dueDate ? String(card.dueDate).slice(0, 10) : '');
    setAssigned((card.assignedUsers || []).map((u) => String(u._id || u)));
    setErr('');
  }, [card._id]);

  useEffect(() => {
    api.commentsForCard(card._id).then((d) => setComments(d.comments || []));
  }, [card._id]);

  async function save() {
    setErr('');
    try {
      await api.updateCard(card._id, {
        title: title.trim(),
        description,
        dueDate: dueDate || null,
        assignedUsers: assigned,
      });
      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function postComment(e) {
    e.preventDefault();
    if (!commentText.trim() || !canEdit) return;
    try {
      await api.addComment(card._id, commentText.trim());
      setCommentText('');
      const d = await api.commentsForCard(card._id);
      setComments(d.comments || []);
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal card-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <button type="button" className="modal-close" onClick={onClose}>
          ×
        </button>
        {err && <div className="error-banner">{err}</div>}
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} disabled={!canEdit} />
        </label>
        <label>
          Due date
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={!canEdit} />
        </label>
        {canEdit && users.length > 0 && (
          <label>
            Assigned
            <select
              multiple
              value={assigned}
              onChange={(e) =>
                setAssigned(Array.from(e.target.selectedOptions, (o) => o.value))
              }
              className="multi-select"
            >
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
            <span className="muted small">Hold Ctrl/Cmd to select multiple</span>
          </label>
        )}
        {canEdit && (
          <div className="modal-actions">
            <button type="button" className="btn primary" onClick={save}>
              Save
            </button>
            <button type="button" className="btn danger outline" onClick={onDelete}>
              Delete card
            </button>
          </div>
        )}
        <h4>Comments</h4>
        <ul className="comment-list">
          {comments.map((c) => (
            <li key={c._id}>
              <strong>{c.userId?.name}</strong>: {c.text}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form onSubmit={postComment} className="comment-form">
            <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment" />
            <button type="submit" className="btn secondary">
              Comment
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
