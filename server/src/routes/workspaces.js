import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { Workspace } from '../models/Workspace.js';
import { User } from '../models/User.js';
import { Board } from '../models/Board.js';
import { List } from '../models/List.js';
import { Card } from '../models/Card.js';
import { Comment } from '../models/Comment.js';
import { Activity } from '../models/Activity.js';
import { authRequired, attachUser } from '../middleware/auth.js';
import { getWorkspaceRole, canEdit } from '../lib/access.js';

const router = Router();
router.use(authRequired, attachUser);

router.get('/', async (req, res) => {
  const workspaces = await Workspace.find({
    $or: [{ owner: req.userId }, { 'members.user': req.userId }],
  })
    .sort({ updatedAt: -1 })
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
  const withRole = workspaces.map((w) => {
    const isOwner = w.owner._id.toString() === req.userId;
    const member = w.members.find((m) => m.user._id.toString() === req.userId);
    const role = isOwner ? 'admin' : member?.role || 'member';
    return { ...w.toObject(), myRole: role };
  });
  res.json({ workspaces: withRole });
});

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Workspace name required')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    const ws = await Workspace.create({
      name: req.body.name,
      owner: req.userId,
      members: [{ user: req.userId, role: 'admin' }],
    });
    const populated = await Workspace.findById(ws._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    res.status(201).json({ workspace: { ...populated.toObject(), myRole: 'admin' } });
  }
);

router.get('/:id', async (req, res) => {
  const access = await getWorkspaceRole(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Workspace not found' });
  const ws = await Workspace.findById(req.params.id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
  const isOwner = ws.owner._id.toString() === req.userId;
  const member = ws.members.find((m) => m.user._id.toString() === req.userId);
  const role = isOwner ? 'admin' : member.role;
  res.json({ workspace: { ...ws.toObject(), myRole: role } });
});

router.patch(
  '/:id',
  [body('name').optional().trim().notEmpty()],
  async (req, res) => {
    const access = await getWorkspaceRole(req.userId, req.params.id);
    if (!access) return res.status(404).json({ message: 'Workspace not found' });
    if (!canEdit(access.role)) return res.status(403).json({ message: 'View only' });
    if (req.body.name) access.workspace.name = req.body.name;
    await access.workspace.save();
    const ws = await Workspace.findById(access.workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    res.json({ workspace: ws });
  }
);

router.delete('/:id', async (req, res) => {
  const access = await getWorkspaceRole(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Workspace not found' });
  if (access.workspace.owner.toString() !== req.userId) {
    return res.status(403).json({ message: 'Only owner can delete workspace' });
  }
  const boards = await Board.find({ workspaceId: access.workspace._id });
  for (const b of boards) {
    const lists = await List.find({ boardId: b._id });
    for (const l of lists) {
      const cards = await Card.find({ listId: l._id });
      for (const c of cards) {
        await Comment.deleteMany({ cardId: c._id });
      }
      await Card.deleteMany({ listId: l._id });
    }
    await List.deleteMany({ boardId: b._id });
    await Activity.deleteMany({ boardId: b._id });
  }
  await Board.deleteMany({ workspaceId: access.workspace._id });
  await Workspace.findByIdAndDelete(access.workspace._id);
  res.json({ ok: true });
});

router.post(
  '/:id/members',
  [
    body('email').isEmail().normalizeEmail(),
    body('role').optional().isIn(['admin', 'member', 'guest']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid email or role' });
    const access = await getWorkspaceRole(req.userId, req.params.id);
    if (!access) return res.status(404).json({ message: 'Workspace not found' });
    if (access.role !== 'admin') return res.status(403).json({ message: 'Only admins can invite' });
    const invitee = await User.findOne({ email: req.body.email });
    if (!invitee) {
      return res.status(404).json({ message: 'No user with that email — they must register first' });
    }
    if (invitee._id.toString() === req.userId) {
      return res.status(400).json({ message: 'Already in workspace' });
    }
    const exists = access.workspace.members.some((m) => m.user.toString() === invitee._id.toString());
    if (exists) return res.status(400).json({ message: 'User already a member' });
    const role = req.body.role || 'member';
    access.workspace.members.push({ user: invitee._id, role });
    await access.workspace.save();
    const ws = await Workspace.findById(access.workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    res.status(201).json({ workspace: ws });
  }
);

router.delete('/:id/members/:userId', async (req, res) => {
  const access = await getWorkspaceRole(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Workspace not found' });
  if (access.role !== 'admin') return res.status(403).json({ message: 'Only admins can remove members' });
  if (req.params.userId === access.workspace.owner.toString()) {
    return res.status(400).json({ message: 'Cannot remove owner' });
  }
  access.workspace.members = access.workspace.members.filter(
    (m) => m.user.toString() !== req.params.userId
  );
  await access.workspace.save();
  const ws = await Workspace.findById(access.workspace._id)
    .populate('owner', 'name email')
    .populate('members.user', 'name email');
  res.json({ workspace: ws });
});

router.patch(
  '/:id/members/:userId',
  [body('role').isIn(['admin', 'member', 'guest'])],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Invalid role' });
    const access = await getWorkspaceRole(req.userId, req.params.id);
    if (!access) return res.status(404).json({ message: 'Workspace not found' });
    if (access.role !== 'admin') return res.status(403).json({ message: 'Only admins can change roles' });
    const m = access.workspace.members.find((x) => x.user.toString() === req.params.userId);
    if (!m) return res.status(404).json({ message: 'Member not found' });
    m.role = req.body.role;
    await access.workspace.save();
    const ws = await Workspace.findById(access.workspace._id)
      .populate('owner', 'name email')
      .populate('members.user', 'name email');
    res.json({ workspace: ws });
  }
);

router.get('/:id/search', async (req, res) => {
  const access = await getWorkspaceRole(req.userId, req.params.id);
  if (!access) return res.status(404).json({ message: 'Workspace not found' });
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) return res.json({ results: [] });
  const boards = await Board.find({ workspaceId: access.workspace._id });
  const boardIds = boards.map((b) => b._id);
  const lists = await List.find({ boardId: { $in: boardIds } });
  const listIds = lists.map((l) => l._id);
  const cards = await Card.find({
    listId: { $in: listIds },
    $or: [
      { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      { description: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
    ],
  })
    .populate('assignedUsers', 'name email')
    .lean();
  const listMap = Object.fromEntries(lists.map((l) => [l._id.toString(), l]));
  const boardMap = Object.fromEntries(boards.map((b) => [b._id.toString(), b]));
  const results = cards.map((c) => ({
    card: c,
    list: listMap[c.listId.toString()],
    board: boardMap[listMap[c.listId.toString()].boardId.toString()],
  }));
  res.json({ results });
});

export default router;
