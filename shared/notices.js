let timer, current, viewportCleanup;
const closeIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';
export function dismissNotice() {
  clearTimeout(timer);
  viewportCleanup?.();
  viewportCleanup = null;
  current?.remove();
  current = null;
}
export function showNotice(message, tone = 'counted') {
  const persistent = tone === 'error';
  const scheduleDismiss = () => {
    if (!persistent) timer = setTimeout(dismissNotice, 4000);
  };
  dismissNotice();
  const el = document.createElement('div');
  current = el;
  el.className = `feedback-toast inventory-notice feedback-toast-${tone}`;
  el.setAttribute('role', tone === 'error' ? 'alert' : 'status');
  const text = document.createElement('span');
  text.textContent = message;
  const close = document.createElement('button');
  close.type = 'button';
  close.setAttribute('aria-label', 'Descartar aviso');
  close.innerHTML = closeIcon;
  close.onclick = dismissNotice;
  el.append(text, close);
  document.body.append(el);
  const position = () => {
    const v = window.visualViewport;
    el.style.setProperty('--notice-top', `${v?.offsetTop || 0}px`);
    el.style.left = `${(v?.offsetLeft || 0) + (v?.width || innerWidth) / 2}px`;
    el.style.width = `${Math.min(420, (v?.width || innerWidth) - 24)}px`;
  };
  const viewport = window.visualViewport;
  position();
  viewport?.addEventListener('resize', position);
  viewport?.addEventListener('scroll', position);
  window.addEventListener('resize', position);
  viewportCleanup = () => {
    viewport?.removeEventListener('resize', position);
    viewport?.removeEventListener('scroll', position);
    window.removeEventListener('resize', position);
  };
  let start = null;
  el.addEventListener('pointerdown', (event) => {
    if (event.target.closest('button')) return;
    start = { x: event.clientX, y: event.clientY };
    clearTimeout(timer);
    el.setPointerCapture(event.pointerId);
  });
  el.addEventListener('pointermove', (event) => {
    if (!start) return;
    const y = Math.min(0, event.clientY - start.y);
    el.style.setProperty('--notice-drag', `${y}px`);
    el.style.opacity = String(Math.max(0.2, 1 - Math.abs(y) / 100));
  });
  const end = (event) => {
    if (!start) return;
    const dismiss = event.clientY - start.y < -28;
    start = null;
    if (dismiss) dismissNotice();
    else {
      el.style.removeProperty('--notice-drag');
      el.style.removeProperty('opacity');
      scheduleDismiss();
    }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', () => {
    start = null;
    el.style.removeProperty('--notice-drag');
    el.style.removeProperty('opacity');
    scheduleDismiss();
  });
  scheduleDismiss();
}

export async function transitionItem(change) {
  const old = document.querySelector('.count-view .item-card');
  if (!old || matchMedia('(prefers-reduced-motion: reduce)').matches || !old.animate) {
    change();
    return;
  }
  const view = old.closest('.count-view');
  view.inert = true;
  try {
    await old.animate(
      [
        { transform: 'translateX(0)', opacity: 1 },
        { transform: 'translateX(-16%)', opacity: 0 },
      ],
      { duration: 160, easing: 'cubic-bezier(.5,0,1,1)', fill: 'forwards' },
    ).finished;
  } catch {}
  change();
  if (view.isConnected) view.inert = false;
  const next = document.querySelector('.count-view .item-card');
  if (next && next !== old)
    next.animate(
      [
        { transform: 'translateX(16%)', opacity: 0 },
        { transform: 'translateX(0)', opacity: 1 },
      ],
      { duration: 180, easing: 'cubic-bezier(.16,1,.3,1)' },
    );
}
