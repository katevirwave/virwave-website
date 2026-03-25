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
      '.section-header, .card, .card-horizontal, .card-research, .timeline-step, .phone-frame, .trust-strip, .founder-quote blockquote, .breathing-reveal, .blog-card, .contact-buttons'
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

  /* --- Init -------------------------------------------------- */
  async function init() {
    var config = await loadConfig();
    applyVisibility(config);
    initNav();
    highlightCurrentPage();
    initSmoothScroll();
    initImmersiveNav();
    initScrollReveal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
