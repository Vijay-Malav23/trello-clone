import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { List } from '../models/List.js';
import { Card } from '../models/Card.js';
import { Comment } from '../models/Comment.js';
import { authRequired, attachUser } from '../middleware/auth.js';
import { getBoardAccess, canEdit } from '../lib/access.js';
import { logActivity } from '../lib/activity.js';

const router = Router();
router.use(authRequired, attachUser);

router.post(
  '/',
  [body('boardId').notEmpty(), body('title').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const access = await getBoardAccess(req.userId, req.body.boardId);
    if (!access) return res.status(404).json({ message: 'Board not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    const maxPos = await List.findOne({ boardId: access.board._id }).sort({ position: -1 }).select('position');
    const position = maxPos ? maxPos.position + 1 : 0;
    const list = await List.create({
      title: req.body.title,
      boardId: access.board._id,
      position,
    });
    await logActivity(access.board._id, req.userId, 'list_created', `Added list "${list.title}"`);
    res.status(201).json({ list });
  }
);

router.patch(
  '/:id',
  [body('title').optional().trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid title' });
    const list = await List.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });
    const access = await getBoardAccess(req.userId, list.boardId);
    if (!access) return res.status(404).json({ message: 'Board not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    if (req.body.title) list.title = req.body.title;
    await list.save();
    await logActivity(access.board._id, req.userId, 'list_renamed', `Renamed list to "${list.title}"`);
    res.json({ list });
  }
);

router.delete('/:id', async (req, res) => {
  const list = await List.findById(req.params.id);
  if (!list) return res.status(404).json({ message: 'List not found' });
  const access = await getBoardAccess(req.userId, list.boardId);
  if (!access) return res.status(404).json({ message: 'Board not found' });
  if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
  const cards = await Card.find({ listId: list._id });
  for (const c of cards) await Comment.deleteMany({ cardId: c._id });
  await Card.deleteMany({ listId: list._id });
  await List.findByIdAndDelete(list._id);
  const remaining = await List.find({ boardId: list.boardId }).sort({ position: 1 });
  for (let i = 0; i < remaining.length; i++) {
    remaining[i].position = i;
    await remaining[i].save();
  }
  await logActivity(access.board._id, req.userId, 'list_deleted', 'Deleted a list');
  res.json({ ok: true });
});

router.patch(
  '/reorder',
  [body('boardId').notEmpty(), body('orderedListIds').isArray({ min: 1 })],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'boardId and orderedListIds required' });
    const access = await getBoardAccess(req.userId, req.body.boardId);
    if (!access) return res.status(404).json({ message: 'Board not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    const lists = await List.find({ boardId: access.board._id });
    const idSet = new Set(lists.map((l) => l._id.toString()));
    const ordered = req.body.orderedListIds.map(String);
    if (ordered.length !== lists.length || !ordered.every((id) => idSet.has(id))) {
      return res.status(400).json({ message: 'List IDs must match all lists on board' });
    }
    for (let i = 0; i < ordered.length; i++) {
      await List.findByIdAndUpdate(ordered[i], { position: i });
    }
    await logActivity(access.board._id, req.userId, 'lists_reordered', 'Reordered lists');
    const updated = await List.find({ boardId: access.board._id }).sort({ position: 1 });
    res.json({ lists: updated });
  }
);

export default router;
