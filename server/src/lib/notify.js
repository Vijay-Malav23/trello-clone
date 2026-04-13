import { Notification } from '../models/Notification.js';

export async function notifyUsers(userIds, message, { type = 'info', boardId, cardId } = {}) {
  const unique = [...new Set(userIds.map(String))];
  await Promise.all(
    unique.map((userId) =>
      Notification.create({ userId, message, type, boardId, cardId })
    )
  );
}
