/* ============================================================
   VirWave — Main JS
   Handles: nav toggle, visibility system, shared utilities
   ============================================================ */

(function () {
  'use strict';

  /* --- Visibility / Hidden-pages system ---------------------- */
  // Reads /_config.json to determine which sections/pages to hide.
  // Any element with data-section="key" will be hidden if config says so.
  // Pages listed under "hiddenPages" will redirect to home.

  let siteConfig = null;

  async function loadConfig() {
    try {
      const base = getBasePath();
      const res = await fetch(base + '_config.json');
      if (!res.ok) return {};
      siteConfig = await res.json();
      return siteConfig;
    } catch {
      siteConfig = {};
      return {};
    }
  }

  function applyVisibility(config) {
    if (!config) return;

    // Hide sections
    const hiddenSections = config.hiddenSections || [];
    hiddenSections.forEach(function (key) {
      const els = document.querySelectorAll('[data-section="' + key + '"]');
      els.forEach(function (el) { el.setAttribute('data-visibility', 'hidden'); });
    });

    // Hide nav items
    const hiddenNav = config.hiddenNav || [];
    hiddenNav.forEach(function (key) {
      const els = document.querySelectorAll('[data-nav="' + key + '"]');
      els.forEach(function (el) { el.setAttribute('data-visibility', 'hidden'); });
    });

    // Redirect if on a hidden page
    const hiddenPages = config.hiddenPages || [];
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    for (var i = 0; i < hiddenPages.length; i++) {
      var hp = hiddenPages[i].replace(/\/+$/, '') || '/';
      if (path === hp || path === hp + '/index.html') {
        window.location.href = getBasePath();
        return;
      }
    }
  }

  /* --- Base path helper (works with GitHub Pages subdir) ----- */
  function getBasePath() {
    // If served from virwave-website/ subdir on GitHub Pages
    var meta = document.querySelector('meta[name="base-path"]');
    if (meta) return meta.getAttribute('content');
    return '/';
  }
  window.VW = window.VW || {};
  window.VW.getBasePath = getBasePath;

  /* --- Mobile nav toggle ------------------------------------- */
  function initNav() {
    var toggle = document.getElementById('nav-toggle');
    var links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      links.classList.toggle('open');
    });

    // Close nav when a link is clicked (mobile)
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('open')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* --- Current page highlight -------------------------------- */
  function highlightCurrentPage() {
    var path = window.location.pathname;
    document.querySelectorAll('.nav-links a').forEach(function (a) {
      var href = a.getAttribute('href');
      if (!href) return;
      // Normalize
      var linkPath = new URL(href, window.location.origin).pathname;
      if (path === linkPath || (linkPath !== '/' && path.startsWith(linkPath))) {
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  /* --- Smooth scroll for anchor links ------------------------ */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = document.querySelector(a.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* --- Threshold array helper -------------------------------- */
  function buildThresholdArray(steps) {
    return Array.from({ length: steps + 1 }, function (_, i) { return i / steps; });
  }

  /* --- Scroll Reveal ----------------------------------------- */
  function initScrollReveal() {
    // Skip if reduced motion is preferred
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var targets = document.querySelectorAll(
      '.section-header, .card, .card-horizontal, .card-research, .timeline-step, .phone-frame, .trust-strip, .founder-quote blockquote, .breathing-reveal, .blog-card, .contact-buttons, .product-spread__text, .product-spread__visual, .b2b-item, .products-closing, .event-card, .events-room-card, .events-privacy-card, .events-cta-card, .realm, .archetype-card, .archetypes-cta'
    );
    if (!targets.length) return;

    targets.forEach(function (el) { el.classList.add('reveal'); });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          // Stagger cards within a grid
          var parent = entry.target.parentElement;
          var siblings = parent ? parent.querySelectorAll('.reveal') : [];
          var index = Array.prototype.indexOf.call(siblings, entry.target);
          var delay = index > 0 ? index * 100 : 0;

          setTimeout(function () {
            entry.target.classList.add('revealed');
          }, delay);

          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    targets.forEach(function (el) { observer.observe(el); });

    // Hero canvas fade-out on scroll
    var heroCanvas = document.getElementById('hero-canvas');
    var hero = document.querySelector('.hero');
    if (hero && heroCanvas) {
      var heroObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          heroCanvas.style.opacity = entry.intersectionRatio;
        });
      }, { threshold: buildThresholdArray(20) });
      heroObserver.observe(hero);
    }
  }

  /* --- Homepage immersive nav -------------------------------- */
  function initImmersiveNav() {
    var nav = document.querySelector('.site-nav');
    var hero = document.querySelector('.hero');
    if (!nav || !hero) return;

    var navObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        // Solidify nav when hero is less than 20% visible
        if (entry.intersectionRatio < 0.2) {
          nav.classList.remove('nav-immersive');
        } else {
          nav.classList.add('nav-immersive');
        }
      });
    }, { threshold: [0, 0.2, 0.5, 1] });

    navObserver.observe(hero);
  }

  /* --- Hero headline: word-by-word split --------------------- */
  function splitHeadingWords() {
    var h = document.querySelector('[data-split-words]');
    if (!h) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var wordIndex = 0;
    var newNodes = [];
    Array.prototype.forEach.call(h.childNodes, function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var text = node.textContent;
        var parts = text.split(/(\s+)/);
        parts.forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            newNodes.push(document.createTextNode(' '));
          } else {
            var span = document.createElement('span');
            span.className = 'word';
            span.style.setProperty('--word-index', wordIndex);
            span.textContent = part;
            newNodes.push(span);
            wordIndex++;
          }
        });
      } else {
        // preserve <br> and similar
        newNodes.push(node.cloneNode(true));
      }
    });
    h.textContent = '';
    newNodes.forEach(function (n) { h.appendChild(n); });
  }

  /* --- Magnetic hover --------------------------------------- */
  function initMagnetic() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Skip on coarse/touch pointers (no useful cursor to track)
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    var MAX_PULL = 6; // px
    var RADIUS = 90;  // px — activation distance from element center

    var els = document.querySelectorAll('[data-magnetic]');
    els.forEach(function (el) {
      function onMove(e) {
        var rect = el.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = e.clientX - cx;
        var dy = e.clientY - cy;
        var dist = Math.hypot(dx, dy);
        if (dist > RADIUS) {
          reset();
          return;
        }
        var strength = 1 - dist / RADIUS;
        el.classList.add('is-magnetized');
        el.style.setProperty('--magnet-x', (dx * 0.2 * strength).toFixed(2) + 'px');
        el.style.setProperty('--magnet-y', (dy * 0.2 * strength).toFixed(2) + 'px');

        // Follow cursor for card glow
        if (el.classList.contains('archetype-card')) {
          var hx = ((e.clientX - rect.left) / rect.width) * 100;
          var hy = ((e.clientY - rect.top) / rect.height) * 100;
          el.style.setProperty('--hover-x', hx + '%');
          el.style.setProperty('--hover-y', hy + '%');
        }

        // Clamp
        var x = parseFloat(el.style.getPropertyValue('--magnet-x'));
        var y = parseFloat(el.style.getPropertyValue('--magnet-y'));
        if (Math.abs(x) > MAX_PULL) {
          el.style.setProperty('--magnet-x', (MAX_PULL * Math.sign(x)) + 'px');
        }
        if (Math.abs(y) > MAX_PULL) {
          el.style.setProperty('--magnet-y', (MAX_PULL * Math.sign(y)) + 'px');
        }
      }
      function reset() {
        el.classList.remove('is-magnetized');
        el.style.setProperty('--magnet-x', '0px');
        el.style.setProperty('--magnet-y', '0px');
      }
      window.addEventListener('pointermove', onMove, { passive: true });
      el.addEventListener('pointerleave', reset);
    });
  }

  /* --- Scroll-linked parallax ------------------------------- */
  function initParallax() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var layers = document.querySelectorAll('.parallax-layer');
    if (!layers.length) return;

    var viewportH = window.innerHeight;
    var ticking = false;

    function update() {
      layers.forEach(function (el) {
        var rect = el.getBoundingClientRect();
        // Only compute when in/near viewport
        if (rect.bottom < -200 || rect.top > viewportH + 200) return;
        var speed = parseFloat(el.getAttribute('data-parallax-speed')) || 0.1;
        // Distance from viewport center, expressed relative to viewport height
        var center = rect.top + rect.height / 2;
        var offset = (center - viewportH / 2) * -speed;
        el.style.transform = 'translate3d(0, ' + offset.toFixed(1) + 'px, 0)';
      });
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () {
      viewportH = window.innerHeight;
      onScroll();
    });
    update();
  }

  /* --- Archetype card tap-to-expand (touch) ----------------- */
  function initArchetypeToggle() {
    var cards = document.querySelectorAll('.archetype-card');
    cards.forEach(function (card) {
      card.addEventListener('click', function () {
        // On hover-capable devices, hover CSS handles it; allow click to pin-open.
        var open = card.classList.toggle('is-open');
        card.setAttribute('aria-expanded', String(open));
      });
    });
  }

  /* --- Archetypes: realm-tinted blob ------------------------ */
  function initRealmTint() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var blob = document.querySelector('.blob-archetypes');
    if (!blob) return;

    var TINTS = {
      grounded:  'rgba(74, 122, 74, 0.32)',
      flowing:   'rgba(42, 154, 148, 0.32)',
      signaling: 'rgba(196, 114, 26, 0.28)',
      radiating: 'rgba(196, 150, 10, 0.30)'
    };

    var observer = new IntersectionObserver(function (entries) {
      // Pick the most-visible realm
      var best = null;
      var bestRatio = 0;
      entries.forEach(function (entry) {
        if (entry.intersectionRatio > bestRatio) {
          bestRatio = entry.intersectionRatio;
          best = entry.target;
        }
      });
      if (best && bestRatio > 0.25) {
        var realm = best.getAttribute('data-realm');
        blob.style.setProperty('--realm-tint', TINTS[realm] || 'rgba(10,126,164,0.28)');
      }
    }, { threshold: [0.25, 0.5, 0.75] });

    document.querySelectorAll('.realm').forEach(function (r) { observer.observe(r); });
  }

  /* --- Init -------------------------------------------------- */
  async function init() {
    var config = await loadConfig();
    applyVisibility(config);
    initNav();
    highlightCurrentPage();
    initSmoothScroll();
    initImmersiveNav();
    splitHeadingWords();
    initScrollReveal();
    initMagnetic();
    initParallax();
    initArchetypeToggle();
    initRealmTint();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
