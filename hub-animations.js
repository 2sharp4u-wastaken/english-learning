/**
 * hub-animations.js — Live welcome screen interactions
 * 3D tilt on card hover, counter animation, ripple on click
 */

const TIER_COLORS = {
  learn:     'rgba(0, 217, 163, 0.45)',
  practice:  'rgba(77, 159, 255, 0.45)',
  challenge: 'rgba(255, 184, 48, 0.45)',
  test:      'rgba(255, 77, 109, 0.45)',
};

// ─── 3D Card Tilt ───────────────────────────────────────────
function initTilt() {
  const cards = document.querySelectorAll('.tier-section .game-card:not(.locked)');
  cards.forEach(card => {
    let raf = null;
    let targetRX = 0, targetRY = 0;
    let currentRX = 0, currentRY = 0;
    let isHovered = false;

    card.addEventListener('mouseenter', () => { isHovered = true; });

    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      targetRY =  ((x - cx) / cx) * 12;
      targetRX = -((y - cy) / cy) * 8;

      if (!raf) {
        const tick = () => {
          currentRX += (targetRX - currentRX) * 0.18;
          currentRY += (targetRY - currentRY) * 0.18;
          card.style.transform = `perspective(700px) rotateX(${currentRX}deg) rotateY(${currentRY}deg) translateY(-6px) scale(1.02)`;
          if (isHovered) raf = requestAnimationFrame(tick);
          else {
            currentRX += (0 - currentRX) * 0.18;
            currentRY += (0 - currentRY) * 0.18;
            card.style.transform = `perspective(700px) rotateX(${currentRX}deg) rotateY(${currentRY}deg) translateY(0px) scale(1)`;
            if (Math.abs(currentRX) > 0.05 || Math.abs(currentRY) > 0.05) {
              raf = requestAnimationFrame(tick);
            } else {
              card.style.transform = '';
              raf = null;
            }
          }
        };
        raf = requestAnimationFrame(tick);
      }
    });

    card.addEventListener('mouseleave', () => {
      isHovered = false;
      targetRX = 0;
      targetRY = 0;
    });
  });
}

// ─── Stats Counter Animation ────────────────────────────────
function animateCounter(el, target, duration = 1400, delay = 600) {
  if (!el || isNaN(target) || target === 0) return;
  const start = performance.now() + delay;

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);

  const tick = now => {
    const elapsed = now - start;
    if (elapsed < 0) { requestAnimationFrame(tick); return; }
    const t = Math.min(elapsed / duration, 1);
    el.textContent = Math.round(easeOutCubic(t) * target);
    if (t < 1) requestAnimationFrame(tick);
    else el.textContent = target;
  };

  requestAnimationFrame(tick);
}

function initCounters() {
  const streakEl = document.getElementById('streak-count');
  const wordsEl  = document.getElementById('words-learned-count');

  if (streakEl) {
    const val = parseInt(streakEl.textContent, 10) || 0;
    if (val > 0) { streakEl.textContent = '0'; animateCounter(streakEl, val); }
  }
  if (wordsEl) {
    const val = parseInt(wordsEl.textContent, 10) || 0;
    if (val > 0) { wordsEl.textContent = '0'; animateCounter(wordsEl, val, 1600, 800); }
  }
}

// ─── Ripple on Click ────────────────────────────────────────
function initRipple() {
  document.querySelectorAll('.tier-section .game-card:not(.locked)').forEach(card => {
    card.addEventListener('click', e => {
      const tier = card.closest('[data-tier]')?.dataset.tier || 'learn';
      const color = TIER_COLORS[tier] || TIER_COLORS.learn;

      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        border-radius: 50%;
        background: ${color};
        width: 10px; height: 10px;
        transform: scale(0);
        pointer-events: none;
        z-index: 10;
        animation: hubRipple 0.55s ease-out forwards;
      `;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left - 5;
      const y = e.clientY - rect.top  - 5;
      ripple.style.left = x + 'px';
      ripple.style.top  = y + 'px';

      card.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });
}

// ─── Ripple keyframe injection ───────────────────────────────
function injectRippleKeyframe() {
  if (document.getElementById('hub-ripple-kf')) return;
  const style = document.createElement('style');
  style.id = 'hub-ripple-kf';
  style.textContent = `
    @keyframes hubRipple {
      to { transform: scale(30); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Boot ────────────────────────────────────────────────────
function boot() {
  injectRippleKeyframe();
  initTilt();
  initCounters();
  initRipple();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

// Re-init when welcome screen is shown (user navigates back from a game)
window.addEventListener('show-welcome', () => {
  initTilt();
  initCounters();
  initRipple();
});
