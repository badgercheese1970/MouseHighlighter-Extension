/* Mouse Highlighter — content script
   Runs inside every Chrome tab. The canvas is part of the page content,
   so it appears in tab sharing and window sharing in Google Meet / Zoom / Teams. */

(function () {
  'use strict';

  // Prevent double-injection (e.g. on history navigation)
  if (document.getElementById('__mh_canvas__')) return;

  // ── Settings (synced from popup) ─────────────────────────────────────────
  const DEFAULTS = {
    circleSize: 120,
    color: '#ffd700',
    sensitivity: 50,
    fadeDelay: 1500,
    enabled: true
  };
  let cfg = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, saved => { cfg = { ...DEFAULTS, ...saved }; });
  chrome.storage.onChanged.addListener(changes => {
    for (const [k, { newValue }] of Object.entries(changes)) cfg[k] = newValue;
  });

  // ── Canvas overlay ───────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.id = '__mh_canvas__';
  Object.assign(canvas.style, {
    position:      'fixed',
    top:           '0',
    left:          '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none',
    zIndex:        '2147483647',
    display:       'block'
  });
  (document.documentElement || document.body).appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  // ── State ────────────────────────────────────────────────────────────────
  let mouseX = -999, mouseY = -999;
  let positions = [];          // {x, y, t} — last 300 ms of movement
  let currentAlpha = 0;
  let targetAlpha  = 0;
  let fadeTimer    = null;

  // ── Mouse tracking ───────────────────────────────────────────────────────
  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (!cfg.enabled) return;

    const now = Date.now();
    positions.push({ x: mouseX, y: mouseY, t: now });
    const cutoff = now - 300;
    positions = positions.filter(p => p.t > cutoff);

    if (detectJiggle()) showHighlight();
  }, true);

  // ── Jiggle detection (same algorithm as the native Mac app) ──────────────
  function detectJiggle() {
    if (positions.length < 4) return false;
    let totalMovement = 0, directionChanges = 0, lastDir = null;

    for (let i = 1; i < positions.length; i++) {
      const dx   = positions[i].x - positions[i - 1].x;
      const dy   = positions[i].y - positions[i - 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      totalMovement += dist;

      if (dist > 2) {
        const dir = { x: dx / dist, y: dy / dist };
        if (lastDir) {
          const dot = dir.x * lastDir.x + dir.y * lastDir.y;
          if (dot < 0.3) directionChanges++;
        }
        lastDir = dir;
      }
    }

    const threshold = 150 - cfg.sensitivity;
    return directionChanges >= 2 && totalMovement > threshold;
  }

  // ── Show / hide ──────────────────────────────────────────────────────────
  function showHighlight() {
    targetAlpha = 1;
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(() => { targetAlpha = 0; }, cfg.fadeDelay);
  }

  // ── Draw loop ────────────────────────────────────────────────────────────
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth fade in (fast) / fade out (slower)
    if (currentAlpha < targetAlpha) {
      currentAlpha = Math.min(currentAlpha + 0.12, targetAlpha);
    } else {
      currentAlpha = Math.max(currentAlpha - 0.04, targetAlpha);
    }

    if (currentAlpha > 0.005 && mouseX > 0) {
      const { r, g, b } = hexToRgb(cfg.color);
      const radius = cfg.circleSize / 2;

      ctx.save();
      ctx.globalAlpha = currentAlpha;

      // Filled circle (semi-transparent)
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.35)`;
      ctx.fill();

      // Visible ring
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.85)`;
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.restore();
    }

    requestAnimationFrame(draw);
  }

  draw();
})();
