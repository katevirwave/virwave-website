/* ============================================================
   Book gateway (home)
   The cover turns to reveal a two-page spread: the VirWave world
   on the left leaf, AIKEI on the right. Without JS the <noscript>
   block in index.html renders the spread already open.
   ============================================================ */
(function () {
  'use strict';

  var gate = document.querySelector('[data-book-gate]');
  if (!gate) return;

  var cover   = gate.querySelector('[data-book-cover]');
  var caption = gate.querySelector('[data-book-caption]');
  var reduce  = window.matchMedia('(prefers-reduced-motion: reduce)');

  var CAPTION_CLOSED = gate.getAttribute('data-caption-closed') || '';
  var CAPTION_OPEN   = gate.getAttribute('data-caption-open') || '';

  function setCaption(text) {
    if (caption) caption.textContent = text;
  }

  var closer  = gate.querySelector('[data-book-close]');
  var autoOpen;

  /* Once the reader has decided either way, stop the book opening itself. */
  function cancelAutoOpen() {
    if (autoOpen) { window.clearTimeout(autoOpen); autoOpen = null; }
  }

  var turned;
  var stage = gate.querySelector('.book-stage');
  var aikeiPage = gate.querySelector('[data-book-door="aikei"]');
  var doorFallback = gate.querySelector('[data-book-door-fallback]');

  /* Chrome will not hit-test the AIKEI leaf inside the book's preserve-3d
     context: every click over the page lands on .book instead, so the link
     never fires. Nothing local to that subtree fixes it and flattening the
     context destroys the turn, so where the page proves unclickable we lay a
     real link over it from outside the 3D context. Browsers that hit-test it
     correctly never see the stand-in. */
  function openDoorFallback() {
    if (!doorFallback || !aikeiPage || !stage) return;

    var page = aikeiPage.getBoundingClientRect();
    if (!page.width || !page.height) return;

    /* elementFromPoint only answers for points on screen, so probe the middle
       of whatever part of the page is actually visible. If none of it is, the
       question can't be settled yet — try again once it scrolls into view. */
    var top = Math.max(page.top, 0);
    var bottom = Math.min(page.bottom, window.innerHeight);
    var left = Math.max(page.left, 0);
    var right = Math.min(page.right, window.innerWidth);
    if (bottom <= top || right <= left) {
      window.addEventListener('scroll', openDoorFallback, { once: true, passive: true });
      return;
    }

    var probe = document.elementFromPoint((left + right) / 2, (top + bottom) / 2);
    if (probe && probe.closest('[data-book-door="aikei"]')) {
      doorFallback.classList.remove('is-active');
      return;
    }

    var box = stage.getBoundingClientRect();
    doorFallback.style.left   = (page.left - box.left) + 'px';
    doorFallback.style.top    = (page.top - box.top) + 'px';
    doorFallback.style.width  = page.width + 'px';
    doorFallback.style.height = page.height + 'px';
    doorFallback.classList.add('is-active');
  }

  function markTurned(instantly) {
    window.clearTimeout(turned);
    turned = window.setTimeout(function () {
      gate.classList.add('is-turned');
      openDoorFallback();
    }, instantly ? 0 : 1150);
  }

  window.addEventListener('resize', function () {
    if (gate.classList.contains('is-turned')) openDoorFallback();
  });

  function open() {
    cancelAutoOpen();
    if (gate.classList.contains('is-open')) return;
    gate.classList.add('is-open');
    if (cover) cover.setAttribute('aria-expanded', 'true');
    setCaption(CAPTION_OPEN);
    markTurned(gate.classList.contains('is-instant'));
  }

  function close() {
    cancelAutoOpen();
    if (!gate.classList.contains('is-open')) return;
    /* Hand focus back to the cover before the closer leaves the tab order. */
    if (closer && gate.contains(document.activeElement) && cover) {
      cover.focus({ preventScroll: true });
    }
    window.clearTimeout(turned);
    gate.classList.remove('is-open');
    gate.classList.remove('is-turned');
    if (doorFallback) doorFallback.classList.remove('is-active');
    if (cover) cover.setAttribute('aria-expanded', 'false');
    setCaption(CAPTION_CLOSED);
  }

  /* Deep links (/#team, /#building…) and reduced motion skip the turn. */
  var instant = reduce.matches || (window.location.hash && window.location.hash.length > 1);

  if (cover) cover.addEventListener('click', open);
  if (closer) closer.addEventListener('click', close);

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (!gate.classList.contains('is-open')) return;
    close();
  });

  if (instant) {
    gate.classList.add('is-instant');
    open();
  } else {
    setCaption(CAPTION_CLOSED);

    /* Nobody should be stranded on a closed book. */
    autoOpen = window.setTimeout(open, 2200);
    gate.addEventListener('click', cancelAutoOpen, { once: true });
  }

  /* Turning the AIKEI leaf on the way out. */
  var aikei = gate.querySelector('[data-book-door="aikei"]');
  [aikei, doorFallback].forEach(function (door) {
    if (!door) return;
    door.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduce.matches) return;
      if (window.matchMedia('(max-width: 860px)').matches) return;

      var href = door.getAttribute('href');
      if (!href) return;

      e.preventDefault();
      gate.classList.add('is-leaving');
      window.setTimeout(function () { window.location.href = href; }, 380);
      /* If navigation is blocked for any reason, put the page back. */
      window.setTimeout(function () { gate.classList.remove('is-leaving'); }, 3000);
    });
  });
})();
