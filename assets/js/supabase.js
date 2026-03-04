/* ============================================================
   VirWave — Supabase Client (lightweight, no SDK)
   Uses the PostgREST API directly via fetch.
   
   Config is loaded from /_supabase.json so keys aren't 
   hardcoded in JS files. The anon key is public by design —
   it only allows what RLS policies permit.
   ============================================================ */

var VWSupabase = (function () {
  'use strict';

  var _config = null;

  /**
   * Load Supabase config from /_supabase.json
   * Returns { url, anonKey } or null if unavailable.
   */
  async function getConfig() {
    if (_config) return _config;
    try {
      var base = (window.VW && window.VW.getBasePath) ? window.VW.getBasePath() : '/';
      var res = await fetch(base + '_supabase.json');
      if (!res.ok) return null;
      _config = await res.json();
      return _config;
    } catch {
      return null;
    }
  }

  /**
   * Insert a row into a table via the PostgREST API.
   * @param {string} table - Table name (e.g., 'event_interest')
   * @param {object} data - Row data to insert
   * @returns {{ ok: boolean, error?: string }}
   */
  async function insert(table, data) {
    var config = await getConfig();
    if (!config || !config.url || !config.anonKey) {
      return { ok: false, error: 'Supabase not configured. Check _supabase.json.' };
    }

    try {
      var res = await fetch(config.url + '/rest/v1/' + table, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.anonKey,
          'Authorization': 'Bearer ' + config.anonKey,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(data)
      });

      if (res.ok) {
        return { ok: true };
      }

      // Try to parse error
      var errBody = await res.json().catch(function () { return {}; });
      var msg = errBody.message || errBody.msg || ('HTTP ' + res.status);

      // Handle duplicate (unique constraint on email_normalized + event_code)
      if (res.status === 409 || (errBody.code === '23505')) {
        return { ok: false, error: 'duplicate', message: 'You\'ve already signed up with this email. We\'ll be in touch!' };
      }

      return { ok: false, error: msg };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  return {
    getConfig: getConfig,
    insert: insert
  };
})();

if (typeof window !== 'undefined') {
  window.VWSupabase = VWSupabase;
}
