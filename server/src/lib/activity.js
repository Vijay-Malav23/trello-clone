import { Activity } from '../models/Activity.js';

export async function logActivity(boardId, userId, action, details = '', cardId = null) {
  await Activity.create({ boardId, userId, action, details, cardId });
}
