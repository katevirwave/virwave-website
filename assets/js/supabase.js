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
      if (res.ok) return { ok: true };
      var errBody = await res.json().catch(function () { return {}; });
      var msg = errBody.message || errBody.msg || ('HTTP ' + res.status);
      if (res.status === 409 || errBody.code === '23505') {
        return { ok: false, error: 'duplicate', message: "You've already signed up with this email. We'll be in touch!" };
      }
      return { ok: false, error: msg };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Upload a file to a private Supabase Storage bucket.
   * Content-Type is locked to 'application/pdf' matching the bucket config.
   * Bucket RLS must allow anon INSERT on the given path pattern.
   * @param {string} bucket - e.g. 'resumes'
   * @param {string} path   - e.g. 'event-interest/{uuid}.pdf'
   * @param {File}   file   - File object from <input type="file">
   * @returns {{ ok: boolean, path?: string, error?: string }}
   */
  async function uploadFile(bucket, path, file) {
    var config = await getConfig();
    if (!config || !config.url || !config.anonKey) {
      return { ok: false, error: 'Supabase not configured.' };
    }
    var encodedPath = String(path || '').split('/').map(encodeURIComponent).join('/');
    try {
      var res = await fetch(
        config.url + '/storage/v1/object/' + encodeURIComponent(bucket) + '/' + encodedPath,
        {
          method: 'POST',
          headers: {
            'apikey': config.anonKey,
            'Authorization': 'Bearer ' + config.anonKey,
            'Content-Type': 'application/pdf',
            'x-upsert': 'false'
          },
          body: file
        }
      );
      if (res.ok) return { ok: true, path: path };
      var errBody = await res.json().catch(function () { return {}; });
      return { ok: false, error: errBody.message || errBody.error || ('HTTP ' + res.status) };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Delete a file from a private Supabase Storage bucket.
   * Used for best-effort cleanup when DB insert fails after upload.
   * @param {string} bucket
   * @param {string} path
   * @returns {{ ok: boolean, error?: string }}
   */
  async function deleteFile(bucket, path) {
    var config = await getConfig();
    if (!config || !config.url || !config.anonKey) {
      return { ok: false, error: 'Supabase not configured.' };
    }
    try {
      var res = await fetch(config.url + '/storage/v1/object/' + encodeURIComponent(bucket), {
        method: 'DELETE',
        headers: {
          'apikey': config.anonKey,
          'Authorization': 'Bearer ' + config.anonKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prefixes: [path] })
      });
      if (res.ok) return { ok: true };
      var errBody = await res.json().catch(function () { return {}; });
      return { ok: false, error: errBody.message || errBody.error || ('HTTP ' + res.status) };
    } catch (err) {
      return { ok: false, error: err.message || 'Network error' };
    }
  }

  return {
    getConfig: getConfig,
    insert: insert,
    uploadFile: uploadFile,
    deleteFile: deleteFile
  };
})();
