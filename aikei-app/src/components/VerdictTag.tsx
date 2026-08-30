export function VerdictTag({ verdict }: { verdict: "fail" | "review" | "pass" }) {
  const color =
    verdict === "fail"
      ? "var(--fail)"
      : verdict === "review"
        ? "var(--review)"
        : "var(--pass)";
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em]">
      <span
        aria-hidden
        className="inline-block size-[6px]"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{verdict}</span>
    </span>
  );
}
