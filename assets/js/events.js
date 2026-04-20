/* ============================================================
   VirWave — Events renderer
   Reads /events/events.json and populates:
     - #events-upcoming  (upcoming grid)
     - #events-past      (archive grid, optional)
     - #events-upcoming-empty (empty state for upcoming)
   Optionally respects a data-limit attribute on mounts for the
   homepage teaser ("Where you'll find us").
   Defensive: textContent-only for user fields, https-only for URLs.
   ============================================================ */
(function () {
  'use strict';

  var FEED = '/events/events.json';

  var upcomingMount  = document.getElementById('events-upcoming');
  var pastMount      = document.getElementById('events-past');
  var upcomingEmpty  = document.getElementById('events-upcoming-empty');
  var archiveWrap    = document.getElementById('events-archive');
  var showAllBtn     = document.getElementById('events-show-all');

  if (!upcomingMount && !pastMount) return;

  var ARCHIVE_COLLAPSE_AT = 6;

  var KIND_LABELS = {
    talk:      'Talk',
    fair:      'Fair',
    workshop:  'Workshop',
    mixer:     'Mixer',
    dinner:    'Dinner',
    networking:'Networking'
  };

  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  fetch(FEED, { cache: 'no-cache' })
    .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function (events) { render(Array.isArray(events) ? events : []); })
    .catch(function (err) {
      if (typeof console !== 'undefined') console.warn('Events feed failed:', err);
      if (upcomingEmpty) upcomingEmpty.hidden = false;
      if (upcomingMount) upcomingMount.hidden = true;
      if (archiveWrap) archiveWrap.hidden = true;
    });

  function render(list) {
    var now = Date.now();
    var upcoming = [];
    var past = [];

    list.forEach(function (ev) {
      if (!ev || typeof ev !== 'object') return;
      var t = ev.date ? new Date(ev.date).getTime() : NaN;
      var status = ev.status || (isFinite(t) && t >= now ? 'upcoming' : 'past');
      (status === 'upcoming' ? upcoming : past).push(ev);
    });

    upcoming.sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    past.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

    if (upcomingMount) {
      var upLimit = parseLimit(upcomingMount);
      var upcomingSlice = upLimit > 0 ? upcoming.slice(0, upLimit) : upcoming;
      if (upcomingSlice.length === 0) {
        if (upcomingEmpty) upcomingEmpty.hidden = false;
      } else {
        if (upcomingEmpty) upcomingEmpty.hidden = true;
        upcomingSlice.forEach(function (ev) {
          upcomingMount.appendChild(buildCard(ev, 'upcoming'));
        });
      }
    }

    if (pastMount) {
      var pastLimit = parseLimit(pastMount);
      var pastList = pastLimit > 0 ? past.slice(0, pastLimit) : past;

      if (pastList.length === 0 && archiveWrap) {
        archiveWrap.hidden = true;
        return;
      }

      var collapsed = pastList.length > ARCHIVE_COLLAPSE_AT && !pastLimit;
      var visible = collapsed ? pastList.slice(0, ARCHIVE_COLLAPSE_AT) : pastList;

      visible.forEach(function (ev) {
        pastMount.appendChild(buildCard(ev, 'past'));
      });

      if (collapsed && showAllBtn) {
        showAllBtn.hidden = false;
        showAllBtn.addEventListener('click', function () {
          pastList.slice(ARCHIVE_COLLAPSE_AT).forEach(function (ev) {
            pastMount.appendChild(buildCard(ev, 'past'));
          });
          showAllBtn.hidden = true;
        });
      } else if (showAllBtn) {
        showAllBtn.hidden = true;
      }
    }
  }

  function parseLimit(mount) {
    var raw = mount.getAttribute('data-limit');
    var n = raw ? parseInt(raw, 10) : 0;
    return isFinite(n) && n > 0 ? n : 0;
  }

  function buildCard(ev, status) {
    var article = el('article', 'event-card' + (status === 'past' ? ' event-card--past' : ''));

    var head = el('div', 'event-card-head');

    head.appendChild(dateBlock(ev.date));

    var chip = el('span', 'events-chip ' + (status === 'past' ? 'events-chip--archived' : 'events-chip--kind'));
    chip.textContent = status === 'past' ? 'Archived' : (KIND_LABELS[ev.kind] || 'Event');
    head.appendChild(chip);

    article.appendChild(head);

    var title = el('h3', 'event-card__title');
    title.textContent = ev.title || 'Untitled event';
    article.appendChild(title);

    var metaParts = [];
    if (ev.venue) metaParts.push(ev.venue);
    if (ev.city) metaParts.push(ev.city);
    var timeLabel = formatTime(ev.date);
    if (timeLabel && status === 'upcoming') metaParts.push(timeLabel);
    if (metaParts.length) {
      var meta = el('p', 'event-card__meta');
      meta.textContent = metaParts.join(' \u00B7 ');
      article.appendChild(meta);
    }

    if (ev.blurb) {
      var blurb = el('p', 'event-card__blurb');
      blurb.textContent = ev.blurb;
      article.appendChild(blurb);
    }

    if (status === 'upcoming') {
      var actions = el('div', 'event-card__actions');
      if (ev.code) {
        var registerA = el('a', 'btn btn-primary btn-sm');
        registerA.href = '/interest/?event=' + encodeURIComponent(ev.code);
        registerA.textContent = 'Register interest';
        actions.appendChild(registerA);
      }
      if (isSafeUrl(ev.url)) {
        var extA = el('a', 'btn btn-ghost-dark btn-sm');
        extA.href = ev.url;
        extA.target = '_blank';
        extA.rel = 'noopener';
        extA.textContent = 'Event page';
        var sr = el('span', 'sr-only');
        sr.textContent = ' (opens in new tab)';
        extA.appendChild(sr);
        actions.appendChild(extA);
      }
      if (actions.childNodes.length) article.appendChild(actions);
    }

    return article;
  }

  function dateBlock(dateStr) {
    var wrap = el('div', 'event-date-block');
    if (!dateStr) {
      var tba = el('span', 'event-date-block__day');
      tba.textContent = '\u00B7\u00B7\u00B7';
      wrap.appendChild(tba);
      return wrap;
    }
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) {
      var unk = el('span', 'event-date-block__day');
      unk.textContent = '\u00B7\u00B7\u00B7';
      wrap.appendChild(unk);
      return wrap;
    }
    var day = el('span', 'event-date-block__day');
    day.textContent = String(d.getUTCDate());
    var month = el('span', 'event-date-block__month');
    month.textContent = MONTHS[d.getUTCMonth()];
    wrap.appendChild(day);
    wrap.appendChild(month);
    return wrap;
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
    if (h === 0 && m === 0) return '';
    var hh = h % 12 === 0 ? 12 : h % 12;
    var mm = m < 10 ? '0' + m : String(m);
    var ampm = h < 12 ? 'am' : 'pm';
    return (m === 0 ? hh : hh + ':' + mm) + ampm;
  }

  function isSafeUrl(u) {
    if (!u || typeof u !== 'string') return false;
    return /^https:\/\//i.test(u);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }
})();
