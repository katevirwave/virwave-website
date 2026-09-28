/* VirWave — lightweight event tracking on top of Vercel Web Analytics.
   Page views are recorded by /_vercel/insights/script.js automatically.
   This adds named click events (store badges, apply, share, etc.):
   - any element with data-track="event_name"
   - any App Store / Google Play link, even without data-track
   Custom events need a Vercel Pro plan; on Hobby they are ignored harmlessly. */
(function () {
  'use strict';
  function send(name, data) {
    try { if (window.va) window.va('event', { name: name, data: data || {} }); } catch (e) { /* never block navigation */ }
  }
  var params = new URLSearchParams(window.location.search);
  var ref = (params.get('ref') || params.get('code') || '').toUpperCase();
  var utm = params.get('utm_source') || '';
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a, button');
    if (!el) return;
    var name = el.getAttribute('data-track');
    var href = el.getAttribute('href') || '';
    if (!name) {
      if (href.indexOf('apps.apple.com') !== -1) name = 'store_click_ios';
      else if (href.indexOf('play.google.com') !== -1) name = 'store_click_android';
      else if (href.indexOf('affiliates.virwave.com') !== -1) name = 'affiliate_portal_click';
      else return;
    }
    send(name, { page: window.location.pathname, ref: ref, utm_source: utm });
  }, true);
})();
