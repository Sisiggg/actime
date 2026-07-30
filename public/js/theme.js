(function () {
  const STORAGE_KEY = 'actime-theme';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem(STORAGE_KEY);
  const isDark = saved !== null ? saved === 'dark' : prefersDark;

  if (isDark) document.body.classList.add('dark-mode');

  window.setTheme = function (dark) {
    document.body.classList.toggle('dark-mode', dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = dark ? '\u2600\uFE0F' : '\uD83C\uDF19';
  };

  window.toggleTheme = function () {
    const isDark = document.body.classList.contains('dark-mode');
    setTheme(!isDark);
  };

  document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = document.body.classList.contains('dark-mode') ? '\u2600\uFE0F' : '\uD83C\uDF19';
  });
})();
