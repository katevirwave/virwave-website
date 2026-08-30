type Decision = "Ship" | "Ship with conditions" | "Fix before release" | "Stop" | "Escalate";

const TONE: Record<Decision, string> = {
  Ship: "var(--pass)",
  "Ship with conditions": "var(--review)",
  "Fix before release": "var(--fail)",
  Stop: "var(--fail)",
  Escalate: "var(--review)",
};

export function RecommendationBanner({
  decision,
  reason,
}: {
  decision: Decision;
  reason: string;
}) {
  return (
    <div className="w-full border border-rule bg-panel px-6 py-6">
      <p className="flex items-center gap-3 font-display text-[28px] font-medium leading-tight tracking-[-0.03em] text-ink">
        <span
          aria-hidden
          className="inline-block size-[6px] shrink-0"
          style={{ backgroundColor: TONE[decision] }}
        />
        {decision}
      </p>
      <p className="mt-2 max-w-[62ch] text-muted">{reason}</p>
    </div>
  );
}
