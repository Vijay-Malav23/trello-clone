import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { Comment } from '../models/Comment.js';
import { authRequired, attachUser } from '../middleware/auth.js';
import { getCardAccess, canEdit } from '../lib/access.js';
import { logActivity } from '../lib/activity.js';
import { notifyUsers } from '../lib/notify.js';

const router = Router();
router.use(authRequired, attachUser);

router.get('/card/:cardId', async (req, res) => {
  const access = await getCardAccess(req.userId, req.params.cardId);
  if (!access) return res.status(404).json({ message: 'Card not found' });
  const comments = await Comment.find({ cardId: access.card._id })
    .sort({ createdAt: 1 })
    .populate('userId', 'name email');
  res.json({ comments });
});

router.post(
  '/',
  [body('cardId').notEmpty(), body('text').trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const access = await getCardAccess(req.userId, req.body.cardId);
    if (!access) return res.status(404).json({ message: 'Card not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    const comment = await Comment.create({
      cardId: access.card._id,
      userId: req.userId,
      text: req.body.text,
    });
    const populated = await Comment.findById(comment._id).populate('userId', 'name email');
    await logActivity(
      access.board._id,
      req.userId,
      'comment_added',
      `Comment on "${access.card.title}"`,
      access.card._id
    );
    const assignees = (access.card.assignedUsers || []).map((id) => id.toString());
    const notifyIds = assignees.filter((id) => id !== req.userId);
    if (notifyIds.length) {
      await notifyUsers(notifyIds, `New comment on "${access.card.title}"`, {
        type: 'comment',
        boardId: access.board._id,
        cardId: access.card._id,
      });
    }
    res.status(201).json({ comment: populated });
  }
);

router.delete('/:id', async (req, res) => {
  const comment = await Comment.findById(req.params.id);
  if (!comment) return res.status(404).json({ message: 'Comment not found' });
  const access = await getCardAccess(req.userId, comment.cardId);
  if (!access) return res.status(404).json({ message: 'Card not found' });
  if (access.role === 'guest') {
    return res.status(403).json({ message: 'View only' });
  }
  if (comment.userId.toString() !== req.userId && access.role !== 'admin') {
    return res.status(403).json({ message: 'Can only delete your own comment unless admin' });
  }
  await Comment.findByIdAndDelete(comment._id);
  res.json({ ok: true });
});

export default router;
