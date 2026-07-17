/* ============================================================
   VirWave — Plushie page
   Renders a plushie's personality for /plushie/<code>.

   Shared by /plushie/index.html (code via ?c=) and /404.html
   (code via path segment, for pretty /plushie/XXXXXX URLs on
   GitHub Pages).

   Data model:
     - `code` is a 6-char uppercase alphanumeric primary key.
     - `name`, `species`, `origin`, `home`, `story` are user-editable.
     - species / origin / home have deterministic defaults derived from
       the code (FNV-1a hash) so a fresh tag already has a personality.
   ============================================================ */

(function () {
  'use strict';

  var CODE_RE = /^[A-Z0-9]{6}$/;

  /* --- Whimsical default pools ------------------------------- */
  /* Keep these alphabetised within category so swaps don't silently
     change an existing plushie's identity mid-test. Appending new
     entries at the end is safe; reordering or removing is not. */
  var SPECIES = [
    'bear', 'bunny', 'cat', 'deer', 'dog', 'dragon', 'elephant', 'fox',
    'giraffe', 'hedgehog', 'hippo', 'koala', 'lemur', 'lion', 'llama',
    'monkey', 'mouse', 'otter', 'owl', 'panda', 'penguin', 'rabbit',
    'raccoon', 'seal', 'sloth', 'tiger', 'turtle', 'whale', 'wolf', 'yak'
  ];
  var ORIGINS = [
    'Argentina', 'Brazil', 'Canada', 'Chile', 'Cuba', 'Denmark', 'Egypt',
    'Ethiopia', 'Finland', 'Greece', 'Iceland', 'India', 'Indonesia',
    'Ireland', 'Japan', 'Kenya', 'Madagascar', 'Mexico', 'Mongolia',
    'Morocco', 'Nepal', 'New Zealand', 'Norway', 'Peru', 'Portugal',
    'Scotland', 'Tanzania', 'Turkey', 'Vietnam', 'Wales'
  ];
  var HOMES = [
    'Amsterdam', 'Athens', 'Barcelona', 'Berlin', 'Brussels', 'Budapest',
    'Cape Town', 'Copenhagen', 'Dublin', 'Edinburgh', 'Helsinki', 'Kyoto',
    'Lisbon', 'London', 'Melbourne', 'Montreal', 'Oslo', 'Paris', 'Prague',
    'Reykjavik', 'Rome', 'Seoul', 'Singapore', 'Stockholm', 'Sydney',
    'Tokyo', 'Vancouver', 'Vienna', 'Warsaw', 'Zurich'
  ];

  /* --- FNV-1a 32-bit hash (stable across browsers) ---------- */
  function fnv1a(str, seed) {
    var h = (seed == null ? 2166136261 : seed) >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function pickFrom(pool, code, seed) {
    return pool[fnv1a(code, seed) % pool.length];
  }
  function defaultsFor(code) {
    return {
      species: pickFrom(SPECIES, code, 0x01000193),
      origin:  pickFrom(ORIGINS, code, 0x811C9DC5),
      home:    pickFrom(HOMES,   code, 0xDEADBEEF)
    };
  }

  /* --- Code extraction --------------------------------------- */
  function getCodeFromURL() {
    // Query string form: /plushie/?c=ABCDEF
    var params = new URLSearchParams(window.location.search);
    var q = (params.get('c') || params.get('code') || '').trim().toUpperCase();
    if (CODE_RE.test(q)) return q;

    // Path form: /plushie/ABCDEF (served via 404.html on GitHub Pages)
    var parts = window.location.pathname.split('/').filter(Boolean);
    if (parts[0] === 'plushie' && parts[1]) {
      var p = parts[1].trim().toUpperCase();
      if (CODE_RE.test(p)) return p;
    }

    return null;
  }

  /* --- Supabase I/O ------------------------------------------ */
  async function sbRequest(path, options) {
    var config = await VWSupabase.getConfig();
    if (!config || !config.url || !config.anonKey) {
      throw new Error('Supabase not configured.');
    }
    var headers = Object.assign({
      'apikey': config.anonKey,
      'Authorization': 'Bearer ' + config.anonKey
    }, (options && options.headers) || {});
    var res = await fetch(config.url + '/rest/v1/' + path, Object.assign({}, options, { headers: headers }));
    return res;
  }

  async function fetchPlushie(code) {
    var res = await sbRequest('plushies?code=eq.' + encodeURIComponent(code) + '&select=*', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    var rows = await res.json();
    return rows && rows[0] ? rows[0] : null;
  }

  async function createPlushie(code) {
    var res = await sbRequest('plushies', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ code: code })
    });
    if (res.ok) {
      var rows = await res.json();
      return rows && rows[0] ? rows[0] : { code: code };
    }
    // If another tab raced us, a 409 is fine — fetch the winner.
    if (res.status === 409) return await fetchPlushie(code);
    return null;
  }

  async function updatePlushieField(code, field, value) {
    var body = {};
    body[field] = value === '' ? null : value;
    var res = await sbRequest('plushies?code=eq.' + encodeURIComponent(code), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(body)
    });
    return res.ok;
  }

  /* --- Rendering --------------------------------------------- */
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), attrs[k]);
        else el.setAttribute(k, attrs[k]);
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }

  /* Cute, species-agnostic plushie SVG — earned brand consistency
     by sticking to one friendly shape and leaning on the text to
     describe the specific animal. */
  var PLUSHIE_SVG =
    '<svg viewBox="0 0 220 220" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs>' +
        '<radialGradient id="plushie-glow" cx="50%" cy="42%" r="55%">' +
          '<stop offset="0%"  stop-color="rgba(140,235,170,0.35)"/>' +
          '<stop offset="60%" stop-color="rgba(10,126,164,0.12)"/>' +
          '<stop offset="100%" stop-color="rgba(10,126,164,0)"/>' +
        '</radialGradient>' +
      '</defs>' +
      '<circle cx="110" cy="110" r="110" fill="url(#plushie-glow)"/>' +
      '<g class="plushie-svg-body">' +
        '<ellipse cx="72"  cy="70"  rx="18" ry="22" fill="currentColor" opacity="0.85"/>' +
        '<ellipse cx="148" cy="70"  rx="18" ry="22" fill="currentColor" opacity="0.85"/>' +
        '<ellipse cx="110" cy="130" rx="68" ry="60" fill="currentColor"/>' +
        '<circle  cx="90"  cy="120" r="5"  fill="#0D2137"/>' +
        '<circle  cx="130" cy="120" r="5"  fill="#0D2137"/>' +
        '<path d="M 100 142 Q 110 150 120 142" stroke="#0D2137" stroke-width="2.5" ' +
          'stroke-linecap="round" fill="none"/>' +
        '<circle  cx="110" cy="133" r="3"  fill="#0D2137" opacity="0.55"/>' +
      '</g>' +
    '</svg>';

  function makeEditable(el, field, code, opts) {
    opts = opts || {};
    var maxLen = opts.maxLength || 60;
    var hint = opts.hint || 'Click to edit';
    var fallback = opts.fallback || '';
    var initial = opts.initial || '';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', hint);
    el.classList.add('plushie-editable');

    function render(stored) {
      // What actually gets displayed: the stored value if present,
      // else the fallback (hash-derived default), else the placeholder
      // text with the `is-empty` styling.
      el.dataset.currentValue = stored;
      if (stored) {
        el.textContent = stored;
        el.classList.remove('is-empty');
      } else if (fallback) {
        el.textContent = fallback;
        el.classList.remove('is-empty');
      } else {
        el.textContent = el.dataset.placeholder || '';
        el.classList.add('is-empty');
      }
    }

    // Initial paint — no network, same display logic as commit().
    render(initial);

    function commit(newValue) {
      var trimmed = newValue.trim().slice(0, maxLen);
      render(trimmed);
      updatePlushieField(code, field, trimmed).then(function (ok) {
        if (!ok) {
          el.classList.add('is-error');
          setTimeout(function () { el.classList.remove('is-error'); }, 1500);
        }
      });
    }

    function enterEdit() {
      if (el.classList.contains('is-editing')) return;
      // Prefill with the currently displayed value (stored or fallback),
      // not the placeholder — the user should see what they're editing.
      var stored = el.dataset.currentValue || '';
      var prefill = stored || (el.classList.contains('is-empty') ? '' : fallback);

      el.classList.add('is-editing');
      var input = document.createElement(opts.multiline ? 'textarea' : 'input');
      input.className = 'plushie-input';
      input.value = prefill;
      input.maxLength = maxLen;
      if (!opts.multiline) input.type = 'text';
      input.setAttribute('aria-label', hint);

      el.textContent = '';
      el.appendChild(input);
      input.focus();
      input.select();

      function exit(save) {
        el.classList.remove('is-editing');
        if (save) {
          commit(input.value);
        } else {
          // Revert to whatever was displayed before (stored or fallback).
          render(stored);
        }
      }

      input.addEventListener('blur', function () { exit(true); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); exit(false); input.blur(); }
        if (e.key === 'Enter' && !opts.multiline) { e.preventDefault(); exit(true); }
      });
    }

    el.addEventListener('click', enterEdit);
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); enterEdit(); }
    });
  }

  function renderPlushie(mount, plushie) {
    var code = plushie.code;
    var defaults = defaultsFor(code);

    mount.innerHTML = '';
    mount.classList.add('plushie-page');

    var card = h('div', { class: 'plushie-card' }, [
      h('div', { class: 'plushie-figure', 'aria-hidden': 'true' }),
      h('p', { class: 'section-eyebrow plushie-eyebrow', text: 'A VirWave plushie' }),
      h('h1', {
        class: 'plushie-name',
        id: 'plushie-name',
        'data-placeholder': 'Give me a name'
      }),
      h('p', { class: 'plushie-bio' }, [
        document.createTextNode('A '),
        h('span', { class: 'plushie-field', id: 'plushie-species', 'data-placeholder': 'species' }),
        document.createTextNode(' from '),
        h('span', { class: 'plushie-field', id: 'plushie-origin',  'data-placeholder': 'somewhere' }),
        document.createTextNode(', living in '),
        h('span', { class: 'plushie-field', id: 'plushie-home',    'data-placeholder': 'somewhere' }),
        document.createTextNode('.')
      ]),
      h('p', {
        class: 'plushie-story',
        id: 'plushie-story',
        'data-placeholder': 'Add a short story about this plushie…'
      }),
      h('div', { class: 'plushie-footer' }, [
        h('span', { class: 'plushie-code-label', text: 'Plushie code' }),
        h('code', { class: 'plushie-code', text: code })
      ]),
      h('p', { class: 'plushie-hint', text: 'Tap any field to edit. Changes save automatically.' })
    ]);

    mount.appendChild(card);

    // Render SVG into .plushie-figure
    card.querySelector('.plushie-figure').innerHTML = PLUSHIE_SVG;

    // Wire up editable fields — makeEditable handles all display state.
    function bind(selector, field, opts) {
      var el = card.querySelector(selector);
      opts.initial = plushie[field] || '';
      makeEditable(el, field, code, opts);
    }

    bind('#plushie-name',    'name',    { maxLength: 60,  hint: 'Edit name' });
    bind('#plushie-species', 'species', { maxLength: 40,  hint: 'Edit species', fallback: defaults.species });
    bind('#plushie-origin',  'origin',  { maxLength: 60,  hint: 'Edit where this plushie is from', fallback: defaults.origin });
    bind('#plushie-home',    'home',    { maxLength: 60,  hint: 'Edit where this plushie lives', fallback: defaults.home });
    bind('#plushie-story',   'story',   { maxLength: 500, hint: 'Edit story', multiline: true });
  }

  function renderMessage(mount, title, body) {
    mount.innerHTML = '';
    mount.classList.add('plushie-page');
    mount.appendChild(
      h('div', { class: 'plushie-card plushie-card--message' }, [
        h('p', { class: 'section-eyebrow plushie-eyebrow', text: 'Plushies' }),
        h('h1', { class: 'plushie-message-title', text: title }),
        h('p', { class: 'plushie-message-body', text: body }),
        h('a', { class: 'btn btn-ghost btn-sm', href: '/', text: 'Back to home' })
      ])
    );
  }

  /* --- Entry point ------------------------------------------- */
  async function init() {
    var mount = document.getElementById('plushie-mount');
    if (!mount) return;

    var code = getCodeFromURL();
    if (!code) {
      renderMessage(
        mount,
        'This page lives on a plushie',
        'Every VirWave plushie has its own page. Scan your plushie’s tag to visit it.'
      );
      return;
    }

    // Make sure the canonical pretty URL shows in the address bar,
    // even when we loaded via 404.html or ?c=.
    try {
      var desired = '/plushie/' + code;
      if (window.location.pathname + window.location.search !== desired) {
        window.history.replaceState(null, '', desired);
      }
    } catch (_) { /* history API unavailable, no-op */ }

    // Update the tab title so the plushie feels personal.
    try { document.title = code + ' — VirWave Plushie'; } catch (_) {}

    var plushie = await fetchPlushie(code);
    if (!plushie) {
      plushie = await createPlushie(code);
    }
    if (!plushie) {
      renderMessage(
        mount,
        'We couldn’t reach this plushie',
        'Something went wrong talking to the server. Check your connection and try again.'
      );
      return;
    }

    renderPlushie(mount, plushie);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
