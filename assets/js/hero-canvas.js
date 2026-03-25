/* ============================================================
   VirWave — Hero Canvas Atmosphere
   Renders breathing aura, ambient orbs, and particles on a
   full-viewport canvas behind the hero content.

   Design: "Approach D" — no mouse interaction, no parallax.
   The canvas breathes on a real breathwork cadence so the
   visitor's nervous system begins to entrain.

   Progressive enhancement: CSS gradient is the base layer.
   Canvas layers on top via position:absolute. If JS fails,
   the visitor sees the gradient, text, and buttons.
   ============================================================ */

(function () {
  'use strict';

  /* --- Configuration ---------------------------------------- */
  var BREATH = {
    inhale: 4000,
    hold:   4000,
    exhale: 6000,
    rest:   2000
  };
  var TOTAL = BREATH.inhale + BREATH.hold + BREATH.exhale + BREATH.rest; // 16000ms

  var AURA = {
    x: 0.62,        // 62% from left (asymmetric)
    y: 0.45,        // 45% from top
    radius: 0.28,   // proportion of canvas width
    scaleMin: 0.95,
    scaleMax: 1.05,
    opacityMin: 0.15,
    opacityMax: 0.28,
    colorInner: { r: 10, g: 126, b: 164 },   // teal
    colorMid:   { r: 140, g: 235, b: 170 },   // mint
  };

  var ORBS = [
    { x: 0.3, y: 0.35, radius: 0.35, color: { r: 96, g: 165, b: 250 }, opacity: 0.10, dx: 0.08, dy: 0.05, durX: 45000, durY: 52000 },  // phase-blue
    { x: 0.75, y: 0.6, radius: 0.3, color: { r: 167, g: 139, b: 250 }, opacity: 0.08, dx: 0.06, dy: 0.07, durX: 55000, durY: 48000 }   // phase-violet
  ];

  var PARTICLE_COUNT_DESKTOP = 8;
  var PARTICLE_COUNT_MOBILE = 4;
  var PERF_BUDGET_MS = 20;
  var PERF_FAIL_THRESHOLD = 3;

  /* --- State ------------------------------------------------ */
  var canvas, ctx;
  var particles = [];
  var perfFailCount = 0;
  var lastFrameTime = 0;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var startTime = 0;

  /* --- Easing ----------------------------------------------- */
  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /* --- Breathing state machine ------------------------------ */
  function getBreathState(elapsed) {
    var t = elapsed % TOTAL;
    var phase, progress;

    if (t < BREATH.inhale) {
      phase = 'inhale';
      progress = t / BREATH.inhale;
    } else if (t < BREATH.inhale + BREATH.hold) {
      phase = 'hold';
      progress = (t - BREATH.inhale) / BREATH.hold;
    } else if (t < BREATH.inhale + BREATH.hold + BREATH.exhale) {
      phase = 'exhale';
      progress = (t - BREATH.inhale - BREATH.hold) / BREATH.exhale;
    } else {
      phase = 'rest';
      progress = (t - BREATH.inhale - BREATH.hold - BREATH.exhale) / BREATH.rest;
    }

    var scale, opacity;
    switch (phase) {
      case 'inhale':
        scale = AURA.scaleMin + (AURA.scaleMax - AURA.scaleMin) * easeInOutCubic(progress);
        opacity = AURA.opacityMin + (AURA.opacityMax - AURA.opacityMin) * easeInOutCubic(progress);
        break;
      case 'hold':
        scale = AURA.scaleMax;
        opacity = AURA.opacityMax;
        break;
      case 'exhale':
        scale = AURA.scaleMax - (AURA.scaleMax - AURA.scaleMin) * easeInOutCubic(progress);
        opacity = AURA.opacityMax - (AURA.opacityMax - AURA.opacityMin) * easeInOutCubic(progress);
        break;
      case 'rest':
        scale = AURA.scaleMin;
        opacity = AURA.opacityMin;
        break;
    }

    return { phase: phase, scale: scale, opacity: opacity };
  }

  /* --- Particle factory ------------------------------------- */
  function createParticle() {
    return {
      x: Math.random(),
      y: Math.random(),
      size: 1.5 + Math.random() * 2.5,
      opacity: 0.03 + Math.random() * 0.04,
      phaseX: Math.random() * Math.PI * 2,
      phaseY: Math.random() * Math.PI * 2,
      speedX: 0.00003 + Math.random() * 0.00005,
      speedY: 0.00002 + Math.random() * 0.00004,
      ampX: 0.02 + Math.random() * 0.03,
      ampY: 0.015 + Math.random() * 0.025
    };
  }

  function initParticles() {
    var count = canvas.width < 768 ? PARTICLE_COUNT_MOBILE : PARTICLE_COUNT_DESKTOP;
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push(createParticle());
    }
  }

  /* --- Render layers ---------------------------------------- */
  function drawOrbs(elapsed) {
    for (var i = 0; i < ORBS.length; i++) {
      var orb = ORBS[i];
      var ox = orb.x + Math.sin(elapsed / orb.durX * Math.PI * 2) * orb.dx;
      var oy = orb.y + Math.cos(elapsed / orb.durY * Math.PI * 2) * orb.dy;
      var cx = ox * canvas.width;
      var cy = oy * canvas.height;
      var r = orb.radius * canvas.width;

      var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, 'rgba(' + orb.color.r + ',' + orb.color.g + ',' + orb.color.b + ',' + orb.opacity + ')');
      grad.addColorStop(1, 'rgba(' + orb.color.r + ',' + orb.color.g + ',' + orb.color.b + ',0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAura(breath) {
    var cx = AURA.x * canvas.width;
    var cy = AURA.y * canvas.height;
    var baseR = AURA.radius * canvas.width;
    var r = baseR * breath.scale;

    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(' + AURA.colorInner.r + ',' + AURA.colorInner.g + ',' + AURA.colorInner.b + ',' + breath.opacity + ')');
    grad.addColorStop(0.4, 'rgba(' + AURA.colorMid.r + ',' + AURA.colorMid.g + ',' + AURA.colorMid.b + ',' + (breath.opacity * 0.5) + ')');
    grad.addColorStop(1, 'rgba(' + AURA.colorMid.r + ',' + AURA.colorMid.g + ',' + AURA.colorMid.b + ',0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticles(elapsed) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var px = (p.x + Math.sin(elapsed * p.speedX + p.phaseX) * p.ampX) * canvas.width;
      var py = (p.y + Math.cos(elapsed * p.speedY + p.phaseY) * p.ampY) * canvas.height;

      ctx.fillStyle = 'rgba(248, 248, 246, ' + p.opacity + ')';
      ctx.beginPath();
      ctx.arc(px, py, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* --- Render frame ----------------------------------------- */
  function render(timestamp) {
    if (!startTime) startTime = timestamp;
    var elapsed = timestamp - startTime;

    // Performance budget
    if (lastFrameTime) {
      var delta = timestamp - lastFrameTime;
      if (delta > PERF_BUDGET_MS) {
        perfFailCount++;
        if (perfFailCount >= PERF_FAIL_THRESHOLD && particles.length > 4) {
          particles = particles.slice(0, 4);
          perfFailCount = 0;
        }
      } else {
        perfFailCount = 0;
      }
    }
    lastFrameTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Compositing: lighter for luminous blending
    ctx.globalCompositeOperation = 'lighter';

    drawOrbs(elapsed);

    var breath = getBreathState(elapsed);
    drawAura(breath);

    // Reset to default for particles (they're tiny white dots, 'lighter' would over-brighten)
    ctx.globalCompositeOperation = 'source-over';
    drawParticles(elapsed);

    requestAnimationFrame(render);
  }

  /* --- Static frame for reduced motion ---------------------- */
  function renderStaticFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';

    // Orbs at mid-position
    drawOrbs(TOTAL / 2);

    // Aura at rest state
    drawAura({ scale: AURA.scaleMin, opacity: AURA.opacityMin });

    ctx.globalCompositeOperation = 'source-over';
    // No particles in reduced motion
  }

  /* --- Resize handler --------------------------------------- */
  var resizeTimer;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      var hero = canvas.parentElement;
      if (!hero) return;
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
      initParticles();
      if (reducedMotion) renderStaticFrame();
    }, 150);
  }

  /* --- Init ------------------------------------------------- */
  function init() {
    canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    if (!ctx) return;

    var hero = canvas.parentElement;
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;

    initParticles();

    if (reducedMotion) {
      renderStaticFrame();
    } else {
      requestAnimationFrame(render);
    }

    window.addEventListener('resize', handleResize);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
