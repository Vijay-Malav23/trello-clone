import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export async function attachUser(req, res, next) {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    return next();
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
}
