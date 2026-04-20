import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function HostDashboard({ params }: { params: { code: string } }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/host");

  const { data: event } = await supabase
    .from("events")
    .select("id, code, title, subtitle, mode, status, capacity")
    .eq("code", params.code)
    .eq("host_id", user.id)
    .maybeSingle();

  if (!event) return notFound();

  const { data: summary } = await supabase.rpc("host_room_summary", { p_event_id: event.id });
  const row = summary?.[0] ?? { total_participants: 0, realms: {} };

  return (
    <main className="shell-wide">
      <p className="eyebrow">{event.mode} · {event.status}</p>
      <h1>{event.title}</h1>
      {event.subtitle && <p className="muted">{event.subtitle}</p>}

      <section style={{ marginTop: "var(--sp-8)" }}>
        <h2 style={{ fontSize: "1.25rem" }}>Room</h2>
        <p>
          <span style={{ fontSize: "2rem", fontWeight: 600 }}>{row.total_participants}</span>{" "}
          <span className="muted">scanned in</span>
          {event.capacity && <span className="muted"> · capacity {event.capacity}</span>}
        </p>
        <div className="card" style={{ marginTop: "var(--sp-4)" }}>
          <p className="eyebrow">Realms</p>
          {Object.keys(row.realms || {}).length === 0 ? (
            <p className="muted">No participants matched yet.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "var(--sp-2)", marginTop: "var(--sp-3)" }}>
              {Object.entries(row.realms as Record<string, number>).map(([realm, count]) => (
                <li key={realm} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{realm}</span>
                  <span className="muted">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="muted" style={{ marginTop: "var(--sp-8)", fontSize: "0.875rem" }}>
        Match actions (reveal pairs / push table assignments) land here next. v1 is manual.
      </p>
    </main>
  );
}
