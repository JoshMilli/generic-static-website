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

  // Reveal on scroll
  const revealEls = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          obs.unobserve(entry.target);
        }
      });
    }, { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    revealEls.forEach(el => revealObserver.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in-view'));
  }

  // Section-based background accents
  const sections = document.querySelectorAll('section[data-section]');
  const setSection = (name) => document.body.setAttribute('data-section', name);
  if (sections.length) {
    setSection(sections[0].dataset.section || 'hero');
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const name = entry.target.dataset.section;
          if (name) setSection(name);
        }
      });
    }, { threshold: 0.5 });
    sections.forEach(s => sectionObserver.observe(s));
  }

  // Parallax background motion
  const bg = document.querySelector('.bg-gradient');
  if (bg) {
    let raf, tx = 0, ty = 0, cx = 0, cy = 0;
    const onMove = (e) => {
      const w = window.innerWidth, h = window.innerHeight;
      const x = (e.clientX / w - 0.5);
      const y = (e.clientY / h - 0.5);
      tx = x * 24; ty = y * 24;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          cx += (tx - cx) * 0.08;
          cy += (ty - cy) * 0.08;
          bg.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
          raf = null;
        });
      }
    };
    window.addEventListener('pointermove', onMove, { passive: true });
  }
})();