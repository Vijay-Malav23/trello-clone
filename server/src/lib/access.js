import { Workspace } from '../models/Workspace.js';
import { Board } from '../models/Board.js';
import { List } from '../models/List.js';
import { Card } from '../models/Card.js';

export async function getWorkspaceRole(userId, workspaceId) {
  const ws = await Workspace.findById(workspaceId);
  if (!ws) return null;
  if (ws.owner.toString() === userId) return { workspace: ws, role: 'admin' };
  const member = ws.members.find((m) => m.user.toString() === userId);
  if (!member) return null;
  return { workspace: ws, role: member.role };
}

export async function getBoardAccess(userId, boardId) {
  const board = await Board.findById(boardId);
  if (!board) return null;
  const access = await getWorkspaceRole(userId, board.workspaceId);
  if (!access) return null;
  return { board, workspace: access.workspace, role: access.role };
}

export async function getListAccess(userId, listId) {
  const list = await List.findById(listId);
  if (!list) return null;
  const boardAccess = await getBoardAccess(userId, list.boardId);
  if (!boardAccess) return null;
  return { list, ...boardAccess };
}

export async function getCardAccess(userId, cardId) {
  const card = await Card.findById(cardId);
  if (!card) return null;
  const listAccess = await getListAccess(userId, card.listId);
  if (!listAccess) return null;
  return { card, ...listAccess };
}

export function canEdit(role) {
  return role === 'admin' || role === 'member';
}
