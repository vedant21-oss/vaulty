/**
 * @file theme.js
 * @description Loads before paint so the page never flashes the wrong theme.
 * Follows the system setting until the user picks one, then remembers it.
 */
(function () {
  'use strict';
  var KEY = 'andhaar-theme';
  var root = document.documentElement;

  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);
  } catch (e) { /* storage blocked: follow system */ }

  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-theme-toggle]') : null;
    if (!btn) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (err) { /* ignore */ }
    document.dispatchEvent(new CustomEvent('andhaar:theme', { detail: next }));
  });
})();
