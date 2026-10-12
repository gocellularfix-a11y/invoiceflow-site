// Progressive enhancement only: the site is fully readable without this file.
// No network requests, no storage, no tracking. Honors prefers-reduced-motion.
(() => {
  const root = document.documentElement;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Scroll progress bar and header border.
  const bar = document.querySelector('.progress');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const max = root.scrollHeight - innerHeight;
      if (bar) bar.style.setProperty('--p', max > 0 ? String(Math.min(1, scrollY / max)) : '0');
      root.classList.toggle('is-scrolled', scrollY > 8);
      ticking = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (still) return;

  // Reveal on scroll.
  const items = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -6% 0px' },
    );
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  if (!finePointer) return;

  // Hero scene follows the pointer.
  const hero = document.querySelector('.hero');
  const scene = document.querySelector('[data-tilt]');
  if (hero && scene) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      scene.style.setProperty('--ry', `${(-16 + x * 26).toFixed(2)}deg`);
      scene.style.setProperty('--rx', `${(6 - y * 18).toFixed(2)}deg`);
    });
    hero.addEventListener('pointerleave', () => {
      scene.style.removeProperty('--ry');
      scene.style.removeProperty('--rx');
    });
  }

  // Feature cards: spotlight and a slight 3D tilt.
  document.querySelectorAll('[data-card]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
      card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      card.style.setProperty('--ty', `${((x - 0.5) * 8).toFixed(2)}deg`);
      card.style.setProperty('--tx', `${((0.5 - y) * 8).toFixed(2)}deg`);
    });
    card.addEventListener('pointerleave', () => {
      card.style.removeProperty('--tx');
      card.style.removeProperty('--ty');
    });
  });
})();
