"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Step = "email" | "otp";

export default function HostSignIn() {
  const supabase = createClient();
  const router = useRouter();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
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
    router.refresh();
  }

  if (step === "email") {
    return (
      <form onSubmit={sendCode} style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className="field">
          <label htmlFor="host-email">Email</label>
          <input
            id="host-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <p className="muted" style={{ fontSize: "0.875rem" }}>
          Host accounts are invite-only. If your email isn&apos;t registered yet, reach out.
        </p>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy || !email}>
          {busy ? "Sending..." : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} style={{ display: "grid", gap: "var(--sp-4)" }}>
      <div className="field">
        <label htmlFor="host-code">Six-digit code</label>
        <input
          id="host-code"
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
    </form>
  );
}
