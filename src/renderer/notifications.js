// =============================================================================
// Agent Desk — Toast Notifications
// =============================================================================

'use strict';

import { registry } from './state.js';

// Toast system
export function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 200);
  }, 1500);
}

registry.showToast = showToast;
