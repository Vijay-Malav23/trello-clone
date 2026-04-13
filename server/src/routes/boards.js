import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { Board } from '../models/Board.js';
import { List } from '../models/List.js';
import { Card } from '../models/Card.js';
import { Comment } from '../models/Comment.js';
import { Activity } from '../models/Activity.js';
import { Notification } from '../models/Notification.js';
import { authRequired, attachUser } from '../middleware/auth.js';
import { getWorkspaceRole, getBoardAccess, canEdit } from '../lib/access.js';
import { logActivity } from '../lib/activity.js';

const router = Router();
router.use(authRequired, attachUser);

router.get('/workspace/:workspaceId', async (req, res) => {
  const access = await getWorkspaceRole(req.userId, req.params.workspaceId);
  if (!access) return res.status(404).json({ message: 'Workspace not found' });
  const boards = await Board.find({ workspaceId: access.workspace._id })
    .sort({ updatedAt: -1 })
    .lean();
  const withStar = boards.map((b) => ({
    ...b,
    starred: b.starredBy?.some((id) => id.toString() === req.userId),
  }));
  res.json({ boards: withStar });
});

router.post(
  '/',
  [
    body('workspaceId').notEmpty(),
    body('title').trim().notEmpty().withMessage('Title required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const access = await getWorkspaceRole(req.userId, req.body.workspaceId);
    if (!access) return res.status(404).json({ message: 'Workspace not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    const board = await Board.create({
      title: req.body.title,
      workspaceId: access.workspace._id,
      background: req.body.background || undefined,
    });
    await logActivity(board._id, req.userId, 'board_created', `Created board "${board.title}"`);
    res.status(201).json({ board });
  }
);

router.get('/:id/full', async (req, res) => {
  const access = await getBoardAccess(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Board not found' });
  const lists = await List.find({ boardId: access.board._id }).sort({ position: 1 }).lean();
  const listIds = lists.map((l) => l._id);
  const cards = await Card.find({ listId: { $in: listIds } })
    .populate('assignedUsers', 'name email')
    .sort({ position: 1 })
    .lean();
  const byList = {};
  for (const l of lists) byList[l._id.toString()] = [];
  for (const c of cards) {
    const key = c.listId.toString();
    if (byList[key]) byList[key].push(c);
  }
  const listsWithCards = lists.map((l) => ({
    ...l,
    cards: byList[l._id.toString()] || [],
  }));
  const boardObj = access.board.toObject();
  boardObj.starred = boardObj.starredBy?.some((id) => id.toString() === req.userId);
  res.json({
    board: boardObj,
    lists: listsWithCards,
    role: access.role,
  });
});

router.patch(
  '/:id',
  [
    body('title').optional().trim().notEmpty(),
    body('background').optional().isString(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input' });
    const access = await getBoardAccess(req.userId, req.params.id);
    if (!access) return res.status(404).json({ message: 'Board not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    if (req.body.title != null) access.board.title = req.body.title;
    if (req.body.background != null) access.board.background = req.body.background;
    await access.board.save();
    await logActivity(access.board._id, req.userId, 'board_updated', 'Board settings updated');
    res.json({ board: access.board });
  }
);

router.delete('/:id', async (req, res) => {
  const access = await getBoardAccess(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Board not found' });
  if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
  const lists = await List.find({ boardId: access.board._id });
  for (const l of lists) {
    const cards = await Card.find({ listId: l._id });
    for (const c of cards) {
      await Comment.deleteMany({ cardId: c._id });
      await Notification.deleteMany({ cardId: c._id });
    }
    await Card.deleteMany({ listId: l._id });
  }
  await List.deleteMany({ boardId: access.board._id });
  await Activity.deleteMany({ boardId: access.board._id });
  await Notification.deleteMany({ boardId: access.board._id });
  await Board.findByIdAndDelete(access.board._id);
  res.json({ ok: true });
});

router.patch('/:id/star', [body('starred').isBoolean()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'starred boolean required' });
  const access = await getBoardAccess(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Board not found' });
  const uid = req.userId;
  const ids = access.board.starredBy.map((x) => x.toString());
  if (req.body.starred && !ids.includes(uid)) {
    access.board.starredBy.push(uid);
  } else if (!req.body.starred) {
    access.board.starredBy = access.board.starredBy.filter((x) => x.toString() !== uid);
  }
  await access.board.save();
  res.json({ board: access.board, starred: req.body.starred });
});

export default router;
