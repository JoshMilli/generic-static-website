(function() {
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const stored = localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') {
    document.documentElement.setAttribute('data-theme', stored);
  } else if (!prefersDark) {
    document.documentElement.setAttribute('data-theme', 'light');
  }

  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', current);
      localStorage.setItem('theme', current);
    });
  }

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const hamburger = document.getElementById('hamburger');
  const header = document.querySelector('.site-header');
  if (hamburger && header) {
    hamburger.addEventListener('click', () => {
      header.classList.toggle('open');
      const nav = header.querySelector('.nav');
      if (nav) {
        if (header.classList.contains('open')) {
          nav.style.display = 'flex';
          nav.style.flexDirection = 'column';
          nav.style.position = 'absolute';
          nav.style.top = '64px';
          nav.style.right = '20px';
          nav.style.background = 'var(--bg-soft)';
          nav.style.border = '1px solid var(--border)';
          nav.style.padding = '10px';
          nav.style.borderRadius = '12px';
          nav.style.boxShadow = '0 20px 40px rgba(0,0,0,.35)';
          nav.style.zIndex = '50';
          nav.querySelectorAll('a').forEach(a => { a.style.padding = '8px 12px'; });
        } else {
          nav.removeAttribute('style');
          nav.querySelectorAll('a').forEach(a => a.removeAttribute('style'));
        }
      }
    });
  }

  document.querySelectorAll('.accordion details').forEach(d => {
    d.addEventListener('toggle', () => {
      if (d.open) {
        document.querySelectorAll('.accordion details').forEach(o => { if (o !== d) o.open = false; });
      }
    });
  });
})();