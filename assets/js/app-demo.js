/* ============================================================
   VirWave — App Demo
   Handles the interactive shape picker in the app-preview section.
   Swaps SVG shape and syncs animation to the current phase offset.
   ============================================================ */

(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var CYCLE = 16000; // ms — matches CSS 16s animation

  var SHAPES = {
    box: {
      label:     'Box',
      dasharray: 400,
      anim:      'draw-box',
      create: function () {
        var el = document.createElementNS(NS, 'path');
        el.setAttribute('d', 'M40,40 L160,40 L160,160 L40,160 Z');
        el.setAttribute('stroke-linecap', 'round');
        el.setAttribute('stroke-linejoin', 'round');
        return el;
      }
    },
    circle: {
      label:     'Circle',
      dasharray: 503,
      anim:      'draw-circle',
      create: function () {
        var el = document.createElementNS(NS, 'circle');
        el.setAttribute('cx', '100');
        el.setAttribute('cy', '100');
        el.setAttribute('r', '80');
        return el;
      }
    },
    triangle: {
      label:     'Triangle',
      dasharray: 420,
      anim:      'draw-triangle',
      create: function () {
        var el = document.createElementNS(NS, 'path');
        el.setAttribute('d', 'M100,30 L174,150 L26,150 Z');
        el.setAttribute('stroke-linejoin', 'round');
        return el;
      }
    }
  };

  var activeShape = 'box';

  function setShape(key) {
    if (key === activeShape) return;
    var def = SHAPES[key];
    if (!def) return;

    var svg = document.querySelector('.app-demo-shape');
    var chip = document.querySelector('.phone-shape-chip');
    if (!svg) return;

    // Preserve <defs> (gradient lives there)
    var defs = svg.querySelector('defs');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    if (defs) svg.appendChild(defs);

    // Build new SVG element
    var el = def.create();
    el.setAttribute('stroke-dasharray', def.dasharray);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'url(#shapeGrad)');
    el.setAttribute('stroke-width', '2.5');
    el.classList.add('shape-draw', def.anim);

    // Sync to current cycle phase so transition feels seamless
    var phaseMs = Date.now() % CYCLE;
    el.style.animationDelay = '-' + (phaseMs / 1000).toFixed(3) + 's';

    svg.appendChild(el);

    if (chip) chip.textContent = def.label;
    activeShape = key;
  }

  function init() {
    var btns = document.querySelectorAll('.shape-picker-btn');
    if (!btns.length) return;

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        btns.forEach(function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        setShape(btn.getAttribute('data-shape'));
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
