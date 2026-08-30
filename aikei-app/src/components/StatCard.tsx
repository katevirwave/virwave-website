export function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="cut px-6 py-8">
      <p className="font-display text-[48px] font-medium leading-none tracking-[-0.03em] text-ink">
        {value}
      </p>
      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-faint">
        {label}
      </p>
    </div>
  );
}
