import { Link } from "@tanstack/react-router";

export function LegalPage({
  eyebrow,
  title,
  paragraphs,
}: {
  eyebrow: string;
  title: string;
  paragraphs: string[];
}) {
  return (
    <div className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-[1120px] items-center justify-between px-6 py-6">
        <Link to="/" className="font-display text-[22px] text-ink no-underline">
          AIKEI
        </Link>
        <Link to="/" className="text-[15px] text-teal">
          Home
        </Link>
      </header>
      <div className="border-t border-rule" />
      <main className="mx-auto max-w-[1120px] px-6 py-24">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-6 text-[56px] leading-[1.02]">{title}</h1>
        <div className="mt-8 max-w-[62ch] space-y-5 text-muted">
          {paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </main>
      <div className="border-t border-rule" />
      <footer className="mx-auto flex max-w-[1120px] items-center justify-between px-6 py-8">
        <span className="font-display text-[22px] text-ink">AIKEI</span>
        <span className="text-[11px] text-muted">AIKEI by VirWave</span>
      </footer>
    </div>
  );
}
