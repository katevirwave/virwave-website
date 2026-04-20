"use client";

import { useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

type Event = {
  id: string;
  code: string;
  title: string;
  mode: "tables" | "pairs";
};

type Step = "email" | "otp" | "profile" | "joined";

export default function JoinFlow({
  event,
  initialUser,
}: {
  event: Event;
  initialUser: User | null;
}) {
  const supabase = createClient();

  const [step, setStep] = useState<Step>(initialUser ? "profile" : "email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [optInPortrait, setOptInPortrait] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("otp");
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("profile");
  }

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.rpc("join_event", {
      p_event_id: event.id,
      p_first_name: firstName,
      p_opt_in_portrait: optInPortrait,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("joined");
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className="field">
          <label htmlFor="email">Your email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <p className="muted" style={{ fontSize: "0.875rem" }}>
          We&apos;ll send a six-digit code. Your email becomes your VirWave account.
        </p>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !email}>
          {busy ? "Sending..." : "Send code"}
        </button>
      </form>
    );
  }

  if (step === "otp") {
    return (
      <form onSubmit={verifyCode} style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className="field">
          <label htmlFor="code">Six-digit code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || code.length !== 6}>
          {busy ? "Verifying..." : "Verify"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => { setStep("email"); setCode(""); setError(null); }}
        >
          Use a different email
        </button>
      </form>
    );
  }

  if (step === "profile") {
    return (
      <form onSubmit={join} style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className="field">
          <label htmlFor="first-name">First name</label>
          <input
            id="first-name"
            type="text"
            required
            maxLength={40}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <label style={{ display: "flex", gap: "var(--sp-3)", alignItems: "flex-start", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={optInPortrait}
            onChange={(e) => setOptInPortrait(e.target.checked)}
            style={{ marginTop: "0.25rem" }}
          />
          <span className="muted" style={{ fontSize: "0.875rem" }}>
            Let tonight&apos;s answers add to my VirWave portrait. Untick to keep this event separate.
          </span>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !firstName}>
          {busy ? "Joining..." : "Join the room"}
        </button>
      </form>
    );
  }

  return (
    <div style={{ textAlign: "center", display: "grid", gap: "var(--sp-4)" }}>
      <p className="eyebrow">You&apos;re in</p>
      <h2>Hi {firstName || "there"}.</h2>
      <p className="muted">
        Sit tight. The questions will appear here when the host is ready.
      </p>
    </div>
  );
}
