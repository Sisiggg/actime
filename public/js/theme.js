(function () {
  const STORAGE_KEY = 'actime-theme';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem(STORAGE_KEY);
  const isDark = saved !== null ? saved === 'dark' : prefersDark;

  const ICONS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>'
  };

  function renderIcon() {
    const btn = document.getElementById('themeBtn');
    if (!btn) return;
    const dark = document.body.classList.contains('dark-mode');
    btn.innerHTML = dark ? ICONS.sun : ICONS.moon;
    btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.setAttribute('aria-pressed', String(dark));
  }

  if (isDark) document.body.classList.add('dark-mode');

  window.setTheme = function (dark) {
    document.body.classList.toggle('dark-mode', dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    renderIcon();
  };

  window.toggleTheme = function () {
    const isDark = document.body.classList.contains('dark-mode');
    setTheme(!isDark);
  };

  document.addEventListener('DOMContentLoaded', renderIcon);
})();
