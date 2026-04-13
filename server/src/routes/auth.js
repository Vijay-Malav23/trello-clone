import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import { User } from '../models/User.js';
import { authRequired, attachUser } from '../middleware/auth.js';

const router = Router();

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post(
  '/register',
  [
    body('name').trim().notEmpty().withMessage('Name required'),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 chars'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hash });
    const token = signToken(user._id.toString());
    return res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  }
);

router.post(
  '/login',
  [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(401).json({ message: 'Invalid email or password' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: 'Invalid email or password' });
    const token = signToken(user._id.toString());
    return res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  }
);

router.get('/me', authRequired, attachUser, (req, res) => {
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email } });
});

router.patch(
  '/profile',
  authRequired,
  attachUser,
  [body('name').optional().trim().notEmpty()],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ message: errors.array()[0].msg });
    if (req.body.name) req.user.name = req.body.name;
    await req.user.save();
    res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email } });
  }
);

export default router;
