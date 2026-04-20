// Supabase Edge Function: compute-shortlists
//
// POST /functions/v1/compute-shortlists
// Body: { "event_id": "<uuid>" }
// Auth: host JWT (Bearer) or service role.
//
// Wraps the compute_event_shortlists() Postgres function. The DB function
// is SECURITY DEFINER, but we still verify here that the caller is the
// event host before promoting the call to service role — keeps raw
// answers untouchable by anyone but the server.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY         = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "auth_required" }, 401);
  }

  let body: { event_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const eventId = body?.event_id;
  if (!eventId || typeof eventId !== "string") {
    return json({ error: "event_id_required" }, 400);
  }

  // 1. Verify caller as host of this event (or accept service role).
  const caller = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth:   { persistSession: false },
  });

  const { data: userData, error: userErr } = await caller.auth.getUser();
  if (userErr || !userData?.user) {
    // Could also be service_role token — try a DB-side check.
    const token = authHeader.slice("Bearer ".length);
    if (token !== SUPABASE_SERVICE_ROLE_KEY) {
      return json({ error: "auth_failed" }, 401);
    }
  } else {
    const { data: ownsEvent, error: checkErr } = await caller
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("host_id", userData.user.id)
      .maybeSingle();

    if (checkErr) return json({ error: "authz_check_failed" }, 500);
    if (!ownsEvent) return json({ error: "not_authorized" }, 403);
  }

  // 2. Promote to service role and run the orchestrator.
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data, error } = await admin.rpc("compute_event_shortlists", {
    p_event_id: eventId,
  });

  if (error) {
    return json({ error: "compute_failed", detail: error.message }, 500);
  }

  return json({ event_id: eventId, rows_written: data ?? 0 });
});
