import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import mongoose from 'mongoose';
import { List } from '../models/List.js';
import { Card } from '../models/Card.js';
import { Comment } from '../models/Comment.js';
import { Notification } from '../models/Notification.js';
import { authRequired, attachUser } from '../middleware/auth.js';
import { getCardAccess, getListAccess, canEdit } from '../lib/access.js';
import { logActivity } from '../lib/activity.js';
import { notifyUsers } from '../lib/notify.js';

const router = Router();
router.use(authRequired, attachUser);

router.post(
  '/',
  [
    body('listId').notEmpty(),
    body('title').trim().notEmpty(),
    body('description').optional().isString(),
    body('dueDate').optional().isISO8601(),
    body('assignedUsers').optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const access = await getListAccess(req.userId, req.body.listId);
    if (!access) return res.status(404).json({ message: 'List not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    const maxPos = await Card.findOne({ listId: access.list._id }).sort({ position: -1 }).select('position');
    const position = maxPos ? maxPos.position + 1 : 0;
    const assigned = (req.body.assignedUsers || [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
    const card = await Card.create({
      title: req.body.title,
      description: req.body.description || '',
      listId: access.list._id,
      position,
      assignedUsers: assigned,
      dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
    });
    const populated = await Card.findById(card._id).populate('assignedUsers', 'name email');
    await logActivity(access.board._id, req.userId, 'card_created', `Created card "${card.title}"`, card._id);
    const assignNotify = assigned.map((id) => id.toString()).filter((id) => id !== req.userId);
    if (assignNotify.length) {
      await notifyUsers(assignNotify, `You were assigned to "${card.title}"`, {
        type: 'assign',
        boardId: access.board._id,
        cardId: card._id,
      });
    }
    res.status(201).json({ card: populated });
  }
);

router.patch(
  '/:id',
  [
    body('title').optional().trim().notEmpty(),
    body('description').optional().isString(),
    body('dueDate').optional({ nullable: true }).isISO8601(),
    body('assignedUsers').optional().isArray(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid input' });
    const access = await getCardAccess(req.userId, req.params.id);
    if (!access) return res.status(404).json({ message: 'Card not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    const prevAssigned = new Set((access.card.assignedUsers || []).map((id) => id.toString()));
    if (req.body.title != null) access.card.title = req.body.title;
    if (req.body.description != null) access.card.description = req.body.description;
    if (req.body.dueDate !== undefined) {
      access.card.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }
    if (req.body.assignedUsers != null) {
      access.card.assignedUsers = req.body.assignedUsers
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));
    }
    await access.card.save();
    const populated = await Card.findById(access.card._id).populate('assignedUsers', 'name email');
    await logActivity(access.board._id, req.userId, 'card_updated', `Updated "${populated.title}"`, populated._id);
    const newAssigned = new Set((populated.assignedUsers || []).map((u) => u._id.toString()));
    for (const id of newAssigned) {
      if (!prevAssigned.has(id) && id !== req.userId) {
        await notifyUsers([id], `You were assigned to "${populated.title}"`, {
          type: 'assign',
          boardId: access.board._id,
          cardId: populated._id,
        });
      }
    }
    res.json({ card: populated });
  }
);

router.delete('/:id', async (req, res) => {
  const access = await getCardAccess(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Card not found' });
  if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
  await Comment.deleteMany({ cardId: access.card._id });
  await Notification.deleteMany({ cardId: access.card._id });
  const title = access.card.title;
  const listId = access.card.listId;
  await Card.findByIdAndDelete(access.card._id);
  const rest = await Card.find({ listId }).sort({ position: 1 });
  for (let i = 0; i < rest.length; i++) {
    rest[i].position = i;
    await rest[i].save();
  }
  await logActivity(access.board._id, req.userId, 'card_deleted', `Deleted card "${title}"`);
  res.json({ ok: true });
});

router.patch(
  '/:id/move',
  [
    body('listId').notEmpty(),
    body('position').isInt({ min: 0 }).withMessage('position must be >= 0'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const access = await getCardAccess(req.userId, req.params.id);
    if (!access) return res.status(404).json({ message: 'Card not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    const targetListId = req.body.listId;
    const targetIndex = req.body.position;
    const card = access.card;
    const oldListId = card.listId.toString();
    const targetList = await List.findById(targetListId);
    if (!targetList) return res.status(404).json({ message: 'Target list not found' });
    const oldList = await List.findById(oldListId);
    if (oldList.boardId.toString() !== targetList.boardId.toString()) {
      return res.status(400).json({ message: 'Lists must belong to the same board' });
    }

    if (oldListId === targetListId.toString()) {
      const all = await Card.find({ listId: oldListId }).sort({ position: 1 });
      const ids = all.map((c) => c._id.toString());
      const cur = ids.indexOf(card._id.toString());
      if (cur === -1) return res.status(400).json({ message: 'Card state invalid' });
      ids.splice(cur, 1);
      const clamped = Math.min(targetIndex, ids.length);
      ids.splice(clamped, 0, card._id.toString());
      for (let i = 0; i < ids.length; i++) {
        await Card.findByIdAndUpdate(ids[i], { listId: oldListId, position: i });
      }
    } else {
      const oldCards = await Card.find({ listId: oldListId }).sort({ position: 1 });
      const oldIds = oldCards.map((c) => c._id.toString()).filter((id) => id !== card._id.toString());
      for (let i = 0; i < oldIds.length; i++) {
        await Card.findByIdAndUpdate(oldIds[i], { position: i });
      }
      const newCards = await Card.find({ listId: targetListId }).sort({ position: 1 });
      const newIds = newCards.map((c) => c._id.toString());
      const clamped = Math.min(targetIndex, newIds.length);
      newIds.splice(clamped, 0, card._id.toString());
      for (let i = 0; i < newIds.length; i++) {
        await Card.findByIdAndUpdate(newIds[i], { listId: targetListId, position: i });
      }
    }

    await logActivity(access.board._id, req.userId, 'card_moved', `Moved "${card.title}"`, card._id);
    const boardId = access.board._id;
    const full = await Card.findById(card._id).populate('assignedUsers', 'name email');
    res.json({ card: full, boardId });
  }
);

export default router;
