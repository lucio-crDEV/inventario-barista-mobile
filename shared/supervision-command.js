import { api } from './client.js';
export const commandKey = (userId) => `inventory-supervision-pending:${userId}`;
export function readCommand(userId) {
  try {
    const value = JSON.parse(sessionStorage.getItem(commandKey(userId)) || 'null');
    return value && typeof value === 'object' && typeof value.id === 'string' ? value : null;
  } catch {
    return null;
  }
}
export async function submitCommand(userId, payload) {
  const key = commandKey(userId),
    pending = readCommand(userId);
  if (pending && (pending.id !== payload.id || JSON.stringify(pending) !== JSON.stringify(payload)))
    throw Object.assign(Error('Resuelve el cambio pendiente antes de iniciar otro.'), {
      code: 'PENDING_COMMAND',
      pending,
    });
  try {
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    throw Object.assign(Error('No se pudo conservar el cambio. No se ha enviado.'), {
      code: 'PERSISTENCE_FAILED',
    });
  }
  try {
    const result = await api('/api/admin/supervision/command', payload);
    sessionStorage.removeItem(key);
    return result;
  } catch (error) {
    if (error.status && error.status < 500 && ![408, 429].includes(error.status)) {
      sessionStorage.removeItem(key);
      error.pending = null;
    } else error.pending = payload;
    throw error;
  }
}
