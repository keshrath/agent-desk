// =============================================================================
// Agent Desk — DOM Utilities (morphdom helpers)
// =============================================================================
// Shared morphdom-based DOM patching and HTML escaping utilities.
// morphdom is loaded as a global via vendor script tag.
// =============================================================================

'use strict';

/**
 * Morph an element's children to match new HTML.
 * @param {HTMLElement} el - Container element
 * @param {string} newInnerHTML - New HTML content
 */
export function morph(el, newInnerHTML) {
  const wrap = document.createElement(el.tagName);
  wrap.innerHTML = newInnerHTML;
  morphdom(el, wrap, { childrenOnly: true });
}

/**
 * Escape HTML entities.
 * @param {string} str
 * @returns {string}
 */
export function esc(str) {
  if (str == null) return '';
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}

/**
 * Escape for use in HTML attributes.
 * @param {string} str
 * @returns {string}
 */
export function escAttr(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
