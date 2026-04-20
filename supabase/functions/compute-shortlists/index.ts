/**
 * VirWave — Singles Group Scoring
 * Supabase Edge Function: compute-shortlists
 *
 * Retargeted to this repo's schema:
 *   table: events (not events_live)
 *   column: host_id (not host_user_id)
 *   status check: 'ended' | 'archived' (not 'closed')
 *
 * Deploy:
 *   supabase functions deploy compute-shortlists
 *
 * Invoke:
 *   POST /functions/v1/compute-shortlists
 *   Authorization: Bearer <host JWT>
 *   Body: { "event_id": "uuid" }
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface RequestBody {
  event_id: string;
}

interface SuccessResponse {
  ok: true;
  event_id: string;
  shortlist_rows_written: number;
  cohesion_score: number | null;
  family_distribution: Array<{ family: string; n: number }>;
  computed_at: string;
}

interface ErrorResponse {
  ok: false;
  error: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: SuccessResponse | ErrorResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const eventId = body.event_id;
  if (!eventId || typeof eventId !== 'string') {
    return json({ ok: false, error: 'event_id is required' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ ok: false, error: 'Missing Authorization header' }, 401);
  }

  // RLS-respecting client — verifies caller is the host
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // Table is 'events'; host column is 'host_id' (not host_user_id)
  const { data: eventRow, error: eventErr } = await userClient
    .from('events')
    .select('id, host_id, status')
    .eq('id', eventId)
    .single();

  if (eventErr || !eventRow) {
    return json({ ok: false, error: 'Event not found or not accessible' }, 403);
  }

  // Status enum: draft | upcoming | live | ended | archived (no 'closed')
  if (eventRow.status === 'ended' || eventRow.status === 'archived') {
    return json({ ok: false, error: 'Event is closed; recomputation disabled' }, 409);
  }

  // Service-role client bypasses RLS for the compute (reads raw event_answers)
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: rowsWritten, error: computeErr } = await serviceClient
    .rpc('compute_event_shortlists', { p_event_id: eventId });

  if (computeErr) {
    console.error('compute_event_shortlists failed', computeErr);
    return json({ ok: false, error: `Compute failed: ${computeErr.message}` }, 500);
  }

  const [{ data: cohesion }, { data: distribution }] = await Promise.all([
    serviceClient.rpc('event_cohesion_score', { p_event_id: eventId }),
    serviceClient.rpc('event_family_distribution', { p_event_id: eventId }),
  ]);

  return json({
    ok: true,
    event_id: eventId,
    shortlist_rows_written: rowsWritten ?? 0,
    cohesion_score: cohesion ?? null,
    family_distribution: (distribution ?? []) as Array<{ family: string; n: number }>,
    computed_at: new Date().toISOString(),
  });
});
