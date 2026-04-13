import { Router } from 'express';
import { Activity } from '../models/Activity.js';
import { authRequired, attachUser } from '../middleware/auth.js';
import { getBoardAccess } from '../lib/access.js';

const router = Router();
router.use(authRequired, attachUser);

router.get('/board/:boardId', async (req, res) => {
  const access = await getBoardAccess(req.userId, req.params.boardId);
  if (!access) return res.status(404).json({ message: 'Board not found' });
  const activities = await Activity.find({ boardId: access.board._id })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('userId', 'name email')
    .lean();
  res.json({ activities });
});

export default router;
