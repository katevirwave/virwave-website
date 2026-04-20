import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import HostSignIn from "./HostSignIn";
import Link from "next/link";

export default async function HostHome() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="shell">
        <p className="eyebrow">Hosts</p>
        <h1>Sign in to your event.</h1>
        <div className="card">
          <HostSignIn />
        </div>
      </main>
    );
  }

  const { data: events } = await supabase
    .from("events")
    .select("code, title, subtitle, starts_at, status, mode")
    .eq("host_id", user.id)
    .order("starts_at", { ascending: false });

  return (
    <main className="shell-wide">
      <p className="eyebrow">Hosts</p>
      <h1>Your events</h1>
      {!events || events.length === 0 ? (
        <p className="muted">You don&apos;t host any events yet.</p>
      ) : (
        <ul style={{ display: "grid", gap: "var(--sp-4)", listStyle: "none", padding: 0 }}>
          {events.map((e) => (
            <li key={e.code} className="card">
              <p className="eyebrow">{e.status} · {e.mode}</p>
              <h2 style={{ fontSize: "1.25rem", marginTop: "var(--sp-2)" }}>{e.title}</h2>
              {e.subtitle && <p className="muted">{e.subtitle}</p>}
              <Link href={`/host/${e.code}`} className="btn btn-ghost" style={{ marginTop: "var(--sp-4)" }}>
                Open dashboard
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
