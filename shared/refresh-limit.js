// This UI cooldown shares only a timestamp, never inventory or credentials.
export const REFRESH_COOLDOWN_MS = 30_000;
export function refreshLimit(userId) {
  const key = `inventory-refresh-next:${userId}`;
  let next = 0;
  const remaining = () => {
    try {
      const saved = Number(localStorage.getItem(key));
      if (Number.isFinite(saved)) next = Math.max(next, saved);
    } catch {}
    return Math.min(REFRESH_COOLDOWN_MS, Math.max(0, next - Date.now()));
  };
  const run = async (check) => {
    const retryAfter = remaining();
    if (retryAfter)
      throw Object.assign(Error('Espera antes de volver a comprobar.'), {
        code: 'REFRESH_COOLDOWN',
        retryAfter,
      });
    next = Date.now() + REFRESH_COOLDOWN_MS;
    try {
      localStorage.setItem(key, String(next));
    } catch {}
    // Failed attempts also consume the cooldown; no automatic retry is queued.
    return check();
  };
  return {
    key,
    remaining,
    run(check) {
      // Serializes simultaneous taps from tabs on the same secure origin.
      return navigator.locks ? navigator.locks.request(key, () => run(check)) : run(check);
    },
  };
}
