/* ============================================================
   VirWave — Hero Canvas Atmosphere
   Renders a breathing BOX SHAPE that progressively draws its
   outline, with a radial aura glow behind it, ambient orbs,
   and particles. Matches the app's actual breathing animation.

   Box breathing: 4 equal phases, each draws one side of the box.
   Inhale = top, Hold = right, Exhale = bottom, Rest = left.

   No mouse interaction. No parallax.
   ============================================================ */

(function () {
  'use strict';

  /* --- Configuration ---------------------------------------- */
  // Box breathing: 4 equal 4s phases = 16s total
  var PHASE_DURATION = 4000;
  var TOTAL = PHASE_DURATION * 4; // 16000ms

  var SHAPE = {
    x: 0.60,          // center X (60% from left, asymmetric)
    y: 0.48,          // center Y
    sizeRatio: 0.22,  // proportion of min(width, height)
    strokeWidth: 2.5,
    cornerRadius: 6,
    color: { r: 10, g: 126, b: 164 },     // teal
    colorEnd: { r: 140, g: 235, b: 170 },  // mint (for gradient)
    baseOpacity: 0.12,     // dim guide outline
    strokeOpacity: 0.85,   // active drawing line
    tailOpacity: 0.25       // luminous tail after full cycle
  };

  var AURA = {
    spreadRatio: 1.8,  // aura radius = shape size * this
    opacityMin: 0.10,
    opacityMax: 0.22
  };

  var ORBS = [
    { x: 0.25, y: 0.3, radius: 0.32, color: { r: 96, g: 165, b: 250 }, opacity: 0.08, dx: 0.06, dy: 0.04, durX: 45000, durY: 52000 },
    { x: 0.78, y: 0.65, radius: 0.28, color: { r: 167, g: 139, b: 250 }, opacity: 0.06, dx: 0.05, dy: 0.06, durX: 55000, durY: 48000 }
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
  // Matches the app's easings.loop = Easing.inOut(Easing.ease)
  // Approximation of cubic-bezier(0.42, 0, 0.58, 1)
  function easeInOut(t) {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /* --- Breathing cycle -------------------------------------- */
  function getCycleProgress(elapsed) {
    // Overall cycle progress 0→1 over 16s
    var raw = (elapsed % TOTAL) / TOTAL;

    // Ease within each quarter (each side of the box)
    var quarter = Math.floor(raw * 4);
    var quarterProgress = (raw * 4) - quarter;
    var easedQuarter = easeInOut(quarterProgress);

    return (quarter + easedQuarter) / 4;
  }

  function getAuraState(elapsed) {
    var t = (elapsed % TOTAL) / TOTAL;
    // Aura pulses: brighter during inhale+hold (0-50%), dimmer during exhale+rest (50-100%)
    var pulse = t < 0.25
      ? easeInOut(t * 4)            // inhale: grow
      : t < 0.5
        ? 1                                // hold: peak
        : t < 0.75
          ? 1 - easeInOut((t - 0.5) * 4) // exhale: shrink
          : 0;                              // rest: dim
    return {
      opacity: AURA.opacityMin + (AURA.opacityMax - AURA.opacityMin) * pulse,
      scale: 0.96 + 0.08 * pulse  // 0.96 → 1.04
    };
  }

  /* --- Particle factory ------------------------------------- */
  function createParticle() {
    return {
      x: Math.random(),
      y: Math.random(),
      size: 1.5 + Math.random() * 2,
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

  /* --- Build box path --------------------------------------- */
  function buildBoxPath(cx, cy, side, r) {
    // Rounded rectangle path drawn clockwise from top-left
    var half = side / 2;
    var x0 = cx - half, y0 = cy - half;
    var x1 = cx + half, y1 = cy + half;
    var path = new Path2D();
    path.moveTo(x0 + r, y0);
    path.lineTo(x1 - r, y0);
    path.arcTo(x1, y0, x1, y0 + r, r);
    path.lineTo(x1, y1 - r);
    path.arcTo(x1, y1, x1 - r, y1, r);
    path.lineTo(x0 + r, y1);
    path.arcTo(x0, y1, x0, y1 - r, r);
    path.lineTo(x0, y0 + r);
    path.arcTo(x0, y0, x0 + r, y0, r);
    path.closePath();
    return path;
  }

  /* --- Render layers ---------------------------------------- */
  function drawOrbs(elapsed) {
    for (var i = 0; i < ORBS.length; i++) {
      var orb = ORBS[i];
      var ox = orb.x + Math.sin(elapsed / orb.durX * Math.PI * 2) * orb.dx;
      var oy = orb.y + Math.cos(elapsed / orb.durY * Math.PI * 2) * orb.dy;
      var px = ox * canvas.width;
      var py = oy * canvas.height;
      var r = orb.radius * canvas.width;

      var grad = ctx.createRadialGradient(px, py, 0, px, py, r);
      grad.addColorStop(0, 'rgba(' + orb.color.r + ',' + orb.color.g + ',' + orb.color.b + ',' + orb.opacity + ')');
      grad.addColorStop(1, 'rgba(' + orb.color.r + ',' + orb.color.g + ',' + orb.color.b + ',0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawAura(cx, cy, shapeSize, auraState) {
    var r = shapeSize * AURA.spreadRatio * auraState.scale;

    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    var a = auraState.opacity;
    grad.addColorStop(0, 'rgba(' + SHAPE.color.r + ',' + SHAPE.color.g + ',' + SHAPE.color.b + ',' + a + ')');
    grad.addColorStop(0.35, 'rgba(' + SHAPE.colorEnd.r + ',' + SHAPE.colorEnd.g + ',' + SHAPE.colorEnd.b + ',' + (a * 0.4) + ')');
    grad.addColorStop(1, 'rgba(' + SHAPE.colorEnd.r + ',' + SHAPE.colorEnd.g + ',' + SHAPE.colorEnd.b + ',0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBreathingShape(elapsed) {
    var cx = SHAPE.x * canvas.width;
    var cy = SHAPE.y * canvas.height;
    var side = Math.min(canvas.width, canvas.height) * SHAPE.sizeRatio;
    var r = SHAPE.cornerRadius;
    var perimeter = (side - 2 * r) * 4 + 2 * Math.PI * r; // rounded rect perimeter

    var boxPath = buildBoxPath(cx, cy, side, r);
    var cycleProgress = getCycleProgress(elapsed);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = SHAPE.strokeWidth;

    // Layer 1: Base outline (always visible, dim guide)
    ctx.setLineDash([]);
    ctx.globalAlpha = SHAPE.baseOpacity;
    ctx.strokeStyle = 'rgba(' + SHAPE.color.r + ',' + SHAPE.color.g + ',' + SHAPE.color.b + ',1)';
    ctx.stroke(boxPath);

    // Layer 2: Luminous tail (full outline at low opacity, fades between cycles)
    var cycleFraction = (elapsed % TOTAL) / TOTAL;
    var tailFade = cycleFraction < 0.1 ? 1 - (cycleFraction / 0.1) : 0; // fades in first 10% of new cycle
    if (tailFade > 0) {
      ctx.globalAlpha = SHAPE.tailOpacity * tailFade;
      ctx.stroke(boxPath);
    }

    // Layer 3: Animated progress line (the drawing stroke)
    ctx.setLineDash([perimeter]);
    ctx.lineDashOffset = perimeter * (1 - cycleProgress);
    ctx.globalAlpha = SHAPE.strokeOpacity;

    // Gradient stroke: teal → mint
    var grad = ctx.createLinearGradient(cx - side / 2, cy - side / 2, cx + side / 2, cy + side / 2);
    grad.addColorStop(0, 'rgba(' + SHAPE.color.r + ',' + SHAPE.color.g + ',' + SHAPE.color.b + ',1)');
    grad.addColorStop(1, 'rgba(' + SHAPE.colorEnd.r + ',' + SHAPE.colorEnd.g + ',' + SHAPE.colorEnd.b + ',1)');
    ctx.strokeStyle = grad;
    ctx.stroke(boxPath);

    // Reset
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
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

    // Background orbs (lighter compositing for luminous blending)
    ctx.globalCompositeOperation = 'lighter';
    drawOrbs(elapsed);

    // Aura glow behind shape
    var cx = SHAPE.x * canvas.width;
    var cy = SHAPE.y * canvas.height;
    var shapeSize = Math.min(canvas.width, canvas.height) * SHAPE.sizeRatio;
    var auraState = getAuraState(elapsed);
    drawAura(cx, cy, shapeSize, auraState);

    // Shape and particles use source-over
    ctx.globalCompositeOperation = 'source-over';
    drawBreathingShape(elapsed);
    drawParticles(elapsed);

    requestAnimationFrame(render);
  }

  /* --- Static frame for reduced motion ---------------------- */
  function renderStaticFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    drawOrbs(TOTAL / 2);

    var cx = SHAPE.x * canvas.width;
    var cy = SHAPE.y * canvas.height;
    var shapeSize = Math.min(canvas.width, canvas.height) * SHAPE.sizeRatio;
    drawAura(cx, cy, shapeSize, { opacity: AURA.opacityMin, scale: 0.96 });

    ctx.globalCompositeOperation = 'source-over';

    // Draw the box at 50% progress (half drawn)
    var side = shapeSize;
    var boxPath = buildBoxPath(cx, cy, side, SHAPE.cornerRadius);
    var perimeter = (side - 2 * SHAPE.cornerRadius) * 4 + 2 * Math.PI * SHAPE.cornerRadius;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = SHAPE.strokeWidth;
    ctx.setLineDash([]);
    ctx.globalAlpha = SHAPE.baseOpacity;
    ctx.strokeStyle = 'rgba(' + SHAPE.color.r + ',' + SHAPE.color.g + ',' + SHAPE.color.b + ',1)';
    ctx.stroke(boxPath);

    ctx.setLineDash([perimeter]);
    ctx.lineDashOffset = perimeter * 0.5;
    ctx.globalAlpha = SHAPE.strokeOpacity * 0.6;
    ctx.stroke(boxPath);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
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
