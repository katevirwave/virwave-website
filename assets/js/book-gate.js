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

  function open() {
    if (gate.classList.contains('is-open')) return;
    gate.classList.add('is-open');
    if (cover) cover.setAttribute('aria-expanded', 'true');
    setCaption(CAPTION_OPEN);
  }

  /* Deep links (/#team, /#building…) and reduced motion skip the turn. */
  var instant = reduce.matches || (window.location.hash && window.location.hash.length > 1);

  if (instant) {
    gate.classList.add('is-instant');
    open();
  } else {
    setCaption(CAPTION_CLOSED);

    if (cover) {
      cover.addEventListener('click', open);
    }

    /* Nobody should be stranded on a closed book. */
    var autoOpen = window.setTimeout(open, 2200);
    gate.addEventListener('click', function () { window.clearTimeout(autoOpen); }, { once: true });
  }

  /* The mascot plate holds its poster frame when motion is unwelcome. */
  var plate = gate.querySelector('[data-book-plate]');
  if (plate && reduce.matches) {
    plate.removeAttribute('autoplay');
    plate.pause();
  }

  /* Turning the AIKEI leaf on the way out. */
  var aikei = gate.querySelector('[data-book-door="aikei"]');
  if (aikei) {
    aikei.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (reduce.matches) return;
      if (window.matchMedia('(max-width: 860px)').matches) return;

      var href = aikei.getAttribute('href');
      if (!href) return;

      e.preventDefault();
      gate.classList.add('is-leaving');
      window.setTimeout(function () { window.location.href = href; }, 380);
      /* If navigation is blocked for any reason, put the page back. */
      window.setTimeout(function () { gate.classList.remove('is-leaving'); }, 3000);
    });
  }
})();
