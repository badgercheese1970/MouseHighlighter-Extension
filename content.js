/* Mouse Highlighter — content script
   Uses a CSS div overlay (not canvas) so it appears in Chrome tab capture,
   window sharing, and whole-screen sharing in Google Meet / Zoom / Teams. */

(function () {
  'use strict';

  if (document.getElementById('__mh_highlight__')) return;

  // ── Settings ──────────────────────────────────────────────────────────────
  const DEFAULTS = { circleSize: 120, color: '#ffd700', sensitivity: 50, fadeDelay: 1500, enabled: true };
  let cfg = { ...DEFAULTS };

  try {
    chrome.storage.sync.get(DEFAULTS, saved => { cfg = { ...DEFAULTS, ...saved }; applyStyle(); });
    chrome.storage.onChanged.addListener(changes => {
      for (const [k, { newValue }] of Object.entries(changes)) cfg[k] = newValue;
      applyStyle();
    });
  } catch (e) { /* extension context invalidated — reload tab to restore */ }

  // ── Highlight div ─────────────────────────────────────────────────────────
  const el = document.createElement('div');
  el.id = '__mh_highlight__';
  Object.assign(el.style, {
    position:        'fixed',
    top:             '0',
    left:            '0',
    pointerEvents:   'none',
    zIndex:          '2147483647',
    borderRadius:    '50%',
    opacity:         '0',
    willChange:      'transform, opacity',
    transform:       'translate(-9999px, -9999px)',
  });
  (document.documentElement || document.body).appendChild(el);

  function hexToRgb(hex) {
    return {
      r: parseInt(hex.slice(1,3), 16),
      g: parseInt(hex.slice(3,5), 16),
      b: parseInt(hex.slice(5,7), 16)
    };
  }

  function applyStyle() {
    const { r, g, b } = hexToRgb(cfg.color);
    const s = cfg.circleSize;
    Object.assign(el.style, {
      width:     s + 'px',
      height:    s + 'px',
      background: `rgba(${r},${g},${b},0.30)`,
      border:    `3px solid rgba(${r},${g},${b},0.90)`,
      boxShadow: `0 0 ${Math.round(s*0.15)}px ${Math.round(s*0.08)}px rgba(${r},${g},${b},0.35)`,
    });
  }
  applyStyle();

  // ── State ──────────────────────────────────────────────────────────────────
  let mouseX = -9999, mouseY = -9999;
  let positions = [];
  let visible   = false;
  let fadeTimer = null;

  // ── Mouse tracking ─────────────────────────────────────────────────────────
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Move element immediately — no waiting for rAF
    el.style.transform = `translate(${mouseX - cfg.circleSize/2}px, ${mouseY - cfg.circleSize/2}px)`;

    if (!cfg.enabled) return;

    const now = Date.now();
    positions.push({ x: mouseX, y: mouseY, t: now });
    positions = positions.filter(p => p.t > now - 300);

    if (detectJiggle()) showHighlight();
  }, true);

  // ── Jiggle detection ───────────────────────────────────────────────────────
  function detectJiggle() {
    if (positions.length < 4) return false;
    let totalMovement = 0, dirChanges = 0, lastDir = null;
    for (let i = 1; i < positions.length; i++) {
      const dx = positions[i].x - positions[i-1].x;
      const dy = positions[i].y - positions[i-1].y;
      const d  = Math.sqrt(dx*dx + dy*dy);
      totalMovement += d;
      if (d > 2) {
        const dir = { x: dx/d, y: dy/d };
        if (lastDir && (dir.x*lastDir.x + dir.y*lastDir.y) < 0.3) dirChanges++;
        lastDir = dir;
      }
    }
    return dirChanges >= 2 && totalMovement > (150 - cfg.sensitivity);
  }

  // ── Show / hide ────────────────────────────────────────────────────────────
  function showHighlight() {
    applyStyle(); // pick up any settings changes
    el.style.transition = 'opacity 0.15s ease-in';
    el.style.opacity    = '1';
    visible = true;
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(hideHighlight, cfg.fadeDelay);
  }

  function hideHighlight() {
    el.style.transition = 'opacity 0.4s ease-out';
    el.style.opacity    = '0';
    visible = false;
  }

})();
