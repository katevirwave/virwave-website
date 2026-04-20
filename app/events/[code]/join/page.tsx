import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import JoinFlow from "./JoinFlow";
import { notFound } from "next/navigation";

export default async function JoinPage({ params }: { params: { code: string } }) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Look up the event by code. RLS lets anyone read published events.
  const { data: event, error } = await supabase
    .from("events")
    .select("id, code, title, subtitle, starts_at, venue, city, status, mode")
    .eq("code", params.code)
    .in("status", ["upcoming", "live"])
    .maybeSingle();

  if (error || !event) return notFound();

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <main className="shell">
      <p className="eyebrow">You&apos;re joining</p>
      <h1>{event.title}</h1>
      {event.subtitle && <p className="muted">{event.subtitle}</p>}
      <div className="card">
        <JoinFlow event={event} initialUser={user} />
      </div>
      <p className="muted" style={{ fontSize: "0.875rem" }}>
        By joining you agree to share a first name with other attendees in the room.
      </p>
    </main>
  );
}
